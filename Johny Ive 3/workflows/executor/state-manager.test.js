const StateManager = require('./state-manager');

/**
 * Comprehensive test suite for StateManager
 * Run with: node state-manager.test.js
 */

// Test utilities
const assert = (condition, message) => {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
};

const assertDeepEqual = (actual, expected, message) => {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  assert(actualStr === expectedStr, `${message} - Expected: ${expectedStr}, Got: ${actualStr}`);
};

console.log('🧪 Testing StateManager...\n');

// Test 1: Basic initialization
console.log('📋 Test 1: Basic initialization');
const sm1 = new StateManager();
assertDeepEqual(sm1.getAll(), {}, 'Empty initialization');

const sm2 = new StateManager({ user: { name: 'John' } });
assertDeepEqual(sm2.getAll(), { user: { name: 'John' } }, 'Initialization with data');
console.log('');

// Test 2: Get operations
console.log('📋 Test 2: Get operations');
const sm3 = new StateManager({
  user: {
    profile: {
      name: 'Alice',
      age: 30
    },
    settings: {
      theme: 'dark'
    }
  },
  items: [
    { id: 1, name: 'Item 1' },
    { id: 2, name: 'Item 2' }
  ]
});

assert(sm3.get('user.profile.name') === 'Alice', 'Get nested property');
assert(sm3.get('user.settings.theme') === 'dark', 'Get nested property 2');
assert(sm3.get('items[0].name') === 'Item 1', 'Get array element with bracket notation');
assert(sm3.get('items.1.id') === 2, 'Get array element with dot notation');
assert(sm3.get('nonexistent.path') === undefined, 'Get non-existent path returns undefined');
console.log('');

// Test 3: Set operations
console.log('📋 Test 3: Set operations');
const sm4 = new StateManager();
assert(sm4.set('user.name', 'Bob') === true, 'Set creates nested objects');
assert(sm4.get('user.name') === 'Bob', 'Verify set value');

assert(sm4.set('items[0].name', 'First Item') === true, 'Set array element');
assert(sm4.get('items[0].name') === 'First Item', 'Verify array element set');

sm4.set('deeply.nested.path.to.value', 42);
assert(sm4.get('deeply.nested.path.to.value') === 42, 'Set deeply nested value');
console.log('');

// Test 4: Template resolution
console.log('📋 Test 4: Template resolution');
const sm5 = new StateManager({
  user: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com'
  },
  currentEmail: {
    subject: 'Investment Opportunity',
    sender: 'investor@vc.com'
  },
  count: 5
});

assert(
  sm5.resolveTemplate('Hello {{user.firstName}} {{user.lastName}}!') === 'Hello John Doe!',
  'Resolve multiple variables'
);

assert(
  sm5.resolveTemplate('Email from {{currentEmail.sender}}: {{currentEmail.subject}}') === 
  'Email from investor@vc.com: Investment Opportunity',
  'Resolve email template'
);

assert(
  sm5.resolveTemplate('Count: {{count}}') === 'Count: 5',
  'Resolve numeric value'
);

assert(
  sm5.resolveTemplate('Unknown: {{unknown.variable}}') === 'Unknown: {{unknown.variable}}',
  'Keep unresolved variables'
);

assert(
  sm5.resolveTemplate('State variable: {{state.user.email}}') === 'State variable: john.doe@example.com',
  'Resolve state-prefixed variables'
);
console.log('');

// Test 5: Template resolution in objects
console.log('📋 Test 5: Template resolution in objects');
const templateObj = {
  to: '{{user.email}}',
  subject: 'Re: {{currentEmail.subject}}',
  body: 'Dear {{user.firstName}},\n\nThank you for your email about "{{currentEmail.subject}}".',
  metadata: {
    sender: '{{user.email}}',
    count: '{{count}} items'
  }
};

const resolved = sm5.resolveTemplates(templateObj);
assertDeepEqual(resolved, {
  to: 'john.doe@example.com',
  subject: 'Re: Investment Opportunity',
  body: 'Dear John,\n\nThank you for your email about "Investment Opportunity".',
  metadata: {
    sender: 'john.doe@example.com',
    count: '5 items'
  }
}, 'Resolve templates in nested object');
console.log('');

// Test 6: Clear and delete operations
console.log('📋 Test 6: Clear and delete operations');
const sm6 = new StateManager({ a: 1, b: { c: 2 }, d: [1, 2, 3] });
assert(sm6.delete('b.c') === true, 'Delete nested property');
assert(sm6.get('b.c') === undefined, 'Verify deletion');
assertDeepEqual(sm6.get('b'), {}, 'Parent object remains');

