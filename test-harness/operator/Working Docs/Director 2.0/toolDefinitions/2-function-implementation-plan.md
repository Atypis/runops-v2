# Two-Function Node Operations Implementation Plan

## Executive Summary

After deep analysis of the Director 2.0 codebase, I propose consolidating the current 4 node operation functions into 2 elegant functions. This plan outlines the approach, identifies key design decisions, and provides a clear implementation path.

## Current State Analysis

### Existing Functions
1. **`create_node`** - Adds nodes at the end of workflow
2. **`insert_node_at`** - Inserts nodes at specific position
3. **`update_node`** - Modifies existing node properties
4. **`delete_node`** - Removes nodes with dependency handling

### Key Findings
- All functions already support both single and multiple node operations
- Each has ~36 duplicated schema definitions across node types
- Position management varies by operation (append vs insert vs shift)
- Delete has complex dependency handling for control flow nodes
- Aliases are mandatory and serve as stable references

## Proposed Solution: Two Functions

### 1. `add_or_replace_nodes`
Handles create, insert, and update operations based on target type.

```javascript
{
  target: "end" | number | string,  // Determines operation type
  nodes: [{
    type: "browser_action" | "transform" | ...,
    config: { /* node-specific config */ },
    alias: "unique_identifier",
    description?: "optional description"
  }]
}
```

**Target Behavior**:
- `"end"` → Append to workflow (replace create_node)
- `number` → Insert at position, shifting others (replace insert_node_at)
- `string` (UUID/alias) → Replace existing node (replace update_node)

### 2. `delete_nodes`
Maintains current delete functionality with its complex dependency handling.

```javascript
{
  nodeIds: string[],  // Array of node IDs or aliases to delete
  options?: {
    handleDependencies?: boolean,  // default: true
    deleteChildren?: boolean,      // default: false
    dryRun?: boolean              // default: false
  }
}
```

## Implementation Approach

### Phase 1: Tool Definition Updates

1. **Create new schema in `toolDefinitionsV2.js`**:
   - Define `add_or_replace_nodes` with unified node schema
   - Keep `delete_nodes` largely unchanged
   - Use strict mode with proper JSON Schema

2. **Schema Design Decisions**:
   - ✅ Always use arrays (no single vs multiple duplication)
   - ✅ Single node schema definition used everywhere
   - ✅ Clear target discrimination via type checking

### Phase 2: Backend Implementation

1. **Create new handler in `directorService.js`**:
   ```javascript
   async addOrReplaceNodes(args, workflowId) {
     const { target, nodes } = args;
     
     // Target type detection
     if (target === "end") {
       return this.createNodesAtEnd(nodes, workflowId);
     } else if (typeof target === "number") {
       return this.insertNodesAt(nodes, target, workflowId);
     } else if (typeof target === "string") {
       return this.replaceNodes(nodes, target, workflowId);
     }
     
     throw new Error(`Invalid target: ${target}`);
   }
   ```

2. **Refactor existing methods**:
   - Extract core logic from current methods
   - Create shared validation functions
   - Maintain all current business rules

### Phase 3: Director Prompt Updates

1. **Update system prompt** to explain new functions:
   - Clear examples for each target type
   - Migration guide from old to new
   - Emphasize the unified mental model

2. **Provide extensive examples**:
   ```javascript
   // Append nodes (old: create_node)
   add_or_replace_nodes({
     target: "end",
     nodes: [{type: "browser_action", config: {...}, alias: "nav"}]
   })
   
   // Insert at position (old: insert_node_at)
   add_or_replace_nodes({
     target: 5,
     nodes: [{type: "transform", config: {...}, alias: "clean"}]
   })
   
   // Replace node (old: update_node)
   add_or_replace_nodes({
     target: "validate_form",  // by alias
     nodes: [{type: "browser_query", config: {...}, alias: "validate_form"}]
   })
   ```

### Phase 4: Migration Strategy

1. **Parallel Operation**:
   - Keep old functions working during transition
   - Add new functions alongside
   - Monitor usage patterns

