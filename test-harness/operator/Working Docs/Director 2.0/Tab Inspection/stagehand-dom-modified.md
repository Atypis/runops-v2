# Stagehand DOM Processing Analysis for Director 2.0

## 1. What We Care About: POV Generation for LLMs

**FOCUS**: We only care about the **Page-View Generation** mechanism - the process that creates the text representation of a web page that gets fed to the LLM. Everything else (natural language APIs, agents, caching, etc.) is irrelevant.

**The Goal**: Extract and potentially modify Stagehand's POV generation to:
- Maintain the excellent accessibility tree processing
- Include stable DOM selectors (id, data-*, classes) in the LLM context
- Provide Director with both clean LLM context AND selector visibility

## 2. Stagehand's Current POV Generation Process

### **2.1 High-Level Pipeline**

```
Raw Page → Accessibility Tree → Filtered Tree → Formatted Text → LLM
```

### **2.2 Detailed Process Flow**

#### **Step 1: Accessibility Tree Extraction**
**File**: `lib/a11y/utils.ts` - `getAccessibilityTree()` function (lines 489-573)

```typescript
// Uses Chrome DevTools Protocol to get accessibility tree
const { nodes: fullNodes } = await stagehandPage.sendCDP<{
  nodes: AXNode[];
}>("Accessibility.getFullAXTree", params, sessionFrame);
```

**What happens**: 
- Calls CDP `Accessibility.getFullAXTree` to get raw accessibility nodes
- Each node contains: role, name, description, value, properties (DOM attributes)
- Automatically excludes invisible elements (display:none, etc.)

#### **Step 2: DOM Mapping** 
**File**: `lib/a11y/utils.ts` - `buildBackendIdMaps()` function (lines 129-255)

```typescript
// Creates mapping from CDP backendNodeIds to XPaths and tag names
const { tagNameMap, xpathMap } = await buildBackendIdMaps(stagehandPage, targetFrame);
```

**What happens**:
- Walks the DOM tree via CDP `DOM.getDocument`
- Creates `tagNameMap`: backendNodeId → HTML tag name
- Creates `xpathMap`: encodedId → XPath selector
- **CRITICAL**: This generates the stable selectors but doesn't surface them to LLM

#### **Step 3: Tree Building & Filtering**
**File**: `lib/a11y/utils.ts` - `buildHierarchicalTree()` function (lines 336-431)

```typescript
// Filters and structures accessibility nodes
const keep = node.name?.trim() || node.childIds?.length || isInteractive(node);

// Only keeps nodes that are:
const isInteractive = (n: AccessibilityNode) =>
  n.role !== "none" && n.role !== "generic" && n.role !== "InlineTextBox";
```

**What happens**:
- Filters nodes based on interactivity and content
- Removes structural noise (generic divs, none roles, etc.)
- Creates hierarchical tree with parent-child relationships
- **PRESERVES** all node properties including DOM attributes

#### **Step 4: Text Formatting (THE BOTTLENECK)**
**File**: `lib/a11y/utils.ts` - `formatSimplifiedTree()` function (lines 82-103)

```typescript
export function formatSimplifiedTree(
  node: AccessibilityNode & { encodedId?: EncodedId },
  level = 0,
): string {
  const indent = "  ".repeat(level);
  const idLabel = node.encodedId ?? node.nodeId;
  const namePart = node.name ? `: ${cleanText(node.name)}` : "";
  
  // 🚨 THIS IS THE PROBLEM LINE
  const currentLine = `${indent}[${idLabel}] ${node.role}${namePart}\n`;
  
  const childrenLines = node.children
    ?.map((c) => formatSimplifiedTree(c as typeof node, level + 1))
    .join("") ?? "";

  return currentLine + childrenLines;
}
```

**What happens**:
- **Line 96 creates the final LLM output**: `[0-123] button: Submit`
- **ONLY USES**: encodedId, role, name (accessible name)
- **IGNORES**: description, value, properties (where DOM attributes live!)

#### **Step 5: LLM Consumption**
**File**: `lib/handlers/observeHandler.ts` - `observe()` function (line 110)