assert(sm6.delete('d[1]') === true, 'Delete array element');
assertDeepEqual(sm6.get('d'), [1, 3], 'Array element removed');

sm6.clear();
assertDeepEqual(sm6.getAll(), {}, 'Clear removes all state');
console.log('');

// Test 7: Merge operations
console.log('📋 Test 7: Merge operations');
const sm7 = new StateManager({ user: { name: 'Alice', age: 30 } });
sm7.merge('user', { age: 31, city: 'New York' });
assertDeepEqual(sm7.get('user'), { name: 'Alice', age: 31, city: 'New York' }, 'Merge at path');

sm7.merge('', { newProp: 'value' });
assert(sm7.get('newProp') === 'value', 'Merge at root');
assert(sm7.get('user.name') === 'Alice', 'Existing data preserved');
console.log('');

// Test 8: Has operation
console.log('📋 Test 8: Has operation');
const sm8 = new StateManager({ a: { b: { c: null } }, d: undefined });
assert(sm8.has('a.b.c') === true, 'Has returns true for null value');
assert(sm8.has('d') === true, 'Has returns true for undefined value');
assert(sm8.has('nonexistent') === false, 'Has returns false for non-existent path');
console.log('');

// Test 9: Mutation tracking
console.log('📋 Test 9: Mutation tracking');
const sm9 = new StateManager();
sm9.set('test', 1);
sm9.set('test', 2);
sm9.delete('test');

const history = sm9.getMutationHistory();
assert(history.length >= 3, 'Mutation history tracked');
assert(history[history.length - 3].operation === 'set', 'First mutation is set');
assert(history[history.length - 3].newValue === 1, 'First value correct');
assert(history[history.length - 2].oldValue === 1, 'Old value tracked');
assert(history[history.length - 2].newValue === 2, 'New value tracked');
assert(history[history.length - 1].operation === 'delete', 'Delete operation tracked');
console.log('');

// Test 10: Snapshots
console.log('📋 Test 10: Snapshots');
const sm10 = new StateManager({ original: 'state' });
const snapshot = sm10.createSnapshot();
sm10.set('modified', true);
assert(sm10.get('modified') === true, 'State modified');

sm10.restoreSnapshot(snapshot);
assert(sm10.get('modified') === undefined, 'Snapshot restored');
assert(sm10.get('original') === 'state', 'Original state restored');
console.log('');

// Test 11: Complex workflow example
console.log('📋 Test 11: Complex workflow example');
const workflowState = new StateManager({
  emails: [],
  currentIndex: 0,
  processedCount: 0,
  config: {
    maxEmails: 10,
    filterKeywords: ['investment', 'funding', 'capital']
  }
});

// Simulate email processing
const mockEmails = [
  { id: 1, subject: 'Investment Opportunity', sender: 'vc@example.com' },
  { id: 2, subject: 'Team Meeting', sender: 'team@example.com' },
  { id: 3, subject: 'Funding Round Update', sender: 'investor@example.com' }
];

workflowState.set('emails', mockEmails);

// Process emails
for (let i = 0; i < mockEmails.length; i++) {
  workflowState.set('currentIndex', i);
  const emailPath = `emails[${i}]`;
  const email = workflowState.get(emailPath);
  
  // Check if email matches filter
  const keywords = workflowState.get('config.filterKeywords');
  const matches = keywords.some(keyword => 
    email.subject.toLowerCase().includes(keyword)
  );
  
  if (matches) {
    workflowState.set(`${emailPath}.processed`, true);
    workflowState.set('processedCount', workflowState.get('processedCount') + 1);
  }
}

assert(workflowState.get('processedCount') === 2, 'Correct emails processed');
assert(workflowState.get('emails[0].processed') === true, 'First email processed');
assert(workflowState.get('emails[1].processed') === undefined, 'Second email not processed');
assert(workflowState.get('emails[2].processed') === true, 'Third email processed');
console.log('');

// Test 12: Error handling
console.log('📋 Test 12: Error handling');
const sm11 = new StateManager();
assert(sm11.set('', 'value') === false, 'Set with empty path fails gracefully');
assert(sm11.delete('') === false, 'Delete with empty path fails gracefully');
assert(sm11.merge('test', null) === false, 'Merge with null fails gracefully');
assert(sm11.resolveTemplate(123) === 123, 'Non-string template returns as-is');
console.log('');

console.log('🎉 All tests passed!');