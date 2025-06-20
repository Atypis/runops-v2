// Advanced Gmail to Airtable workflow with full authentication and error handling
export default {
  id: 'gmail-airtable-advanced',
  version: '2.0.0',
  name: 'Gmail to Airtable CRM Sync (Advanced)',
  description: 'Production-ready investor email extraction with authentication, deduplication, and error handling',
  
  config: {
    credentials: {
      gmail: {
        email: 'michaelburner595@gmail.com',
        password: 'dCdWqhgPzJev6Jz'
      },
      airtable: {
        baseId: 'appTnT68Rt8yHIGV3',
        tableId: 'tblgfPzXfTFnNJgpp'
      }
    },
    searchQuery: 'after:2025/06/01 before:2025/06/03'
  },

  phases: {
    gmailAuth: {
      name: 'Gmail Authentication',
      description: 'Navigate to Gmail and handle login if needed',
      nodes: ['navigateGmail', 'waitForGmailLoad', 'checkGmailAuth', 'handleGmailLogin']
    },
    airtableAuth: {
      name: 'Airtable Authentication',
      description: 'Open Airtable and handle Google sign-in',
      nodes: ['openAirtable', 'waitForAirtableLoad', 'checkAirtableAuth', 'handleAirtableLogin', 'verifyAirtableAccess']
    },
    dataPrep: {
      name: 'Data Preparation',
      description: 'Download existing CRM data for deduplication',
      nodes: ['waitForTableRender', 'extractExistingRecords', 'buildEmailLookup', 'switchBackToGmail']
    },
    emailExtraction: {
      name: 'Email Search & Extraction',
      description: 'Search Gmail and extract investor emails',
      nodes: ['clickSearchField', 'clearSearchField', 'typeSearchQuery', 'submitSearch', 'waitForResults', 'extractEmailList', 'classifyInvestorEmails', 'categorizeEmails']
    },
    processing: {
      name: 'Process Emails to CRM',
      description: 'Create new records and track updates',
      nodes: ['processNewInvestors', 'logUpdateCount', 'generateSummary']
    }
  },

  nodes: {
    // Gmail Authentication Flow
    navigateGmail: {
      type: 'browser_action',
      method: 'goto',
      target: 'https://mail.google.com',
      description: 'Navigate to Gmail'
    },
    waitForGmailLoad: {
      type: 'wait',
      duration: 3000,
      reason: 'Wait for Gmail page to load'
    },
    checkGmailAuth: {
      type: 'browser_query',
      method: 'extract',
      instruction: 'Check if Gmail inbox is visible (look for compose button or inbox) OR if sign-in form is present (look for email input field)',
      schema: {
        isLoggedIn: { type: 'boolean' },
        hasInbox: { type: 'boolean' },
        hasSignInForm: { type: 'boolean' }
      },
      description: 'Check Gmail authentication status'
    },
    handleGmailLogin: {
      type: 'route',
      value: 'state.isLoggedIn',
      paths: {
        'true': {
          type: 'memory',
          operation: 'set',
          data: { gmailAuthStatus: 'Already logged in' }
        },
        'false': {
          type: 'sequence',
          nodes: [
            {
              type: 'browser_action',
              method: 'type',
              target: 'input[type="email"], input[name="identifier"], #identifierId',
              data: '{{config.credentials.gmail.email}}'
            },
            {
              type: 'browser_action',
              method: 'click',
              target: 'button containing "Next", #identifierNext'
            },
            {
              type: 'wait',
              duration: 2000,
              reason: 'Wait for password field'
            },
            {
              type: 'browser_action',
              method: 'type',
              target: 'input[type="password"], input[name="password"]',
              data: '{{config.credentials.gmail.password}}'
            },
            {
              type: 'browser_action',
              method: 'click',
              target: 'button containing "Sign in", button containing "Next", #passwordNext'
            },
            {
              type: 'wait',
              duration: 3000,
              reason: 'Wait for login completion'
            }
          ]
        }
      },
      description: 'Handle Gmail login if needed'
    },

    // Airtable Authentication Flow
    openAirtable: {
      type: 'browser_action',
      method: 'openNewTab',
      target: 'https://airtable.com/{{config.credentials.airtable.baseId}}/{{config.credentials.airtable.tableId}}',
      data: { name: 'airtable' },
      description: 'Open Airtable in new tab'
    },
    waitForAirtableLoad: {
      type: 'wait',
      duration: 3000,
      reason: 'Wait for Airtable page to load'
    },
    checkAirtableAuth: {
      type: 'browser_query',
      method: 'extract',
      instruction: 'Check if Airtable table is visible (look for table headers or "Add record" button) OR if login page is present (look for "Sign in with Google" button)',
      schema: {
        isLoggedIn: { type: 'boolean' },
        hasTable: { type: 'boolean' },
        hasGoogleSignIn: { type: 'boolean' }
      },
      description: 'Check Airtable authentication status'
    },
    handleAirtableLogin: {
      type: 'route',
      value: 'state.isLoggedIn',
      paths: {
        'true': {
          type: 'memory',
          operation: 'set',
          data: { airtableAuthStatus: 'Already logged in' }
        },
        'false': {
          type: 'sequence',
          nodes: [
            {
              type: 'browser_action',
              method: 'click',
              target: 'button containing "Sign in with Google", button containing "Continue with Google"'
            },
            {
              type: 'wait',
              duration: 2000,
              reason: 'Wait for Google account chooser'
            },
            {
              type: 'browser_query',
              method: 'extract',
              instruction: 'Check what is displayed: account chooser with emails, or email input field',
              schema: {
                hasAccountChooser: { type: 'boolean' },
                accounts: { type: 'array', items: { type: 'string' } }
              }
            },
            {
              type: 'route',
              value: 'state.accounts?.includes("michaelburner595@gmail.com")',
              paths: {
                'true': {
                  type: 'browser_action',
                  method: 'click',
                  target: 'div containing "michaelburner595@gmail.com"'
                },
                'false': {
                  type: 'sequence',
                  nodes: [
                    {
                      type: 'browser_action',
                      method: 'click',
                      target: 'button containing "Use another account", div containing "Use another account"'
                    },
                    {
                      type: 'wait',
                      duration: 1000,
                      reason: 'Wait for email input'
                    },
                    {
                      type: 'browser_action',
                      method: 'type',
                      target: 'input[type="email"]',
                      data: '{{config.credentials.gmail.email}}'
                    },
                    {
                      type: 'browser_action',
                      method: 'click',
                      target: 'button containing "Next"'
                    },
                    {
                      type: 'wait',
                      duration: 2000,
                      reason: 'Wait for password'
                    },
                    {
                      type: 'browser_action',
                      method: 'type',
                      target: 'input[type="password"]',
                      data: '{{config.credentials.gmail.password}}'
                    },
                    {
                      type: 'browser_action',
                      method: 'click',
                      target: 'button containing "Sign in", button containing "Next"'
                    }
                  ]
                }
              }
            },
            {
              type: 'wait',
              duration: 5000,
              reason: 'Wait for Airtable to load after authentication'
            }
          ]
        }
      },
      description: 'Handle Airtable Google sign-in if needed'
    },
    verifyAirtableAccess: {
      type: 'browser_query',
      method: 'extract',
      instruction: 'Verify we can see the Airtable table with headers',
      schema: {
        tableVisible: { type: 'boolean' },
        columnHeaders: { type: 'array', items: { type: 'string' } }
      },
      description: 'Verify Airtable access'
    },

    // Data Preparation
    waitForTableRender: {
      type: 'wait',
      duration: 2000,
      reason: 'Wait for table data to render'
    },
    extractExistingRecords: {
      type: 'handle',
      try: {
        type: 'browser_query',
        method: 'extract',
        instruction: 'Extract ALL visible records from the Airtable table. Get every row with all columns including Investor Name, Contact Person, Email, Stage, Last Interaction, Thread Summary, and any other visible fields',
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
                threadSummary: { type: 'string' }
              }
            }
          }
        }
      },
      catch: {
        type: 'sequence',
        nodes: [
          {
            type: 'wait',
            duration: 2000,
            reason: 'Retry delay'
          },
          {
            type: 'browser_query',
            method: 'extract',
            instruction: 'Get all data from the investor table',
            schema: {
              existingRecords: { type: 'array' }
            }
          }
        ]
      },
      description: 'Extract existing CRM records with retry'
    },
    buildEmailLookup: {
      type: 'transform',
      input: 'state.existingRecords',
      function: `(records) => {
        const lookup = {};
        if (Array.isArray(records)) {
          records.forEach(r => {
            if (r.email) {
              lookup[r.email.toLowerCase().trim()] = r;
            }
          });
        }
        return { lookup, count: Object.keys(lookup).length };
      }`,
      output: 'state.emailData',
      description: 'Build email lookup map for deduplication'
    },
    switchBackToGmail: {
      type: 'browser_action',
      method: 'switchTab',
      target: 'main',
      description: 'Switch back to Gmail tab'
    },

    // Email Extraction
    clickSearchField: {
      type: 'browser_action',
      method: 'click',
      target: 'input[placeholder*="Search"], button[aria-label*="Search"], .gb_Ue',
      description: 'Click Gmail search field'
    },
    clearSearchField: {
      type: 'browser_action',
      method: 'clear',
      target: 'input[placeholder*="Search"]',
      description: 'Clear search field'
    },
    typeSearchQuery: {
      type: 'browser_action',
      method: 'type',
      target: 'input[placeholder*="Search"]',
      data: '{{config.searchQuery}}',
      description: 'Type search query'
    },
    submitSearch: {
      type: 'browser_action',
      method: 'press',
      target: 'Enter',
      description: 'Submit search'
    },
    waitForResults: {
      type: 'wait',
      duration: 3000,
      reason: 'Wait for search results'
    },
    extractEmailList: {
      type: 'browser_query',
      method: 'extract',
      instruction: 'Extract all visible email threads from the search results. For each email get: sender name, sender email address, subject line, date, and preview text if available',
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
              preview: { type: 'string' }
            }
          }
        }
      },
      description: 'Extract email list from search results'
    },
    classifyInvestorEmails: {
      type: 'cognition',
      prompt: 'Analyze these emails and identify which ones are investor-related. Look for keywords: funding, investment, capital, VC, venture, investor, fund, portfolio, deal, term sheet, diligence. Also check if sender domain looks like a VC firm. Return only the investor-related emails.',
      input: 'state.emails',
      output: 'state.investorEmails',
      model: 'gpt-4o-mini',
      description: 'Filter for investor emails using AI'
    },
    categorizeEmails: {
      type: 'transform',
      input: ['state.investorEmails', 'state.emailData.lookup'],
      function: `(emails, lookup) => {
        const newInvestors = [];
        const updates = [];
        
        emails.forEach(email => {
          const key = email.senderEmail?.toLowerCase().trim();
          if (lookup && lookup[key]) {
            updates.push({ ...email, existingRecord: lookup[key] });
          } else {
            newInvestors.push(email);
          }
        });
        
        return { 
          newInvestors, 
          updates,
          stats: {
            totalFound: emails.length,
            new: newInvestors.length,
            existing: updates.length
          }
        };
      }`,
      output: 'state.categorized',
      description: 'Categorize as new or existing investors'
    },

    // Processing
    processNewInvestors: {
      type: 'iterate',
      over: 'state.categorized.newInvestors',
      as: 'newInvestor',
      body: {
        type: 'sequence',
        nodes: [
          // Click on email
          {
            type: 'browser_action',
            method: 'click',
            target: 'tr containing "{{newInvestor.subject}}", div containing "{{newInvestor.subject}}"'
          },
          {
            type: 'wait',
            duration: 1000,
            reason: 'Wait for email to open'
          },
          // Extract detailed info
          {
            type: 'browser_query',
            method: 'extract',
            instruction: 'Extract the full email thread content, all metadata, and identify the investor firm name and contact person details',
            schema: {
              threadContent: { type: 'string' },
              firmName: { type: 'string' },
              personName: { type: 'string' },
              personRole: { type: 'string' }
            }
          },
          // Generate summary
          {
            type: 'cognition',
            prompt: 'Create a 1-2 line CRM summary focusing on: conversation stage (initial outreach, follow-up, etc), key ask or next step, and any specific dates/deadlines',
            input: 'state.threadContent',
            output: 'state.threadSummary',
            model: 'gpt-4o-mini'
          },
          // Switch to Airtable
          {
            type: 'browser_action',
            method: 'switchTab',
            target: 'airtable'
          },
          // Create record
          {
            type: 'browser_action',
            method: 'click',
            target: 'button containing "Add record", button[aria-label*="Add"], .addRecord'
          },
          {
            type: 'wait',
            duration: 500,
            reason: 'Wait for new row'
          },
          // Fill fields
          {
            type: 'browser_action',
            method: 'type',
            target: 'input[placeholder*="Investor Name"], div[data-columnname="Investor Name"] input',
            data: '{{state.firmName}}'
          },
          {
            type: 'browser_action',
            method: 'type',
            target: 'input[placeholder*="Contact Person"], div[data-columnname="Contact Person"] input',
            data: '{{state.personName}}'
          },
          {
            type: 'browser_action',
            method: 'type',
            target: 'input[placeholder*="Email"], div[data-columnname="Email"] input',
            data: '{{newInvestor.senderEmail}}'
          },
          {
            type: 'browser_action',
            method: 'type',
            target: 'input[placeholder*="Stage"], div[data-columnname="Stage"] input',
            data: 'Initial Contact'
          },
          {
            type: 'browser_action',
            method: 'type',
            target: 'input[placeholder*="Last Interaction"], div[data-columnname="Last Interaction"] input',
            data: '{{newInvestor.date}}'
          },
          {
            type: 'browser_action',
            method: 'type',
            target: 'textarea[placeholder*="Thread Summary"], div[data-columnname="Thread Summary"] textarea',
            data: '{{state.threadSummary}}'
          },
          // Save by clicking outside
          {
            type: 'browser_action',
            method: 'click',
            target: 'body'
          },
          {
            type: 'wait',
            duration: 1000,
            reason: 'Wait for save'
          },
          // Back to Gmail
          {
            type: 'browser_action',
            method: 'switchTab',
            target: 'main'
          },
          // Return to inbox
          {
            type: 'browser_action',
            method: 'click',
            target: 'a[aria-label*="Back"], button[aria-label*="Back"], .ar6'
          }
        ]
      },
      description: 'Process each new investor email'
    },
    logUpdateCount: {
      type: 'memory',
      operation: 'set',
      data: {
        updatesNeeded: '{{state.categorized.updates.length}}',
        updateEmails: '{{state.categorized.updates}}'
      },
      description: 'Log existing investors that need updates'
    },
    generateSummary: {
      type: 'transform',
      input: 'state.categorized.stats',
      function: `(stats) => {
        return {
          success: true,
          summary: \`Processed \${stats.totalFound} investor emails: \${stats.new} new investors added, \${stats.existing} existing investors found\`,
          timestamp: new Date().toISOString()
        };
      }`,
      output: 'state.finalSummary',
      description: 'Generate final summary'
    }
  },

  flow: {
    type: 'sequence',
    items: [
      { ref: 'phase:gmailAuth' },
      { ref: 'phase:airtableAuth' },
      { ref: 'phase:dataPrep' },
      { ref: 'phase:emailExtraction' },
      { ref: 'phase:processing' }
    ]
  }
};