```typescript
const observationResponse = await observe({
  instruction,
  domElements: combinedTree,  // ← This is the formatted text from step 4
  llmClient,
  requestId,
  // ...
});
```

## 3. The Problem: Stable Selectors Are Filtered Out

### **3.1 What We Need vs What LLM Gets**

**What Director Needs:**
```
[0-123] button#submit-btn[data-qa="submit"]: Submit
[1-456] input#email[type="email"][data-testid="login-email"]: Email
```

**What LLM Currently Gets:**
```
[0-123] button: Submit  
[1-456] textbox: Email
```

### **3.2 Where The Data Gets Lost**

#### **The Data IS Available**
**File**: `types/context.ts` - `AccessibilityNode` interface (lines 22-39)

```typescript
export type AccessibilityNode = {
  role: string;                    // ✅ Used by formatSimplifiedTree  
  name?: string;                   // ✅ Used by formatSimplifiedTree
  description?: string;            // ❌ Ignored by formatSimplifiedTree
  value?: string;                  // ❌ Ignored by formatSimplifiedTree  
  properties?: {                   // ❌ IGNORED - Contains DOM attributes!
    name: string;
    value: {
      type: string;
      value?: string;
    };
  }[];
  // ... other fields
};
```

#### **The Bottleneck Function**
**File**: `lib/a11y/utils.ts` - `formatSimplifiedTree()` line 96

```typescript
// 🚨 THIS LINE DETERMINES EVERYTHING THE LLM SEES
const currentLine = `${indent}[${idLabel}] ${node.role}${namePart}\n`;
```

**Problem**: This line only uses 3 fields and completely ignores `node.properties` which contains:
- `id` attributes
- `data-qa`, `data-testid` attributes  
- `class` attributes
- `aria-*` attributes
- Form attributes (`type`, `name`, etc.)

### **3.3 Stable Selectors DO Exist (But Are Hidden)**

**The selectors ARE generated** in parallel by:

**File**: `lib/dom/xpathUtils.ts` - `generateXPathsForElement()` function

```typescript
// This generates stable XPaths with attribute priority:
const attributePriority = [
  "data-qa",        // Highest priority
  "data-component", 
  "data-role",
  "role",
  "aria-role", 
  "type",
  "name",
  "aria-label",
  "placeholder",
  "title",
  "alt"             // Lowest priority
];

// ID-based XPaths are generated:
async function generatedIdBasedXPath(element: ChildNode): Promise<string | null> {
  if (isElementNode(element) && element.id) {
    return `//*[@id='${element.id}']`;  // Perfect stable selector!
  }
  return null;
}
```

**The Problem**: These selectors exist in `xpathMap` but are never shown to the LLM.

## 4. Exact Modification Strategy

### **4.1 Single Point of Control**

**Target**: `lib/a11y/utils.ts` - `formatSimplifiedTree()` function, specifically **line 96**

This is the ONLY place that determines LLM output format.

### **4.2 Modification Approach**

#### **Option A: Enhance formatSimplifiedTree**

```typescript
export function formatSimplifiedTree(
  node: AccessibilityNode & { encodedId?: EncodedId },
  level = 0,
): string {
  const indent = "  ".repeat(level);
  const idLabel = node.encodedId ?? node.nodeId;
  const namePart = node.name ? `: ${cleanText(node.name)}` : "";
  
  // 🆕 NEW: Extract key DOM attributes
  const attributePart = extractKeyAttributes(node.properties);
  
  // 🆕 MODIFIED: Include attributes in output
  const currentLine = `${indent}[${idLabel}] ${node.role}${attributePart}${namePart}\n`;
  
  const childrenLines = node.children
    ?.map((c) => formatSimplifiedTree(c as typeof node, level + 1))
    .join("") ?? "";

  return currentLine + childrenLines;
}

