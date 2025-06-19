const { useState, useEffect } = React;

// CANONICAL SCHEMAS
// These are the agreed-upon data structures for our workflow
const SCHEMAS = {
  // Email list item - used in the emails array
  emailItem: {
    subject: { type: 'string' },      // Email subject line
    senderName: { type: 'string' },   // Display name of sender
    senderEmail: { type: 'string' },  // Email address of sender
    date: { type: 'string' },         // Date string (e.g., "Jun 2")
    threadId: { type: 'string' }      // Unique identifier for deduplication
  },
  
  // Full email thread content - extracted when clicking into an email
  emailThread: {
    fullContent: { type: 'string' },   // Complete thread text
    latestMessage: { type: 'string' }, // Most recent message
    threadLength: { type: 'number' }   // Number of messages in thread
  },
  
  // Investor information - extracted from email content
  investorInfo: {
    investorName: { type: 'string' },    // Primary investor/firm name
    contactPerson: { type: 'string' },   // Individual's full name
    companyName: { type: 'string' },     // Their company (if different)
    investmentFirm: { type: 'string' }   // VC firm they represent
  },
  
  // Airtable record check result
  recordCheck: {
    recordExists: { type: 'boolean' },    // Does record already exist?
    existingRecordId: { type: 'string' }  // ID if it exists
  }
};

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
  
  gmailAirtableFull: {
    name: 'Gmail→Airtable Full Workflow',
    nodes: [
      // PHASE 1: Initial Setup Stage
      {
        type: 'sequence',
        name: 'Initial Setup - Login to Gmail and Airtable',
        nodes: [
          // Gmail login
          { type: 'browser_action', method: 'goto', target: 'https://accounts.google.com/signin/v2/identifier?service=mail' },
          { type: 'browser_query', method: 'extract', instruction: 'Check if already logged into Gmail or if login page is shown', schema: { isLoggedIn: { type: 'boolean' } } },
          {
            type: 'route',
            value: 'state.isLoggedIn',
            paths: {
              'true': { type: 'memory', operation: 'set', data: { gmailReady: true } },
              'false': {
                type: 'sequence',
                name: 'Gmail Login',
                nodes: [
                  { type: 'browser_action', method: 'type', target: 'email field', data: 'michaelburner595@gmail.com' },
                  { type: 'browser_action', method: 'click', target: 'Next button' },
                  { type: 'browser_action', method: 'type', target: 'password field', data: 'dCdWqhgPzJev6Jz' },
                  { type: 'browser_action', method: 'click', target: 'Next or Sign in button' }
                ]
              }
            }
          },
          
          // Open new tab for Airtable
          { type: 'browser_action', method: 'openNewTab', target: 'https://airtable.com/appG5J3iVIJcaRK0J/tblKbOEYSRrz8bQnL/viwG7v37KJoTOJaFg', data: { name: 'airtable' } },
          
          // Check if Airtable login is needed
          { type: 'browser_query', method: 'extract', instruction: 'Check if we need to login to Airtable (look for login button or "Continue with Google")', schema: { needsLogin: { type: 'boolean' } } },
          
          // Login to Airtable if needed
          {
            type: 'route',
            value: 'state.needsLogin',
            paths: {
              'true': {
                type: 'sequence',
                name: 'Airtable Google SSO Login',
                nodes: [
                  { type: 'browser_action', method: 'click', target: 'Continue with Google button or Sign in with Google' },
                  // Google should recognize us from Gmail login and auto-select account
                  { type: 'browser_query', method: 'extract', instruction: 'Check if Google account chooser is shown', schema: { hasAccountChooser: { type: 'boolean' } } },
                  {
                    type: 'route',
                    value: 'state.hasAccountChooser',
                    paths: {
                      'true': { type: 'browser_action', method: 'click', target: 'account with email michaelburner595@gmail.com' },
                      'false': { type: 'memory', operation: 'set', data: { autoSelected: true } }
                    }
                  }
                ]
              },
              'false': { type: 'memory', operation: 'set', data: { airtableReady: true } }
            }
          },
          
          // Switch back to Gmail tab
          { type: 'browser_action', method: 'switchTab', target: 'main' },
          { type: 'memory', operation: 'set', data: { setupComplete: true } }
        ]
      },
      
      // PHASE 2: Email Processing
      {
        type: 'sequence',
        name: 'Process Gmail Emails',
        nodes: [
          // Go back to Gmail and search
          { type: 'browser_action', method: 'goto', target: 'https://mail.google.com' },
          { type: 'browser_action', method: 'click', target: 'search mail textbox' },
          { type: 'browser_action', method: 'type', target: 'search box', data: 'after:2025/06/01 before:2025/06/03' },
          { type: 'browser_action', method: 'click', target: 'search button or press Enter' },
          
          // Extract all emails
          {
            type: 'browser_query',
            method: 'extract',
            instruction: 'Extract all visible email threads. For each email get: subject, sender name, sender email address, date, and a unique identifier if visible',
            schema: {
              emails: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: SCHEMAS.emailItem
                }
              }
            }
          },
          
          // Initialize processing state
          {
            type: 'memory',
            operation: 'set',
            data: {
              processedEmails: [],
              successCount: 0,
              errorCount: 0
            }
          },
          
          // Filter for investor emails
          {
            type: 'cognition',
            prompt: `Analyze these emails and return a boolean array indicating which are investor-related.
An email is investor-related if it mentions: funding, investment, capital, VC, venture, portfolio, pitch deck, due diligence, or comes from investment firms.
IMPORTANT: Return ONLY a JSON array of booleans, same length as input.
Example: [true, false, true, false]`,
            input: 'state.emails',
            output: 'state.investorMask',
            model: 'gpt-4o-mini'
          },
          
          // Apply filter
          {
            type: 'transform',
            input: ['state.emails', 'state.investorMask'],
            function: '(emails, mask) => emails.filter((e, i) => mask[i])',
            output: 'state.investorEmails'
          }
        ]
      },
      
      // PHASE 3: Process Each Investor Email
      {
        type: 'iterate',
        over: 'state.investorEmails',
        as: 'currentEmail',
        body: {
          type: 'sequence',
          name: 'Process Single Email',
          nodes: [
            // Check if already processed
            {
              type: 'transform',
              input: ['state.processedEmails', 'currentEmail.subject'],
              function: '(processed, subject) => processed.includes(subject)',
              output: 'state.isProcessed'
            },
            
            // Skip if processed, otherwise process
            {
              type: 'route',
              value: 'state.isProcessed',
              paths: {
                'true': { type: 'memory', operation: 'set', data: { skipped: true } },
                'false': {
                  type: 'sequence',
                  nodes: [
                    // Click on email
                    { type: 'browser_action', method: 'click', target: 'email with subject "{{currentEmail.subject}}"' },
                    
                    // Extract investor details
                    {
                      type: 'browser_query',
                      method: 'extract',
                      instruction: 'Extract investor information from the email. Look for company name, contact person full name, and any other relevant details',
                      schema: {
                        investorInfo: SCHEMAS.investorInfo,
                        emailContent: { type: 'string' }
                      }
                    },
                    
                    // Generate thread summary
                    {
                      type: 'cognition',
                      prompt: 'Create a concise 2-line summary of this investor email for CRM notes. Focus on key points and next steps.',
                      input: 'state.emailContent',
                      output: 'state.threadSummary'
                    },
                    
                    // Classify stage
                    {
                      type: 'cognition',
                      prompt: `Classify this investor's stage based on the email content:
- "Interested": Initial outreach, exploring possibilities
- "In Diligence": Requesting documents, deeper discussions
- "Deck Sent": We have sent materials, awaiting response
Return only one of these three values.`,
                      input: 'state.emailContent',
                      output: 'state.investorStage'
                    },
                    
                    // Switch to Airtable tab
                    { type: 'browser_action', method: 'switchTab', target: 'airtable' },
                    
                    // Create new record
                    { type: 'browser_action', method: 'click', target: 'Add record button (+ icon) in the table' },
                    
                    // Fill in the fields
                    { type: 'browser_action', method: 'type', target: 'Investor Name field', data: '{{state.investorInfo.investorName}}' },
                    { type: 'browser_action', method: 'type', target: 'Contact Person field', data: '{{state.investorInfo.contactPerson}}' },
                    { type: 'browser_action', method: 'type', target: 'Email field', data: '{{currentEmail.senderEmail}}' },
                    { type: 'browser_action', method: 'click', target: 'Stage dropdown' },
                    { type: 'browser_action', method: 'click', target: '{{state.investorStage}} option in dropdown' },
                    { type: 'browser_action', method: 'type', target: 'Thread Summary / Notes field', data: '{{state.threadSummary}}' },
                    { type: 'browser_action', method: 'type', target: 'Last Interaction date field', data: '{{currentEmail.date}}' },
                    { type: 'browser_action', method: 'click', target: 'Follow-up Needed checkbox to check it' },
                    
                    // Save and close
                    { type: 'browser_action', method: 'click', target: 'Save button or click outside to save' },
                    
                    // Mark as processed
                    {
                      type: 'transform',
                      input: ['state.processedEmails', 'currentEmail.subject'],
                      function: '(processed, subject) => [...processed, subject]',
                      output: 'state.processedEmails'
                    },
                    
                    // Update success count
                    {
                      type: 'transform',
                      input: 'state.successCount',
                      function: '(count) => count + 1',
                      output: 'state.successCount'
                    },
                    
                    // Switch back to Gmail tab
                    { type: 'browser_action', method: 'switchTab', target: 'main' }
                  ]
                }
              }
            }
          ]
        }
      },
      
      // PHASE 4: Summary
      {
        type: 'sequence',
        name: 'Generate Summary',
        nodes: [
          {
            type: 'memory',
            operation: 'set',
            data: {
              workflowComplete: true,
              summary: 'Workflow completed. Check state for results.'
            }
          }
        ]
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
  const [selectedEmailIndex, setSelectedEmailIndex] = useState(null);

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
        {/* Workflow Overview Card */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h2 className="text-lg font-semibold mb-2">📋 Gmail→Airtable CRM Workflow</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <strong>Phase 1: Setup</strong>
              <ul className="mt-1 text-gray-700">
                <li>• Login to Gmail</li>
                <li>• Open Airtable in new tab</li>
                <li>• Login with Google SSO</li>
              </ul>
            </div>
            <div>
              <strong>Phase 2: Extract & Filter</strong>
              <ul className="mt-1 text-gray-700">
                <li>• Search emails (Jun 1-3)</li>
                <li>• Extract with canonical schema</li>
                <li>• AI filter investor emails</li>
              </ul>
            </div>
            <div>
              <strong>Phase 3: Process Loop</strong>
              <ul className="mt-1 text-gray-700">
                <li>• Click each investor email</li>
                <li>• Extract investor details</li>
                <li>• Create/update in Airtable</li>
              </ul>
            </div>
            <div>
              <strong>Canonical Schema</strong>
              <ul className="mt-1 text-gray-700">
                <li>• Email: {Object.keys(SCHEMAS.emailItem).join(', ')}</li>
                <li>• Thread: {Object.keys(SCHEMAS.emailThread).join(', ')}</li>
                <li>• Investor: {Object.keys(SCHEMAS.investorInfo).join(', ')}</li>
              </ul>
            </div>
          </div>
        </div>

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
                  <h3 className="text-lg font-medium mb-2">Gmail→Airtable Workflow Steps</h3>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => executeNode(SAMPLE_WORKFLOWS.gmailAirtableFull.nodes[0])}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
                    >
                      Phase 1: Setup (Login Gmail + Airtable)
                    </button>
                    <button
                      onClick={() => executeNode(SAMPLE_WORKFLOWS.gmailAirtableFull.nodes[1])}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300"
                    >
                      Phase 2: Search & Filter Emails
                    </button>
                    <button
                      onClick={() => executeNode(SAMPLE_WORKFLOWS.gmailAirtableFull.nodes[2])}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-300"
                    >
                      Phase 3: Process Investor Emails
                    </button>
                    <button
                      onClick={() => executeWorkflow(SAMPLE_WORKFLOWS.gmailAirtableFull)}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-300 font-bold"
                    >
                      🚀 Run Full Workflow
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <h3 className="text-lg font-medium mb-2">Debug: Individual Primitives</h3>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => executeNode({ type: 'browser_action', method: 'goto', target: 'https://accounts.google.com/signin/v2/identifier?service=mail' })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      1.1 Navigate to Gmail Login
                    </button>
                    <button
                      onClick={() => executeNode({ type: 'browser_query', method: 'extract', instruction: 'Check if already logged into Gmail or if login page is shown', schema: { isLoggedIn: { type: 'boolean' } } })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      1.2 Check Gmail Login Status
                    </button>
                    <button
                      onClick={() => executeNode({ type: 'browser_action', method: 'type', target: 'email field', data: 'michaelburner595@gmail.com' })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      1.3 Type Email
                    </button>
                    <button
                      onClick={() => executeNode({ type: 'browser_action', method: 'click', target: 'Next button' })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      1.4 Click Next
                    </button>
                    <button
                      onClick={() => executeNode({ type: 'browser_action', method: 'type', target: 'password field', data: 'dCdWqhgPzJev6Jz' })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      1.5 Type Password
                    </button>
                    <button
                      onClick={() => executeNode({ type: 'browser_action', method: 'click', target: 'Next or Sign in button' })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      1.6 Click Sign In
                    </button>
                    <button
                      onClick={() => executeNode({ type: 'browser_action', method: 'openNewTab', target: 'https://airtable.com/appG5J3iVIJcaRK0J/tblKbOEYSRrz8bQnL/viwG7v37KJoTOJaFg', data: { name: 'airtable' } })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      1.7 Open Airtable in New Tab
                    </button>
                    <button
                      onClick={() => executeNode({ type: 'browser_action', method: 'click', target: 'Continue with Google button or Sign in with Google' })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      1.8 Click Continue with Google
                    </button>
                    <button
                      onClick={() => executeNode({ type: 'browser_action', method: 'switchTab', target: 'main' })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      1.9 Switch to Gmail Tab
                    </button>
                    <button
                      onClick={() => executeNode({ type: 'browser_action', method: 'switchTab', target: 'airtable' })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      1.10 Switch to Airtable Tab
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <h3 className="text-lg font-medium mb-2">Debug: Phase 2 - Email Extraction (Individual Steps)</h3>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => executeNode({ type: 'browser_action', method: 'goto', target: 'https://mail.google.com' })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      2.1 Go to Gmail
                    </button>
                    <button
                      onClick={() => executeNode({ type: 'browser_action', method: 'click', target: 'search mail textbox' })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      2.2 Click Search Box
                    </button>
                    <button
                      onClick={() => executeNode({ type: 'browser_action', method: 'type', target: 'search box', data: 'after:2025/06/01 before:2025/06/03' })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      2.3 Type Search Query
                    </button>
                    <button
                      onClick={() => executeNode({ type: 'browser_action', method: 'click', target: 'search button or press Enter' })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      2.4 Execute Search
                    </button>
                    <button
                      onClick={() => executeNode({
                        type: 'browser_query',
                        method: 'extract',
                        instruction: 'Extract all visible email threads. For each email get: subject, sender name, sender email address, date, and a unique identifier if visible',
                        schema: 'z.object({ emails: z.array(z.object({ subject: z.string(), senderName: z.string(), senderEmail: z.string(), date: z.string(), threadId: z.string() })) })'
                      })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      2.5 Extract Emails (Zod String Schema)
                    </button>
                    <button
                      onClick={() => executeNode({
                        type: 'browser_query',
                        method: 'extract',
                        instruction: 'Extract all visible email threads. For each email get: subject, sender name, sender email address, date'
                      })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      2.5a Extract Emails (No Schema)
                    </button>
                    <button
                      onClick={() => executeNode({
                        type: 'browser_query',
                        method: 'extract',
                        instruction: 'Extract all visible email threads. For each email get: subject, sender name, sender email address, date, and a unique identifier if visible',
                        schema: {
                          emails: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: SCHEMAS.emailItem
                            }
                          }
                        }
                      })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      2.5b Extract Emails (Canonical Schema)
                    </button>
                    <button
                      onClick={() => executeNode({
                        type: 'memory',
                        operation: 'set',
                        data: {
                          processedEmails: [],
                          successCount: 0,
                          errorCount: 0
                        }
                      })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      2.6 Initialize Processing State
                    </button>
                    <button
                      onClick={() => executeNode({
                        type: 'cognition',
                        prompt: `Analyze these emails and return a boolean array indicating which are investor-related.
An email is investor-related if it mentions: funding, investment, capital, VC, venture, portfolio, pitch deck, due diligence, or comes from investment firms.
IMPORTANT: Return ONLY a JSON array of booleans, same length as input.
Example: [true, false, true, false]`,
                        input: 'state.emails',
                        output: 'state.investorMask',
                        model: 'gpt-4o-mini'
                      })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      2.7 Classify Investor Emails
                    </button>
                    <button
                      onClick={() => executeNode({
                        type: 'transform',
                        input: ['state.emails', 'state.investorMask'],
                        function: '(emails, mask) => emails.filter((e, i) => mask[i])',
                        output: 'state.investorEmails'
                      })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      2.8 Apply Filter
                    </button>
                    
                    {/* Test data generator */}
                    <button
                      onClick={() => {
                        const testEmails = [
                          {
                            subject: "Re: Investment opportunity in your startup",
                            senderName: "John Smith",
                            senderEmail: "john@sequoia.com",
                            date: "Jun 2",
                            threadId: "thread_001"
                          },
                          {
                            subject: "Following up on our call - Accel Partners",
                            senderName: "Sarah Chen",
                            senderEmail: "sarah@accel.com",
                            date: "Jun 2",
                            threadId: "thread_002"
                          },
                          {
                            subject: "Due diligence materials request",
                            senderName: "Mike Johnson",
                            senderEmail: "mjohnson@kleiner.com",
                            date: "Jun 1",
                            threadId: "thread_003"
                          }
                        ];
                        setState(prev => ({ 
                          ...prev, 
                          investorEmails: testEmails,
                          processedEmails: []
                        }));
                        addLog('Generated test investor emails for visualization', 'success');
                      }}
                      className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 text-sm"
                    >
                      🧪 Generate Test Investor Emails
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <h3 className="text-lg font-medium mb-2">Debug: Phase 3 - Process Single Email (Select email first)</h3>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => executeNode({ 
                        type: 'browser_action', 
                        method: 'click', 
                        target: 'email with subject "{{currentEmail.subject}}"' 
                      })}
                      disabled={!isConnected || isExecuting || !state.currentEmail}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      3.1 Click on Current Email
                    </button>
                    <button
                      onClick={() => executeNode({
                        type: 'browser_query',
                        method: 'extract',
                        instruction: 'Extract the full email thread content including all messages in the conversation',
                        schema: {
                          emailThread: {
                            type: 'object',
                            properties: {
                              fullContent: { type: 'string' },
                              latestMessage: { type: 'string' },
                              threadLength: { type: 'number' }
                            }
                          }
                        }
                      })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      3.2 Extract Email Thread Content
                    </button>
                    <button
                      onClick={() => executeNode({
                        type: 'browser_query',
                        method: 'extract',
                        instruction: 'Extract investor/company information from this email. Look for company name, investor name, contact person full name, and any investment firm they represent',
                        schema: {
                          investorInfo: {
                            type: 'object',
                            properties: {
                              investorName: { type: 'string' },
                              contactPerson: { type: 'string' },
                              companyName: { type: 'string' },
                              investmentFirm: { type: 'string' }
                            }
                          }
                        }
                      })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      3.3 Extract Investor Details
                    </button>
                    <button
                      onClick={() => executeNode({
                        type: 'cognition',
                        prompt: 'Create a concise 2-line summary of this investor email thread for CRM notes. Focus on key points, their interest level, and suggested next steps.',
                        input: 'state.emailThread.fullContent',
                        output: 'state.threadSummary'
                      })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      3.4 Generate Thread Summary
                    </button>
                    <button
                      onClick={() => executeNode({
                        type: 'cognition',
                        prompt: `Classify this investor's stage based on the email content:
- "Interested": Initial outreach, exploring possibilities
- "In Diligence": Requesting documents, deeper discussions
- "Deck Sent": We have sent materials, awaiting response
Return only one of these three values.`,
                        input: 'state.emailThread.fullContent',
                        output: 'state.investorStage'
                      })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      3.5 Classify Investor Stage
                    </button>
                    <button
                      onClick={() => executeNode({ type: 'browser_action', method: 'switchTab', target: 'airtable' })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      3.6 Switch to Airtable
                    </button>
                    <button
                      onClick={() => executeNode({
                        type: 'browser_query',
                        method: 'extract',
                        instruction: 'Check if there is already a record for investor "{{state.investorInfo.investorName}}" or email "{{currentEmail.senderEmail}}" in the visible Airtable records',
                        schema: {
                          recordExists: { type: 'boolean' },
                          existingRecordId: { type: 'string' }
                        }
                      })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      3.7 Check for Existing Record
                    </button>
                    <button
                      onClick={() => executeNode({ 
                        type: 'browser_action', 
                        method: 'click', 
                        target: 'Add record button (+ icon) in the table or at bottom of table' 
                      })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      3.8a Create New Record
                    </button>
                    <button
                      onClick={() => executeNode({ 
                        type: 'browser_action', 
                        method: 'click', 
                        target: 'row containing investor "{{state.investorInfo.investorName}}"' 
                      })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      3.8b Click Existing Record
                    </button>
                    <button
                      onClick={() => executeNode({ 
                        type: 'browser_action', 
                        method: 'type', 
                        target: 'Investor Name field', 
                        data: '{{state.investorInfo.investorName}}' 
                      })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      3.9 Fill Investor Name
                    </button>
                    <button
                      onClick={() => executeNode({
                        type: 'transform',
                        input: ['state.processedEmails', 'currentEmail.subject'],
                        function: '(processed, subject) => [...(processed || []), subject]',
                        output: 'state.processedEmails'
                      })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      3.10 Mark Email as Processed
                    </button>
                    <button
                      onClick={() => executeNode({ type: 'browser_action', method: 'switchTab', target: 'main' })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      3.11 Back to Gmail
                    </button>
                    
                    {/* Full loop button */}
                    <button
                      onClick={() => executeNode({
                        type: 'iterate',
                        over: 'state.investorEmails',
                        as: 'currentEmail',
                        index: 'emailIndex',
                        body: {
                          type: 'sequence',
                          name: 'Process Single Email',
                          nodes: [
                            // Check if already processed
                            {
                              type: 'transform',
                              input: ['state.processedEmails', 'currentEmail.subject'],
                              function: '(processed, subject) => (processed || []).includes(subject)',
                              output: 'state.isProcessed'
                            },
                            // Route: Skip if processed
                            {
                              type: 'route',
                              value: 'state.isProcessed',
                              paths: {
                                'true': { type: 'memory', operation: 'set', data: { skipReason: 'already processed' } },
                                'false': {
                                  type: 'sequence',
                                  nodes: [
                                    // Click email
                                    { type: 'browser_action', method: 'click', target: 'email with subject "{{currentEmail.subject}}"' },
                                    // Extract thread
                                    {
                                      type: 'browser_query',
                                      method: 'extract',
                                      instruction: 'Extract the full email thread content',
                                      schema: { emailThread: SCHEMAS.emailThread }
                                    },
                                    // Extract investor info
                                    {
                                      type: 'browser_query',
                                      method: 'extract',
                                      instruction: 'Extract investor information from this email',
                                      schema: { investorInfo: SCHEMAS.investorInfo }
                                    },
                                    // Generate summary
                                    {
                                      type: 'cognition',
                                      prompt: 'Create a 2-line CRM summary',
                                      input: 'state.emailThread.fullContent',
                                      output: 'state.threadSummary'
                                    },
                                    // Switch to Airtable
                                    { type: 'browser_action', method: 'switchTab', target: 'airtable' },
                                    // Create record
                                    { type: 'browser_action', method: 'click', target: 'Add record button' },
                                    { type: 'browser_action', method: 'type', target: 'Investor Name field', data: '{{state.investorInfo.investorName}}' },
                                    { type: 'browser_action', method: 'type', target: 'Email field', data: '{{currentEmail.senderEmail}}' },
                                    // Mark processed
                                    {
                                      type: 'transform',
                                      input: ['state.processedEmails', 'currentEmail.subject'],
                                      function: '(processed, subject) => [...(processed || []), subject]',
                                      output: 'state.processedEmails'
                                    },
                                    // Back to Gmail
                                    { type: 'browser_action', method: 'switchTab', target: 'main' }
                                  ]
                                }
                              }
                            }
                          ]
                        }
                      })}
                      disabled={!isConnected || isExecuting || !state.investorEmails}
                      className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:bg-gray-300 text-sm font-bold"
                    >
                      🔄 Process ALL Investor Emails (Loop)
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
              
              {/* Email Loop Visualizer */}
              {state.investorEmails && state.investorEmails.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-lg font-semibold mb-2">Investor Emails to Process ({state.investorEmails.length})</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {state.investorEmails.map((email, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded border ${
                          selectedEmailIndex === index 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-300 bg-white'
                        } ${
                          state.processedEmails?.includes(email.subject)
                            ? 'opacity-50'
                            : ''
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-medium">{email.subject}</div>
                            <div className="text-sm text-gray-600">
                              From: {email.senderName} ({email.senderEmail})
                            </div>
                            <div className="text-xs text-gray-500">{email.date}</div>
                          </div>
                          <div className="flex flex-col space-y-1">
                            <button
                              onClick={() => {
                                setSelectedEmailIndex(index);
                                setState(prev => ({ ...prev, currentEmail: email, emailIndex: index }));
                              }}
                              className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                            >
                              Select
                            </button>
                            {state.processedEmails?.includes(email.subject) && (
                              <span className="text-xs text-green-600">✓ Processed</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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