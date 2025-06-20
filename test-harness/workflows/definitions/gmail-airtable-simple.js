// Simplified Gmail to Airtable workflow
export default {
  id: 'gmail-airtable-simple',
  version: '1.0.0',
  name: 'Gmail to Airtable CRM',
  description: 'Extract investor emails from Gmail and sync to Airtable CRM',
  
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
    options: {
      dateRange: 'after:2025/06/01 before:2025/06/03'
    }
  },

  // Phases group related nodes
  phases: {
    setup: {
      name: 'Setup Gmail & Airtable',
      description: 'Login to both platforms',
      nodes: ['navigateGmail', 'openAirtable', 'switchBackToGmail']
    },
    extract: {
      name: 'Extract Emails',
      description: 'Search and extract investor emails',
      nodes: ['searchEmails', 'waitForResults', 'extractEmailList', 'filterInvestors']
    },
    process: {
      name: 'Process to CRM',
      description: 'Create records in Airtable',
      nodes: ['switchToAirtable', 'createRecord']
    }
  },

  // Individual atomic nodes
  nodes: {
    navigateGmail: {
      type: 'browser_action',
      method: 'goto',
      target: 'https://mail.google.com',
      description: 'Open Gmail'
    },
    openAirtable: {
      type: 'browser_action',
      method: 'openNewTab',
      target: 'https://airtable.com/{{config.credentials.airtable.baseId}}',
      data: { name: 'airtable' },
      description: 'Open Airtable in new tab'
    },
    switchBackToGmail: {
      type: 'browser_action',
      method: 'switchTab',
      target: 'main',
      description: 'Switch back to Gmail tab'
    },
    searchEmails: {
      type: 'sequence',
      nodes: [
        {
          type: 'browser_action',
          method: 'click',
          target: 'search mail input field or search button'
        },
        {
          type: 'browser_action',
          method: 'type',
          target: 'search input',
          data: '{{config.options.dateRange}}'
        },
        {
          type: 'browser_action',
          method: 'click',
          target: 'search button or press enter'
        }
      ],
      description: 'Search for emails in date range'
    },
    waitForResults: {
      type: 'wait',
      duration: 3000,
      reason: 'Wait for search results to load'
    },
    extractEmailList: {
      type: 'browser_query',
      method: 'extract',
      instruction: 'Extract all visible email threads with sender name, email, subject, and date',
      schema: {
        emails: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              senderName: { type: 'string' },
              senderEmail: { type: 'string' },
              subject: { type: 'string' },
              date: { type: 'string' }
            }
          }
        }
      },
      description: 'Extract email list'
    },
    filterInvestors: {
      type: 'cognition',
      prompt: 'Analyze these emails and return only the ones that are investor-related (funding, investment, capital, VC, etc). Return the filtered array.',
      input: 'state.emails',
      output: 'state.investorEmails',
      description: 'Filter for investor emails'
    },
    switchToAirtable: {
      type: 'browser_action',
      method: 'switchTab',
      target: 'airtable',
      description: 'Switch to Airtable tab'
    },
    createRecord: {
      type: 'sequence',
      nodes: [
        {
          type: 'browser_action',
          method: 'click',
          target: 'Add record button or + button'
        },
        {
          type: 'wait',
          duration: 1000,
          reason: 'Wait for form'
        },
        {
          type: 'browser_action',
          method: 'type',
          target: 'Investor Name field',
          data: 'Test Investor'
        }
      ],
      description: 'Create Airtable record'
    }
  },

  // Main workflow flow
  flow: {
    type: 'sequence',
    items: [
      { ref: 'phase:setup' },
      { ref: 'phase:extract' },
      { ref: 'phase:process' }
    ]
  }
};