2. **Gradual Deprecation**:
   - Update Director prompt to prefer new functions
   - Add deprecation warnings to old functions
   - Remove after verification period

## Key Design Decisions & Trade-offs

### Decision 1: Target Type Discrimination
**Options**:
1. Use separate parameter (e.g., `operation: "append" | "insert" | "replace"`)
2. Use target value type inference ✅

**Choice**: Target type inference
**Reasoning**: 
- More intuitive: "put these nodes at [location]"
- Reduces parameters
- Natural mapping: end → append, number → position, string → node reference

### Decision 2: Node Reference for Replace
**Options**:
1. Only accept node ID (integer)
2. Accept alias or UUID ✅
3. Accept any unique identifier

**Choice**: Accept alias or UUID
**Reasoning**:
- Aliases are already mandatory and unique
- Director primarily uses aliases for references
- More flexible for users

### Decision 3: Keep Delete Separate
**Options**:
1. Merge into single "manage_nodes" function
2. Keep delete as separate function ✅

**Choice**: Keep separate
**Reasoning**:
- Delete has fundamentally different semantics
- Complex dependency handling doesn't fit "add/replace" mental model
- Clearer intent and safer operations

### Decision 4: Return Value Consistency
**Options**:
1. Different return formats based on operation
2. Unified return format ✅

**Choice**: Unified format
**Reasoning**:
```javascript
{
  success: true,
  operation: "append" | "insert" | "replace",
  nodes: [...],  // Resulting nodes
  message: "Human-readable summary"
}
```

## Benefits of This Approach

1. **Eliminates Duplication**: From ~144 schema definitions to ~12
2. **Intuitive Mental Model**: "Put nodes somewhere" vs "Remove nodes"
3. **Backwards Compatible**: Can run in parallel with old functions
4. **Future Proof**: Easy to extend with new target types
5. **Consistent**: Always work with arrays of nodes

## Potential Challenges & Mitigations

### Challenge 1: Director Retraining
**Risk**: Director may struggle with new pattern
**Mitigation**: 
- Extensive examples in prompt
- Clear migration mappings
- Keep old functions available initially

### Challenge 2: Target Ambiguity
**Risk**: String numbers could be position or ID
**Mitigation**:
- Document clearly: numbers are positions, strings are references
- Add validation to detect and warn about ambiguous cases

### Challenge 3: Error Message Clarity
**Risk**: Generic function = generic errors
**Mitigation**:
- Detect operation type early
- Provide operation-specific error messages
- Include examples in error text

## Implementation Timeline

1. **Week 1**: 
   - Implement `toolDefinitionsV2.js` with new schemas
   - Create backend handlers
   - Write comprehensive tests

2. **Week 2**:
   - Update Director prompts with examples
   - Run parallel testing
   - Monitor for issues

3. **Week 3**:
   - Gradual rollout
   - Deprecation warnings on old functions
   - Documentation updates

4. **Week 4**:
   - Full transition
   - Remove old functions
   - Final cleanup

## Next Steps

1. **Approval**: Review and approve this plan
2. **Prototype**: Implement in `toolDefinitionsV2.js`
3. **Backend**: Create new handlers
4. **Test**: Comprehensive testing suite
5. **Deploy**: Gradual rollout with monitoring

## Alternative Consideration

If we want to be even more radical, we could go to a single function:

```javascript
manage_nodes({
  operation: "add" | "replace" | "delete",
  target: "end" | number | nodeRef | nodeRefs[],
  nodes?: [...],  // Required for add/replace
  options?: {...}  // For delete options
})
```

However, this adds complexity without significant benefit and makes the schema more convoluted with conditional requirements.

## Recommendation

Proceed with the 2-function approach as it provides the optimal balance of:
- Simplicity
- Clarity of intent  
- Flexibility
- Backwards compatibility

The consolidation from 4 to 2 functions captures 90% of the deduplication benefit while maintaining clear semantics and safe operations.