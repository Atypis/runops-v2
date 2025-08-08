# Stagehand Technical Analysis for Director 2.0

## Executive Summary

Stagehand is a TypeScript-based browser automation framework that leverages Accessibility Tree APIs rather than raw DOM manipulation. While it provides robust element identification and interaction capabilities, **it is fundamentally optimized for immediate action execution rather than RPA workflow construction**.

**Key Finding**: Stagehand uses natural language descriptions as its primary interaction mechanism, with XPath selectors serving as implementation details. This approach conflicts with Director 2.0's requirement for deterministic, selector-based workflow construction.

## 1. INPUT GATHERING MECHANISMS

### 1.1 DOM Snapshot Collection

**Method**: Accessibility Tree via Chrome DevTools Protocol (CDP)
- **Not raw DOM**: Uses `Accessibility.getFullAXTree` instead of DOM parsing
- **Tree Structure**: Hierarchical nodes with roles, names, and relationships
- **Data Format**: JSON tree with accessibility metadata
- **Size**: Typically 10-50KB for average pages (much smaller than raw HTML)

```typescript
// From lib/a11y/utils.ts
const { nodes: fullNodes } = await stagehandPage.sendCDP<{ nodes: AXNode[] }>(
  "Accessibility.getFullAXTree", 
  params, 
  sessionFrame
);
```

**Key Properties Captured**:
- `role`: Element's accessibility role (button, link, textbox, etc.)
- `name`: Accessible name/label
- `value`: Current value for input elements
- `backendNodeId`: CDP identifier for element lookup
- `properties`: Additional accessibility properties (URL, checked state, etc.)

**Invisible Elements**: Automatically excluded by the Accessibility API - elements with `display:none` or `visibility:hidden` are not included in the tree.

### 1.2 Screenshot Collection

**Operator Mode Only**: Screenshots are only captured in the experimental "Operator" agent mode:

```typescript
// From lib/handlers/operatorHandler.ts
const screenshot = await this.stagehandPage.page.screenshot({
  type: "png",
  fullPage: false,  // Viewport only
});
const base64Image = screenshot.toString("base64");
```

**Standard Mode**: The primary `observe()` and `act()` methods work purely with accessibility tree data - no visual processing.

### 1.3 Hybrid Integration

- **No built-in mapping**: Stagehand doesn't correlate visual elements with DOM nodes
- **Text-only approach**: The system relies on accessibility text rather than visual analysis
- **Operator mode**: Experimental visual mode sends screenshots to LLMs for analysis

## 2. PRE-PROCESSING & FILTERING STRATEGIES

### 2.1 Element Filtering

**Inclusion Criteria** (from `buildHierarchicalTree`):
```typescript
const keep = node.name?.trim() || node.childIds?.length || isInteractive(node);
```

**Interactive Definition**:
```typescript
const isInteractive = (n: AccessibilityNode) =>
  n.role !== "none" && n.role !== "generic" && n.role !== "InlineTextBox";
```

**Excluded Roles**:
- `generic`: Wrapper divs/spans without semantic meaning
- `none`: Explicitly non-interactive elements
- `InlineTextBox`: Text implementation details

### 2.2 Attribute Filtering

**Preserved Attributes** (priority order):
1. `data-qa` - QA testing selectors
2. `data-component` - Component identifiers
3. `data-role` - Custom role attributes
4. `role` - ARIA roles
5. `aria-role` - Alternative ARIA syntax
6. `type` - Input types
7. `name` - Form element names
8. `aria-label` - Accessibility labels
9. `placeholder` - Input placeholders
10. `title` - Tooltip text
11. `alt` - Image alternatives

**Removed**: All other attributes including style, class (unless stable), event handlers, etc.

### 2.3 Content Processing

**Text Cleaning** (`cleanText` function):
- Removes Private Use Area Unicode (0xE000-0xF8FF)
- Normalizes non-breaking spaces to regular spaces
- Collapses consecutive whitespace
- Trims leading/trailing spaces

