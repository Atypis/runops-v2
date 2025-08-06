# Pipedream Integration Test Scenarios for Director

## Test Scenario 1: Basic API Discovery
**Objective**: Test that Director can discover and explore API services

**Prompt for Director**:
```
Can you search for available email services using the Pipedream integration? 
Then show me what actions are available for Gmail.
```

**Expected Behavior**:
- Director uses `pipedream_search_services` with query "email"
- Director uses `pipedream_get_components` with app_slug "gmail"
- Returns list of available Gmail components

---

## Test Scenario 2: Simple Gmail Search Workflow
**Objective**: Build a basic workflow that searches Gmail using API

**Prompt for Director**:
```
Create a workflow that searches Gmail for emails containing "invoice" 
and stores the results. Use the Pipedream API integration, not browser automation.
```

**Expected Workflow Structure**:
```javascript
[
  {
    type: 'context',
    alias: 'setup',
    config: {
      variables: {
        search_term: 'invoice'
      }
    }
  },
  {
    type: 'pipedream_connect',
    alias: 'search_invoices',
    config: {
      component_id: 'gmail-search-emails',
      params: {
        query: '{{search_term}}',
        maxResults: 10
      },
      store: {
        'emails': 'invoice_emails',
        'count': 'total_invoices'
      }
    }
  }
]
```

---

## Test Scenario 3: Hybrid Browser + API Workflow
**Objective**: Test Director's ability to intelligently combine browser and API automation

**Prompt for Director**:
```
I need to:
1. Navigate to a website with a list of contacts (use https://example.com/contacts)
2. Extract the email addresses from the page
3. For each email, search Gmail to see if we've communicated with them before
4. Save the results to Airtable

Choose the most efficient approach - use APIs where possible.
```

**Expected Approach**:
- Browser automation for website scraping (no API available)
- Pipedream API for Gmail search (faster than browser)
- Pipedream API for Airtable saves (more reliable than browser)

---

## Test Scenario 4: Data Processing Pipeline
**Objective**: Test iteration and data transformation with API components

**Prompt for Director**:
```
Build a workflow that:
1. Searches Gmail for emails from the last week with attachments
2. Creates a record for each email
3. Uses AI to classify each email's priority (urgent/normal/low)
4. Saves high-priority emails to an Airtable base

Use the Pipedream integration for Gmail and Airtable operations.
```

**Expected Workflow Elements**:
- `pipedream_connect` node for Gmail search
- `create_records` to generate email records
- `iterate` over email records
- `cognition` node for AI classification
- `route` node to filter high-priority
- `pipedream_connect` node for Airtable creation

---

## Test Scenario 5: Multi-Service Integration
**Objective**: Test integration with multiple API services

**Prompt for Director**:
```
Search for and show me what Pipedream services are available for:
1. Payments (search for "stripe" or "payment")
2. Communication (search for "slack")
3. Databases (search for "airtable")

Then create a simple workflow that could connect all three.
```

**Expected Behavior**:
- Multiple `pipedream_search_services` calls
- Multiple `pipedream_get_components` calls
- Creative workflow combining multiple services

---

## Test Scenario 6: Error Handling Test
**Objective**: Test how Director handles authentication requirements

**Prompt for Director**:
```
Create a workflow that sends an email using Gmail API via Pipedream.
Make sure to handle authentication properly.
```

**Expected Behavior**:
- Director should recognize auth requirements
- Should add context node with token configuration
- Should provide clear instructions about token setup

---

## Test Scenario 7: Comparison Test
**Objective**: Test Director's decision-making between browser vs API

**Prompt for Director**:
```
I need to get the subject lines of the last 50 emails in Gmail.
What's the best approach - browser automation or API? 
Build the workflow using the optimal method and explain why.
```

**Expected Analysis**:
- API is 100x faster (no page loads)
- API is more reliable (no UI changes)
- API can get exact count (no scrolling)
- Director should choose `pipedream_connect`

---

## Test Scenario 8: Complex Real-World Use Case
**Objective**: Test a realistic business automation scenario

**Prompt for Director**:
```
Build a customer support email triage system:
1. Search Gmail for unread support emails (subject contains "support" or "help")
2. Extract customer email, subject, and body
3. Use AI to categorize: bug report, feature request, or general question
4. For bug reports, create an Airtable record with priority level
5. For feature requests, add to a different Airtable table
6. Mark processed emails as read in Gmail

Use APIs wherever possible for speed and reliability.
```

**Success Criteria**:
- Proper use of `pipedream_connect` for Gmail operations
- Record creation from email data
- AI classification with structured output
- Conditional routing based on category
- Multiple Airtable operations
- Workflow should be significantly faster than browser-only approach

---

## Quick Test Commands for Director

### Test 1: Service Discovery
```
Show me all available Pipedream services for "email"
```

### Test 2: Component Discovery
```
What Gmail actions are available through Pipedream?
```

### Test 3: Simple Workflow
```
Create a workflow that uses the Pipedream Gmail API to search for "meeting" emails
```

### Test 4: Service Availability
```
Is Airtable available through Pipedream? What can I do with it?
```

### Test 5: Authentication Check
```
Build a Gmail search workflow and show me how authentication works
```

---

## Validation Checklist

✅ **Discovery Tools Working**:
- [ ] `pipedream_search_services` returns results
- [ ] `pipedream_get_components` returns components
- [ ] Director provides helpful messages about available actions

✅ **Node Creation Working**:
- [ ] Director creates `pipedream_connect` nodes correctly
- [ ] Component IDs are properly set
- [ ] Parameters are correctly configured
- [ ] Store mappings are included when needed

✅ **Integration Patterns**:
- [ ] Director can combine browser + API nodes
- [ ] Director chooses API over browser when appropriate
- [ ] Director handles authentication requirements
- [ ] Director can iterate over API results

✅ **Error Handling**:
- [ ] Clear messages about missing tokens
- [ ] Helpful guidance on authentication setup
- [ ] Graceful handling of unavailable services

---

## Notes for Testing

1. **Start Simple**: Begin with Test Scenario 1 to verify basic functionality
2. **Mock Mode**: The system will use mock responses initially (no real API calls)
3. **Watch Logs**: Check console output for `[PIPEDREAM_DISCOVERY]` and `[PIPEDREAM_CONNECT]` messages
4. **Token Setup**: For real API calls, you'll need to update `PIPEDREAM_API_TOKEN` in `.env`

## Expected Director Behavior

The Director should:
1. **Recognize** when to use Pipedream vs browser automation
2. **Discover** available services and components autonomously
3. **Build** efficient workflows combining both approaches
4. **Explain** why it chose API over browser (or vice versa)
5. **Handle** authentication requirements gracefully

---

## Report Template for Director

After each test, the Director could report:
```
Test Scenario: [Name]
Status: ✅ Success / ⚠️ Partial / ❌ Failed
Tools Used: [pipedream_search_services, pipedream_get_components, etc.]
Nodes Created: [List of node types]
Execution Time: [Estimated vs browser-only]
Issues Encountered: [Any problems]
Suggestions: [Improvements needed]
```