// 🆕 NEW: Helper function to extract stable selectors
function extractKeyAttributes(properties?: Array<{name: string, value: any}>): string {
  if (!properties) return "";
  
  // 🔥 ENHANCED: Scout-proven automation attribute list (20 attributes)
  // Based on battle-tested Scout browser-use patches for RPA/automation
  const keyAttrs = [
    // Test Framework Hooks (Priority 1 - Highest stability for automation)
    "data-testid", "data-test", "data-cy", "data-qa", "data-pw", 
    "data-test-id", "data-automation", "data-automation-id", "data-selenium",
    
    // Core Identifiers (Priority 2)
    "id",
    
    // Component/Role Markers (Priority 3)  
    "data-component", "data-role", "data-field",
    
    // Accessibility Hooks (Priority 4)
    "aria-labelledby", "aria-describedby", "aria-controls",
    
    // Navigation & Forms (Priority 5)
    "href", "formcontrolname", "autocomplete",
    
    // Analytics & Tracking (Priority 6)
    "data-track",
    
    // Traditional Form Attributes (Priority 7)
    "type", "name", "class"
  ];
  
  const attrs = properties
    .filter(p => keyAttrs.includes(p.name) && p.value?.value)
    .map(p => {
      const name = p.name;
      const value = p.value.value;
      return name === "id" ? `#${value}` : 
             name === "class" ? `.${value.split(' ').join('.')}` :
             name === "href" ? `[href="${value}"]` :
             `[${name}="${value}"]`;
    })
    .join("");
    
  return attrs;
}
```

#### **Result:**
```typescript
// Before (Current Stagehand):
[0-123] button: Submit
[1-456] textbox: Email

// After (Scout-Enhanced):
[0-123] button#submit-btn[data-testid="form-submit"][data-qa="submit"]: Submit
[1-456] input#email[data-cy="email-input"][type="email"]: Email  
[2-789] a[href="/login"][data-automation="login-link"]: Login
```

### **4.3 Alternative: Dual Output Approach**

If we want to keep clean LLM context separate from selector info:

```typescript
// Modify TreeResult interface in types/context.ts
export interface TreeResult {
  tree: AccessibilityNode[];
  simplified: string;           // Clean LLM context
  enrichedSimplified: string;   // 🆕 With selectors  
  selectorInfo: Record<EncodedId, {  // 🆕 Selector metadata
    xpath: string;
    attributes: Record<string, string>;
    stability: "high" | "medium" | "low";
  }>;
  iframes?: AccessibilityNode[];
  idToUrl: Record<EncodedId, string>;
  xpathMap: Record<EncodedId, string>;
}
```

### **4.4 Files That Need Modification**

#### **Primary Target:**
- `lib/a11y/utils.ts` - `formatSimplifiedTree()` function (line 96)

#### **Optional Enhancements:**
- `types/context.ts` - Extend `TreeResult` interface for dual output
- `lib/handlers/observeHandler.ts` - Use enriched output for Director

#### **Dependencies (NO CHANGES NEEDED):**
- `lib/dom/xpathUtils.ts` - Already generates stable selectors perfectly
- `buildBackendIdMaps()` - Already creates xpath mappings
- `buildHierarchicalTree()` - Already preserves all node properties

## 5. Implementation Summary

**The Fix**: Change ONE line in ONE function (`formatSimplifiedTree` line 96) to include DOM attributes from `node.properties` using Scout's proven automation attribute list.

**Scout Attribute Alignment**: Leverages the battle-tested 20-attribute list from Scout's browser-use patches, providing comprehensive coverage of:
- Test framework hooks (Cypress, Playwright, Selenium)  
- RPA automation markers
- Accessibility selectors
- Form and navigation attributes

**Impact**: 
- ✅ Maintains all existing Stagehand functionality
- ✅ Preserves excellent accessibility tree processing  
- ✅ Adds comprehensive stable selector visibility for Director
- ✅ Aligns with proven Scout reconnaissance patterns
- ✅ Minimal code change with maximum RPA automation coverage

**Integration Strategy**: Extract modified Stagehand POV generation for Director's tab inspection system, incorporating Scout's enhanced attribute discovery for consistent selector-based workflow construction.

**Next Steps**: 
1. Fork Stagehand and apply the single-line modification
2. Add Scout's `extractKeyAttributes` helper function  
3. Test with Director's workflow construction pipeline
4. Maintain consistency between Scout reconnaissance and Director automation