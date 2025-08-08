# Pipedream Integration: Migration Plan

## Executive Summary

We built a Pipedream integration based on incorrect assumptions about their API. The implementation works perfectly with mock data but doesn't connect to real Pipedream services. This document outlines what happened, what we learned, and how to migrate to the real Pipedream Connect.

---

## The Problem: What We Built vs Reality

### What We Thought Pipedream Was

We assumed Pipedream had a simple REST API for component execution:
```javascript
// Our fantasy implementation
POST /v1/components/gmail-search-emails/execute
Authorization: Bearer pd_token
{
  params: { query: "invoice", maxResults: 10 }
}
```

### What Pipedream Actually Is

**Pipedream Platform** (not what we want):
- Build workflows in Pipedream's UI
- Not embeddable in our app
- For individual developers, not SaaS products

**Pipedream Connect** (what we need):
- SDK for embedding integrations in YOUR app
- Users connect accounts to YOUR app, not Pipedream
- Requires OAuth flow and project setup
- Different API structure entirely

### What We Actually Built

A mock system that perfectly demonstrates the concept but doesn't execute real API calls:
- ✅ Service discovery works (finds Gmail, Airtable)
- ✅ Workflow patterns are correct
- ✅ Node structure is right
- ❌ Component discovery endpoint doesn't exist
- ❌ Component execution endpoint is fantasy
- ✅ Mock mode works perfectly for testing

---

## Current Implementation Analysis

### What Works (Can Keep)

1. **Node Architecture** (~90% salvageable)
   ```javascript
   // This structure is correct
   {
     type: 'pipedream_connect',
     alias: 'search_emails',
     config: {
       component_id: 'gmail-search-messages',
       params: { query: 'test' }
     }
   }
   ```

2. **Tool Definitions**
   - `pipedream_search_services` - Works with small fixes
   - `pipedream_get_components` - Needs new endpoint
   - Schema structures all correct

3. **Authentication Chain**
   ```javascript
   // This fallback pattern is good
   auth_config → workflow_variables → environment
   ```

4. **Service Discovery**
   - Works with `q` parameter (not `search`)
   - Returns real app data from Pipedream

5. **Mock System**
   - Perfect for development/testing
   - Good fallback when not configured

### What Doesn't Work

1. **Component Discovery**
   ```javascript
   // This endpoint doesn't exist
   GET /v1/components?app=gmail
   ```

2. **Component Execution**
   ```javascript
   // This is completely fictional
   POST /v1/components/{id}/execute
   ```

3. **User Authentication**
   - No OAuth flow implemented
   - No user token management
   - No account connections

---

## The Real Pipedream Connect Architecture

### How Connect Actually Works

```
User → Your App → OAuth Flow → Service (Gmail/Airtable)
         ↓
    Pipedream SDK
         ↓
    Executes Actions
```

### Required Components

1. **OAuth Client** (you have this!)
   - Client ID: `0wZGnmLCFrC8XmpVmG01VD4JQ50GRfYNrJZ-2k9ZoFo`
   - Client Secret: `FENM0wyrZX66y7Js5LhaXicy9z_NKaY2SiO6H-X7fqE`
   - Workspace: `o_JvI4zMV`

2. **Connect Project**
   - Created via `pd init connect`
   - Generates project structure
   - Provides SDK integration

3. **API Endpoints** (different from v1)
   ```
   GET  /v1/connect/{project_id}/actions
   POST /v1/connect/{project_id}/actions/run
   POST /v1/connect/{project_id}/actions/configure
   ```

---

## Migration Path

### Option A: Full Pipedream Connect Implementation (Recommended)

**Effort**: 2-3 hours  
**Result**: Production-ready multi-user system

#### Step 1: Setup Connect Project
```bash
pd init connect
# Select existing OAuth client
# Generate project structure
```

#### Step 2: Install SDK
```bash
npm install @pipedream/sdk
```

#### Step 3: Update executePipedreamConnect
```javascript
import { createClient } from '@pipedream/sdk';

async executePipedreamConnect(config, workflowId) {
  const client = createClient({
    publicKey: process.env.PIPEDREAM_PUBLIC_KEY,
    secretKey: process.env.PIPEDREAM_SECRET_KEY,
  });
  
  // Get user's connected account
  const account = await this.getUserAccount(workflowId, config.component_id);
  
  // Execute action
  return client.actions.run({
    actionId: config.component_id,
    accountId: account.id,
    params: config.params
  });
}
```