**Noise Removal**:
1. **Structural Collapse**: Single-child generic wrappers are removed
2. **Redundant Text**: StaticText nodes matching parent text are filtered
3. **Generic Role Replacement**: Generic roles replaced with actual tag names when available
4. **Scrollable Detection**: Elements marked with "scrollable" prefix if overflow detected

## 3. SELECTOR STRATEGIES & RELIABILITY

### 3.1 Selector Generation

**XPath-Only Approach**: Stagehand exclusively uses XPath selectors, not CSS selectors.

**Three-Tier Strategy**:
```typescript
// Order: most accurate → most cacheable
return [standardXPath, ...(idBasedXPath ? [idBasedXPath] : []), complexXPath];
```

1. **Standard XPath**: Positional path (e.g., `/html/body/div[2]/button[1]`)
2. **ID-based XPath**: If element has ID (e.g., `//*[@id='submit-btn']`)
3. **Complex XPath**: Attribute combinations for uniqueness

### 3.2 Reliability Mechanisms

**Attribute Priority**:
```typescript
const attributePriority = [
  "data-qa",       // Highest priority - QA selectors
  "data-component",
  "data-role",
  "role",
  "aria-role",
  "type",
  "name",
  "aria-label",
  "placeholder",
  "title",
  "alt"           // Lowest priority
];
```

**Self-Healing**:
```typescript
if (!this.selfHeal || err instanceof PlaywrightCommandMethodNotSupportedException) {
  // Return failure
} else {
  // Re-observe page and fall back to natural language
  return await this.stagehandPage.act({ action: actCommand });
}
```

### 3.3 Critical Limitation for Director 2.0

**Natural Language First**: Stagehand's API is designed around natural language instructions:
```typescript
// Typical Stagehand usage
await page.act({ action: "click the login button" });
await page.observe("Find all navigation links");
```

**Selectors are Hidden**: While Stagehand generates stable XPaths internally, they're not exposed as the primary interaction mechanism. The system expects you to describe what you want, not provide selectors.

## 4. CODEBASE & INTEGRATION ANALYSIS

### 4.1 Language & Architecture

- **Language**: TypeScript
- **Runtime**: Node.js (Bun explicitly not supported)
- **Browser Framework**: Playwright
- **Package Manager**: pnpm
- **Main Dependencies**:
  - `playwright`: Browser automation
  - `@anthropic-ai/sdk`, `openai`: LLM providers
  - `zod`: Schema validation
  - `devtools-protocol`: CDP types

### 4.2 API Design

**Main Class**: `Stagehand`
```typescript
class Stagehand {
  async init(): Promise<InitResult>
  async act(options: ActOptions): Promise<ActResult>
  async observe(instruction: string): Promise<ObserveResult[]>
  async extract<T>(schema: z.ZodSchema<T>): Promise<T>
  agent(config?: AgentConfig): Agent
}
```

**Integration Pattern**:
```typescript
import { Stagehand } from '@browserbasehq/stagehand';

const stagehand = new Stagehand({
  env: "LOCAL",
  headless: false
});

await stagehand.init();
const page = stagehand.page;

// Natural language interaction
await page.act({ action: "click the submit button" });
const elements = await page.observe("Find all form inputs");
```

### 4.3 Error Handling

- **StagehandError**: Base error class
- **Specific Errors**: `ElementNotFoundError`, `XPathResolutionError`, `IframeError`
- **Self-healing**: Automatic retry with re-observation on failure
- **Fallback**: JavaScript click if Playwright click fails

## 5. CRITICAL ANALYSIS FOR DIRECTOR 2.0

### 5.1 Alignment with Director Requirements

| Director 2.0 Need | Stagehand Support | Gap Analysis |
|------------------|-------------------|--------------|
| Workflow Construction | ❌ Limited | Designed for immediate execution, not workflow building |
| Deterministic Navigation | ⚠️ Partial | Generates stable XPaths but hides them from API |
| Incremental Building | ❌ No | No workflow persistence or state management |
| RPA Optimization | ❌ No | Optimized for one-time actions, not repeatability |
| Debugging Support | ✅ Yes | Good logging and error reporting |

