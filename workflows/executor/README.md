# StateManager

A comprehensive state management system for workflow execution with support for nested paths, mutation tracking, and template resolution.

## Features

- **Nested Path Access**: Access and modify deeply nested values using dot notation (e.g., `user.profile.name`)
- **Array Support**: Handle array indices with both bracket and dot notation (e.g., `items[0].name` or `items.0.name`)
- **Template Resolution**: Resolve `{{variable}}` templates with automatic path lookup
- **Mutation Tracking**: Track all state changes for debugging and auditing
- **Snapshots**: Create and restore state snapshots for checkpointing
- **Type Safety**: Comprehensive error handling and validation
- **Immutability**: All operations maintain immutability through deep cloning

## Installation

```javascript
const StateManager = require('./state-manager');
```

## Basic Usage

```javascript
// Initialize with initial state
const state = new StateManager({
  user: {
    name: 'John Doe',
    email: 'john@example.com'
  }
});

// Get values
const userName = state.get('user.name'); // 'John Doe'
const email = state.get('user.email'); // 'john@example.com'

// Set values
state.set('user.age', 30);
state.set('preferences.theme', 'dark'); // Creates nested structure

// Check existence
if (state.has('user.email')) {
  console.log('Email exists');
}

// Delete values
state.delete('user.age');
```

## API Reference

### Constructor

```javascript
new StateManager(initialState = {})
```

Creates a new StateManager instance with optional initial state.

### Methods

#### `get(path)`
Retrieves a value at the specified path.

```javascript
state.get('user.profile.name'); // Returns value or undefined
state.get('items[0].id'); // Array access
state.get(''); // Returns entire state
```

#### `set(path, value)`
Sets a value at the specified path, creating intermediate objects as needed.

```javascript
state.set('user.name', 'Jane'); // true on success
state.set('items[0].active', true); // Creates array if needed
```

#### `getAll()`
Returns a deep clone of the entire state.

```javascript
const fullState = state.getAll();
```

#### `clear()`
Removes all state data.

```javascript
state.clear(); // Returns true on success
```

#### `has(path)`
Checks if a path exists in the state.

```javascript
state.has('user.email'); // true or false
```

#### `delete(path)`
Removes a value at the specified path.

```javascript
state.delete('user.preferences'); // true on success
```

#### `merge(path, object)`
Merges an object into the state at the specified path.

```javascript
state.merge('user', { age: 31, city: 'NYC' });
state.merge('', { newProp: 'value' }); // Merge at root
```

#### `resolveTemplate(template)`
Resolves template variables in a string.

```javascript
state.set('user.name', 'John');
state.resolveTemplate('Hello {{user.name}}!'); // 'Hello John!'
state.resolveTemplate('Welcome {{state.user.name}}'); // 'Welcome John'
```

#### `resolveTemplates(object)`
Recursively resolves all template strings in an object.

```javascript
const template = {
  to: '{{user.email}}',
  subject: 'Hello {{user.name}}',
  body: {
    greeting: 'Dear {{user.name}}'
  }
};
const resolved = state.resolveTemplates(template);
```

#### `getMutationHistory(limit = 50)`
Returns recent state mutations for debugging.

```javascript
const history = state.getMutationHistory(10);
// Returns array of mutation records with timestamp, operation, path, oldValue, newValue
```

#### `createSnapshot()`
Creates a snapshot of the current state.

```javascript
const snapshot = state.createSnapshot();
// Returns { timestamp, state, mutationCount }
```

#### `restoreSnapshot(snapshot)`
Restores state from a snapshot.

```javascript
state.restoreSnapshot(snapshot); // true on success
```

## Advanced Examples

### Working with Arrays

```javascript
// Initialize with array data
const state = new StateManager({
  todos: [
    { id: 1, text: 'Task 1', done: false },
    { id: 2, text: 'Task 2', done: true }
  ]
});

// Access array elements
state.get('todos[0].text'); // 'Task 1'
state.get('todos.1.done'); // true

// Modify array elements
state.set('todos[0].done', true);
state.set('todos[2]', { id: 3, text: 'Task 3', done: false });

// Delete array elements
state.delete('todos[1]'); // Removes element and adjusts indices
```

### Template Resolution in Workflows

```javascript
const state = new StateManager({
  currentEmail: {
    sender: 'investor@vc.com',
    subject: 'Investment Opportunity'
  },
  user: {
    name: 'John',
    company: 'StartupCo'
  }
});

// Email template
const emailTemplate = {
  to: '{{currentEmail.sender}}',
  subject: 'Re: {{currentEmail.subject}}',
  body: `Hi {{user.name}} from {{user.company}},
  
  Thanks for your email about "{{currentEmail.subject}}".`
};

const resolved = state.resolveTemplates(emailTemplate);
// Resolves all template variables
```

### Mutation Tracking for Debugging

```javascript
const state = new StateManager();

// Perform operations
state.set('step', 1);
state.set('status', 'processing');
state.set('step', 2);
state.set('status', 'complete');

// View mutation history
const history = state.getMutationHistory();
history.forEach(mutation => {
  console.log(`${mutation.timestamp}: ${mutation.operation} ${mutation.path}`);
  console.log(`  Old: ${JSON.stringify(mutation.oldValue)}`);
  console.log(`  New: ${JSON.stringify(mutation.newValue)}`);
});
```

### Workflow Checkpointing

```javascript
const state = new StateManager({ workflowStep: 1 });

// Create checkpoint before risky operation
const checkpoint = state.createSnapshot();

try {
  // Risky operations
  state.set('workflowStep', 2);
  state.set('data', await fetchData());
  
  // More operations...
  
} catch (error) {
  // Restore to checkpoint on error
  state.restoreSnapshot(checkpoint);
  console.log('Restored to checkpoint');
}
```

## Best Practices

1. **Use Descriptive Paths**: Use clear, hierarchical paths that reflect your data structure
2. **Avoid Direct State Mutation**: Always use the provided methods to modify state
3. **Handle Undefined Values**: Check if paths exist with `has()` before accessing
4. **Use Templates for Dynamic Values**: Leverage template resolution for configuration
5. **Track Important Changes**: Use mutation history for debugging complex workflows
6. **Create Snapshots at Checkpoints**: Snapshot before critical operations for recovery
7. **Clean Up Large States**: Clear unused data to prevent memory issues

## Performance Considerations

- Deep cloning is used to maintain immutability, which has a performance cost
- Mutation history is limited to prevent unbounded growth (default: 1000 entries)
- Template resolution uses regex matching, cache frequently used templates if needed
- For very large state objects, consider splitting into multiple StateManager instances

## Error Handling

All methods include comprehensive error handling:
- Invalid paths return `undefined` for get operations
- Set/delete operations return `false` on failure
- Template resolution preserves unresolved variables
- Type validation prevents invalid operations

## Testing

Run the test suite:

```bash
node state-manager.test.js
```

Run the example workflow:

```bash
node state-manager.example.js
```