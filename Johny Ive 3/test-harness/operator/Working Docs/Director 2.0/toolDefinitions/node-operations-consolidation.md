# Node Operations Consolidation - From 4 Functions to 2

## Problem Statement

The original toolDefinitions.js had 4 separate functions for node management:
1. `create_node` - Add nodes to the end
2. `insert_node_at` - Add nodes at specific position
3. `update_node` - Modify existing nodes
4. `delete_node` - Remove nodes

This led to massive duplication:
- Each function needed to know about all 12 node types
- `create_node` had the schema duplicated twice (single node vs array)
- Total: ~36 duplicated schemas across functions

## Evolution of Thinking

### First Insight: Single vs Multiple is Artificial
A single node is just an array with one element. Having separate schemas for:
```javascript
// Single
create_node({ type: "browser_action", config: {...}, alias: "nav" })

// Multiple  
create_node({ nodes: [{type: "browser_action", config: {...}, alias: "nav"}] })
```
...is unnecessary duplication. Solution: Always use array.

### Second Insight: Create vs Insert are the Same
- `create_node` = add nodes at end
- `insert_node_at` = add nodes at position X
- These are the same operation with different targeting!

### Third Insight: Update as Upsert
If `update_node` is a full replacement (not field-by-field editing), then:
- Insert at position X = "put these nodes here"
- Update node Y = "replace node Y with this node"
- Again, same operation with different targeting!

## The Elegant Solution: 2 Functions

### 1. `add_or_replace_nodes`
```javascript
{
  target: "end" | number | nodeId,
  nodes: [/* array of node definitions */]
}
```

**Target behavior:**
- `"end"` → Append to workflow (old create_node)
- `number` → Insert at position, shifting others (old insert_node_at)  
- `nodeId` → Replace existing node (old update_node)

### 2. `delete_nodes`
```javascript
{
  nodeIds: string[]  // Array of node IDs to delete
}
```

## Benefits

1. **Zero duplication** - Node schema defined only once
2. **Intuitive mental model** - "I want to put nodes somewhere" vs "I want to remove nodes"
3. **Flexible** - Same function handles create, insert, and update based on target
4. **Simple** - Two functions instead of four
5. **Consistent** - Always work with arrays of nodes

## Implementation Notes

- Backend needs to detect target type and route to appropriate logic
- String that looks like UUID/ID = node replacement
- Number = position insert
- "end" = append
- Validation remains the same - backend validates node schemas

## Migration Path

1. Create new toolDefinitionsV2.js with the 2-function approach
2. Update backend to handle new function signatures
3. Update system prompt to reflect new functions
4. Test thoroughly
5. Deprecate old 4-function approach

## Philosophical Note

This consolidation reveals that CRUD operations are really just:
- **PUT** - "Place this thing at this location" (create/update/insert)
- **DELETE** - "Remove this thing"

Everything else is just variations on targeting.