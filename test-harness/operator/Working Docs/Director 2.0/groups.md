# Groups Feature Documentation

## Overview

The Groups feature provides a simple, text-based interface for users to execute multiple workflow nodes as a batch. This feature is available in the **Groups tab** of the operator UI and allows users to:

1. Execute node ranges using Director-style syntax
2. Save frequently used node selections for one-click execution
3. Manage saved groups (view, execute, delete)

## Why This Feature Exists

Previously, the GROUP node type existed in the workflow system, allowing Director to create nodes that would execute a range of other nodes. However, this added unnecessary complexity:

- Director already had the `execute_nodes` tool for testing node ranges
- Users needed a simpler way to test and re-run node selections
- The GROUP node type was redundant and confusing

The new Groups feature replaces the GROUP node type entirely, providing the same functionality through a clean UI that reuses Director's existing `executeNodes` capability.

## How It Works

### Frontend Interface

Located in the **Groups tab**, the interface consists of:

1. **Execute Node Range** section:
   - Text input field for node selection
   - Execute button (▶)
   - Save button (💾)
   - Format examples

2. **Saved Groups** section:
   - List of saved groups with names and descriptions
   - One-click Run button for each group
   - Delete button for group management

### Node Selection Syntax

The same syntax Director uses in `execute_nodes`:

- **Single node**: `5`
- **Range**: `3-5` (executes nodes 3, 4, and 5)
- **Multiple selections**: `1-3,10,15-17` (executes 1-3, 10, and 15-17)
- **All nodes**: `all`

### Backend Implementation

#### API Endpoints

1. **Execute Range**
   ```
   POST /api/director/execute-range
   Body: {
     workflowId: string,
     nodeSelection: string,
     resetBrowserFirst?: boolean
   }
   ```

2. **Save Group**
   ```
   POST /api/director/workflows/:workflowId/groups
   Body: {
     name: string,
     nodeSelection: string,
     description?: string
   }
   ```

3. **List Saved Groups**
   ```
   GET /api/director/workflows/:workflowId/saved-groups
   Response: {
     groups: Array<{
       id: string,
       name: string,
       nodeSelection: string,
       description: string,
       createdAt: string
     }>
   }
   ```

4. **Delete Group**
   ```
   DELETE /api/director/workflows/:workflowId/groups/:groupId
   ```

### Storage

Saved groups are stored in the `workflow_memory` table with keys formatted as:
```
saved_group_<sanitized_name>
```

## Usage Examples

### Basic Execution

1. Click on the Groups tab
2. Enter `1-5` in the text field
3. Click Execute or press Enter
4. View results in the execution logs

### Saving a Group

1. Enter a node selection (e.g., `1-10`)
2. Click the Save button
3. Enter a name: "Login Flow"
4. Enter a description: "Complete Gmail login with 2FA"
5. Click Save Group

### Running Saved Groups

1. Find the group in the Saved Groups list
2. Click the "▶ Run" button
3. Execution starts immediately

## Implementation Details

### Key Design Decisions

1. **Text-based input**: Matches Director's experience exactly, no need for complex UI
2. **Reuses existing backend**: Calls `directorService.executeNodes()` directly
3. **Simple storage**: Uses workflow_memory table, no new database schema
4. **No GROUP node type**: Completely removes the redundant node type

### Code Organization

- **Backend**: Routes added to `/backend/routes/director.js`
- **Frontend**: `GroupsViewer` component in `/frontend/app.js`
- **No new services**: Reuses existing Director service methods

## Migration from GROUP Nodes

The GROUP node type has been completely removed from:
- System prompts (directorPromptV3.js)
- Tool definitions (toolDefinitionsV2.js)
- Node executor (still handles legacy groups for backward compatibility)

Existing GROUP nodes in workflows will continue to work but Director can no longer create new ones. Users should use the Groups tab instead for the same functionality.

## Benefits

1. **Simplicity**: One less node type to understand
2. **Direct execution**: No need to create nodes just to execute ranges
3. **Reusability**: Save and re-run common node selections
4. **Consistency**: Uses the same syntax as Director's execute_nodes
5. **Performance**: No overhead of creating/managing GROUP nodes

## Future Enhancements

Potential improvements (not yet implemented):
- Visual node selection with checkboxes
- Keyboard shortcuts (Ctrl+G for groups)
- Group execution history
- Parameterized groups (with variable substitution)
- Export/import saved groups