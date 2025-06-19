import { chromium } from 'playwright';
import { Stagehand } from '@browserbasehq/stagehand';
import dotenv from 'dotenv';

dotenv.config();

// Test specific workflow patterns from Gmail->Airtable
async function testWorkflowPatterns() {
  console.log('🚀 Testing workflow patterns...');
  
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  const page = context.pages()[0] || await context.newPage();
  
  const stagehand = new Stagehand({ page });
  
  // Pattern 1: Login Flow (if needed)
  await testLoginPattern(stagehand);
  
  // Pattern 2: Email Processing Loop
  await testEmailLoopPattern(stagehand);
  
  // Pattern 3: Airtable Update Pattern
  await testAirtablePattern(stagehand);
}

async function testLoginPattern(stagehand) {
  console.log('\n📧 Testing Gmail Login Pattern...');
  
  // Check if already logged in
  const isLoggedIn = await stagehand.extract({
    instruction: "Check if Gmail inbox is loaded",
    schema: { inboxVisible: "boolean" }
  });
  
  if (isLoggedIn.inboxVisible) {
    console.log('✅ Already logged in!');
    return;
  }
  
  // Login sequence
  console.log('🔐 Logging in...');
  await stagehand.act({ action: "Type email address", data: { email: process.env.GMAIL_EMAIL } });
  await stagehand.act({ action: "Click Next button" });
  await stagehand.page.waitForTimeout(2000);
  await stagehand.act({ action: "Type password", data: { password: process.env.GMAIL_PASSWORD } });
  await stagehand.act({ action: "Click Sign in button" });
}

async function testEmailLoopPattern(stagehand) {
  console.log('\n📨 Testing Email Processing Loop...');
  
  // Extract email list
  const emails = await stagehand.extract({
    instruction: "Extract all visible emails with subject and sender",
    schema: {
      emails: {
        type: "array",
        items: {
          type: "object",
          properties: {
            subject: { type: "string" },
            sender: { type: "string" },
            snippet: { type: "string" }
          }
        }
      }
    }
  });
  
  console.log(`Found ${emails.emails.length} emails`);
  
  // Process first 3 emails as demo
  for (let i = 0; i < Math.min(3, emails.emails.length); i++) {
    const email = emails.emails[i];
    console.log(`\n--- Processing email ${i + 1} ---`);
    console.log(`Subject: ${email.subject}`);
    console.log(`From: ${email.sender}`);
    
    // Click to open
    await stagehand.act({ 
      action: `Click on email with subject "${email.subject}"` 
    });
    
    await stagehand.page.waitForTimeout(1000);
    
    // Extract investor info
    const investorInfo = await stagehand.extract({
      instruction: "Extract investor information if this is an investor email",
      schema: {
        isInvestor: "boolean",
        name: "string",
        company: "string",
        email: "string"
      }
    });
    
    console.log('Investor info:', investorInfo);
    
    // Go back to list
    await stagehand.act({ action: "Go back to email list" });
    await stagehand.page.waitForTimeout(1000);
  }
}

async function testAirtablePattern(stagehand) {
  console.log('\n📊 Testing Airtable Pattern...');
  
  // Navigate to Airtable
  const baseId = process.env.AIRTABLE_BASE_ID;
  await stagehand.page.goto(`https://airtable.com/${baseId}`);
  await stagehand.page.waitForLoadState('networkidle');
  
  // Check if we can see the table
  const tableInfo = await stagehand.extract({
    instruction: "Check if Airtable base is loaded and describe visible fields",
    schema: {
      isLoaded: "boolean",
      visibleFields: {
        type: "array",
        items: { type: "string" }
      }
    }
  });
  
  console.log('Airtable state:', tableInfo);
  
  if (tableInfo.isLoaded) {
    // Try to add a test record
    console.log('🆕 Attempting to add record...');
    
    await stagehand.act({ action: "Click Add record or empty row" });
    await stagehand.page.waitForTimeout(1000);
    
    // Fill test data
    await stagehand.act({ 
      action: "Fill in Name field", 
      data: { text: "Test Investor" } 
    });
    
    console.log('✅ Record interaction complete');
  }
}

// Helper to test specific problem areas
async function testProblemNode() {
  console.log('\n🔧 Testing specific problem node...');
  
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  const page = context.pages()[0] || await context.newPage();
  const stagehand = new Stagehand({ page });
  
  // PUT YOUR PROBLEMATIC NODE TEST HERE
  // Example: That filter_investor_emails node that's giving trouble
  
  const testEmails = [
    { subject: "Weekly Newsletter", sender: "updates@company.com" },
    { subject: "Series A Discussion", sender: "partner@vcfirm.com" },
    { subject: "Invoice #123", sender: "billing@service.com" }
  ];
  
  // Simulate the LLM call locally
  console.log('Input emails:', testEmails);
  
  // This is what your cognition primitive would do
  const prompt = `Classify which emails are investor-related. Return boolean array.
  Investor emails mention: funding, capital, investment, VC, series, partnership.
  
  Emails: ${JSON.stringify(testEmails)}`;
  
  console.log('Classification prompt:', prompt);
  
  // Expected output: [false, true, false]
}

// Run tests
if (process.argv[2] === '--problem') {
  testProblemNode();
} else {
  testWorkflowPatterns();
}