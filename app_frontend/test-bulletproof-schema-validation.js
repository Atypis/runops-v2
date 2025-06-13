/* Bulletproof Schema Validation Test Suite */
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

// -----------------------
// Load & compile schema
// -----------------------
const schemaPath = path.join(__dirname, 'aef/workflows/schemas/workflow-schema.json');
const workflowSchema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
const ajv = new Ajv({ allErrors: true });
const validateWorkflow = ajv.compile(workflowSchema);

// -----------------------
// Helper functions
// -----------------------
function createTestWorkflow(nodes) {
  return {
    meta: { id: 'test', title: 'test', version: '1.0.0' },
    execution: { workflow: { nodes, flow: [] } }
  };
}

function runTest(name, expectValid, wf) {
  const isValid = validateWorkflow(wf);
  const pass = (expectValid && isValid) || (!expectValid && !isValid);
  const status = pass ? 'PASS' : 'FAIL';
  console.log(`${pass ? '✅' : '❌'} ${status}: ${name}`);
  if (!pass && validateWorkflow.errors) {
    console.error(validateWorkflow.errors.map(e => `${e.instancePath}: ${e.message}`));
  }
  return pass;
}

// -----------------------
// Test definitions
// -----------------------
const tests = [];

// TEST 1 – extract_list valid
tests.push({
  name: 'extract_list with valid listConfig',
  expectValid: true,
  workflow: createTestWorkflow([
    {
      id: 't1', type: 'atomic_task', label: 't1', intent: 'demo',
      actions: [
        { type: 'extract_list', instruction: 'demo', listConfig: { itemSelector: '.row', maxItems: 10 } }
      ]
    }
  ])
});

// TEST 2 – filter_list valid
tests.push({
  name: 'filter_list with valid filterCriteria', expectValid: true,
  workflow: createTestWorkflow([
    { id: 't2', type: 'atomic_task', label: 't2', intent: 'demo',
      actions: [ { type: 'filter_list', instruction: 'demo', listConfig: { filterCriteria: { includeKeywords: ['foo'] } } } ] }
  ])
});

// TEST 3 – list_iterator valid
tests.push({
  name: 'list_iterator with iteratorConfig', expectValid: true,
  workflow: createTestWorkflow([
    { id: 't3', type: 'atomic_task', label: 't3', intent: 'demo', actions: [ { type: 'list_iterator', instruction: 'demo', iteratorConfig: { listVariable: 'listVar' } } ] }
  ])
});

// TEST 4 – assert_element valid
tests.push({ name: 'assert_element with assertConfig', expectValid: true,
  workflow: createTestWorkflow([
    { id: 't4', type: 'atomic_task', label: 't4', intent: 'demo', actions: [ { type: 'assert_element', instruction: 'demo', assertConfig: { assertionType: 'visible', selector: '#id' } } ] }
  ])
});

// TEST 5 – update_row valid
tests.push({ name: 'update_row with rowConfig', expectValid: true,
  workflow: createTestWorkflow([
    { id: 't5', type: 'atomic_task', label: 't5', intent: 'demo', actions: [ { type: 'update_row', instruction: 'demo', rowConfig: { tableName: 'tbl' } } ] }
  ])
});

// TEST 6 – create_row valid
tests.push({ name: 'create_row with rowConfig', expectValid: true,
  workflow: createTestWorkflow([
    { id: 't6', type: 'atomic_task', label: 't6', intent: 'demo', actions: [ { type: 'create_row', instruction: 'demo', rowConfig: { tableName: 'tbl' } } ] }
  ])
});

// TEST 6b – record_search_or_upsert valid
tests.push({ name: 'record_search_or_upsert with rowConfig', expectValid: true,
  workflow: createTestWorkflow([
    { id: 't6b', type: 'atomic_task', label: 't6b', intent: 'demo', actions: [ { type: 'record_search_or_upsert', instruction: 'demo', rowConfig: { tableName: 'tbl' } } ] }
  ])
});

// TEST 7 – invalid action type
tests.push({ name: 'invalid action type rejection', expectValid: false,
  workflow: createTestWorkflow([
    { id: 't7', type: 'atomic_task', label: 't7', intent: 'demo', actions: [ { type: 'bad_type', instruction: 'demo' } ] }
  ])
});

// TEST 8 – missing iteratorConfig.listVariable
tests.push({ name: 'missing required iteratorConfig.listVariable', expectValid: false,
  workflow: createTestWorkflow([
    { id: 't8', type: 'atomic_task', label: 't8', intent: 'demo', actions: [ { type: 'list_iterator', instruction: 'demo', iteratorConfig: {} } ] }
  ])
});

// TEST 9 – invalid enum value in assertConfig
tests.push({ name: 'invalid assertionType enum value', expectValid: false,
  workflow: createTestWorkflow([
    { id: 't9', type: 'atomic_task', label: 't9', intent: 'demo', actions: [ { type: 'assert_element', instruction: 'demo', assertConfig: { assertionType: 'not_valid', selector: '#id' } } ] }
  ])
});

// TEST 10 – navigate with illegal rowConfig
tests.push({ name: 'navigate action with rowConfig should fail', expectValid: false,
  workflow: createTestWorkflow([
    { id: 't10', type: 'atomic_task', label: 't10', intent: 'demo', actions: [ { type: 'navigate', instruction: 'demo', target: { url: 'http://x.com' }, rowConfig: { tableName: 'bad' } } ] }
  ])
});

// -----------------------
// Run all tests
// -----------------------
const results = tests.map(t => runTest(t.name, t.expectValid, t.workflow));
const passed = results.filter(Boolean).length;
console.log('\n' + '='.repeat(60));
console.log(`📊 TEST RESULTS: ${passed}/${tests.length} passed`);
if (passed === tests.length) {
  console.log('🎉 All schema tests passed');
  process.exit(0);
} else {
  console.error('💥 Some schema tests failed');
  process.exit(1);
}
