const { useState, useEffect } = React;

// Sample nodes for testing
const SAMPLE_NODES = {
  // Browser Actions
  navigate: {
    type: 'browser_action',
    method: 'goto',
    target: 'https://mail.google.com'
  },
  clickEmail: {
    type: 'browser_action',
    method: 'click',
    target: 'first email in list'
  },
  typeSearch: {
    type: 'browser_action',
    method: 'type',
    target: 'search box',
    data: 'after:2025/06/01 before:2025/06/03'
  },
  
  // Browser Queries
  extractEmails: {
    type: 'browser_query',
    method: 'extract',
    instruction: 'Extract all visible emails with subject and sender',
    schema: {
      emails: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            subject: { type: 'string' },
            sender: { type: 'string' }
          }
        }
      }
    }
  },
  
  // Cognition
  classifyEmails: {
    type: 'cognition',
    prompt: 'Which of these emails are from investors? Return boolean array.',
    input: 'state.emails',
    output: 'state.investorFlags'
  },
  
  // Transform
  filterEmails: {
    type: 'transform',
    input: 'state.emails',
    function: '(emails) => emails.filter((e, i) => state.investorFlags[i])',
    output: 'state.investorEmails'
  }
};

// Sample workflows
const SAMPLE_WORKFLOWS = {
  extractAndFilter: {
    name: 'Extract and Filter Emails',
    nodes: [
      SAMPLE_NODES.extractEmails,
      SAMPLE_NODES.classifyEmails,
      SAMPLE_NODES.filterEmails
    ]
  },
  loginFlow: {
    name: 'Gmail Login',
    nodes: [
      { type: 'browser_action', method: 'goto', target: 'https://mail.google.com' },
      { type: 'browser_action', method: 'type', target: 'email field', data: '{{email}}' },
      { type: 'browser_action', method: 'click', target: 'Next button' }
    ]
  },
  gmailInvestorCRM: {
    name: 'Gmail Investor CRM (Full)',
    nodes: [
      // Gmail Login Sequence
      {
        type: 'sequence',
        name: 'Gmail Login',
        nodes: [
          { type: 'browser_action', method: 'goto', target: 'https://accounts.google.com/signin/v2/identifier?service=mail' },
          { type: 'browser_query', method: 'extract', instruction: 'Check if account chooser is present', schema: { accountChooser: 'boolean' } },
          { type: 'route', value: 'state.accountChooser', paths: {
            'true': { type: 'browser_action', method: 'click', target: 'Use another account' },
            'false': { type: 'memory', operation: 'set', data: { 'skipChooser': true } }
          }},
          { type: 'browser_action', method: 'type', target: 'email field', data: 'michaelburner595@gmail.com' },
          { type: 'browser_action', method: 'click', target: 'Next button' },
          { type: 'browser_action', method: 'type', target: 'password field', data: 'dCdWqhgPzJev6Jz' },
          { type: 'browser_action', method: 'click', target: 'Next or Sign in button' }
        ]
      },
      // Search for June 2nd emails
      {
        type: 'sequence', 
        name: 'Search Emails',
        nodes: [
          { type: 'browser_action', method: 'click', target: 'Gmail search box' },
          { type: 'browser_action', method: 'type', target: 'search box', data: 'after:2025/06/01 before:2025/06/03' },
          { type: 'browser_action', method: 'click', target: 'search button or press Enter' }
        ]
      },
      // Extract and filter emails
      {
        type: 'browser_query',
        method: 'extract',
        instruction: 'Extract all visible emails with subject, sender, snippet',
        schema: {
          emails: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                subject: { type: 'string' },
                sender: { type: 'string' },
                snippet: { type: 'string' }
              }
            }
          }
        }
      },
      {
        type: 'memory',
        operation: 'set',
        data: { 'allEmails': 'state.emails' }
      },
      {
        type: 'cognition',
        prompt: 'Which emails are investor-related? Return boolean array matching input length.',
        input: 'state.allEmails',
        output: 'state.investorMask'
      },
      {
        type: 'transform',
        input: 'state.allEmails',
        function: '(emails) => emails.filter((e, i) => state.investorMask[i])',
        output: 'state.investorEmails'
      },
      // Process each investor email
      {
        type: 'iterate',
        over: 'state.investorEmails',
        as: 'currentEmail',
        body: {
          type: 'sequence',
          nodes: [
            // Click and extract
            { type: 'browser_action', method: 'click', target: 'email with subject {{currentEmail.subject}}' },
            { type: 'browser_query', method: 'extract', instruction: 'Extract investor details', schema: {
              name: 'string',
              company: 'string', 
              email: 'string',
              phone: 'string'
            }},
            { type: 'memory', operation: 'set', data: { 'currentInvestor': '{{result}}' } },
            // Navigate to Airtable
            { type: 'browser_action', method: 'goto', target: 'https://airtable.com/appXXX' },
            // Check if record exists
            { type: 'browser_action', method: 'type', target: 'search box', data: '{{currentInvestor.name}}' },
            { type: 'browser_query', method: 'extract', instruction: 'Check if any records found', schema: { hasRecords: 'boolean' } },
            // Route based on existence
            { type: 'route', value: 'state.hasRecords', paths: {
              'true': {
                type: 'sequence',
                name: 'Update Record',
                nodes: [
                  { type: 'browser_action', method: 'click', target: 'first record expand button' },
                  { type: 'browser_action', method: 'click', target: 'Last Interaction date field' },
                  { type: 'browser_action', method: 'type', target: 'date field', data: new Date().toISOString().split('T')[0] },
                  { type: 'browser_action', method: 'click', target: 'close modal X button' }
                ]
              },
              'false': {
                type: 'sequence',
                name: 'Create Record',
                nodes: [
                  { type: 'browser_action', method: 'click', target: 'Add record button' },
                  { type: 'browser_action', method: 'type', target: 'Name field', data: '{{currentInvestor.name}}' },
                  { type: 'browser_action', method: 'type', target: 'Email field', data: '{{currentInvestor.email}}' },
                  { type: 'browser_action', method: 'type', target: 'Company field', data: '{{currentInvestor.company}}' },
                  { type: 'browser_action', method: 'click', target: 'close modal X button' }
                ]
              }
            }},
            // Go back to Gmail and label
            { type: 'browser_action', method: 'goto', target: 'https://mail.google.com' },
            { type: 'browser_action', method: 'click', target: 'label button' },
            { type: 'browser_action', method: 'type', target: 'label search', data: 'AEF-Processed' },
            { type: 'browser_action', method: 'click', target: 'apply label' }
          ]
        }
      }
    ]
  }
};

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState([]);
  const [state, setState] = useState({});
  const [isExecuting, setIsExecuting] = useState(false);
  const [customNode, setCustomNode] = useState('');

  useEffect(() => {
    // Check connection on mount
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const response = await fetch('http://localhost:3001/status');
      const data = await response.json();
      setIsConnected(data.connected);
      if (data.currentUrl) {
        addLog(`Connected to: ${data.currentUrl}`, 'success');
      }
    } catch (error) {
      setIsConnected(false);
      addLog('Not connected to backend server', 'error');
    }
  };

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { message, type, timestamp }]);
  };

  const executeNode = async (node) => {
    setIsExecuting(true);
    addLog(`Executing ${node.type}: ${node.method || node.operation || 'process'}`, 'info');
    
    try {
      const response = await fetch('http://localhost:3001/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node, state })
      });
      
      const result = await response.json();
      
      if (result.success) {
        addLog(`Success: ${JSON.stringify(result.data)}`, 'success');
        if (result.state) {
          setState(result.state);
        }
      } else {
        addLog(`Error: ${result.error}`, 'error');
      }
    } catch (error) {
      addLog(`Failed to execute: ${error.message}`, 'error');
    } finally {
      setIsExecuting(false);
    }
  };

  const executeWorkflow = async (workflow) => {
    addLog(`Starting workflow: ${workflow.name}`, 'info');
    for (const node of workflow.nodes) {
      await executeNode(node);
      // Small delay between nodes for visibility
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    addLog(`Workflow complete: ${workflow.name}`, 'success');
  };

  const executeCustom = () => {
    try {
      const node = JSON.parse(customNode);
      executeNode(node);
    } catch (error) {
      addLog('Invalid JSON for custom node', 'error');
    }
  };

  const clearLogs = () => {
    setLogs([]);
    setState({});
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-4">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-800">AEF Test Dashboard</h1>
            <div className="flex items-center space-x-4">
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {isConnected ? '● Connected' : '● Disconnected'}
              </div>
              <button
                onClick={checkConnection}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Reconnect
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Actions */}
            <div className="lg:col-span-2">
              <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium mb-2">Individual Nodes</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(SAMPLE_NODES).map(([key, node]) => (
                      <button
                        key={key}
                        onClick={() => executeNode(node)}
                        disabled={!isConnected || isExecuting}
                        className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:bg-gray-300"
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4">
                  <h3 className="text-lg font-medium mb-2">Gmail CRM Steps</h3>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => executeNode({ type: 'browser_action', method: 'goto', target: 'https://accounts.google.com/signin/v2/identifier?service=mail' })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
                    >
                      1. Go to Gmail Login
                    </button>
                    <button
                      onClick={() => executeWorkflow(SAMPLE_WORKFLOWS.gmailInvestorCRM.nodes.slice(0, 1)[0])}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
                    >
                      2. Complete Gmail Login
                    </button>
                    <button
                      onClick={() => executeNode(SAMPLE_WORKFLOWS.gmailInvestorCRM.nodes[2])}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300"
                    >
                      3. Extract Emails
                    </button>
                    <button
                      onClick={() => {
                        // Run the classify and filter sequence
                        const nodes = SAMPLE_WORKFLOWS.gmailInvestorCRM.nodes.slice(3, 6);
                        executeWorkflow({ name: 'Classify & Filter', nodes });
                      }}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300"
                    >
                      4. Classify & Filter Investors
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-2">Workflows</h3>
                  <div className="space-y-2">
                    {Object.entries(SAMPLE_WORKFLOWS).map(([key, workflow]) => (
                      <button
                        key={key}
                        onClick={() => executeWorkflow(workflow)}
                        disabled={!isConnected || isExecuting}
                        className="w-full px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-300"
                      >
                        {workflow.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-2">Custom Node</h3>
                  <textarea
                    value={customNode}
                    onChange={(e) => setCustomNode(e.target.value)}
                    placeholder='{"type": "browser_query", "method": "extract", ...}'
                    className="w-full h-32 p-2 border rounded font-mono text-sm"
                  />
                  <button
                    onClick={executeCustom}
                    disabled={!isConnected || isExecuting || !customNode}
                    className="mt-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300"
                  >
                    Execute Custom
                  </button>
                </div>
              </div>
            </div>

            {/* State Viewer */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Current State</h2>
              <div className="bg-gray-50 rounded p-4 font-mono text-sm overflow-auto max-h-96">
                <pre>{JSON.stringify(state, null, 2)}</pre>
              </div>
            </div>
          </div>
        </div>

        {/* Logs */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Execution Logs</h2>
            <button
              onClick={clearLogs}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Clear Logs
            </button>
          </div>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500">No logs yet. Execute a node to see results.</p>
            ) : (
              logs.map((log, index) => (
                <div
                  key={index}
                  className={`p-3 rounded font-mono text-sm ${
                    log.type === 'error' ? 'bg-red-50 text-red-800' :
                    log.type === 'success' ? 'bg-green-50 text-green-800' :
                    'bg-gray-50 text-gray-800'
                  }`}
                >
                  <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById('root'));