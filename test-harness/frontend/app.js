const { useState, useEffect } = React;

// Helper to get primitive info
function getPrimitiveInfo(node) {
  const info = {
    primitive: node.type,
    description: '',
    stagehandCommands: [],
    details: {}
  };
  
  switch (node.type) {
    case 'browser_action':
      info.description = 'Performs browser interactions with side effects';
      switch (node.method) {
        case 'goto':
          info.stagehandCommands = [`currentPage.goto("${node.target}")`];
          info.details = { target: node.target, waitsFor: 'Page load and network idle' };
          break;
        case 'click':
          info.stagehandCommands = [`currentPage.act("click on ${node.target}")`];
          info.details = { target: node.target, uses: 'AI vision + DOM analysis' };
          break;
        case 'type':
          info.stagehandCommands = [`currentPage.act("type \\"${node.data}\\" into ${node.target}")`];
          info.details = { target: node.target, data: node.data };
          break;
        case 'openNewTab':
          info.stagehandCommands = [
            `const newPage = await stagehand.context.newPage()`,
            `pages["${node.data?.name || 'tab'}"] = newPage`,
            `await newPage.goto("${node.target}")`
          ];
          info.details = { url: node.target, tabName: node.data?.name };
          break;
        case 'switchTab':
          info.stagehandCommands = [
            `currentPage = pages["${node.target}"]`,
            `await currentPage.bringToFront()`
          ];
          info.details = { targetTab: node.target };
          break;
      }
      break;
      
    case 'browser_query':
      info.description = 'Extracts data from page without side effects';
      switch (node.method) {
        case 'extract':
          info.stagehandCommands = [`await currentPage.extract({ instruction: "${node.instruction}", schema: zodSchema })`];
          info.details = { 
            instruction: node.instruction,
            schema: node.schema ? 'Provided' : 'None',
            storesIn: node.schema ? Object.keys(node.schema) : ['state.lastExtract']
          };
          break;
        case 'observe':
          info.stagehandCommands = [`await currentPage.observe({ instruction: "${node.instruction}" })`];
          info.details = { instruction: node.instruction };
          break;
      }
      break;
      
    case 'transform':
      info.description = 'Pure data transformation without side effects';
      info.stagehandCommands = ['// Pure JavaScript function execution'];
      info.details = {
        input: Array.isArray(node.input) ? node.input : [node.input],
        function: node.function,
        output: node.output
      };
      break;
      
    case 'cognition':
      info.description = 'AI-powered reasoning and content generation';
      info.stagehandCommands = [
        `await openai.chat.completions.create({`,
        `  model: "${node.model || 'gpt-4o-mini'}",`,
        `  messages: [{ role: "user", content: prompt + input }]`,
        `})`
      ];
      info.details = {
        prompt: node.prompt,
        input: node.input,
        output: node.output,
        model: node.model || 'gpt-4o-mini'
      };
      break;
      
    case 'memory':
      info.description = 'Explicit state management';
      info.stagehandCommands = [`workflowState[key] = value`];
      info.details = {
        operation: node.operation,
        data: node.data
      };
      break;
      
    case 'sequence':
      info.description = 'Execute nodes in serial order';
      info.stagehandCommands = ['for (const node of nodes) { await executeNode(node) }'];
      info.details = {
        name: node.name,
        nodeCount: node.nodes?.length || 0
      };
      break;
      
    case 'iterate':
      info.description = 'Loop over collections with scoped variables';
      info.stagehandCommands = [
        `const items = state["${node.over}"]`,
        `for (let i = 0; i < items.length; i++) {`,
        `  state["${node.as}"] = items[i]`,
        `  state["${node.as}Index"] = i`,
        `  await executeNode(body)`,
        `}`
      ];
      info.details = {
        over: node.over,
        as: node.as,
        iteratesOver: `state.${node.over}`
      };
      break;
      
    case 'route':
      info.description = 'Multi-way branching based on conditions';
      info.stagehandCommands = [
        `const value = state["${node.value}"]`,
        `const selectedPath = paths[value] || paths.default`,
        `await executeNode(selectedPath)`
      ];
      info.details = {
        checkValue: node.value,
        paths: Object.keys(node.paths || {})
      };
      break;
  }
  
  return info;
}

