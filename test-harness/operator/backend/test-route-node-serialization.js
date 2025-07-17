import { supabase } from './config/supabase.js';

async function testRouteNodeSerialization() {
  console.log('Testing route node array serialization...\n');
  
  // Test data - route node with array config
  const routeConfig = [
    { name: "branch1", condition: "{{test}} > 5", branch: 10 },
    { name: "branch2", condition: "{{test}} <= 5", branch: 20 },
    { name: "default", condition: "true", branch: 30 }
  ];
  
  console.log('Original config (should be array):');
  console.log(JSON.stringify(routeConfig, null, 2));
  console.log('Type:', Array.isArray(routeConfig) ? 'Array' : 'Object');
  console.log('');
  
  // Create a test workflow
  const { data: workflow, error: workflowError } = await supabase
    .from('workflows')
    .insert({ goal: 'Test route node serialization', status: 'building' })
    .select()
    .single();
    
  if (workflowError) {
    console.error('Error creating workflow:', workflowError);
    process.exit(1);
  }
  
  console.log('Created test workflow:', workflow.id);
  
  // Insert a route node with array config
  const nodeData = {
    workflow_id: workflow.id,
    position: 1,
    type: 'route',
    params: routeConfig,  // This is an array
    description: 'Test route node',
    status: 'pending',
    alias: 'test_route'
  };
  
  console.log('\nInserting node with params:');
  console.log('Type of params:', Array.isArray(nodeData.params) ? 'Array' : 'Object');
  console.log('');
  
  const { data: insertedNode, error: insertError } = await supabase
    .from('nodes')
    .insert(nodeData)
    .select()
    .single();
    
  if (insertError) {
    console.error('Error inserting node:', insertError);
    process.exit(1);
  }
  
  console.log('Node inserted successfully, ID:', insertedNode.id);
  console.log('\nRetrieved params from insert response:');
  console.log(JSON.stringify(insertedNode.params, null, 2));
  console.log('Type:', Array.isArray(insertedNode.params) ? 'Array' : 'Object');
  
  // Fetch the node again to see how it's stored
  const { data: fetchedNode, error: fetchError } = await supabase
    .from('nodes')
    .select('*')
    .eq('id', insertedNode.id)
    .single();
    
  if (fetchError) {
    console.error('Error fetching node:', fetchError);
    process.exit(1);
  }
  
  console.log('\nFetched node params:');
  console.log(JSON.stringify(fetchedNode.params, null, 2));
  console.log('Type:', Array.isArray(fetchedNode.params) ? 'Array' : 'Object');
  
  // Check raw SQL query
  const { data: rawData, error: rawError } = await supabase.rpc('', {
    query: `SELECT params, jsonb_typeof(params) as params_type FROM nodes WHERE id = ${insertedNode.id}`
  }).single();
  
  if (!rawError && rawData) {
    console.log('\nRaw database check:');
    console.log('JSONB type in database:', rawData.params_type);
  }
  
  // Cleanup
  await supabase.from('nodes').delete().eq('workflow_id', workflow.id);
  await supabase.from('workflows').delete().eq('id', workflow.id);
  
  console.log('\nTest completed. Cleanup done.');
  
  // Summary
  console.log('\n=== SUMMARY ===');
  console.log('Original data was:', Array.isArray(routeConfig) ? 'Array' : 'Object');
  console.log('Insert response showed:', Array.isArray(insertedNode.params) ? 'Array' : 'Object');
  console.log('Fetched data showed:', Array.isArray(fetchedNode.params) ? 'Array' : 'Object');
  
  if (!Array.isArray(fetchedNode.params)) {
    console.log('\n❌ ISSUE CONFIRMED: Array was converted to object!');
    console.log('This appears to be happening in the Supabase client or PostgreSQL JSONB handling.');
  } else {
    console.log('\n✅ No issue found - array was preserved correctly.');
  }
}

testRouteNodeSerialization().catch(console.error);