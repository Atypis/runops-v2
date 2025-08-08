const StateManager = require('./state-manager');

/**
 * Example: Using StateManager in a workflow execution context
 * 
 * This demonstrates how the StateManager would be used in a real
 * workflow engine to manage state across different steps.
 */

// Initialize state manager with workflow context
const state = new StateManager({
  workflow: {
    id: 'email-investor-crm',
    name: 'Email to CRM Workflow',
    startTime: new Date().toISOString()
  },
  credentials: {
    gmail: {
      user: 'user@example.com',
      authenticated: true
    },
    airtable: {
      apiKey: '***hidden***',
      baseId: 'appXXXXXX'
    }
  },
  emails: [],
  currentEmail: null,
  processedCount: 0,
  errors: []
});

console.log('🚀 Workflow Execution Example\n');

// Step 1: Fetch emails
console.log('📧 Step 1: Fetching emails...');
const mockEmails = [
  {
    id: 'email1',
    subject: 'Re: Series A Investment Interest',
    sender: 'john@techventures.com',
    body: 'We are interested in leading your Series A round...',
    date: '2025-06-20T10:00:00Z'
  },
  {
    id: 'email2',
    subject: 'Follow-up: Due Diligence Documents',
    sender: 'sarah@capitalpartners.com',
    body: 'Thank you for the pitch deck. We would like to proceed...',
    date: '2025-06-20T11:00:00Z'
  },
  {
    id: 'email3',
    subject: 'Newsletter: Weekly Tech Updates',
    sender: 'newsletter@techweekly.com',
    body: 'This week in tech news...',
    date: '2025-06-20T09:00:00Z'
  }
];

state.set('emails', mockEmails);
console.log(`✅ Fetched ${mockEmails.length} emails\n`);

// Step 2: Process each email
console.log('🔄 Step 2: Processing emails...');

for (let i = 0; i < mockEmails.length; i++) {
  const emailPath = `emails[${i}]`;
  const email = state.get(emailPath);
  
  // Set current email for template resolution
  state.set('currentEmail', email);
  state.set('currentEmailIndex', i);
  
  console.log(`\n📨 Processing email ${i + 1}/${mockEmails.length}: "${email.subject}"`);
  
  // Step 2a: Check if email is from investor
  const investorKeywords = ['investment', 'funding', 'series', 'capital', 'venture', 'due diligence'];
  const isInvestorEmail = investorKeywords.some(keyword => 
    email.subject.toLowerCase().includes(keyword) || 
    email.body.toLowerCase().includes(keyword)
  );
  
  if (!isInvestorEmail) {
    console.log('   ⏭️  Skipping - not an investor email');
    state.set(`${emailPath}.skipped`, true);
    state.set(`${emailPath}.reason`, 'Not investor-related');
    continue;
  }
  
  // Step 2b: Extract investor information
  console.log('   🔍 Extracting investor information...');
  
  // Mock extraction logic
  const extractedData = {
    investorName: email.sender.split('@')[0].replace(/[^a-zA-Z]/g, ' ').trim(),
    company: email.sender.split('@')[1].split('.')[0],
    email: email.sender,
    stage: email.subject.toLowerCase().includes('series a') ? 'Series A' : 'Unknown',
    status: 'Active',
    lastContact: email.date,
    notes: state.resolveTemplate('Email subject: "{{currentEmail.subject}}" - Showing interest')
  };
  
  state.set(`${emailPath}.extracted`, extractedData);
  console.log(`   ✅ Extracted: ${extractedData.investorName} from ${extractedData.company}`);
  
  // Step 2c: Prepare CRM record
  console.log('   📊 Preparing CRM record...');
  
  const crmRecord = {
    fields: {
      'Name': extractedData.investorName,
      'Company': extractedData.company,
      'Email': extractedData.email,
      'Stage': extractedData.stage,
      'Status': extractedData.status,
      'Last Contact': extractedData.lastContact,
      'Notes': extractedData.notes,
      'Source': 'Email - Automated Import',
      'Added Date': new Date().toISOString()
    }
  };
  
  state.set(`${emailPath}.crmRecord`, crmRecord);
  
  // Step 2d: Mock CRM submission
  console.log('   📤 Submitting to CRM...');
  
  // Simulate API call
  const success = Math.random() > 0.1; // 90% success rate
  
  if (success) {
    const recordId = `rec${Math.random().toString(36).substr(2, 9)}`;
    state.set(`${emailPath}.crmRecordId`, recordId);
    state.set(`${emailPath}.processed`, true);
    state.set('processedCount', state.get('processedCount') + 1);
    console.log(`   ✅ Created CRM record: ${recordId}`);
  } else {
    const error = {
      timestamp: new Date().toISOString(),
      emailId: email.id,
      error: 'CRM API Error: Rate limit exceeded'
    };
    
    // Add to errors array
    const errors = state.get('errors');
    errors.push(error);
    state.set('errors', errors);
    state.set(`${emailPath}.error`, error.error);
    console.log(`   ❌ Failed: ${error.error}`);
  }
}