// Component for rendering a node with expandable details
function NodeButton({ node, label, onClick, disabled, expanded, onToggleExpand }) {
  const info = getPrimitiveInfo(node);
  
  return (
    <div className="mb-2">
      <div className="flex items-center gap-2">
        <button
          onClick={onClick}
          disabled={disabled}
          className="flex-1 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm text-left"
        >
          {label}
        </button>
        <button
          onClick={onToggleExpand}
          className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
        >
          {expanded ? '−' : '+'}
        </button>
      </div>
      
      {expanded && (
        <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200 text-xs">
          <div className="mb-2">
            <strong className="text-gray-700">Primitive:</strong> 
            <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded">{info.primitive}</span>
          </div>
          
          <div className="mb-2">
            <strong className="text-gray-700">Description:</strong> 
            <span className="ml-2">{info.description}</span>
          </div>
          
          {info.stagehandCommands.length > 0 && (
            <div className="mb-2">
              <strong className="text-gray-700">StageHand Commands:</strong>
              <pre className="mt-1 p-2 bg-gray-900 text-green-400 rounded overflow-x-auto">
                {info.stagehandCommands.join('\n')}
              </pre>
            </div>
          )}
          
          <div>
            <strong className="text-gray-700">Details:</strong>
            <pre className="mt-1 p-2 bg-white rounded border overflow-x-auto">
              {JSON.stringify(info.details, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

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
          
          // Open new tab for Airtable - Investor Relationship Management App
          { type: 'browser_action', method: 'openNewTab', target: 'https://airtable.com/appTnT68Rt8yHIGV3', data: { name: 'airtable' } },
          
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
                  // Wait a moment for Google auth to load
                  { type: 'memory', operation: 'set', data: { waitingForGoogle: true } },
                  // Check what Google is showing us
                  { type: 'browser_query', method: 'extract', instruction: 'Check what is shown: account chooser with multiple accounts, single account confirmation, or login form', schema: { 
                    hasAccountChooser: { type: 'boolean' },
                    hasSingleAccountConfirm: { type: 'boolean' },
                    hasLoginForm: { type: 'boolean' },
                    accounts: { type: 'array', items: { type: 'string' } }
                  } },
                  {
                    type: 'route',
                    value: 'state.hasAccountChooser',
                    paths: {
                      'true': {
                        type: 'sequence',
                        nodes: [
                          { type: 'browser_action', method: 'click', target: 'account that contains "michaelburner595@gmail.com" or "Michael Burner"' },
                          { type: 'memory', operation: 'set', data: { selectedAccount: true } }
                        ]
                      },
                      'false': {
                        type: 'route',
                        value: 'state.hasSingleAccountConfirm',
                        paths: {
                          'true': {
                            type: 'sequence',
                            nodes: [
                              { type: 'browser_action', method: 'click', target: 'Continue button or Allow button' },
                              { type: 'memory', operation: 'set', data: { confirmedAccount: true } }
                            ]
                          },
                          'false': {
                            type: 'route',
                            value: 'state.hasLoginForm',
                            paths: {
                              'true': {
                                type: 'sequence',
                                name: 'Fresh Google Login',
                                nodes: [
                                  { type: 'browser_action', method: 'type', target: 'email or username field', data: 'michaelburner595@gmail.com' },
                                  { type: 'browser_action', method: 'click', target: 'Next button' },
                                  { type: 'browser_action', method: 'type', target: 'password field', data: 'dCdWqhgPzJev6Jz' },
                                  { type: 'browser_action', method: 'click', target: 'Next or Sign in button' }
                                ]
                              },
                              'false': { type: 'memory', operation: 'set', data: { autoAuthenticated: true } }
                            }
                          }
                        }
                      }
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
      
      // PHASE 2: Email Processing - With proper waits
      {
        type: 'sequence',
        name: 'Process Gmail Emails',
        nodes: [
          // CRITICAL: Switch to Gmail tab first!
          { type: 'browser_action', method: 'switchTab', target: 'main' },
          
          // Navigate to Gmail
          { type: 'browser_action', method: 'goto', target: 'https://mail.google.com' },
          
          // Wait for page load
          { type: 'wait', duration: 2000, reason: 'Gmail page load' },
          
          // Click search box
          { type: 'browser_action', method: 'click', target: 'search mail textbox or search button with magnifying glass icon' },
          
          // Wait for search box focus
          { type: 'wait', duration: 500, reason: 'Search box focus' },
          
          // Type search query
          { type: 'browser_action', method: 'type', target: 'search input field that is currently focused', data: 'after:2025/06/01 before:2025/06/03' },
          
          // Execute search
          { type: 'browser_action', method: 'click', target: 'search button or press Enter key' },
          
          // Wait for search results
          { type: 'wait', duration: 2000, reason: 'Search results to load' },
          
          // Extract all emails
          {
            type: 'browser_query',
            method: 'extract',
            instruction: 'Extract all visible email threads from the search results. For each email get: subject line, sender name (FROM field), sender email address (FROM field - the person who sent the email TO you), date, and any unique identifier if visible. Make sure to extract the actual sender\'s email, NOT your own email address.',
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
              emailResults: {},
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
  },

  // The Master Workflow - Intelligent Gmail→Airtable CRM Sync
  masterCRM: {
    name: '🚀 Master CRM Workflow (Intelligent Sync)',
    nodes: [
      // PHASE 1: Setup and Intelligence Gathering
      {
        type: 'sequence',
        name: 'Phase 1: Setup & Intelligence',
        nodes: [
          // 1.1 Login to both platforms
          { type: 'memory', operation: 'set', data: { workflowPhase: 'Setting up Gmail & Airtable...' } },
          { type: 'browser_action', method: 'goto', target: 'https://mail.google.com' },
          { type: 'wait', duration: 1000, reason: 'Gmail load' },
          
          // 1.2 Open Airtable in new tab
          {
            type: 'browser_action',
            method: 'openNewTab',
            target: 'https://airtable.com/appVu0J00I1q0pCzO/tblgfPzXfTFnNJgpp/viwYUiKHcejGvP6f7',
            data: { name: 'airtable' }
          },
          
          // 1.3 Download ALL Airtable data first
          { type: 'memory', operation: 'set', data: { workflowPhase: 'Downloading existing CRM data...' } },
          {
            type: 'browser_query',
            method: 'extract',
            instruction: 'Extract ALL investor records from the table. Get every row with all columns.',
            schema: {
              existingRecords: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    investorName: { type: 'string' },
                    contactPerson: { type: 'string' },
                    email: { type: 'string' },
                    stage: { type: 'string' },
                    lastInteraction: { type: 'string' },
                    threadSummary: { type: 'string' },
                    followUpNeeded: { type: 'boolean' },
                    nextStep: { type: 'string' },
                    interactions: { type: 'string' },
                    followUps: { type: 'string' }
                  }
                }
              }
            }
          },
          
          // 1.4 Build email lookup map with improved handling
          {
            type: 'transform',
            input: 'state.existingRecords',
            function: `(data) => {
              const lookup = {};
              console.log('Building lookup from data:', data);
              
              // Handle different possible data structures
              let records = [];
              if (Array.isArray(data)) {
                records = data;
              } else if (data && typeof data === 'object') {
                // Handle nested structure from browser_query
                if (data.existingRecords) records = data.existingRecords;
                else if (data.records) records = data.records;
                else if (data.data) records = data.data;
              }
              
              // Build lookup with normalization
              if (Array.isArray(records)) {
                records.forEach(r => {
                  if (r.email) {
                    const normalizedEmail = r.email.toLowerCase().trim();
                    lookup[normalizedEmail] = r;
                    console.log('Added to lookup:', normalizedEmail);
                  }
                });
              }
              console.log('Final lookup keys:', Object.keys(lookup));
              return lookup;
            }`,
            output: 'state.emailLookup'
          },
          
          // Debug: Verify lookup was built correctly
          {
            type: 'memory',
            operation: 'set',
            data: {
              debugLookupCount: '{{Object.keys(state.emailLookup).length}}'
            }
          },
          
          // 1.5 Switch back to Gmail
          { type: 'browser_action', method: 'switchTab', target: 'main' },
          { type: 'memory', operation: 'set', data: { workflowPhase: 'Extracting investor emails...' } }
        ]
      },
      
      // PHASE 2: Extract and Classify Emails
      {
        type: 'sequence',
        name: 'Phase 2: Email Extraction & Classification',
        nodes: [
          // Extract emails
          {
            type: 'browser_query',
            method: 'extract',
            instruction: 'Extract ALL email threads from inbox. For each email, focus on the FROM field - this is the person/company who SENT the email. Extract: 1) senderName: The name in the FROM field (NOT your name), 2) senderEmail: The email address in the FROM field (the sender\'s email, NOT michaelburner595@gmail.com which is the recipient), 3) subject: email subject line, 4) date: when received, 5) threadId: unique thread identifier. CRITICAL: The senderEmail must be the email address of the person who sent the email TO you, not your own email address.',
            schema: {
              emails: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    senderName: { type: 'string' },
                    senderEmail: { type: 'string' },
                    subject: { type: 'string' },
                    date: { type: 'string' },
                    threadId: { type: 'string' }
                  }
                }
              }
            }
          },
          
          // Classify as investor-related
          {
            type: 'cognition',
            prompt: `Analyze these emails and identify which are from investors/VCs. Look for:
- VC firm domains (@sequoia.com, @a16z.com, etc.)
- Investment-related keywords (funding, round, investment, pitch, deck, diligence)
- VC partner names and titles
Return a boolean array where true = investor email.`,
            input: 'state.emails',
            output: 'state.investorFlags',
            model: 'gpt-4o-mini'
          },
          
          // Filter to investor emails only
          {
            type: 'transform',
            input: ['state.emails', 'state.investorFlags'],
            function: '(emails, flags) => emails.filter((e, i) => flags[i])',
            output: 'state.investorEmails'
          },
          
          // Categorize emails as NEW vs UPDATE with better matching
          {
            type: 'transform',
            input: ['state.investorEmails', 'state.emailLookup'],
            function: `(emails, lookup) => {
              const newEmails = [];
              const updateEmails = [];
              
              if (Array.isArray(emails) && lookup && typeof lookup === 'object') {
                emails.forEach(email => {
                  const emailKey = email.senderEmail?.toLowerCase().trim();
                  console.log('Checking email:', emailKey, 'against lookup');
                  
                  if (emailKey && lookup[emailKey]) {
                    console.log('Found existing record for:', emailKey);
                    updateEmails.push({ ...email, existingRecord: lookup[emailKey] });
                  } else {
                    console.log('No existing record for:', emailKey, '- marking as NEW');
                    newEmails.push(email);
                  }
                });
              } else {
                console.log('Invalid inputs - emails:', Array.isArray(emails), 'lookup:', typeof lookup);
                newEmails.push(...(emails || []));
              }
              
              console.log('Categorized:', newEmails.length, 'NEW,', updateEmails.length, 'UPDATE');
              return { new: newEmails, update: updateEmails };
            }`,
            output: 'state.categorizedEmails'
          },
          
          { 
            type: 'memory', 
            operation: 'set', 
            data: { 
              workflowPhase: 'Emails categorized - ready to process' 
            }
          }
        ]
      },
      
      // PHASE 3: Process NEW Investor Records
      {
        type: 'sequence',
        name: 'Phase 3: Create NEW Investor Records',
        nodes: [
          {
            type: 'iterate',
            over: 'state.categorizedEmails.new',
            as: 'newInvestor',
            body: {
              type: 'sequence',
              name: 'Create New Record',
              nodes: [
                // Click email to open
                { type: 'browser_action', method: 'click', target: 'email with subject "{{newInvestor.subject}}"' },
                { type: 'wait', duration: 500, reason: 'Email open' },
                
                // Extract full content
                {
                  type: 'browser_query',
                  method: 'extract',
                  instruction: 'Extract the complete email thread including all messages and signatures',
                  schema: {
                    fullThread: { type: 'string' },
                    latestMessage: { type: 'string' },
                    companyInfo: { type: 'string' }
                  }
                },
                
                // Extract investor details
                {
                  type: 'cognition',
                  prompt: `From this email thread, extract investor information:
- Investment firm name (e.g., "First Round Capital")
- Contact person full name
- Any company/fund information mentioned

Email content: {{state.fullThread}}

Return JSON with keys: investorName, contactPerson, firmInfo`,
                  input: 'state.fullThread',
                  output: 'state.extractedInfo',
                  model: 'gpt-4o-mini'
                },
                
                // Generate CRM content
                {
                  type: 'cognition',
                  prompt: `Create CRM content for this new investor email.

Thread Summary Examples from our CRM:
- "Sent pitch deck after Slush meeting. Lisa reviewing metrics and wants to circle back with questions."
- "Alice Chen from Alpha Ventures thanks Michael for sending the deck, expresses being impressed with the traction"

Next Step Examples:
- "Wait for Lisa's follow-up questions"
- "Send financial projections by EOD Monday"
- "Schedule intro call next week"

Stage Classification:
- "Interested" = Initial outreach, learning about us
- "In Diligence" = Reviewing materials, asking detailed questions
- "Deck Sent" = We sent materials, awaiting response

Email content: {{state.fullThread}}

Return JSON with: threadSummary, nextStep, stage, followUpNeeded (boolean)`,
                  input: 'state.fullThread',
                  output: 'state.crmContent',
                  model: 'gpt-4o-mini'
                },
                
                // Format interaction history
                {
                  type: 'transform',
                  input: ['newInvestor.date', 'state.latestMessage'],
                  function: `(date, message) => {
                    const d = new Date(date);
                    const formatted = d.toISOString().split('T')[0];
                    const action = message.includes('deck') ? 'Received pitch deck request' : 'Initial contact';
                    return formatted + ': ' + action;
                  }`,
                  output: 'state.interactionEntry'
                },
                
                // Switch to Airtable
                { type: 'browser_action', method: 'switchTab', target: 'airtable' },
                { type: 'wait', duration: 500, reason: 'Tab switch' },
                
                // Create new record
                { type: 'browser_action', method: 'click', target: 'Add record button or + button' },
                { type: 'wait', duration: 500, reason: 'New record form' },
                
                // Fill all fields with validation and error handling
                {
                  type: 'handle',
                  try: {
                    type: 'sequence',
                    nodes: [
                      // Validate extracted info exists
                      {
                        type: 'route',
                        value: 'state.extractedInfo.investorName',
                        paths: {
                          'undefined': {
                            type: 'memory',
                            operation: 'set',
                            data: {
                              'extractedInfo.investorName': '{{state.extractedInfo.firmInfo || newInvestor.senderName || "Unknown Investor"}}'
                            }
                          },
                          'default': { type: 'memory', operation: 'set', data: { skip: true } }
                        }
                      },
                      {
                        type: 'route',
                        value: 'state.extractedInfo.contactPerson',
                        paths: {
                          'undefined': {
                            type: 'memory',
                            operation: 'set',
                            data: {
                              'extractedInfo.contactPerson': '{{newInvestor.senderName || "Unknown"}}'
                            }
                          },
                          'default': { type: 'memory', operation: 'set', data: { skip: true } }
                        }
                      },
                      
                      // Try different selectors for Investor Name
                      {
                        type: 'browser_action', 
                        method: 'click', 
                        target: 'first cell in the new row or input with placeholder containing "Investor"'
                      },
                      { type: 'wait', duration: 200, reason: 'Field focus' },
                      { type: 'browser_action', method: 'type', target: 'focused input', data: '{{state.extractedInfo.investorName}}' },
                      
                      // Move to Contact Person field
                      { type: 'browser_action', method: 'click', target: 'press Tab or click next cell' },
                      { type: 'wait', duration: 200, reason: 'Field transition' },
                      { type: 'browser_action', method: 'type', target: 'focused input', data: '{{state.extractedInfo.contactPerson}}' },
                      
                      // Move to Email field
                      { type: 'browser_action', method: 'click', target: 'press Tab or click next cell' },
                      { type: 'wait', duration: 200, reason: 'Field transition' },
                      { type: 'browser_action', method: 'type', target: 'focused input', data: '{{newInvestor.senderEmail}}' }
                    ]
                  },
                  catch: {
                    type: 'sequence',
                    nodes: [
                      // Fallback: Try clicking on the row and typing directly
                      { type: 'browser_action', method: 'click', target: 'new empty row in the table' },
                      { type: 'wait', duration: 500, reason: 'Row selection' },
                      { type: 'browser_action', method: 'type', target: 'selected cell', data: '{{state.extractedInfo.investorName || newInvestor.senderName}}' },
                      { type: 'browser_action', method: 'type', target: 'press Tab', data: '' },
                      { type: 'browser_action', method: 'type', target: 'selected cell', data: '{{state.extractedInfo.contactPerson || newInvestor.senderName}}' },
                      { type: 'browser_action', method: 'type', target: 'press Tab', data: '' },
                      { type: 'browser_action', method: 'type', target: 'selected cell', data: '{{newInvestor.senderEmail}}' }
                    ]
                  }
                },
                
                // Set Stage dropdown
                { type: 'browser_action', method: 'click', target: 'Stage dropdown' },
                { type: 'browser_action', method: 'click', target: '{{state.crmContent.stage}} option' },
                
                // Set dates and content
                { type: 'browser_action', method: 'type', target: 'Last Interaction field', data: '{{newInvestor.date}}' },
                { type: 'browser_action', method: 'type', target: 'Thread Summary field', data: '{{state.crmContent.threadSummary}}' },
                { type: 'browser_action', method: 'type', target: 'Next Step field', data: '{{state.crmContent.nextStep}}' },
                { type: 'browser_action', method: 'type', target: 'Interactions field', data: '{{state.interactionEntry}}' },
                
                // Check follow-up if needed
                {
                  type: 'route',
                  value: 'state.crmContent.followUpNeeded',
                  paths: {
                    'true': { type: 'browser_action', method: 'click', target: 'Follow-up Needed checkbox' },
                    'false': { type: 'memory', operation: 'set', data: { skip: true } }
                  }
                },
                
                // Save record
                { type: 'browser_action', method: 'click', target: 'Save button or press Enter' },
                { type: 'wait', duration: 1000, reason: 'Record save' },
                
                // Back to Gmail
                { type: 'browser_action', method: 'switchTab', target: 'main' },
                
                // Track completion
                {
                  type: 'transform',
                  input: ['state.processedNew', 'newInvestor.senderEmail'],
                  function: '(processed, email) => [...(processed || []), email]',
                  output: 'state.processedNew'
                }
              ]
            }
          }
        ]
      },
      
      // PHASE 4: Update EXISTING Investor Records
      {
        type: 'sequence',
        name: 'Phase 4: Update Existing Records',
        nodes: [
          {
            type: 'iterate',
            over: 'state.categorizedEmails.update',
            as: 'updateEmail',
            body: {
              type: 'sequence',
              name: 'Update Existing Record',
              nodes: [
                // Click email to open
                { type: 'browser_action', method: 'click', target: 'email with subject "{{updateEmail.subject}}"' },
                { type: 'wait', duration: 500, reason: 'Email open' },
                
                // Extract new content
                {
                  type: 'browser_query',
                  method: 'extract',
                  instruction: 'Extract the latest message from this email thread',
                  schema: {
                    latestMessage: { type: 'string' },
                    threadContext: { type: 'string' }
                  }
                },
                
                // Generate update content
                {
                  type: 'cognition',
                  prompt: `Generate CRM update for existing investor.

Current record:
- Stage: {{updateEmail.existingRecord.stage}}
- Last summary: {{updateEmail.existingRecord.threadSummary}}

New email: {{state.latestMessage}}

Create:
1. New thread summary (incorporate previous context)
2. Updated stage if progression detected
3. New next step
4. Whether follow-up is needed

Return JSON with: newSummary, newStage, nextStep, followUpNeeded`,
                  input: 'state.latestMessage',
                  output: 'state.updateContent',
                  model: 'gpt-4o-mini'
                },
                
                // Format new interaction entry
                {
                  type: 'transform',
                  input: ['updateEmail.date', 'state.latestMessage'],
                  function: `(date, message) => {
                    const d = new Date(date);
                    const formatted = d.toISOString().split('T')[0];
                    let action = 'Follow-up discussion';
                    if (message.includes('meeting')) action = 'Meeting scheduled';
                    if (message.includes('diligence')) action = 'Due diligence request';
                    if (message.includes('deck')) action = 'Deck shared';
                    return formatted + ': ' + action;
                  }`,
                  output: 'state.newInteraction'
                },
                
                // Switch to Airtable
                { type: 'browser_action', method: 'switchTab', target: 'airtable' },
                { type: 'wait', duration: 500, reason: 'Tab switch' },
                
                // Search for record
                { type: 'browser_action', method: 'click', target: 'search or filter icon' },
                { type: 'browser_action', method: 'type', target: 'search field', data: '{{updateEmail.senderEmail}}' },
                { type: 'browser_action', method: 'click', target: 'search button or Enter' },
                { type: 'wait', duration: 1000, reason: 'Search results' },
                
                // Open record
                { type: 'browser_action', method: 'click', target: 'first record in results' },
                { type: 'wait', duration: 500, reason: 'Record open' },
                
                // Update fields
                { type: 'browser_action', method: 'click', target: 'Last Interaction field' },
                { type: 'browser_action', method: 'type', target: 'Last Interaction field', data: '{{updateEmail.date}}' },
                
                // Update stage if changed
                {
                  type: 'route',
                  value: 'state.updateContent.newStage',
                  paths: {
                    '{{updateEmail.existingRecord.stage}}': { type: 'memory', operation: 'set', data: { sameStage: true } },
                    'default': {
                      type: 'sequence',
                      nodes: [
                        { type: 'browser_action', method: 'click', target: 'Stage dropdown' },
                        { type: 'browser_action', method: 'click', target: '{{state.updateContent.newStage}} option' }
                      ]
                    }
                  }
                },
                
                // Update thread summary
                { type: 'browser_action', method: 'click', target: 'Thread Summary field' },
                { type: 'browser_action', method: 'type', target: 'Thread Summary field', data: '{{state.updateContent.newSummary}}' },
                
                // Update next step
                { type: 'browser_action', method: 'click', target: 'Next Step field' },
                { type: 'browser_action', method: 'type', target: 'Next Step field', data: '{{state.updateContent.nextStep}}' },
                
                // Append to interactions
                { type: 'browser_action', method: 'click', target: 'Interactions field' },
                { type: 'browser_action', method: 'click', target: 'end of Interactions text' },
                { type: 'browser_action', method: 'type', target: 'Interactions field', data: ', {{state.newInteraction}}' },
                
                // Update follow-up checkbox
                {
                  type: 'route',
                  value: 'state.updateContent.followUpNeeded',
                  paths: {
                    'true': { type: 'browser_action', method: 'click', target: 'Follow-up Needed checkbox to check it' },
                    'false': { type: 'browser_action', method: 'click', target: 'Follow-up Needed checkbox to uncheck it' }
                  }
                },
                
                // Save and close
                { type: 'browser_action', method: 'click', target: 'Save button or close button' },
                { type: 'wait', duration: 1000, reason: 'Save changes' },
                
                // Clear search
                { type: 'browser_action', method: 'click', target: 'clear search or X in search field' },
                
                // Back to Gmail
                { type: 'browser_action', method: 'switchTab', target: 'main' },
                
                // Track completion
                {
                  type: 'transform',
                  input: ['state.processedUpdates', 'updateEmail.senderEmail'],
                  function: '(processed, email) => [...(processed || []), email]',
                  output: 'state.processedUpdates'
                }
              ]
            }
          }
        ]
      },
      
      // PHASE 5: Summary and Cleanup
      {
        type: 'sequence',
        name: 'Phase 5: Summary',
        nodes: [
          {
            type: 'memory',
            operation: 'set',
            data: {
              workflowComplete: true,
              summary: '✅ CRM Sync Complete! Check processedNew and processedUpdates for details.'
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
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [debugPanels, setDebugPanels] = useState(new Set());

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
              <button
                onClick={() => {
                  const allNodeIds = ['1.1', '1.2', '1.7', '2.5b', '2.6', '2.7', '2.8', 'loop'];
                  if (expandedNodes.size > 0) {
                    setExpandedNodes(new Set());
                  } else {
                    setExpandedNodes(new Set(allNodeIds));
                  }
                }}
                className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
              >
                {expandedNodes.size > 0 ? 'Collapse All' : 'Expand All'}
              </button>
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
                    <NodeButton
                      node={{ type: 'browser_action', method: 'goto', target: 'https://accounts.google.com/signin/v2/identifier?service=mail' }}
                      label="1.1 Navigate to Gmail Login"
                      onClick={() => executeNode({ type: 'browser_action', method: 'goto', target: 'https://accounts.google.com/signin/v2/identifier?service=mail' })}
                      disabled={!isConnected || isExecuting}
                      expanded={expandedNodes.has('1.1')}
                      onToggleExpand={() => {
                        const newExpanded = new Set(expandedNodes);
                        if (newExpanded.has('1.1')) newExpanded.delete('1.1');
                        else newExpanded.add('1.1');
                        setExpandedNodes(newExpanded);
                      }}
                    />
                    <NodeButton
                      node={{ type: 'browser_query', method: 'extract', instruction: 'Check if already logged into Gmail or if login page is shown', schema: { isLoggedIn: { type: 'boolean' } } }}
                      label="1.2 Check Gmail Login Status"
                      onClick={() => executeNode({ type: 'browser_query', method: 'extract', instruction: 'Check if already logged into Gmail or if login page is shown', schema: { isLoggedIn: { type: 'boolean' } } })}
                      disabled={!isConnected || isExecuting}
                      expanded={expandedNodes.has('1.2')}
                      onToggleExpand={() => {
                        const newExpanded = new Set(expandedNodes);
                        if (newExpanded.has('1.2')) newExpanded.delete('1.2');
                        else newExpanded.add('1.2');
                        setExpandedNodes(newExpanded);
                      }}
                    />
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
                    <NodeButton
                      node={{ type: 'browser_action', method: 'openNewTab', target: 'https://airtable.com/appTnT68Rt8yHIGV3', data: { name: 'airtable' } }}
                      label="1.7 Open Airtable IRM App in New Tab"
                      onClick={() => executeNode({ type: 'browser_action', method: 'openNewTab', target: 'https://airtable.com/appTnT68Rt8yHIGV3', data: { name: 'airtable' } })}
                      disabled={!isConnected || isExecuting}
                      expanded={expandedNodes.has('1.7')}
                      onToggleExpand={() => {
                        const newExpanded = new Set(expandedNodes);
                        if (newExpanded.has('1.7')) newExpanded.delete('1.7');
                        else newExpanded.add('1.7');
                        setExpandedNodes(newExpanded);
                      }}
                    />
                    <button
                      onClick={() => executeNode({ type: 'browser_action', method: 'click', target: 'Continue with Google button or Sign in with Google' })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      1.8 Click Continue with Google
                    </button>
                    <button
                      onClick={() => executeNode({ 
                        type: 'browser_query', 
                        method: 'extract', 
                        instruction: 'Check what is shown: account chooser with multiple accounts, single account confirmation, or login form', 
                        schema: { 
                          hasAccountChooser: { type: 'boolean' },
                          hasSingleAccountConfirm: { type: 'boolean' },
                          hasLoginForm: { type: 'boolean' },
                          accounts: { type: 'array', items: { type: 'string' } }
                        } 
                      })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      1.8a Check Google Auth State
                    </button>
                    <button
                      onClick={() => executeNode({ type: 'browser_action', method: 'click', target: 'account that contains "michaelburner595@gmail.com" or "Michael Burner"' })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      1.8b Select Michael Burner Account
                    </button>
                    <button
                      onClick={() => executeNode({ type: 'browser_action', method: 'click', target: 'Continue button or Allow button' })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      1.8c Click Continue/Allow
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
                    <button
                      onClick={() => executeNode({ type: 'memory', operation: 'get', data: ['*'] })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:bg-gray-300 text-sm"
                    >
                      🔍 Debug: Check Tab State
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
                        instruction: 'Extract all visible email threads from inbox. For each email, focus on the FROM field - this is the person/company who SENT the email. Extract: 1) subject: email subject line, 2) senderName: The name in the FROM field (NOT your name), 3) senderEmail: The email address in the FROM field (the sender\'s email, NOT michaelburner595@gmail.com which is the recipient), 4) date: when received, 5) threadId: unique thread identifier. CRITICAL: The senderEmail must be the email address of the person who sent the email TO you, not your own email address.',
                        schema: {
                          emails: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                subject: { type: 'string' },
                                senderName: { type: 'string' },
                                senderEmail: { type: 'string' },
                                date: { type: 'string' },
                                threadId: { type: 'string' }
                              }
                            }
                          }
                        }
                      })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      2.5 Extract Emails (JSON Schema)
                    </button>
                    <button
                      onClick={() => executeNode({
                        type: 'browser_query',
                        method: 'extract',
                        instruction: 'Extract all visible email threads from inbox. For each email, focus on the FROM field - this is the person/company who SENT the email. Extract: 1) subject: email subject line, 2) senderName: The name in the FROM field (NOT your name), 3) senderEmail: The email address in the FROM field (the sender\'s email, NOT michaelburner595@gmail.com which is the recipient), 4) date: when received. CRITICAL: The senderEmail must be the email address of the person who sent the email TO you, not your own email address.'
                      })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      2.5a Extract Emails (No Schema)
                    </button>
                    <NodeButton
                      node={{
                        type: 'browser_query',
                        method: 'extract',
                        instruction: 'Extract all visible email threads from inbox. For each email, focus on the FROM field - this is the person/company who SENT the email. Extract: 1) subject: email subject line, 2) senderName: The name in the FROM field (NOT your name), 3) senderEmail: The email address in the FROM field (the sender\'s email, NOT michaelburner595@gmail.com which is the recipient), 4) date: when received, 5) threadId: unique thread identifier. CRITICAL: The senderEmail must be the email address of the person who sent the email TO you, not your own email address.',
                        schema: {
                          emails: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: SCHEMAS.emailItem
                            }
                          }
                        }
                      }}
                      label="2.5b Extract Emails (Canonical Schema)"
                      onClick={() => executeNode({
                        type: 'browser_query',
                        method: 'extract',
                        instruction: 'Extract all visible email threads from inbox. For each email, focus on the FROM field - this is the person/company who SENT the email. Extract: 1) subject: email subject line, 2) senderName: The name in the FROM field (NOT your name), 3) senderEmail: The email address in the FROM field (the sender\'s email, NOT michaelburner595@gmail.com which is the recipient), 4) date: when received, 5) threadId: unique thread identifier. CRITICAL: The senderEmail must be the email address of the person who sent the email TO you, not your own email address.',
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
                      expanded={expandedNodes.has('2.5b')}
                      onToggleExpand={() => {
                        const newExpanded = new Set(expandedNodes);
                        if (newExpanded.has('2.5b')) newExpanded.delete('2.5b');
                        else newExpanded.add('2.5b');
                        setExpandedNodes(newExpanded);
                      }}
                    />
                    <NodeButton
                      node={{
                        type: 'memory',
                        operation: 'set',
                        data: {
                          processedEmails: [],
                          successCount: 0,
                          errorCount: 0
                        }
                      }}
                      label="2.6 Initialize Processing State"
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
                      expanded={expandedNodes.has('2.6')}
                      onToggleExpand={() => {
                        const newExpanded = new Set(expandedNodes);
                        if (newExpanded.has('2.6')) newExpanded.delete('2.6');
                        else newExpanded.add('2.6');
                        setExpandedNodes(newExpanded);
                      }}
                    />
                    <NodeButton
                      node={{
                        type: 'cognition',
                        prompt: `Analyze these emails and return a boolean array indicating which are investor-related.
An email is investor-related if it mentions: funding, investment, capital, VC, venture, portfolio, pitch deck, due diligence, or comes from investment firms.
IMPORTANT: Return ONLY a JSON array of booleans, same length as input.
Example: [true, false, true, false]`,
                        input: 'state.emails',
                        output: 'state.investorMask',
                        model: 'gpt-4o-mini'
                      }}
                      label="2.7 Classify Investor Emails"
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
                      expanded={expandedNodes.has('2.7')}
                      onToggleExpand={() => {
                        const newExpanded = new Set(expandedNodes);
                        if (newExpanded.has('2.7')) newExpanded.delete('2.7');
                        else newExpanded.add('2.7');
                        setExpandedNodes(newExpanded);
                      }}
                    />
                    <NodeButton
                      node={{
                        type: 'transform',
                        input: ['state.emails', 'state.investorMask'],
                        function: '(emails, mask) => emails.filter((e, i) => mask[i])',
                        output: 'state.investorEmails'
                      }}
                      label="2.8 Apply Filter"
                      onClick={() => executeNode({
                        type: 'transform',
                        input: ['state.emails', 'state.investorMask'],
                        function: '(emails, mask) => emails.filter((e, i) => mask[i])',
                        output: 'state.investorEmails'
                      })}
                      disabled={!isConnected || isExecuting}
                      expanded={expandedNodes.has('2.8')}
                      onToggleExpand={() => {
                        const newExpanded = new Set(expandedNodes);
                        if (newExpanded.has('2.8')) newExpanded.delete('2.8');
                        else newExpanded.add('2.8');
                        setExpandedNodes(newExpanded);
                      }}
                    />
                    
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
                        prompt: 'Create a concise 2-line summary of this investor email thread for CRM notes. Focus on key points, their interest level, and suggested next steps. Return ONLY valid JSON with a single key "summary" containing the text.',
                        input: 'state.emailThread.fullContent',
                        output: 'state.threadSummaryObj'
                      })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      3.4 Generate Thread Summary
                    </button>
                    <button
                      onClick={() => executeNode({
                        type: 'cognition',
                        prompt: `Classify this investor's stage based on the email content. Options are:
- "Interested": Initial outreach, exploring possibilities
- "In Diligence": Requesting documents, deeper discussions
- "Deck Sent": We have sent materials, awaiting response
Return ONLY valid JSON with a single key "stage" containing exactly one of these three values.`,
                        input: 'state.emailThread.fullContent',
                        output: 'state.investorStageObj'
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
                    
                    {/* Airtable Search & Management */}
                    <h4 className="text-md font-medium mt-4 mb-2">Airtable Operations:</h4>
                    <button
                      onClick={() => executeNode({ type: 'browser_action', method: 'click', target: 'search icon or filter button in the toolbar' })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      3.7a Click Search Button
                    </button>
                    <button
                      onClick={() => executeNode({ type: 'browser_action', method: 'type', target: 'search field', data: '{{state.currentEmail.senderEmail}}' })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      3.7b Type Email to Search
                    </button>
                    <button
                      onClick={() => executeNode({ 
                        type: 'browser_query', 
                        method: 'extract',
                        instruction: 'Check if any records are visible in the table. Look for records with email {{state.currentEmail.senderEmail}}',
                        schema: {
                          recordExists: { type: 'boolean' },
                          recordCount: { type: 'number' }
                        }
                      })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      3.7c Check if Record Exists
                    </button>
                    <h4 className="text-md font-medium mt-4 mb-2">Create New Record:</h4>
                    <button
                      onClick={() => executeNode({ type: 'browser_action', method: 'click', target: 'clear search or X button in search field' })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      3.8a Clear Search
                    </button>
                    <button
                      onClick={() => executeNode({ 
                        type: 'browser_action', 
                        method: 'click', 
                        target: 'Add record button (+ icon) in the toolbar or at bottom of table' 
                      })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      3.8b Add New Record
                    </button>
                    <h4 className="text-md font-medium mt-4 mb-2">Update Existing Record:</h4>
                    <button
                      onClick={() => executeNode({ 
                        type: 'browser_action', 
                        method: 'click', 
                        target: 'first record row in the table' 
                      })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      3.8c Click First Record Row
                    </button>
                    <h4 className="text-md font-medium mt-4 mb-2">Fill Fields:</h4>
                    <button
                      onClick={() => executeNode({ 
                        type: 'browser_action', 
                        method: 'type', 
                        target: 'Investor Name field', 
                        data: '{{state.currentInvestorInfo.investmentFirm}}' 
                      })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      3.9a Fill Investor Name
                    </button>
                    <button
                      onClick={() => executeNode({ 
                        type: 'browser_action', 
                        method: 'type', 
                        target: 'Contact Person field', 
                        data: '{{state.currentInvestorInfo.contactPerson}}' 
                      })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      3.9b Fill Contact Person
                    </button>
                    <button
                      onClick={() => executeNode({ 
                        type: 'browser_action', 
                        method: 'type', 
                        target: 'Email field', 
                        data: '{{state.currentEmail.senderEmail}}' 
                      })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      3.9c Fill Email
                    </button>
                    <button
                      onClick={() => executeNode({ 
                        type: 'browser_action', 
                        method: 'click', 
                        target: 'Stage dropdown field' 
                      })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      3.9d Click Stage Dropdown
                    </button>
                    <button
                      onClick={() => executeNode({ 
                        type: 'browser_action', 
                        method: 'click', 
                        target: '{{state.investorStage}} option in dropdown' 
                      })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      3.9e Select Stage
                    </button>
                    <button
                      onClick={() => executeNode({
                        type: 'browser_action',
                        method: 'type',
                        target: 'Thread Summary / Notes field',
                        data: '{{state.threadSummary}}'
                      })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      3.9f Fill Thread Summary
                    </button>
                    <button
                      onClick={() => executeNode({
                        type: 'browser_action',
                        method: 'click',
                        target: 'Follow-up Needed checkbox'
                      })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      3.9g Check Follow-up
                    </button>
                    <button
                      onClick={() => executeNode({
                        type: 'browser_action',
                        method: 'click',
                        target: 'Save button or click outside to save'
                      })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      3.10 Save Record
                    </button>
                    <button
                      onClick={() => executeNode({ type: 'browser_action', method: 'switchTab', target: 'main' })}
                      disabled={!isConnected || isExecuting}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300 text-sm"
                    >
                      3.11 Back to Gmail
                    </button>
                    
                    {/* Full loop button */}
                    <NodeButton
                      node={{
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
                      }}
                      label="🔄 Process ALL Investor Emails (Loop)"
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
                      expanded={expandedNodes.has('loop')}
                      onToggleExpand={() => {
                        const newExpanded = new Set(expandedNodes);
                        if (newExpanded.has('loop')) newExpanded.delete('loop');
                        else newExpanded.add('loop');
                        setExpandedNodes(newExpanded);
                      }}
                    />
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
              
              {/* Debug Info */}
              {(state.debugClickTarget || state.processingStage) && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <h3 className="font-semibold text-yellow-800 mb-2">🔍 Debug Info</h3>
                  {state.processingStage && (
                    <div className="text-sm"><strong>Stage:</strong> {state.processingStage}</div>
                  )}
                  {state.debugClickTarget && (
                    <div className="text-sm"><strong>Last Click Target:</strong> {state.debugClickTarget}</div>
                  )}
                  {state.debugEmailIndex !== undefined && (
                    <div className="text-sm"><strong>Processing Email:</strong> #{state.debugEmailIndex + 1} of {state.debugTotalEmails}</div>
                  )}
                  {state.currentEmail && (
                    <div className="text-sm"><strong>Current Email:</strong> {state.currentEmail.subject}</div>
                  )}
                </div>
              )}
              
              <div className="bg-gray-50 rounded p-4 font-mono text-sm overflow-auto max-h-96">
                <pre>{JSON.stringify(state, null, 2)}</pre>
              </div>
              
              {/* Enhanced Email Processing Tracker */}
              {state.investorEmails && state.investorEmails.length > 0 && (
                <div className="mt-4 border-2 border-purple-300 rounded-lg p-4 bg-purple-50">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-bold text-purple-800">
                      📧 Investor Email Processor ({state.investorEmails.length} emails)
                    </h3>
                    <div className="text-sm text-purple-600">
                      Processed: {state.processedEmails?.length || 0} | 
                      Remaining: {state.investorEmails.length - (state.processedEmails?.length || 0)}
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                    <div 
                      className="bg-purple-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${((state.processedEmails?.length || 0) / state.investorEmails.length) * 100}%` }}
                    ></div>
                  </div>
                  
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {state.investorEmails.map((email, index) => {
                      const isProcessed = state.processedEmails?.includes(email.subject);
                      const isProcessing = state.currentEmail?.subject === email.subject && state.processingStage;
                      const isCurrent = selectedEmailIndex === index;
                      const isBeingClicked = state.debugClickTarget?.includes(email.subject);
                      
                      return (
                        <div
                          key={index}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            isProcessing 
                              ? 'border-yellow-400 bg-yellow-50 shadow-lg' 
                              : isCurrent 
                                ? 'border-blue-400 bg-blue-50' 
                                : isProcessed
                                  ? 'border-green-300 bg-green-50 opacity-75'
                                  : 'border-gray-300 bg-white hover:border-purple-300'
                          }`}
                        >
                          <div className="flex gap-4">
                            {/* Status Icon */}
                            <div className="flex-shrink-0">
                              {isProcessing ? (
                                <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center animate-pulse">
                                  <span className="text-white text-xl">⚡</span>
                                </div>
                              ) : isProcessed ? (
                                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                                  <span className="text-white text-xl">✓</span>
                                </div>
                              ) : (
                                <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                                  <span className="text-gray-600 text-xl">{index + 1}</span>
                                </div>
                              )}
                            </div>
                            
                            {/* Email Info */}
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-gray-900 truncate">{email.subject}</div>
                              <div className="text-sm text-gray-600">
                                <span className="font-medium">{email.senderName}</span>
                                <span className="text-gray-400 mx-1">•</span>
                                <span className="text-gray-500">{email.senderEmail}</span>
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {email.date} • Thread: {email.threadId}
                              </div>
                              
                              {/* Processing Stage Indicator */}
                              {isProcessing && state.processingStage && (
                                <div className="mt-2 text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded inline-block">
                                  🔄 {state.processingStage}
                                </div>
                              )}
                              
                              {/* Debug: Show if this email is being clicked */}
                              {isBeingClicked && (
                                <div className="mt-1 text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded inline-block">
                                  🎯 Click target detected for this email!
                                </div>
                              )}
                              
                              {/* Extracted Data Preview */}
                              {isProcessed && state.emailResults?.[email.threadId] && (
                                <div className="mt-2 text-xs bg-green-100 p-2 rounded">
                                  <div><strong>Investor:</strong> {state.emailResults[email.threadId].investorName}</div>
                                  <div><strong>Stage:</strong> {state.emailResults[email.threadId].stage}</div>
                                </div>
                              )}
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="flex flex-col gap-2">
                              <button
                                onClick={() => {
                                  setSelectedEmailIndex(index);
                                  setState(prev => ({ 
                                    ...prev, 
                                    currentEmail: email, 
                                    emailIndex: index,
                                    currentEmailSubject: email.subject,
                                    currentEmailSender: email.senderName
                                  }));
                                  addLog(`Selected email #${index + 1}: "${email.subject}"`, 'info');
                                }}
                                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                                  isCurrent 
                                    ? 'bg-blue-600 text-white' 
                                    : 'bg-blue-500 text-white hover:bg-blue-600'
                                }`}
                              >
                                {isCurrent ? '✓ Selected' : 'Select'}
                              </button>
                              
                              {!isProcessed && (
                                <>
                                  <button
                                    onClick={async () => {
                                      setSelectedEmailIndex(index);
                                      setState(prev => ({ 
                                        ...prev, 
                                        currentEmail: email, 
                                        emailIndex: index,
                                        currentEmailSubject: email.subject,
                                        currentEmailSender: email.senderName
                                      }));
                                      addLog(`🚀 Processing email #${index + 1}: "${email.subject}"`, 'success');
                                      
                                      // Execute the single email processing sequence
                                      await executeNode({
                                      type: 'sequence',
                                      name: `Process Email: ${email.subject}`,
                                      nodes: [
                                        // Stage 1: Click the email
                                        {
                                          type: 'sequence',
                                          name: 'Stage 1: Open Email',
                                          nodes: [
                                            { type: 'memory', operation: 'set', data: { processingStage: 'Opening email...' } },
                                            // Debug log
                                            {
                                              type: 'memory',
                                              operation: 'set',
                                              data: {
                                                debugClickTarget: `email with subject "${email.subject}"`,
                                                debugEmailData: JSON.stringify(email),
                                                debugEmailIndex: index,
                                                debugTotalEmails: state.investorEmails.length
                                              }
                                            },
                                            { 
                                              type: 'browser_action', 
                                              method: 'click', 
                                              target: `email with subject "${email.subject}"`
                                            }
                                          ]
                                        },
                                        
                                        // Stage 2: Extract content
                                        {
                                          type: 'sequence',
                                          name: 'Stage 2: Extract Content',
                                          nodes: [
                                            { type: 'memory', operation: 'set', data: { processingStage: 'Reading email content...' } },
                                            {
                                              type: 'browser_query',
                                              method: 'extract',
                                              instruction: 'Extract the full email thread content including all messages',
                                              schema: {
                                                fullContent: { type: 'string' },
                                                latestMessage: { type: 'string' },
                                                threadLength: { type: 'number' }
                                              }
                                            },
                                            { type: 'memory', operation: 'set', data: { 'emailContent': '{{lastExtract.fullContent}}' } }
                                          ]
                                        },
                                        
                                        // Stage 3: Extract investor info
                                        {
                                          type: 'sequence',
                                          name: 'Stage 3: Extract Investor Info',
                                          nodes: [
                                            { type: 'memory', operation: 'set', data: { processingStage: 'Extracting investor details...' } },
                                            {
                                              type: 'browser_query',
                                              method: 'extract',
                                              instruction: 'Extract investor information: company name, contact person, investment firm',
                                              schema: {
                                                investorName: { type: 'string' },
                                                contactPerson: { type: 'string' },
                                                companyName: { type: 'string' },
                                                investmentFirm: { type: 'string' }
                                              }
                                            },
                                            { type: 'memory', operation: 'set', data: { 'currentInvestorInfo': '{{lastExtract}}' } }
                                          ]
                                        },
                                        
                                        // Stage 4: Generate summary
                                        {
                                          type: 'sequence',
                                          name: 'Stage 4: AI Analysis',
                                          nodes: [
                                            { type: 'memory', operation: 'set', data: { processingStage: 'Generating summary...' } },
                                            {
                                              type: 'cognition',
                                              prompt: `Analyze this investor email and create a CRM summary. 

Follow these examples from our CRM:
- "Sent pitch deck after Slush meeting. Lisa reviewing metrics and wants to circle back with questions."
- "Had great meeting. Carla requested specific docs for Tuesday diligence session."
- "Alice Chen from Alpha Ventures thanks Michael for sending the deck, expresses being impressed with the traction in the automation space, and proposes a call for Thursday afternoon to discuss Alpha Ventures' potential involvement in Michael's Series A round."

Be concise but include: what happened, what they want/think, and what's next. Return ONLY valid JSON with key "summary".`,
                                              input: 'state.emailContent',
                                              output: 'state.threadSummaryObj',
                                              model: 'gpt-4o-mini'
                                            },
                                            // Extract just the summary text
                                            {
                                              type: 'transform',
                                              input: 'state.threadSummaryObj',
                                              function: '(obj) => obj.summary',
                                              output: 'state.threadSummary'
                                            },
                                            { type: 'memory', operation: 'set', data: { processingStage: 'Classifying stage...' } },
                                            {
                                              type: 'cognition',
                                              prompt: `Classify this investor email into EXACTLY one of these three stages:

1. "Interested" - Initial interest, asking questions, wants to learn more
2. "In Diligence" - Actively reviewing materials, had meetings, requesting specific docs
3. "Deck Sent" - We sent deck/materials, awaiting their response

Examples:
- "Thanks for sending the deck" → "Deck Sent"
- "Can you send financial projections?" → "In Diligence"
- "Would love to learn more about your product" → "Interested"

Return ONLY valid JSON with key "stage" containing exactly one of the three values above.`,
                                              input: 'state.emailContent',
                                              output: 'state.investorStageObj',
                                              model: 'gpt-4o-mini'
                                            },
                                            // Generate next step
                                            { type: 'memory', operation: 'set', data: { processingStage: 'Generating next steps...' } },
                                            {
                                              type: 'cognition',
                                              prompt: `Based on this investor email, suggest the next action item.

Follow these examples from our CRM:
- "Wait for Lisa's follow-up questions"
- "Await IC decision on deep dive"
- "Send financial projections and customer references by EOD Monday"
- "Schedule follow-up call for next week"

Be specific and action-oriented. Return ONLY valid JSON with key "nextStep".`,
                                              input: 'state.emailContent',
                                              output: 'state.nextStepObj',
                                              model: 'gpt-4o-mini'
                                            },
                                            // Extract just the stage text
                                            {
                                              type: 'transform',
                                              input: 'state.investorStageObj',
                                              function: '(obj) => obj.stage',
                                              output: 'state.investorStage'
                                            }
                                          ]
                                        },
                                        
                                        // Stage 5: Search and Update/Create in Airtable
                                        {
                                          type: 'sequence',
                                          name: 'Stage 5: Airtable Record Management',
                                          nodes: [
                                            { type: 'memory', operation: 'set', data: { processingStage: 'Switching to Airtable...' } },
                                            { type: 'browser_action', method: 'switchTab', target: 'airtable' },
                                            
                                            // Step 5.1: Search for existing record
                                            { type: 'memory', operation: 'set', data: { processingStage: 'Searching for existing record...' } },
                                            // Click search/filter button
                                            { type: 'browser_action', method: 'click', target: 'search icon or filter button in the toolbar' },
                                            // Type email to search
                                            { type: 'browser_action', method: 'type', target: 'search field', data: '{{state.currentEmail.senderEmail}}' },
                                            // Execute search
                                            { type: 'browser_action', method: 'click', target: 'search button or press Enter' },
                                            
                                            // Wait a moment for results
                                            { type: 'wait', duration: 1000, reason: 'Search results' },
                                            
                                            // Check if record exists
                                            {
                                              type: 'browser_query',
                                              method: 'extract',
                                              instruction: 'Check if any records are visible in the table. Look for records with email {{state.currentEmail.senderEmail}}',
                                              schema: {
                                                recordExists: { type: 'boolean' },
                                                recordCount: { type: 'number' }
                                              }
                                            },
                                            
                                            // Step 5.2: Route based on existence
                                            {
                                              type: 'route',
                                              value: 'state.recordExists',
                                              paths: {
                                                'true': {
                                                  // UPDATE EXISTING RECORD
                                                  type: 'sequence',
                                                  name: 'Update Existing Record',
                                                  nodes: [
                                                    { type: 'memory', operation: 'set', data: { processingStage: 'Updating existing record...' } },
                                                    // Click on the existing record to open it
                                                    { type: 'browser_action', method: 'click', target: 'first record row in the table' },
                                                    // Wait for record to open
                                                    { type: 'wait', duration: 500, reason: 'Record to open' },
                                                    
                                                    // Update fields that need updating
                                                    // Update Stage if different
                                                    { type: 'browser_action', method: 'click', target: 'Stage field or dropdown' },
                                                    { type: 'browser_action', method: 'click', target: '{{state.investorStage}} option in dropdown' },
                                                    
                                                    // Update Last Interaction date
                                                    { type: 'browser_action', method: 'click', target: 'Last Interaction date field' },
                                                    { type: 'browser_action', method: 'type', target: 'Last Interaction date field', data: '{{state.currentEmail.date}}' },
                                                    
                                                    // Append to Thread Summary
                                                    { type: 'browser_action', method: 'click', target: 'Thread Summary / Notes field' },
                                                    // Move to end of existing text
                                                    { type: 'browser_action', method: 'click', target: 'end of Thread Summary text' },
                                                    { type: 'browser_action', method: 'type', target: 'Thread Summary / Notes field', data: '\n\n--- {{state.currentEmail.date}} ---\n{{state.threadSummary}}' },
                                                    
                                                    // Check Follow-up Needed
                                                    { type: 'browser_action', method: 'click', target: 'Follow-up Needed checkbox to check it' },
                                                    
                                                    // Close the record
                                                    { type: 'browser_action', method: 'click', target: 'X button or close button to save and close the record' }
                                                  ]
                                                },
                                                'false': {
                                                  // CREATE NEW RECORD
                                                  type: 'sequence',
                                                  name: 'Create New Record',
                                                  nodes: [
                                                    { type: 'memory', operation: 'set', data: { processingStage: 'Creating new record...' } },
                                                    // Clear search first
                                                    { type: 'browser_action', method: 'click', target: 'clear search or X button in search field' },
                                                    
                                                    // Click Add Record
                                                    { type: 'browser_action', method: 'click', target: 'Add record button (+ icon) in the toolbar or at bottom of table' },
                                                    
                                                    // Fill all fields for new record
                                                    { type: 'browser_action', method: 'type', target: 'Investor Name field', data: '{{state.currentInvestorInfo.investmentFirm}}' },
                                                    { type: 'browser_action', method: 'type', target: 'Contact Person field', data: '{{state.currentInvestorInfo.contactPerson}}' },
                                                    { type: 'browser_action', method: 'type', target: 'Email field', data: '{{state.currentEmail.senderEmail}}' },
                                                    
                                                    // Set Stage
                                                    { type: 'browser_action', method: 'click', target: 'Stage dropdown field' },
                                                    { type: 'browser_action', method: 'click', target: '{{state.investorStage}} option in dropdown' },
                                                    
                                                    // Set Last Interaction
                                                    { type: 'browser_action', method: 'type', target: 'Last Interaction date field', data: '{{state.currentEmail.date}}' },
                                                    
                                                    // Add Thread Summary
                                                    { type: 'browser_action', method: 'type', target: 'Thread Summary / Notes field', data: '{{state.threadSummary}}' },
                                                    
                                                    // Check Follow-up Needed
                                                    { type: 'browser_action', method: 'click', target: 'Follow-up Needed checkbox' },
                                                    
                                                    // Add Next Step
                                                    {
                                                      type: 'cognition',
                                                      prompt: 'Based on this email thread, suggest a brief next step action (max 10 words). Return JSON with key "nextStep".',
                                                      input: 'state.emailContent',
                                                      output: 'state.nextStepObj',
                                                      model: 'gpt-4o-mini'
                                                    },
                                                    {
                                                      type: 'transform',
                                                      input: 'state.nextStepObj',
                                                      function: '(obj) => obj.nextStep',
                                                      output: 'state.nextStep'
                                                    },
                                                    { type: 'browser_action', method: 'type', target: 'Next Step / Action field', data: '{{state.nextStep}}' },
                                                    
                                                    // Save the record
                                                    { type: 'browser_action', method: 'click', target: 'Save button or click outside to save' }
                                                  ]
                                                }
                                              }
                                            }
                                          ]
                                        },
                                        
                                        // Stage 6: Finish
                                        {
                                          type: 'sequence',
                                          name: 'Stage 6: Complete',
                                          nodes: [
                                            { type: 'memory', operation: 'set', data: { processingStage: 'Saving...' } },
                                            { type: 'browser_action', method: 'click', target: 'Save button or click outside' },
                                            {
                                              type: 'transform',
                                              input: ['state.processedEmails', 'state.currentEmail.subject'],
                                              function: '(processed, subject) => [...(processed || []), subject]',
                                              output: 'state.processedEmails'
                                            },
                                            {
                                              type: 'transform',
                                              input: ['state.emailResults', 'state.currentEmail', 'state.currentInvestorInfo', 'state.investorStage'],
                                              function: '(results, email, info, stage) => ({ ...(results || {}), [email.threadId]: { ...info, stage, emailSubject: email.subject } })',
                                              output: 'state.emailResults'
                                            },
                                            { type: 'browser_action', method: 'switchTab', target: 'main' },
                                            { type: 'memory', operation: 'set', data: { processingStage: null } }
                                          ]
                                        }
                                      ]
                                    });
                                  }}
                                  disabled={!isConnected || isExecuting}
                                  className="px-3 py-1 bg-green-500 text-white text-xs font-medium rounded hover:bg-green-600 transition-colors"
                                >
                                  Process Email
                                </button>
                                
                                {/* Debug Button */}
                                <button
                                  onClick={() => {
                                    const newDebugPanels = new Set(debugPanels);
                                    if (newDebugPanels.has(index)) {
                                      newDebugPanels.delete(index);
                                    } else {
                                      newDebugPanels.add(index);
                                      // Also select this email
                                      setSelectedEmailIndex(index);
                                      setState(prev => ({ 
                                        ...prev, 
                                        currentEmail: email, 
                                        emailIndex: index,
                                        currentEmailSubject: email.subject,
                                        currentEmailSender: email.senderName
                                      }));
                                    }
                                    setDebugPanels(newDebugPanels);
                                  }}
                                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                                    debugPanels.has(index)
                                      ? 'bg-purple-600 text-white'
                                      : 'bg-purple-500 text-white hover:bg-purple-600'
                                  }`}
                                >
                                  {debugPanels.has(index) ? '🔍 Hide Debug' : '🔍 Debug'}
                                </button>
                                </>
                              )}
                              
                              {isProcessed && (
                                <button
                                  onClick={() => {
                                    // Remove from processed list to allow reprocessing
                                    setState(prev => ({
                                      ...prev,
                                      processedEmails: prev.processedEmails.filter(s => s !== email.subject)
                                    }));
                                    addLog(`Reset email #${index + 1} for reprocessing`, 'info');
                                  }}
                                  className="px-3 py-1 bg-gray-500 text-white text-xs font-medium rounded hover:bg-gray-600 transition-colors"
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                          </div>
                          
                          {/* Debug Panel */}
                          {debugPanels.has(index) && (
                            <div className="mt-4 p-4 bg-gray-50 rounded-lg border-2 border-purple-300">
                              <h4 className="font-bold text-purple-800 mb-3">🛠️ Step-by-Step Debugger</h4>
                              <div className="space-y-2">
                                {/* Stage 1: Open Email */}
                                <div className="border rounded p-2 bg-white">
                                  <div className="flex justify-between items-center">
                                    <span className="font-medium text-sm">1️⃣ Open Email</span>
                                    <button
                                      onClick={() => executeNode({
                                        type: 'browser_action',
                                        method: 'click',
                                        target: `email with subject "${email.subject}"`
                                      })}
                                      disabled={!isConnected || isExecuting}
                                      className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                                    >
                                      Execute
                                    </button>
                                  </div>
                                  <div className="text-xs text-gray-600 mt-1">Click on the email in Gmail</div>
                                </div>

                                {/* Stage 2: Extract Content */}
                                <div className="border rounded p-2 bg-white">
                                  <div className="flex justify-between items-center">
                                    <span className="font-medium text-sm">2️⃣ Extract Email Content</span>
                                    <button
                                      onClick={() => executeNode({
                                        type: 'browser_query',
                                        method: 'extract',
                                        instruction: 'Extract the full email thread content including all messages',
                                        schema: {
                                          fullContent: { type: 'string' },
                                          latestMessage: { type: 'string' },
                                          threadLength: { type: 'number' }
                                        }
                                      })}
                                      disabled={!isConnected || isExecuting}
                                      className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                                    >
                                      Execute
                                    </button>
                                  </div>
                                  <div className="text-xs text-gray-600 mt-1">Extract thread content from opened email</div>
                                  {state.fullContent && (
                                    <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
                                      <strong>Extracted:</strong> {state.fullContent.substring(0, 100)}...
                                    </div>
                                  )}
                                </div>

                                {/* Stage 3: Extract Investor Info */}
                                <div className="border rounded p-2 bg-white">
                                  <div className="flex justify-between items-center">
                                    <span className="font-medium text-sm">3️⃣ Extract Investor Info</span>
                                    <button
                                      onClick={() => executeNode({
                                        type: 'browser_query',
                                        method: 'extract',
                                        instruction: 'Extract investor information: company name, contact person, investment firm',
                                        schema: {
                                          investorName: { type: 'string' },
                                          contactPerson: { type: 'string' },
                                          companyName: { type: 'string' },
                                          investmentFirm: { type: 'string' }
                                        }
                                      })}
                                      disabled={!isConnected || isExecuting}
                                      className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                                    >
                                      Execute
                                    </button>
                                  </div>
                                  <div className="text-xs text-gray-600 mt-1">Extract investor details from email</div>
                                  {state.investorName && (
                                    <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
                                      <div><strong>Investor:</strong> {state.investorName}</div>
                                      <div><strong>Contact:</strong> {state.contactPerson}</div>
                                      <div><strong>Firm:</strong> {state.investmentFirm}</div>
                                    </div>
                                  )}
                                </div>

                                {/* Stage 4: AI Analysis */}
                                <div className="border rounded p-2 bg-white">
                                  <div className="flex justify-between items-center">
                                    <span className="font-medium text-sm">4️⃣ AI Summary & Classification</span>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => executeNode({
                                          type: 'cognition',
                                          prompt: 'Create a concise 2-line summary of this investor email for CRM notes. Return ONLY valid JSON with a single key "summary" containing the text.',
                                          input: 'state.fullContent',
                                          output: 'state.threadSummaryObj',
                                          model: 'gpt-4o-mini'
                                        })}
                                        disabled={!isConnected || isExecuting || !state.fullContent}
                                        className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                                      >
                                        Summary
                                      </button>
                                      <button
                                        onClick={() => executeNode({
                                          type: 'cognition',
                                          prompt: 'Classify this investor email into one of these stages: "Interested", "In Diligence", or "Deck Sent". Return ONLY valid JSON with a single key "stage" containing exactly one of these three values.',
                                          input: 'state.fullContent',
                                          output: 'state.investorStageObj',
                                          model: 'gpt-4o-mini'
                                        })}
                                        disabled={!isConnected || isExecuting || !state.fullContent}
                                        className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                                      >
                                        Classify
                                      </button>
                                    </div>
                                  </div>
                                  <div className="text-xs text-gray-600 mt-1">Generate summary and classify investor stage</div>
                                  {(state.threadSummaryObj || state.investorStageObj) && (
                                    <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
                                      {state.threadSummaryObj && <div><strong>Summary:</strong> {state.threadSummaryObj.summary}</div>}
                                      {state.investorStageObj && <div><strong>Stage:</strong> {state.investorStageObj.stage}</div>}
                                    </div>
                                  )}
                                </div>

                                {/* Stage 5: Intelligent Airtable Operations */}
                                <div className="border rounded p-2 bg-white">
                                  <div className="flex justify-between items-center">
                                    <span className="font-medium text-sm">5️⃣ Intelligent Airtable Sync</span>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => executeNode({
                                          type: 'browser_action',
                                          method: 'switchTab',
                                          target: 'airtable'
                                        })}
                                        disabled={!isConnected || isExecuting}
                                        className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                                      >
                                        Switch Tab
                                      </button>
                                      <button
                                        onClick={async () => {
                                          // Download all Airtable data first
                                          await executeNode({
                                            type: 'browser_query',
                                            method: 'extract',
                                            instruction: 'Extract ALL investor records from the table. Get every row with all columns.',
                                            schema: {
                                              existingRecords: {
                                                type: 'array',
                                                items: {
                                                  type: 'object',
                                                  properties: {
                                                    investorName: { type: 'string' },
                                                    contactPerson: { type: 'string' },
                                                    email: { type: 'string' },
                                                    stage: { type: 'string' },
                                                    lastInteraction: { type: 'string' },
                                                    threadSummary: { type: 'string' },
                                                    followUpNeeded: { type: 'boolean' },
                                                    nextStep: { type: 'string' },
                                                    interactions: { type: 'string' },
                                                    followUps: { type: 'string' }
                                                  }
                                                }
                                              }
                                            }
                                          });
                                          
                                          // Build lookup
                                          await executeNode({
                                            type: 'transform',
                                            input: 'state.existingRecords',
                                            function: `(data) => {
                                              const lookup = {};
                                              console.log('Debug panel: Building lookup from data:', data);
                                              
                                              // Handle different possible data structures
                                              let records = [];
                                              if (Array.isArray(data)) {
                                                records = data;
                                              } else if (data && typeof data === 'object') {
                                                // Handle nested structure from browser_query
                                                if (data.existingRecords) records = data.existingRecords;
                                                else if (data.records) records = data.records;
                                                else if (data.data) records = data.data;
                                              }
                                              
                                              // Build lookup with normalization
                                              if (Array.isArray(records)) {
                                                records.forEach(r => {
                                                  if (r.email) {
                                                    const normalizedEmail = r.email.toLowerCase().trim();
                                                    lookup[normalizedEmail] = r;
                                                    console.log('Debug panel: Added to lookup:', normalizedEmail);
                                                  }
                                                });
                                              }
                                              console.log('Debug panel: Final lookup keys:', Object.keys(lookup));
                                              return lookup;
                                            }`,
                                            output: 'state.emailLookup'
                                          });
                                        }}
                                        disabled={!isConnected || isExecuting}
                                        className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                                      >
                                        Load CRM Data
                                      </button>
                                      <button
                                        onClick={() => {
                                          const lookup = state.emailLookup || {};
                                          const normalizedEmail = email.senderEmail?.toLowerCase().trim();
                                          console.log('Checking email:', normalizedEmail, 'in lookup keys:', Object.keys(lookup));
                                          const exists = lookup[normalizedEmail];
                                          setState(prev => ({
                                            ...prev,
                                            recordExists: !!exists,
                                            existingRecord: exists
                                          }));
                                          addLog(`Record for ${email.senderEmail}: ${exists ? 'EXISTS (will UPDATE)' : 'NEW (will CREATE)'}`, exists ? 'info' : 'warning');
                                        }}
                                        disabled={!state.emailLookup}
                                        className="px-2 py-1 bg-purple-500 text-white text-xs rounded hover:bg-purple-600"
                                      >
                                        Check Status
                                      </button>
                                    </div>
                                  </div>
                                  <div className="text-xs text-gray-600 mt-1">Intelligent record creation/update based on existing data</div>
                                  {state.existingRecords && (
                                    <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
                                      <div><strong>Total CRM Records:</strong> {state.existingRecords.length}</div>
                                      {state.recordExists !== undefined && (
                                        <div className="mt-1">
                                          <strong>This email:</strong> {state.recordExists ? 
                                            <span className="text-blue-600">UPDATE existing record</span> : 
                                            <span className="text-green-600">CREATE new record</span>
                                          }
                                        </div>
                                      )}
                                      {state.existingRecord && (
                                        <div className="mt-2 p-2 bg-blue-50 rounded">
                                          <div className="font-semibold">Existing Record:</div>
                                          <div><strong>Stage:</strong> {state.existingRecord.stage}</div>
                                          <div><strong>Last Summary:</strong> {state.existingRecord.threadSummary}</div>
                                          <div><strong>Interactions:</strong> {state.existingRecord.interactions}</div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                                
                                {/* Stage 6: Smart Record Operations */}
                                <div className="border rounded p-2 bg-white">
                                  <div className="flex justify-between items-center">
                                    <span className="font-medium text-sm">6️⃣ Create/Update Record</span>
                                    <div className="flex gap-2">
                                      {state.recordExists === false && (
                                        <button
                                          onClick={() => executeNode({
                                            type: 'sequence',
                                            nodes: [
                                              { type: 'browser_action', method: 'click', target: 'Add record button or + button' },
                                              { type: 'wait', duration: 500, reason: 'New record form' },
                                              { type: 'browser_action', method: 'type', target: 'Investor Name field', data: state.extractedInfo?.investorName || '' },
                                              { type: 'browser_action', method: 'type', target: 'Contact Person field', data: state.extractedInfo?.contactPerson || '' },
                                              { type: 'browser_action', method: 'type', target: 'Email field', data: email.senderEmail }
                                            ]
                                          })}
                                          disabled={!isConnected || isExecuting}
                                          className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                                        >
                                          Create New
                                        </button>
                                      )}
                                      {state.recordExists === true && (
                                        <button
                                          onClick={() => executeNode({
                                            type: 'sequence',
                                            nodes: [
                                              { type: 'browser_action', method: 'click', target: 'search or filter icon' },
                                              { type: 'browser_action', method: 'type', target: 'search field', data: email.senderEmail },
                                              { type: 'browser_action', method: 'click', target: 'search button or Enter' },
                                              { type: 'wait', duration: 1000, reason: 'Search results' },
                                              { type: 'browser_action', method: 'click', target: 'first record in results' }
                                            ]
                                          })}
                                          disabled={!isConnected || isExecuting}
                                          className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                                        >
                                          Open Existing
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-xs text-gray-600 mt-1">
                                    {state.recordExists === false ? 'Create new investor record' : 
                                     state.recordExists === true ? 'Update existing record with new interaction' : 
                                     'Check record status first'}
                                  </div>
                                </div>

                                {/* Quick Actions */}
                                <div className="mt-3 pt-3 border-t">
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => executeNode({
                                        type: 'browser_action',
                                        method: 'switchTab',
                                        target: 'main'
                                      })}
                                      disabled={!isConnected || isExecuting}
                                      className="px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                                    >
                                      Back to Gmail
                                    </button>
                                    <button
                                      onClick={() => executeNode({
                                        type: 'memory',
                                        operation: 'set',
                                        data: {
                                          currentEmail: email,
                                          emailIndex: index,
                                          processingStage: 'Debug mode'
                                        }
                                      })}
                                      disabled={!isConnected || isExecuting}
                                      className="px-3 py-1 bg-yellow-500 text-white text-xs rounded hover:bg-yellow-600"
                                    >
                                      Set Context
                                    </button>
                                    <button
                                      onClick={() => {
                                        addLog(`Current state for email #${index + 1}:`, 'info');
                                        addLog(JSON.stringify({
                                          currentEmail: state.currentEmail,
                                          fullContent: state.fullContent?.substring(0, 100) + '...',
                                          investorInfo: {
                                            name: state.investorName,
                                            contact: state.contactPerson,
                                            firm: state.investmentFirm
                                          },
                                          summary: state.threadSummaryObj,
                                          stage: state.investorStageObj,
                                          recordExists: state.recordExists
                                        }, null, 2), 'debug');
                                      }}
                                      className="px-3 py-1 bg-purple-500 text-white text-xs rounded hover:bg-purple-600"
                                    >
                                      Log State
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Batch Actions */}
                  <div className="mt-4 flex gap-2 border-t pt-4">
                    <button
                      onClick={() => executeNode({
                        type: 'iterate',
                        over: 'state.investorEmails',
                        as: 'currentEmail',
                        index: 'emailIndex',
                        body: SAMPLE_WORKFLOWS.gmailAirtableFull.nodes[2].body
                      })}
                      disabled={!isConnected || isExecuting || !state.investorEmails}
                      className="px-4 py-2 bg-purple-600 text-white font-medium rounded hover:bg-purple-700 transition-colors"
                    >
                      🚀 Process All Emails
                    </button>
                    
                    <button
                      onClick={() => {
                        setState(prev => ({
                          ...prev,
                          processedEmails: [],
                          emailResults: {}
                        }));
                        addLog('Reset all email processing status', 'info');
                      }}
                      className="px-4 py-2 bg-gray-500 text-white font-medium rounded hover:bg-gray-600 transition-colors"
                    >
                      Reset All
                    </button>
                    
                    <button
                      onClick={() => {
                        const results = state.emailResults || {};
                        const summary = Object.entries(results).map(([threadId, data]) => 
                          `${data.investorName} (${data.stage})`
                        ).join('\n');
                        addLog(`Processed ${Object.keys(results).length} emails:\n${summary}`, 'success');
                      }}
                      disabled={!state.emailResults || Object.keys(state.emailResults).length === 0}
                      className="px-4 py-2 bg-blue-500 text-white font-medium rounded hover:bg-blue-600 transition-colors"
                    >
                      📊 Show Summary
                    </button>
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