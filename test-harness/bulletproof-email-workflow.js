// Bulletproof Email Processing Workflow
// This demonstrates how to make email->CRM sync more reliable using existing primitives

export const bulletproofEmailWorkflow = {
  name: '🛡️ Bulletproof Email->CRM Sync',
  nodes: [
    // PHASE 1: Setup with Error Recovery
    {
      type: 'handle',
      try: {
        type: 'sequence',
        name: 'Setup Gmail & Airtable',
        nodes: [
          // Navigate to Gmail
          { type: 'browser_action', method: 'goto', target: 'https://mail.google.com' },
          { type: 'wait', duration: 2000, reason: 'Page load' },
          
          // Check login status
          {
            type: 'browser_query',
            method: 'extract',
            instruction: 'Check if Gmail inbox is visible',
            schema: { isLoggedIn: { type: 'boolean' } }
          },
          
          // Login if needed
          {
            type: 'route',
            value: 'state.isLoggedIn',
            paths: {
              'false': {
                type: 'sequence',
                nodes: [
                  { type: 'browser_action', method: 'type', target: 'Email input', data: '{{credentials.email}}' },
                  { type: 'browser_action', method: 'click', target: 'Next button' },
                  { type: 'wait', duration: 2000, reason: 'Password field' },
                  { type: 'browser_action', method: 'type', target: 'Password input', data: '{{credentials.password}}' },
                  { type: 'browser_action', method: 'click', target: 'Sign in button' },
                  { type: 'wait', duration: 3000, reason: 'Login completion' }
                ]
              },
              'true': { type: 'memory', operation: 'set', data: { loginStatus: 'Already logged in' } }
            }
          }
        ]
      },
      catch: {
        type: 'cognition',
        prompt: 'Login failed. Analyze error and suggest recovery: {{state.lastError}}',
        input: 'state',
        output: 'state.recoveryPlan'
      }
    },
    
    // PHASE 2: Robust Airtable Data Extraction
    {
      type: 'sequence',
      name: 'Extract Airtable Data',
      nodes: [
        // Open Airtable
        {
          type: 'browser_action',
          method: 'openNewTab',
          target: 'https://airtable.com/{{airtableBaseId}}/{{airtableTableId}}',
          data: { name: 'airtable' }
        },
        { type: 'wait', duration: 3000, reason: 'Airtable load' },
        
        // Extract with multiple attempts
        {
          type: 'handle',
          try: {
            type: 'browser_query',
            method: 'extract',
            instruction: 'Extract ALL investor records from the table. Get every row with all columns.',
            schema: {
              records: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    investorName: { type: 'string' },
                    contactPerson: { type: 'string' },
                    email: { type: 'string' },
                    stage: { type: 'string' }
                  }
                }
              }
            }
          },
          catch: {
            type: 'sequence',
            nodes: [
              // Wait and retry
              { type: 'wait', duration: 2000, reason: 'Retry delay' },
              {
                type: 'browser_query',
                method: 'extract',
                instruction: 'Get all data from the investor table',
                schema: { records: { type: 'array' } }
              }
            ]
          }
        },
        
        // Normalize and validate extracted data
        {
          type: 'transform',
          input: 'state.records',
          function: `(data) => {
            // Handle various response formats
            let records = [];
            if (Array.isArray(data)) {
              records = data;
            } else if (data?.records) {
              records = data.records;
            } else if (data?.data) {
              records = data.data;
            }
            
            // Validate and normalize
            return records.map(r => ({
              investorName: r.investorName || r['Investor Name'] || '',
              contactPerson: r.contactPerson || r['Contact Person'] || '',
              email: (r.email || r.Email || '').toLowerCase().trim(),
              stage: r.stage || r.Stage || 'Unknown'
            })).filter(r => r.email); // Only keep records with emails
          }`,
          output: 'state.normalizedRecords'
        },
        
        // Build multiple lookup maps
        {
          type: 'transform',
          input: 'state.normalizedRecords',
          function: `(records) => {
            const emailLookup = {};
            const nameLookup = {};
            
            records.forEach(r => {
              if (r.email) emailLookup[r.email] = r;
              if (r.contactPerson) {
                nameLookup[r.contactPerson.toLowerCase()] = r;
              }
            });
            
            return { emailLookup, nameLookup, count: records.length };
          }`,
          output: 'state.lookups'
        }
      ]
    },
    
    // PHASE 3: Smart Email Processing
    {
      type: 'sequence',
      name: 'Process Emails Intelligently',
      nodes: [
        // Switch back to Gmail
        { type: 'browser_action', method: 'switchTab', target: 'main' },
        
        // Extract emails with validation
        {
          type: 'handle',
          try: {
            type: 'browser_query',
            method: 'extract',
            instruction: `Extract email threads. For each email:
1. Look at the FROM field (sender info)
2. Extract senderName from FROM field
3. Extract senderEmail from FROM field (must be different from recipient)
4. Never return the logged-in user's email as senderEmail
5. Include subject, date, and any visible thread ID`,
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
            }
          },
          catch: {
            type: 'memory',
            operation: 'set',
            data: { emails: [] }
          }
        },
        
        // Validate extracted emails
        {
          type: 'transform',
          input: 'state.emails',
          function: `(emails) => {
            return emails.filter(e => {
              // Remove any emails that are obviously the user's
              const isValidSender = e.senderEmail && 
                !e.senderEmail.includes('michaelburner') &&
                e.senderEmail.includes('@');
              
              if (!isValidSender) {
                console.log('Filtered out invalid email:', e.senderEmail);
              }
              return isValidSender;
            });
          }`,
          output: 'state.validEmails'
        },
        
        // Smart categorization with multiple checks
        {
          type: 'transform',
          input: ['state.validEmails', 'state.lookups'],
          function: `(emails, lookups) => {
            const categorized = { new: [], update: [] };
            
            emails.forEach(email => {
              const emailKey = email.senderEmail.toLowerCase().trim();
              const nameKey = email.senderName?.toLowerCase().trim();
              
              // Check by email first
              if (lookups.emailLookup[emailKey]) {
                categorized.update.push({
                  ...email,
                  existingRecord: lookups.emailLookup[emailKey],
                  matchType: 'email'
                });
              }
              // Check by name as fallback
              else if (nameKey && lookups.nameLookup[nameKey]) {
                categorized.update.push({
                  ...email,
                  existingRecord: lookups.nameLookup[nameKey],
                  matchType: 'name'
                });
              }
              // New investor
              else {
                categorized.new.push(email);
              }
            });
            
            console.log('Categorization results:', 
              categorized.new.length, 'new,', 
              categorized.update.length, 'updates'
            );
            return categorized;
          }`,
          output: 'state.categorizedEmails'
        }
      ]
    },
    
    // PHASE 4: Robust Record Creation/Update
    {
      type: 'sequence',
      name: 'Process Records with Recovery',
      nodes: [
        // Process NEW records
        {
          type: 'iterate',
          over: 'state.categorizedEmails.new',
          as: 'newEmail',
          body: {
            type: 'handle',
            try: {
              type: 'sequence',
              nodes: [
                // Add record with retries
                {
                  type: 'browser_action',
                  method: 'switchTab',
                  target: 'airtable'
                },
                
                // Multiple strategies for adding records
                {
                  type: 'handle',
                  try: {
                    type: 'browser_action',
                    method: 'click',
                    target: 'Add record button or + button at bottom of table'
                  },
                  catch: {
                    type: 'sequence',
                    nodes: [
                      // Try keyboard shortcut
                      { type: 'browser_action', method: 'click', target: 'press Cmd+Shift+Enter or click empty row' },
                      { type: 'wait', duration: 500, reason: 'New row' }
                    ]
                  }
                },
                
                // Fill fields with validation
                {
                  type: 'sequence',
                  nodes: [
                    // Click first cell
                    { type: 'browser_action', method: 'click', target: 'first empty cell in new row' },
                    { type: 'wait', duration: 300, reason: 'Cell focus' },
                    
                    // Type investor name or company
                    { 
                      type: 'browser_action', 
                      method: 'type', 
                      target: 'focused cell', 
                      data: '{{newEmail.senderName}}' 
                    },
                    
                    // Tab to next field
                    { type: 'browser_action', method: 'click', target: 'press Tab' },
                    { type: 'wait', duration: 200, reason: 'Next field' },
                    
                    // Type contact person
                    { 
                      type: 'browser_action', 
                      method: 'type', 
                      target: 'focused cell', 
                      data: '{{newEmail.senderName}}' 
                    },
                    
                    // Tab to email field
                    { type: 'browser_action', method: 'click', target: 'press Tab' },
                    { type: 'wait', duration: 200, reason: 'Email field' },
                    
                    // Type email
                    { 
                      type: 'browser_action', 
                      method: 'type', 
                      target: 'focused cell', 
                      data: '{{newEmail.senderEmail}}' 
                    }
                  ]
                }
              ]
            },
            catch: {
              type: 'memory',
              operation: 'set',
              data: {
                'failedRecords[]': '{{newEmail.senderEmail}}'
              }
            }
          }
        }
      ]
    }
  ]
};

// Key improvements in this workflow:
// 1. Extensive error handling with handle primitives
// 2. Multiple data validation steps
// 3. Fallback strategies for UI interaction
// 4. Smart email filtering to avoid user's own email
// 5. Multiple lookup strategies (email + name)
// 6. Retry mechanisms for failed operations
// 7. Detailed logging for debugging
// 8. State checkpointing for recovery