### 5.2 Key Architectural Mismatches

1. **Natural Language vs Selectors**: Director needs selector-first; Stagehand is description-first
2. **Immediate vs Deferred**: Stagehand executes immediately; Director needs to build workflows
3. **Hidden Implementation**: Stable selectors exist but aren't exposed in the API
4. **No Workflow Concepts**: No native support for multi-step workflow construction

### 5.3 Integration Challenges

1. **API Incompatibility**: Would need to bypass high-level API to access selectors
2. **Execution Model**: Stagehand's immediate execution conflicts with workflow building
3. **State Management**: No built-in workflow state or persistence
4. **Limited Scout Mode**: Can observe elements but returns descriptions, not selectors

## 6. RECOMMENDATIONS

### 6.1 If Using Stagehand

**Required Modifications**:
1. Fork and modify to expose XPath selectors in observe results
2. Add workflow construction layer on top
3. Implement state management for multi-step workflows
4. Create selector validation without execution

**Example Modification**:
```typescript
// Modified observe to return selectors
interface DirectorObserveResult extends ObserveResult {
  xpath: string;          // Primary XPath
  alternativeXPaths: string[];  // Fallback options
  attributes: Record<string, string>;  // Preserved attributes
}
```

### 6.2 Alternative Approach

**Build Custom Solution** leveraging Stagehand's innovations:
1. Use their accessibility tree approach (more stable than raw DOM)
2. Adopt their attribute prioritization strategy
3. Implement their XPath generation logic
4. Add Director-specific workflow layer

### 6.3 Hybrid Integration

**Use Stagehand for**:
- Page analysis and element discovery
- Accessibility tree processing
- XPath generation strategies

**Build custom for**:
- Workflow construction and persistence
- Selector-first API
- Deferred execution model
- State management

## 7. TECHNICAL INTEGRATION GUIDE

### 7.1 Accessing Internal APIs

```typescript
// Access internal selector generation
import { generateXPathsForElement } from '@browserbasehq/stagehand/dist/lib/dom/xpathUtils';
import { getAccessibilityTree } from '@browserbasehq/stagehand/dist/lib/a11y/utils';

// Get raw accessibility tree
const tree = await getAccessibilityTree(stagehandPage, logger);

// Access XPath mappings
const xpathMap = tree.xpathMap; // EncodedId -> XPath mapping
```

### 7.2 Custom Observer Implementation

```typescript
class DirectorObserver {
  async scoutPage(page: StagehandPage): Promise<DirectorElement[]> {
    // Get accessibility tree
    const tree = await getAccessibilityTree(page, console.log);
    
    // Extract elements with selectors
    return Object.entries(tree.xpathMap).map(([id, xpath]) => ({
      id,
      xpath,
      role: tree.tree.find(n => n.encodedId === id)?.role,
      name: tree.tree.find(n => n.encodedId === id)?.name,
    }));
  }
}
```

### 7.3 Workflow Construction Layer

```typescript
class DirectorWorkflow {
  private steps: WorkflowStep[] = [];
  
  addNavigationStep(xpath: string, action: string) {
    this.steps.push({
      type: 'interact',
      selector: xpath,
      method: action,
      validation: this.generateValidation(xpath)
    });
  }
  
  async execute(page: Page) {
    for (const step of this.steps) {
      await this.executeStep(page, step);
    }
  }
}
```

## CONCLUSION

Stagehand is an innovative browser automation framework with excellent element identification strategies, but it's architecturally misaligned with Director 2.0's requirements. Its natural language-first approach and immediate execution model conflict with the need for deterministic, selector-based workflow construction.

**Recommendation**: Extract Stagehand's best practices (accessibility tree usage, attribute prioritization, XPath generation) but build a custom workflow construction layer tailored to Director 2.0's RPA-focused requirements. The mismatch is fundamental enough that adapting Stagehand would require more effort than building a purpose-fit solution.