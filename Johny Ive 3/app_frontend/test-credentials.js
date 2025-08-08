/**
 * Test script for the new credential management system
 * Run this to verify the Supabase integration is working
 */

const TEST_WORKFLOW_ID = 'test-investor-email-workflow';
const BASE_URL = 'http://localhost:3001';

async function testCredentialAPI() {
  console.log('🔐 Testing Credential Management System');
  console.log('=====================================');

  try {
    // Test 1: Store Gmail credentials
    console.log('\n1. Testing credential storage...');
    const storeResponse = await fetch(`${BASE_URL}/api/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        serviceType: 'gmail',
        authMethod: 'email_password',
        credentials: {
          gmail_email: 'test@example.com',
          gmail_password: 'test_password_123'
        },
        workflowId: TEST_WORKFLOW_ID
      })
    });

    if (storeResponse.ok) {
      console.log('✅ Gmail credentials stored successfully');
    } else {
      const error = await storeResponse.json();
      console.log('❌ Failed to store credentials:', error);
      return;
    }

    // Test 2: Store Airtable credentials
    console.log('\n2. Testing Airtable credential storage...');
    const airtableResponse = await fetch(`${BASE_URL}/api/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        serviceType: 'airtable',
        authMethod: 'api_key',
        credentials: {
          airtable_api_key: 'pat12345.example',
          airtable_base_id: 'appXYZ123'
        },
        workflowId: TEST_WORKFLOW_ID
      })
    });

    if (airtableResponse.ok) {
      console.log('✅ Airtable credentials stored successfully');
    } else {
      const error = await airtableResponse.json();
      console.log('❌ Failed to store Airtable credentials:', error);
    }

    // Test 3: Retrieve credentials
    console.log('\n3. Testing credential retrieval...');
    const retrieveResponse = await fetch(`${BASE_URL}/api/credentials?workflowId=${TEST_WORKFLOW_ID}`);
    
    if (retrieveResponse.ok) {
      const data = await retrieveResponse.json();
      console.log('✅ Retrieved credentials:', data.credentials.length, 'services');
      console.log('   Services found:', data.credentials.map(c => c.service_type).join(', '));
    } else {
      const error = await retrieveResponse.json();
      console.log('❌ Failed to retrieve credentials:', error);
    }

    // Test 4: Validate credentials
    console.log('\n4. Testing credential validation...');
    const validateResponse = await fetch(`${BASE_URL}/api/credentials/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workflowId: TEST_WORKFLOW_ID,
        requiredCredentials: [
          { id: 'gmail_email', serviceType: 'gmail', required: true },
          { id: 'gmail_password', serviceType: 'gmail', required: true },
          { id: 'airtable_api_key', serviceType: 'airtable', required: true },
          { id: 'airtable_base_id', serviceType: 'airtable', required: true }
        ]
      })
    });

    if (validateResponse.ok) {
      const validation = await validateResponse.json();
      console.log('✅ Validation result:', validation);
      console.log(`   Complete: ${validation.isComplete} (${validation.setCount}/${validation.totalRequired})`);
    } else {
      const error = await validateResponse.json();
      console.log('❌ Failed to validate credentials:', error);
    }

    console.log('\n🎉 Credential system test completed!');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test
testCredentialAPI(); 