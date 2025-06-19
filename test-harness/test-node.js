import { chromium } from 'playwright';
import { Stagehand } from '@browserbasehq/stagehand';
import dotenv from 'dotenv';

dotenv.config();

// Test individual legacy nodes quickly
async function testSingleNode() {
  console.log('🚀 Connecting to Chrome...');
  
  try {
    // Connect to your running Chrome instance
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    const context = browser.contexts()[0];
    const page = context.pages()[0] || await context.newPage();
    
    // Initialize Stagehand with the existing page
    const stagehand = new Stagehand({
      page,
      logger: (message) => console.log(`[Stagehand] ${message}`)
    });
    
    console.log('✅ Connected! Current URL:', page.url());
    
    // ============================================
    // TEST YOUR NODE HERE
    // ============================================
    
    // Example: Test extract node
    const result = await testExtractEmails(stagehand);
    console.log('📧 Extracted emails:', result);
    
    // Example: Test filter_list equivalent
    // const filtered = await testFilterInvestorEmails(stagehand, result.emails);
    // console.log('🎯 Filtered emails:', filtered);
    
    // Example: Test navigation
    // await testNavigateToAirtable(stagehand);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Test extraction (browser_query primitive)
async function testExtractEmails(stagehand) {
  return await stagehand.extract({
    instruction: "Extract all visible email threads from the Gmail search results",
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
}

// Test LLM filtering (cognition primitive)
async function testFilterInvestorEmails(stagehand, emails) {
  // Since Stagehand doesn't have direct LLM access, 
  // we'd need to implement the cognition primitive
  console.log('🤔 Filter logic would go here...');
  return emails;
}

// Test navigation (browser_action primitive)
async function testNavigateToAirtable(stagehand) {
  const baseId = process.env.AIRTABLE_BASE_ID;
  await stagehand.page.goto(`https://airtable.com/${baseId}`);
  await stagehand.page.waitForLoadState('networkidle');
  console.log('📊 Navigated to Airtable');
}

// Test click action (browser_action primitive)
async function testClickEmail(stagehand) {
  await stagehand.act({
    action: "click on the first email in the list"
  });
  console.log('👆 Clicked email');
}

// Test data transformation (transform primitive)
function testTransformData(data) {
  // Pure function - no async needed
  const transformed = {
    ...data,
    normalized: {
      email: data.email?.toLowerCase(),
      name: data.name?.trim(),
      timestamp: new Date().toISOString()
    }
  };
  console.log('🔄 Transformed:', transformed);
  return transformed;
}

// Run the test
testSingleNode();