// Step 3: Generate summary
console.log('\n\n📋 Step 3: Generating summary...\n');

const summary = {
  totalEmails: state.get('emails').length,
  processedCount: state.get('processedCount'),
  skippedCount: 0,
  errorCount: state.get('errors').length,
  investors: []
};

// Count skipped and collect investor details
const emails = state.get('emails');
emails.forEach((email, index) => {
  if (state.get(`emails[${index}].skipped`)) {
    summary.skippedCount++;
  } else if (state.get(`emails[${index}].processed`)) {
    const extracted = state.get(`emails[${index}].extracted`);
    summary.investors.push({
      name: extracted.investorName,
      company: extracted.company,
      crmId: state.get(`emails[${index}].crmRecordId`)
    });
  }
});

state.set('summary', summary);

// Display summary
console.log('========================================');
console.log('📊 WORKFLOW EXECUTION SUMMARY');
console.log('========================================');
console.log(`Total Emails Processed: ${summary.totalEmails}`);
console.log(`Successfully Added to CRM: ${summary.processedCount}`);
console.log(`Skipped (Non-investor): ${summary.skippedCount}`);
console.log(`Errors: ${summary.errorCount}`);
console.log('\n✅ Investors Added:');
summary.investors.forEach(investor => {
  console.log(`   - ${investor.name} (${investor.company}) - ID: ${investor.crmId}`);
});

if (summary.errorCount > 0) {
  console.log('\n❌ Errors:');
  state.get('errors').forEach(error => {
    console.log(`   - Email ${error.emailId}: ${error.error}`);
  });
}

// Step 4: Show mutation history
console.log('\n\n🔍 Recent State Mutations (last 10):');
const mutations = state.getMutationHistory(10);
mutations.forEach(mutation => {
  console.log(`   ${mutation.timestamp} - ${mutation.operation} "${mutation.path}"`);
});

// Step 5: Create snapshot for recovery
console.log('\n💾 Creating workflow snapshot...');
const snapshot = state.createSnapshot();
console.log(`✅ Snapshot created at ${snapshot.timestamp}`);
console.log(`   State size: ${JSON.stringify(snapshot.state).length} bytes`);
console.log(`   Total mutations: ${snapshot.mutationCount}`);

// Example: Using templates in workflow actions
console.log('\n\n📝 Template Resolution Examples:');

state.set('emailTemplate', {
  to: '{{currentEmail.sender}}',
  subject: 'Re: {{currentEmail.subject}}',
  body: `Dear {{currentEmail.extracted.investorName}},

Thank you for your email regarding "{{currentEmail.subject}}".

We have added your information to our investor CRM and will be in touch soon.

Best regards,
The Team`
});

// Set current email for template context
state.set('currentEmail', emails[0]);

const resolvedTemplate = state.resolveTemplates(state.get('emailTemplate'));
console.log('\nResolved email template:');
console.log('To:', resolvedTemplate.to);
console.log('Subject:', resolvedTemplate.subject);
console.log('Body:', resolvedTemplate.body);

console.log('\n\n✨ Workflow execution complete!');