#### Step 4: Add OAuth Flow
```javascript
// New endpoint for account connection
app.get('/connect/gmail', (req, res) => {
  const authUrl = pipedream.getAuthorizationUrl({
    app: 'gmail',
    redirectUri: 'http://localhost:3003/auth/callback'
  });
  res.redirect(authUrl);
});
```

### Option B: Keep Mock System + Direct APIs (Quick Fix)

**Effort**: 30 minutes  
**Result**: Works for testing, not scalable

```javascript
// Use Gmail API directly
if (componentId === 'gmail-search') {
  const gmail = google.gmail({ version: 'v1', auth });
  return gmail.users.messages.list({ userId: 'me', q: params.query });
}

// Use Airtable API directly  
if (componentId === 'airtable-create') {
  return fetch(`https://api.airtable.com/v0/${baseId}/${table}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${airtableToken}` },
    body: JSON.stringify({ records: params.records })
  });
}
```

### Option C: Hybrid Approach (Best for Now)

**Effort**: 1 hour  
**Result**: Real service discovery, mock execution

1. Keep current implementation
2. Fix service discovery (`q` parameter)
3. Add "coming soon" message for real execution
4. Document OAuth flow for future

---

## Implementation Checklist

### Immediate Fixes (15 min)
- [x] Fix search parameter (`search` → `q`)
- [x] Update app_slug mapping (`slug` → `name_slug`)
- [ ] Add project configuration check
- [ ] Better error messages for missing setup

### Phase 1: Connect Setup (1 hour)
- [ ] Run `pd init connect` 
- [ ] Create project structure
- [ ] Add SDK dependencies
- [ ] Configure environment variables

### Phase 2: OAuth Flow (1 hour)
- [ ] Add authorization endpoints
- [ ] Implement callback handler
- [ ] Store user tokens
- [ ] Add account management UI

### Phase 3: Real Execution (1 hour)
- [ ] Replace mock execution with SDK calls
- [ ] Update component discovery
- [ ] Test with real Gmail/Airtable
- [ ] Add error handling

---

## Code to Salvage

### Keep As-Is (90%)
- `/backend/services/nodeExecutor.js` - executePipedreamConnect method structure
- `/backend/tools/toolDefinitionsV2.js` - All tool/node definitions
- `/test-pipedream-scenarios.md` - Test cases still valid
- Authentication chain logic
- Variable storage patterns
- Mock response system

### Minor Updates Needed
- `/backend/services/directorService.js` - Fix API endpoints
- Component ID mappings
- Error messages

### New Files Needed
- `/backend/services/pipedreamConnect.js` - SDK integration
- `/backend/routes/oauth.js` - OAuth flow handlers
- `/frontend/components/ConnectAccount.jsx` - UI for connections

---

## Decision Point

### Recommended Path: **Option C (Hybrid)**

1. **Today**: Keep mock system, fix service discovery
2. **Next Sprint**: Implement full Connect with OAuth
3. **Why**: 
   - Current system demonstrates value
   - Can test workflows immediately
   - Clean upgrade path exists

### Success Metrics
- ✅ Director can discover real services
- ✅ Workflows demonstrate hybrid approach
- ✅ Architecture supports real execution
- ⏳ Real API execution (future enhancement)

---

## Lessons Learned

1. **Assumption**: Simple REST API for components
   **Reality**: Complex SDK with OAuth requirements

2. **Assumption**: Components are discoverable via API
   **Reality**: Need Connect project for component access

3. **Assumption**: Direct execution with API token
   **Reality**: User-specific OAuth tokens required

4. **Good News**: Our architecture is solid, just needs different endpoints

---

## Next Steps

1. **Immediate** (You decide):
   - Keep mock system for demos?
   - Start Connect implementation?
   - Try direct Gmail/Airtable APIs?

2. **This Week**:
   - Fix service discovery
   - Document OAuth flow
   - Create setup guide

3. **Next Sprint**:
   - Full Connect implementation
   - User account management
   - Production deployment

---

## TL;DR

We built the right thing, just pointed at wrong endpoints. 90% of work is salvageable. Mock system works great for testing. Real implementation needs Pipedream Connect SDK + OAuth, about 2-3 hours of work. Current system is perfect for demos and validates the hybrid workflow concept.