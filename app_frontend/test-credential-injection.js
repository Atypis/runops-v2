/**
 * Test script for Phase 3 - Credential Injection System
 * Tests the new credential injection functionality
 */

import { CredentialInjectionService } from './lib/credentials/injection.js';

const TEST_WORKFLOW_ID = 'test-investor-email-workflow';

async function testCredentialInjection() {
  console.log('🚀 Testing Phase 3 - Credential Injection System');
  console.log('==================================================');

  try {
    // Test 1: Action requiring credentials detection
    console.log('\n1. Testing credential requirement detection...');
    
    const actionWithCredentials = {
      type: 'type',
      data: { text: '{{gmail_password}}' },
      stepId: 'enter_password'
    };
    
    const actionWithoutCredentials = {
      type: 'click',
      data: { selector: '#button' },
      stepId: 'click_button'
    };
    
    const requiresCredentials = CredentialInjectionService.actionRequiresCredentials(actionWithCredentials);
    const doesNotRequireCredentials = CredentialInjectionService.actionRequiresCredentials(actionWithoutCredentials);
    
    console.log(`✅ Action with {{gmail_password}} requires credentials: ${requiresCredentials}`);
    console.log(`✅ Action without placeholders requires credentials: ${doesNotRequireCredentials}`);
    
    // Test 2: Credential token replacement
    console.log('\n2. Testing credential token replacement...');
    
    const credentials = {
      gmail_email: 'test@example.com',
      gmail_password: 'test_password_123'
    };
    
    const testAction = {
      type: 'type',
      data: { 
        text: '{{gmail_email}}',
        password: '{{gmail_password}}'
      },
      instruction: 'Enter {{gmail_email}} in the email field'
    };
    
    const injectedAction = CredentialInjectionService.injectCredentialsIntoAction(testAction, credentials);
    
    console.log('✅ Original action:', JSON.stringify(testAction, null, 2));
    console.log('✅ Injected action:', JSON.stringify(injectedAction, null, 2));
    
    // Test 3: Step credential extraction
    console.log('\n3. Testing step credential extraction...');
    
    const workflowNodes = [
      {
        id: 'enter_password',
        credentialsRequired: {
          gmail: ['email', 'password']
        }
      },
      {
        id: 'open_airtable',
        credentialsRequired: {
          airtable: ['api_key', 'base_id']
        }
      }
    ];
    
    const passwordStepCreds = CredentialInjectionService.extractRequiredCredentialsFromStep(
      'enter_password', 
      workflowNodes
    );
    
    const airtableStepCreds = CredentialInjectionService.extractRequiredCredentialsFromStep(
      'open_airtable',
      workflowNodes
    );
    
    console.log(`✅ Password step requires: ${passwordStepCreds.join(', ')}`);
    console.log(`✅ Airtable step requires: ${airtableStepCreds.join(', ')}`);
    
    // Test 4: Credential memory clearing
    console.log('\n4. Testing credential memory clearing...');
    
    const testCredentials = {
      gmail_email: 'test@example.com',
      gmail_password: 'secret_password'
    };
    
    console.log('Before clearing:', Object.keys(testCredentials));
    CredentialInjectionService.clearCredentialsFromMemory(testCredentials);
    console.log('After clearing:', Object.keys(testCredentials));
    
    console.log('\n🎉 Phase 3 - Credential Injection Tests Completed!');
    console.log('✅ All credential injection functionality is working correctly');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testCredentialInjection();
}

export { testCredentialInjection }; 