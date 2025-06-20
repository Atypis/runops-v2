// Debug script for email lookup issues
// Run this to test why Ben Thompson is being categorized as NEW instead of UPDATE

import { chromium } from 'playwright';
import { Stagehand } from '@browserbasehq/stagehand';

async function debugEmailLookup() {
  console.log('🔍 Debugging Email Lookup Issue...\n');
  
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  const page = context.pages()[0] || await context.newPage();
  const stagehand = new Stagehand({ page });
  
  // Step 1: Extract Airtable data
  console.log('📊 Step 1: Extracting Airtable data...');
  await page.goto('https://airtable.com/appTnT68Rt8yHIGV3/tblKr3pT0bt8g4e7Y/viw3hkApp4dA39MtQ');
  await page.waitForLoadState('networkidle');
  
  const airtableData = await stagehand.extract({
    instruction: 'Extract all investor records from the table',
    schema: {
      records: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            investorName: { type: 'string' },
            contactPerson: { type: 'string' },
            email: { type: 'string' }
          }
        }
      }
    }
  });
  
  console.log('Raw extraction result:', JSON.stringify(airtableData, null, 2));
  
  // Step 2: Build lookup map
  console.log('\n📋 Step 2: Building lookup map...');
  const buildLookup = (data) => {
    const lookup = {};
    let records = [];
    
    // Handle different data structures
    if (Array.isArray(data)) {
      records = data;
    } else if (data?.records) {
      records = data.records;
    } else if (data?.existingRecords) {
      records = data.existingRecords;
    }
    
    console.log('Records found:', records.length);
    
    records.forEach(r => {
      if (r.email) {
        const key = r.email.toLowerCase().trim();
        lookup[key] = r;
        console.log(`Added to lookup: "${key}" -> ${r.contactPerson}`);
      }
    });
    
    return lookup;
  };
  
  const lookup = buildLookup(airtableData);
  console.log('\nLookup keys:', Object.keys(lookup));
  
  // Step 3: Test specific email
  console.log('\n🧪 Step 3: Testing Ben Thompson lookup...');
  const testEmails = [
    'ben@betacapital.com',
    'Ben@BetaCapital.com',
    ' ben@betacapital.com ',
    'ben@betacapital.com\n'
  ];
  
  testEmails.forEach(email => {
    const normalized = email.toLowerCase().trim();
    const found = lookup[normalized];
    console.log(`Testing "${email}" -> normalized: "${normalized}" -> Found: ${found ? 'YES' : 'NO'}`);
  });
  
  // Step 4: Extract Gmail emails
  console.log('\n📧 Step 4: Extracting Gmail emails...');
  await page.goto('https://mail.google.com');
  await page.waitForLoadState('networkidle');
  
  const gmailEmails = await stagehand.extract({
    instruction: 'Extract sender email addresses from visible emails. Get the FROM field only.',
    schema: {
      emails: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            senderEmail: { type: 'string' },
            subject: { type: 'string' }
          }
        }
      }
    }
  });
  
  console.log('Gmail emails found:', gmailEmails.emails?.length || 0);
  
  // Step 5: Match emails
  console.log('\n🔗 Step 5: Matching emails...');
  gmailEmails.emails?.forEach(email => {
    const key = email.senderEmail?.toLowerCase().trim();
    const match = lookup[key];
    console.log(`Email: ${email.senderEmail} (${email.subject}) -> Match: ${match ? 'UPDATE' : 'NEW'}`);
  });
  
  // Step 6: Diagnose issues
  console.log('\n🩺 Diagnosis:');
  console.log('1. Check if ben@betacapital.com exists in Airtable lookup');
  console.log('2. Check if Gmail is extracting sender emails correctly');
  console.log('3. Check for whitespace or case sensitivity issues');
  console.log('4. Verify data structure handling in transform');
}

// Run with: node debug-email-lookup.js
debugEmailLookup().catch(console.error);