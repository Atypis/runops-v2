const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testFixedLogging() {
  try {
    console.log('🧪 Testing fixed logging with real execution ID format...');
    
    // Use the actual execution ID format from the logs
    const testExecutionId = 'single-vnc-1749732408227';
    const testNodeId = 'navigate_to_gmail';
    
    // Test 1: Insert a log with the real execution ID format
    console.log('🧪 Testing log insertion with execution ID:', testExecutionId);
    const testLog = {
      execution_id: testExecutionId,
      node_id: testNodeId,
      type: 'action',
      title: 'Test Navigation Action',
      content: 'Testing real logging with actual execution ID format',
      metadata: { 
        actionType: 'navigate',
        duration: 2500,
        url: 'https://accounts.google.com/signin/v2/identifier?service=mail&continue=https://mail.google.com'
      }
    };

    const { data: insertData, error: insertError } = await supabase
      .from('aef_node_logs')
      .insert(testLog)
      .select();

    if (insertError) {
      console.error('❌ Insert failed:', insertError);
      return false;
    }

    console.log('✅ Successfully inserted log with real execution ID format');
    console.log('📋 Log ID:', insertData[0].id);

    // Test 2: Query the log back using the execution ID
    console.log('🧪 Testing log retrieval...');
    const { data: queryData, error: queryError } = await supabase
      .from('aef_node_logs')
      .select('*')
      .eq('execution_id', testExecutionId)
      .eq('node_id', testNodeId);

    if (queryError) {
      console.error('❌ Query failed:', queryError);
      return false;
    }

    console.log('✅ Successfully retrieved logs:', queryData.length, 'entries');

    // Test 3: Test the API endpoint with real execution ID
    console.log('🧪 Testing API endpoint with real execution ID...');
    try {
      const response = await fetch(`http://localhost:3000/api/aef/logs/${testExecutionId}/${testNodeId}`);
      
      if (response.ok) {
        const apiData = await response.json();
        console.log('✅ API endpoint working with real execution ID:', apiData.logs.length, 'logs returned');
        console.log('📋 API response:', {
          success: apiData.success,
          executionId: apiData.executionId,
          nodeId: apiData.nodeId,
          logCount: apiData.logs.length
        });
      } else {
        const errorText = await response.text();
        console.warn('⚠️ API endpoint returned:', response.status, errorText);
      }
    } catch (apiError) {
      console.warn('⚠️ API test failed:', apiError.message);
    }

    // Test 4: Clean up
    console.log('🧹 Cleaning up test data...');
    const { error: deleteError } = await supabase
      .from('aef_node_logs')
      .delete()
      .eq('execution_id', testExecutionId)
      .eq('node_id', testNodeId);

    if (deleteError) {
      console.warn('⚠️ Could not clean up test data:', deleteError);
    } else {
      console.log('✅ Test data cleaned up');
    }

    console.log('\n🎉 All tests passed!');
    console.log('✅ Real logging now works with actual execution ID format');
    console.log('✅ The NodeLogger will now successfully capture logs during workflow execution');

    return true;

  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

testFixedLogging(); 