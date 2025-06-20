# Gmail to Airtable CRM Sync - Complete Story Flow

## Goal
Extract investor emails from Gmail and sync them to Airtable CRM with 90-100% reliability, handling all edge cases and authentication flows.

## Credentials & Configuration
- Gmail: michaelburner595@gmail.com / dCdWqhgPzJev6Jz
- Airtable Base ID: appTnT68Rt8yHIGV3
- Airtable Table ID: tblgfPzXfTFnNJgpp
- Date Range: after:2025/06/01 before:2025/06/03

## Phase 1: Gmail Setup & Authentication

### 1.1 Navigate to Gmail
- Open browser and go to https://mail.google.com
- Wait for page to fully load (3 seconds)

### 1.2 Check Gmail Authentication Status
- Extract from page: Is the Gmail inbox visible OR is there a sign-in form?
- If inbox is visible → Skip to Phase 2
- If sign-in form is visible → Continue to 1.3

### 1.3 Gmail Login Flow (if needed)
- Look for email input field (could be labeled "Email or phone")
- Type: michaelburner595@gmail.com
- Click "Next" button
- Wait for password field to appear (2 seconds)
- Type password: dCdWqhgPzJev6Jz
- Click "Sign in" button
- Wait for potential 2FA or security check (3 seconds)
- If 2FA appears → FAIL with clear error message
- If inbox loads → Continue to Phase 2

## Phase 2: Airtable Setup & Authentication

### 2.1 Open Airtable in New Tab
- Open new tab with URL: https://airtable.com/appTnT68Rt8yHIGV3/tblgfPzXfTFnNJgpp
- Name this tab "airtable" for easy switching
- Wait for page load (3 seconds)

### 2.2 Check Airtable Authentication Status
- Extract: Is the Airtable table visible OR is there a login page?
- If table is visible → Skip to 2.5
- If login page → Continue to 2.3

### 2.3 Airtable Login Flow
- Look for "Sign in with Google" button (could also be "Continue with Google")
- Click the Google sign-in button
- Wait for Google account chooser (2 seconds)

### 2.4 Google Account Selection
- Check what's displayed:
  - If account chooser shows michaelburner595@gmail.com → Click on it
  - If no accounts shown → Enter email and password again
  - If different account shown → Click "Use another account" then enter credentials
- Wait for Airtable to load (3-5 seconds)
- Verify we're on the correct table page

### 2.5 Download Existing CRM Data
- Wait for table to be fully rendered (2 seconds)
- Extract ALL visible records from the table including:
  - Investor Name
  - Contact Person
  - Email
  - Stage
  - Last Interaction
  - Thread Summary / Notes
  - All other visible columns
- Build email lookup map: {email → full record} for deduplication
- Store in state as existingRecords and emailLookup

## Phase 3: Email Search & Extraction

### 3.1 Switch Back to Gmail Tab
- Switch to the main (Gmail) tab
- Verify we're still in the inbox

### 3.2 Search for Recent Emails
- Click on the search input field (might need to click search icon first)
- Clear any existing search terms
- Type: after:2025/06/01 before:2025/06/03
- Press Enter or click search button
- Wait for search results to load (3 seconds)

### 3.3 Extract Email List
- Extract all visible email threads including:
  - Sender name
  - Sender email address
  - Subject line
  - Date/time
  - Preview text if available
- Store as rawEmails in state

### 3.4 Identify Investor Emails
- Use AI to analyze each email and determine if it's investor-related
- Look for keywords: funding, investment, capital, VC, venture, investor, fund, portfolio, deal, term sheet, diligence
- Also check sender domain against known VC domains
- Return filtered list of investor emails only
- Store as investorEmails in state

## Phase 4: Process Each Investor Email

### 4.1 Categorize Emails
- For each investor email:
  - Check if sender email exists in emailLookup
  - If exists → Mark as "update" with existing record reference
  - If new → Mark as "new investor"
- Store categorized lists as newInvestors and updates

### 4.2 Process New Investors
For each new investor email:

#### 4.2.1 Click on Email in Gmail
- Find and click the email row by subject line
- Wait for email to open (1 second)

#### 4.2.2 Extract Detailed Information
- Extract full email thread content
- Extract all email metadata
- Identify:
  - Investor firm name
  - Contact person name
  - Their role/title if mentioned
  - Key discussion points

#### 4.2.3 Generate Thread Summary
- Use AI to create a 1-2 line summary focusing on:
  - What stage of conversation (initial outreach, follow-up, etc)
  - Key ask or next step
  - Any specific dates or deadlines mentioned

#### 4.2.4 Switch to Airtable
- Switch to "airtable" tab
- Verify table is still loaded

#### 4.2.5 Create New Record
- Click "+" or "Add record" button
- Wait for new row to appear (500ms)
- Fill in fields:
  - Investor Name: [Extracted firm name]
  - Contact Person: [Extracted person name]
  - Email: [Sender email]
  - Stage: "Initial Contact" or based on conversation
  - Last Interaction: [Email date]
  - Thread Summary: [AI-generated summary]
  - Next Step: [Extracted action items]
- Click outside row to save

#### 4.2.6 Return to Gmail
- Switch back to main tab
- Click back arrow or inbox to return to search results

### 4.3 Process Updates
For each existing investor update:
- Log that we found an existing record
- In production: Would update the existing Airtable record with new interaction
- For now: Track count of updates needed

## Phase 5: Verification & Cleanup

### 5.1 Summary Report
- Count total emails processed
- Count new investors added
- Count existing investors found
- List any errors encountered

### 5.2 State Cleanup
- Clear any sensitive data from state
- Keep only summary statistics

## Error Handling Throughout

### Network Errors
- If page doesn't load in expected time → Retry once
- If still fails → Log error and continue with next item

### Element Not Found
- If can't find expected button/field → Take screenshot
- Try alternative selectors
- If still fails → Log specific error with context

### Data Extraction Failures
- If table extraction returns empty → Wait 2s and retry
- If email extraction fails → Try simpler schema
- Always prefer partial data over no data

### Authentication Loops
- Track if we've already tried to login
- Prevent infinite login attempts
- Fail gracefully with clear error message

## Success Metrics
- 100% of investor emails identified correctly
- 95%+ of new investors added to Airtable
- 0% duplicate records created
- Clear error messages for any failures
- Complete audit trail of what was processed