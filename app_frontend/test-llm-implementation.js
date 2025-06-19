const { config } = require('dotenv');
config();

// Test the LLM Call node implementation
async function testLLMCallImplementation() {
  console.log('🧪 Testing LLM Call Node Implementation...\n');

  const testWorkflow = {
    "id": "test-llm-workflow",
    "name": "Test LLM Call Workflow",
    "description": "Test workflow to verify LLM call functionality",
    "version": "1.0.0",
    "nodes": [
      {
        "id": "start",
        "type": "start",
        "data": {
          "name": "Start",
          "description": "Start of the workflow"
        },
        "position": { "x": 100, "y": 100 }
      },
      {
        "id": "llm-test",
        "type": "llm_call",
        "data": {
          "name": "Test LLM Call",
          "description": "Test LLM call with simple prompt",
          "prompt": "What is 2 + 2? Answer with just the number.",
          "model": "claude-3-haiku-20241022",
          "max_tokens": 50,
          "temperature": 0.1
        },
        "position": { "x": 300, "y": 100 }
      },
      {
        "id": "end",
        "type": "end",
        "data": {
          "name": "End",
          "description": "End of the workflow"
        },
        "position": { "x": 500, "y": 100 }
      }
    ],
    "edges": [
      {
        "id": "start-to-llm",
        "source": "start",
        "target": "llm-test"
      },
      {
        "id": "llm-to-end",
        "source": "llm-test",
        "target": "end"
      }
    ]
  };

  try {
    // Test the workflow execution
    console.log('📤 Testing workflow execution...');
    const response = await fetch('http://localhost:3000/api/aef/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ workflow: testWorkflow })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    console.log('✅ Execution started successfully');
    console.log('📋 Execution ID:', result.executionId);
    
    // Wait a moment for execution to process
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check execution status
    console.log('\n📊 Checking execution status...');
    const statusResponse = await fetch(`http://localhost:3000/api/aef/execution/${result.executionId}/status`);
    
    if (statusResponse.ok) {
      const status = await statusResponse.json();
      console.log('Status:', status.status);
      console.log('Progress:', status.progress);
      
      if (status.results && status.results.length > 0) {
        console.log('\n📄 Node Results:');
        status.results.forEach(nodeResult => {
          console.log(`  Node ${nodeResult.nodeId}:`, nodeResult.status);
          if (nodeResult.result) {
            console.log(`    Result:`, nodeResult.result);
          }
          if (nodeResult.error) {
            console.log(`    Error:`, nodeResult.error);
          }
        });
      }
    } else {
      console.log('❌ Could not fetch execution status');
    }

    // Test individual LLM call action
    console.log('\n🔧 Testing individual LLM action...');
    const actionResponse = await fetch('http://localhost:3000/api/aef/action/llm-test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: {
          type: 'llm_call',
          data: {
            prompt: 'What is the capital of France? Answer in one word.',
            model: 'claude-3-haiku-20241022',
            max_tokens: 10,
            temperature: 0
          }
        },
        context: {}
      })
    });

    if (actionResponse.ok) {
      const actionResult = await actionResponse.json();
      console.log('✅ Individual action test successful');
      console.log('📝 LLM Response:', actionResult.result);
    } else {
      const errorText = await actionResponse.text();
      console.log('❌ Individual action test failed:', errorText);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testLLMCallImplementation().then(() => {
  console.log('\n🏁 Test completed');
}).catch(console.error); 