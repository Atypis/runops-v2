# Gmail→Airtable CRM Canonical Workflow

## Overview
This document defines the canonical workflow for extracting investor emails from Gmail and creating/updating records in Airtable CRM.

## Canonical Data Schemas

### 1. Email Item Schema
Used when extracting email list from Gmail search results:
```javascript
{
  subject: string,      // Email subject line
  senderName: string,   // Display name of sender
  senderEmail: string,  // Email address of sender
  date: string,         // Date string (e.g., "Jun 2")
  threadId: string      // Unique identifier for deduplication
}
```

### 2. Email Thread Schema
Used when extracting full email content after clicking into an email:
```javascript
{
  fullContent: string,   // Complete thread text
  latestMessage: string, // Most recent message
  threadLength: number   // Number of messages in thread
}
```

### 3. Investor Info Schema
Extracted from email content using AI:
```javascript
{
  investorName: string,    // Primary investor/firm name
  contactPerson: string,   // Individual's full name
  companyName: string,     // Their company (if different)
  investmentFirm: string   // VC firm they represent
}
```

### 4. Record Check Schema
Used when checking if investor already exists in Airtable:
```javascript
{
  recordExists: boolean,    // Does record already exist?
  existingRecordId: string  // ID if it exists
}
```

## Workflow Phases

### Phase 1: Initial Setup
1. Navigate to Gmail login
2. Check if already logged in
3. Login if needed (email/password)
4. Open Airtable in new tab
5. Check if Airtable login needed
6. Login with Google SSO if needed
7. Switch back to Gmail tab

### Phase 2: Extract & Filter Emails
1. Navigate to Gmail inbox
2. Click search box
3. Type date range query: `after:2025/06/01 before:2025/06/03`
4. Execute search
5. Extract all emails using Email Item Schema
6. Initialize processing state
7. Use AI to classify investor emails (returns boolean array)
8. Apply filter to get investorEmails array

### Phase 3: Process Loop
For each email in investorEmails:
1. Check if already processed (skip if yes)
2. Click on email by subject
3. Extract email thread content
4. Extract investor information
5. Generate 2-line CRM summary
6. Classify investor stage (Interested/In Diligence/Deck Sent)
7. Switch to Airtable tab
8. Check for existing record
9. Either:
   - Create new record (click Add button)
   - Update existing record (click row)
10. Fill fields:
    - Investor Name
    - Contact Person
    - Email
    - Stage (dropdown)
    - Thread Summary
    - Last Interaction (date)
    - Follow-up Needed (checkbox)
11. Save record
12. Mark email as processed
13. Switch back to Gmail

## State Management

The workflow maintains state with these key properties:
- `emails`: Array of all extracted emails
- `investorMask`: Boolean array indicating which are investor emails
- `investorEmails`: Filtered array of just investor emails
- `processedEmails`: Array of email subjects already processed
- `currentEmail`: Currently selected email in loop
- `emailIndex`: Current position in loop
- `isProcessed`: Boolean for current email processed status
- `emailThread`: Extracted thread content
- `investorInfo`: Extracted investor details
- `threadSummary`: AI-generated summary
- `investorStage`: AI-classified stage

## Deduplication Strategy

Emails are tracked by subject line in the `processedEmails` array. Before processing each email:
1. Check if `currentEmail.subject` exists in `processedEmails`
2. Skip if already processed
3. Add to `processedEmails` after successful Airtable update

## Error Handling

Currently minimal - workflow will stop on any error. Future improvements:
- Wrap each phase in handle primitive
- Add retry logic for network failures
- Handle case where Airtable record creation fails
- Graceful handling of missing fields