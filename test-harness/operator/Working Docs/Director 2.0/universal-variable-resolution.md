# Universal Variable Resolution Implementation Plan

## Executive Summary

Enable template variable resolution (`{{variable}}` syntax) for ALL node types in the workflow executor, not just iteration/group contexts. This allows the Director to use variables directly in any node parameter without requiring workaround nodes.

## Problem Statement

Currently, template variables are only resolved when nodes execute within iteration or group contexts. This forces the Director to create unnecessary intermediate nodes (context/transform) to prepare values that could be directly referenced.

### Example of Current Limitation
```javascript
// ❌ This doesn't work (variables not resolved)
{
  type: "browser_action",
  config: {
    action: "navigate",
    url: "https://google.com/search?q={{extract_first_product_title.title}}"
  }
}

// ✅ Current workaround (requires extra node)
{
  type: "context",
  config: {
    operation: "set",
    key: "search_url",
    value: "https://google.com/search?q={{extract_first_product_title.title}}"
  }
}
// Then navigate to {{search_url}}
```

## Implementation Details

### 1. Core Change Location
**File**: `backend/services/nodeExecutor.js`  
**Line**: 432-437  
**Method**: `executeNode()`

### 2. Code Changes

#### Current Code
```javascript
// Resolve template variables in params if we're in an iteration or group context
let resolvedParams = node.params;
if (this.iterationContext.length > 0 || this.groupContext.length > 0) {
  console.log(`[EXECUTE] Resolving template variables in context`);
  resolvedParams = await this.resolveNodeParams(node.params, workflowId);
  console.log(`[EXECUTE] Resolved params:`, JSON.stringify(resolvedParams, null, 2));
}
```

#### New Code
```javascript
// Always resolve template variables in params
let resolvedParams = node.params;
if (node.params) {
  console.log(`[EXECUTE] Resolving template variables`);
  resolvedParams = await this.resolveNodeParams(node.params, workflowId);
  console.log(`[EXECUTE] Resolved params:`, JSON.stringify(resolvedParams, null, 2));
}
```

### 3. Impact Analysis

#### Affected Node Types
All node types will now support template resolution:
- ✅ `browser_action` - Navigate with dynamic URLs, click dynamic selectors
- ✅ `browser_query` - Extract with dynamic instructions
- ✅ `transform` - Already had partial support, now consistent
- ✅ `cognition` - Dynamic prompts based on workflow state
- ✅ `context` - Already manually resolved, will continue working
- ✅ `route` - Dynamic routing conditions
- ✅ `agent` - Dynamic goals

#### No Breaking Changes
- Existing workflows continue to function identically
- Nodes without templates pass through unchanged
- Context nodes that manually resolve will resolve twice (harmless)

### 4. Testing Scenarios

#### Test 1: Basic Browser Action
```javascript
// Extract a value
{
  type: "browser_query",
  config: { method: "extract", instruction: "Get product title" },
  alias: "get_title"
}

// Navigate using the extracted value
{
  type: "browser_action",
  config: {
    action: "navigate",
    url: "https://google.com/search?q={{get_title.title}}"
  }
}
```

#### Test 2: Dynamic Selectors
```javascript
// Click using a stored selector
{
  type: "browser_action",
  config: {
    action: "click",
    selector: "{{stored_selectors.submit_button}}"
  }
}
```

#### Test 3: Nested Resolution
```javascript
// Type text from nested path
{
  type: "browser_action",
  config: {
    action: "type",
    selector: "#search",
    text: "{{extract_data.products[0].name}}"
  }
}
```

### 5. Director Prompt Updates

Add to the Director prompt after variable reference section:

```
**Direct Variable Usage in All Nodes:**
With universal variable resolution, you can use {{variables}} directly in ANY node parameter:
- Navigate: `url: "https://site.com/search?q={{product.name}}"`
- Click: `selector: "{{dynamic_selectors.button}}"`
- Type: `text: "{{user_data.email}}"`
- Extract: `instruction: "Find {{search_term}} in the table"`

No need for intermediate context/transform nodes just to prepare values!
```

## Benefits

1. **Simpler Workflows**: Fewer nodes needed for the same functionality
2. **Intuitive Patterns**: Directors can use variables naturally
3. **Better Performance**: Skip unnecessary intermediate nodes
4. **Consistent Behavior**: All nodes work the same way
5. **Future Proof**: New node types automatically get variable support

## Rollout Plan

1. **Phase 1**: Implement the code change
2. **Phase 2**: Test with sample workflows
3. **Phase 3**: Update Director documentation
4. **Phase 4**: Monitor for any edge cases

## Success Metrics

- Directors create 30% fewer nodes for variable-heavy workflows
- Zero regression issues reported
- Positive feedback on simplified workflow building

## Potential Concerns & Mitigations

### Performance Impact
**Concern**: Resolving variables for every node adds overhead  
**Mitigation**: The resolution is fast (regex replacement) and only processes nodes with `{{}}` patterns

### Double Resolution
**Concern**: Context nodes already resolve internally  
**Mitigation**: Double resolution is harmless - the second pass finds no templates to replace

### Error Handling
**Concern**: Invalid variable references in more places  
**Mitigation**: Existing error handling in `resolveTemplateVariables` already provides clear messages