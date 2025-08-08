# Pipedream Connect Integration Implementation Plan

**Version**: 1.0  
**Status**: Design Complete, Ready for Implementation  
**Date**: August 2025  
**Context**: Director 2.0 Hybrid Automation Platform  

---

## Executive Summary

This document provides a comprehensive implementation plan for integrating Pipedream Connect into the Director 2.0 workflow automation system. The integration will add API automation capabilities alongside Director's existing browser automation strengths, creating a hybrid platform that can intelligently choose between browser UI automation and API calls for optimal performance.

### Key Benefits
- **Performance**: 100x faster API operations vs browser automation
- **Reliability**: No UI changes, loading states, or anti-bot measures
- **Scale**: Access to 2,800+ APIs and 10,000+ pre-built components
- **Intelligence**: Director can choose optimal automation approach per task

---

## Architecture Overview

### Two-Tier System Design

#### **Tier 1: Director Discovery Tools** (Ephemeral, Non-Persistent)
Tools for API exploration and service discovery, similar to `dom_search`, `get_screenshot`:
- `pipedream_search_services` - Find available API services
- `pipedream_get_components` - List actions for a specific service

#### **Tier 2: Workflow Execution Nodes** (Persistent, Results-Stored) 
Workflow nodes that execute API calls and store results:
- `pipedream_connect` - Execute API components and store results

### Architectural Precedent
This matches Director's existing browser automation pattern:
```
Browser Discovery Tools → browser_action Workflow Nodes
API Discovery Tools → pipedream_connect Workflow Nodes
```

---

## Locked-in Design Decisions (v0)

### ✅ **Decision 1: Progressive Discovery Architecture**
**Choice**: Two-stage discovery (search services → get components) vs full context injection  
**Rationale**: Prevents context explosion (10,000+ components), matches human workflow  
**Implementation**: Discovery tools + dynamic component injection  

### ✅ **Decision 2: Single Node Type Pattern**  
**Choice**: One `pipedream_connect` node vs separate service-specific nodes  
**Rationale**: Matches `browser_action` pattern, flexible, maintainable  
**Implementation**: Action-based configuration within single node type  

### ✅ **Decision 3: Environment Variable Authentication (v0)**  
**Choice**: Environment variables → Context variables → OAuth (future)  
**Rationale**: Immediate functionality, progressive enhancement path  
**Implementation**: Fallback chain with clear upgrade path  

### ✅ **Decision 4: Hybrid Tool/Node Architecture**  
**Choice**: Discovery tools separate from execution nodes  
**Rationale**: Clean separation, matches existing browser tool patterns  
**Implementation**: Tools in `directorService.js`, nodes in `nodeExecutor.js`  

### ✅ **Decision 5: Workflow-Level Integration**  
**Choice**: Full workflow integration vs Director tools only  
**Rationale**: Maximum value, leverages Director's orchestration capabilities  
**Implementation**: Both discovery tools and execution nodes  

---

## Technical Implementation Specification

### File Modification Matrix

| File | Modification Type | Lines | Purpose |
|------|------------------|-------|---------|
| `backend/services/nodeExecutor.js` | ADD | ~1447, ~3850 | Core execution engine |
| `backend/services/directorService.js` | ADD | ~5020, ~6000 | Tool handlers |
| `backend/tools/toolDefinitionsV2.js` | ADD | ~750, ~1500 | Node schema + tools |
| `package.json` | ADD | dependencies | Pipedream SDK |
| `.env` | ADD | N/A | Authentication tokens |

### Core Node Type Implementation

#### **File**: `backend/services/nodeExecutor.js`

**Switch Statement Addition** (Line ~1447):
```javascript
case 'pipedream_connect':
  result = await this.executePipedreamConnect(resolvedConfig, workflowId);
  break;
```

**Execution Method** (Line ~3850):
```javascript
async executePipedreamConnect(config, workflowId) {
  console.log(`[PIPEDREAM_CONNECT] Executing with config:`, JSON.stringify(config, null, 2));
  
  const { component_id, auth_config, params = {} } = config;
  
  // Authentication resolution chain
  const token = await this.resolvePipedreamToken(workflowId, auth_config);
  
  try {
    return await this.executeAPIComponent(token, component_id, auth_config, params);
  } catch (error) {
    console.error(`[PIPEDREAM_CONNECT] Component execution failed:`, error);
    throw new Error(`Pipedream component '${component_id}' failed: ${error.message}`);
  }
}

/**
 * Resolve Pipedream authentication token with fallback chain
 * Priority: auth_config → workflow variables → environment variables
 */
async resolvePipedreamToken(workflowId, authConfig) {
  // 1. Explicit auth config (future OAuth)
  if (authConfig?.token) {
    return authConfig.token;
  }
  
  // 2. Workflow context variables
  const workflowToken = await this.getWorkflowVariable('pipedream_token', workflowId);
  if (workflowToken) {
    return workflowToken;
  }
  
  // 3. Environment variable fallback
  const envToken = process.env.PIPEDREAM_API_TOKEN;
  if (envToken) {
    return envToken;
  }
  
  throw new Error('Pipedream API token not found. Set PIPEDREAM_API_TOKEN environment variable or use context variables.');
}

/**
 * Execute Pipedream component via Connect API
 */
async executeAPIComponent(token, componentId, authConfig, params) {
  const response = await fetch(`https://api.pipedream.com/v1/components/${componentId}/execute`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      auth: authConfig?.service_auth || {},
      params: params
    })
  });
  
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API error ${response.status}: ${errorBody}`);
  }
  
  const result = await response.json();
  console.log(`[PIPEDREAM_CONNECT] Component executed successfully:`, result);
  return result;
}
```

#### **File**: `backend/tools/toolDefinitionsV2.js`

**Node Schema Definition** (Line ~750):
```javascript
// pipedream_connect workflow node schema
{
  type: 'object',
  properties: {
    type: { const: 'pipedream_connect' },
    config: {
      type: 'object',
      properties: {
        component_id: {
          type: 'string',
          description: 'Pipedream component ID to execute (e.g., "gmail-search-emails", "airtable-list-records")'
        },
        auth_config: {
          type: 'object',
          description: 'Authentication configuration for the service. For development, use context variables or environment variables.',
          properties: {
            token: {
              type: 'string',
              description: 'Service-specific authentication token (supports variable references like {{gmail_token}})'
            },
            service_auth: {
              type: 'object',
              description: 'Service-specific authentication parameters',
              additionalProperties: true
            }
          },
          additionalProperties: true
        },
        params: {
          type: 'object',
          description: 'Component-specific parameters (e.g., query, base_id, table_name)',
          additionalProperties: true
        },
        store: {
          type: 'object',
          description: 'Map result fields to workflow variables. Example: {"emails": "foundEmails", "count": "totalEmails"}',
          additionalProperties: { type: 'string' }
        },
        create_records: {
          oneOf: [
            { type: 'string' },
            { type: 'object', properties: { type: { type: 'string' }, id_pattern: { type: 'string' } } }
          ],
          description: 'Create records from API response data (e.g., "email" creates email_001, email_002)'
        },
        store_to_record: {
          type: 'boolean',
          description: 'Store result to current record instead of global variable (iteration contexts only)'
        },
        as: {
          type: 'string', 
          description: 'Field name when using store_to_record (defaults to node alias)'
        }
      },
      required: ['component_id'],
      additionalProperties: false
    },
    description: {
      type: 'string',
      description: 'Human-readable description of what this API call does'
    },
    alias: {
      type: 'string',
      pattern: '^[a-z][a-z0-9_]*$',
      description: 'Unique node identifier in snake_case format'
    }
  },
  required: ['type', 'config', 'alias'],
  additionalProperties: false
}
```

**Discovery Tool Definitions** (Line ~1500):
```javascript
{
  type: 'function',
  function: {
    name: 'pipedream_search_services',
    description: 'Search for available API services and integrations by name. Use this to discover what services Pipedream supports before building API workflow nodes.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Service name to search for (e.g., "gmail", "airtable", "slack", "stripe")'
        }
      },
      required: ['query'],
      additionalProperties: false
    },
    strict: true
  }
},
{
  type: 'function', 
  function: {
    name: 'pipedream_get_components',
    description: 'Get available actions/components for a specific API service. Use this after searching services to discover what operations are available.',
    parameters: {
      type: 'object',
      properties: {
        app_slug: {
          type: 'string',
          description: 'Service identifier from search results (e.g., "gmail", "airtable", "slack")'
        }
      },
      required: ['app_slug'], 
      additionalProperties: false
    },
    strict: true
  }
}
```

#### **File**: `backend/services/directorService.js`

**Tool Handler Registration** (Line ~5020):
```javascript
case 'pipedream_search_services':
  result = await this.handlePipedreamSearchServices(args, workflowId);
  break;
case 'pipedream_get_components':
  result = await this.handlePipedreamGetComponents(args, workflowId);
  break;
```

**Tool Handler Implementation** (Line ~6000):
```javascript
/**
 * Handle service discovery tool call
 * Returns available services matching query - does not create workflow nodes
 */
async handlePipedreamSearchServices(args, workflowId) {
  const { query } = args;
  
  console.log(`[PIPEDREAM_DISCOVERY] Searching services for query: "${query}"`);
  
  try {
    const token = process.env.PIPEDREAM_API_TOKEN;
    if (!token) {
      throw new Error('PIPEDREAM_API_TOKEN environment variable not set');
    }
    
    const response = await fetch(`https://api.pipedream.com/v1/apps?search=${encodeURIComponent(query)}&limit=20`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Pipedream API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    const services = (data.data || []).map(app => ({
      app_slug: app.slug,
      name: app.name,
      description: app.description || `${app.name} integration`,
      logo_url: app.img_src,
      categories: app.categories || []
    }));
    
    console.log(`[PIPEDREAM_DISCOVERY] Found ${services.length} services for "${query}"`);
    
    return {
      query,
      services,
      total_found: data.total_count || services.length,
      message: services.length > 0 
        ? `Found ${services.length} services matching "${query}". Use pipedream_get_components to see available actions.`
        : `No services found for "${query}". Try broader terms like "email", "database", or "crm".`
    };
    
  } catch (error) {
    console.error(`[PIPEDREAM_DISCOVERY] Service search failed:`, error);
    return {
      query,
      services: [],
      error: error.message,
      message: `Failed to search Pipedream services: ${error.message}`
    };
  }
}

/**
 * Handle component discovery tool call  
 * Returns available components for a service - does not create workflow nodes
 */
async handlePipedreamGetComponents(args, workflowId) {
  const { app_slug } = args;
  
  console.log(`[PIPEDREAM_DISCOVERY] Getting components for service: "${app_slug}"`);
  
  try {
    const token = process.env.PIPEDREAM_API_TOKEN;
    if (!token) {
      throw new Error('PIPEDREAM_API_TOKEN environment variable not set');
    }
    
    const response = await fetch(`https://api.pipedream.com/v1/components?app=${app_slug}&type=action&limit=50`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      throw new Error(`Pipedream API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    const components = (data.data || []).map(component => ({
      component_id: component.key,
      name: component.name,
      description: component.description || component.summary || `${component.name} action`,
      version: component.version,
      parameters: component.props || {},
      auth_required: component.auth?.required || false
    }));
    
    console.log(`[PIPEDREAM_DISCOVERY] Found ${components.length} components for "${app_slug}"`);
    
    return {
      app_slug,
      service_name: app_slug,
      components,
      total_found: components.length,
      message: components.length > 0
        ? `Found ${components.length} actions for ${app_slug}. Use these component_ids in pipedream_connect nodes.`
        : `No actions found for ${app_slug}. This service may not have pre-built components.`
    };
    
  } catch (error) {
    console.error(`[PIPEDREAM_DISCOVERY] Component discovery failed:`, error);
    return {
      app_slug,
      components: [],
      error: error.message,
      message: `Failed to get components for ${app_slug}: ${error.message}`
    };
  }
}
```

### Environment Configuration

#### **File**: `.env` (additions)
```bash
# Pipedream Connect Integration
PIPEDREAM_API_TOKEN=pd_dev_your_token_here

# Service-Specific Tokens (Development/Testing)
# Gmail API (for gmail components)
GMAIL_API_TOKEN=ya29.a0AfH6SMC_your_gmail_token_here

# Airtable API (for airtable components) 
AIRTABLE_API_TOKEN=keyXXXXXXXXXXXXXX

# Slack API (for slack components)
SLACK_API_TOKEN=xoxb-your-slack-token-here
```

#### **File**: `package.json` (dependencies)
```json
{
  "dependencies": {
    // ... existing dependencies
    "node-fetch": "^3.3.0"
  }
}
```

---

## Usage Patterns & Examples

### Example 1: Gmail Email Search Workflow

```javascript
// Step 1: Director discovers Gmail service
await director.callTool('pipedream_search_services', { query: 'gmail' });
// Returns: [{ app_slug: 'gmail', name: 'Gmail', description: '...' }]

// Step 2: Director explores Gmail components
await director.callTool('pipedream_get_components', { app_slug: 'gmail' });
// Returns: [{ component_id: 'gmail-search-emails', name: 'Search Emails', ... }]

// Step 3: Director creates workflow node
{
  type: 'pipedream_connect',
  alias: 'search_investor_emails',
  description: 'Search Gmail for emails from investors',
  config: {
    component_id: 'gmail-search-emails',
    auth_config: {
      token: '{{gmail_token}}' // From context variables
    },
    params: {
      query: 'from:investor@company.com',
      maxResults: 20
    },
    store: { 
      'emails': 'foundInvestorEmails',
      'count': 'totalEmails'
    }
  }
}

// Step 4: Access results in subsequent nodes
// {{search_investor_emails.foundInvestorEmails}} - array of emails
// {{search_investor_emails.totalEmails}} - count
```

### Example 2: Airtable Data Operations

```javascript
// Discovery and component selection (same pattern)
await director.callTool('pipedream_search_services', { query: 'airtable' });
await director.callTool('pipedream_get_components', { app_slug: 'airtable' });

// Create records workflow
[
  // Extract data from previous steps (browser or API)
  {
    type: 'browser_ai_extract',
    alias: 'extract_investor_data',
    config: {
      instruction: 'Extract investor information from this page',
      schema: {
        type: 'array',
        items: {
          type: 'object', 
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
            company: { type: 'string' }
          }
        }
      },
      create_records: 'investor'
    }
  },
  
  // Iterate over extracted investors
  {
    type: 'iterate',
    alias: 'save_to_airtable',
    config: {
      records: 'investor_*',
      body: ['create_airtable_record']
    }
  },
  
  // Create Airtable record for each investor
  {
    type: 'pipedream_connect',
    alias: 'create_airtable_record',
    config: {
      component_id: 'airtable-create-record',
      auth_config: {
        token: '{{airtable_token}}'
      },
      params: {
        base_id: 'appXXXXXXXXXXXXXX',
        table_name: 'Investors',
        fields: {
          'Name': '{{current.fields.name}}',
          'Email': '{{current.fields.email}}',
          'Company': '{{current.fields.company}}'
        }
      }
    }
  }
]
```

### Example 3: Hybrid Browser + API Workflow

```javascript
[
  // Use browser automation for complex UI navigation
  {
    type: 'browser_action',
    alias: 'navigate_to_crm',
    config: {
      action: 'navigate',
      url: 'https://internal-crm.company.com'
    }
  },
  
  // Extract data from complex UI
  {
    type: 'browser_ai_extract', 
    alias: 'extract_leads',
    config: {
      instruction: 'Extract lead information from CRM dashboard',
      schema: { /* complex schema */ },
      create_records: 'lead'
    }
  },
  
  // Use API for efficient bulk operations
  {
    type: 'iterate',
    config: {
      records: 'lead_*',
      body: ['enrich_via_api', 'save_to_database']
    }
  },
  
  // API enrichment (100x faster than browser)
  {
    type: 'pipedream_connect',
    alias: 'enrich_via_api',
    config: {
      component_id: 'clearbit-enrich-person',
      params: {
        email: '{{current.fields.email}}'
      }
    }
  },
  
  // API database save
  {
    type: 'pipedream_connect',
    alias: 'save_to_database',
    config: {
      component_id: 'airtable-create-record',
      params: {
        base_id: 'appXXXXXXXXXXXXXX',
        table_name: 'Enriched_Leads',
        fields: {
          'Email': '{{current.fields.email}}',
          'Company': '{{enrich_via_api.company.name}}',
          'Industry': '{{enrich_via_api.company.category.industry}}'
        }
      }
    }
  }
]
```

---

## Error Handling & Validation

### Authentication Error Handling

```javascript
// In executePipedreamConnect method
try {
  const token = await this.resolvePipedreamToken(workflowId, authConfig);
} catch (error) {
  if (error.message.includes('token not found')) {
    throw new Error(`
      Pipedream authentication required. Choose one option:
      
      1. Set environment variable: PIPEDREAM_API_TOKEN=your_token
      2. Add context node with token:
         {
           type: 'context',
           config: { variables: { pipedream_token: 'your_token' } }
         }
      3. Use auth_config in node:
         config: { auth_config: { token: 'your_token' } }
    `);
  }
  throw error;
}
```

### API Error Handling

```javascript
// Component execution error handling
if (!response.ok) {
  const errorBody = await response.text();
  let errorMessage = `Pipedream API error ${response.status}`;
  
  try {
    const errorJson = JSON.parse(errorBody);
    errorMessage += `: ${errorJson.message || errorJson.error || errorBody}`;
  } catch {
    errorMessage += `: ${errorBody}`;
  }
  
  // Provide actionable error messages
  if (response.status === 401) {
    errorMessage += '\n\nAuthentication failed. Check your Pipedream API token.';
  } else if (response.status === 403) {
    errorMessage += '\n\nPermission denied. Verify service authentication.';
  } else if (response.status === 429) {
    errorMessage += '\n\nRate limit exceeded. Wait before retrying.';
  }
  
  throw new Error(errorMessage);
}
```

### Component Parameter Validation

```javascript
// Validate required parameters before API call
function validateComponentParams(componentId, params) {
  const componentSchemas = {
    'gmail-search-emails': {
      required: ['query'],
      optional: ['maxResults', 'labelIds']
    },
    'airtable-create-record': {
      required: ['base_id', 'table_name', 'fields'],
      optional: ['typecast']
    }
  };
  
  const schema = componentSchemas[componentId];
  if (schema) {
    for (const required of schema.required) {
      if (!params[required]) {
        throw new Error(`Component '${componentId}' requires parameter '${required}'`);
      }
    }
  }
}
```

---

## Testing Strategy

### Unit Tests

```javascript
// Test file: backend/tests/pipedreamConnect.test.js
describe('PipedreamConnect Node', () => {
  test('should resolve authentication token from environment', async () => {
    process.env.PIPEDREAM_API_TOKEN = 'test_token';
    const executor = new NodeExecutor();
    
    const token = await executor.resolvePipedreamToken('workflow_123', {});
    expect(token).toBe('test_token');
  });
  
  test('should prioritize auth_config over environment', async () => {
    process.env.PIPEDREAM_API_TOKEN = 'env_token';
    const executor = new NodeExecutor();
    
    const token = await executor.resolvePipedreamToken('workflow_123', { token: 'config_token' });
    expect(token).toBe('config_token');
  });
  
  test('should throw error when no token available', async () => {
    delete process.env.PIPEDREAM_API_TOKEN;
    const executor = new NodeExecutor();
    
    await expect(executor.resolvePipedreamToken('workflow_123', {}))
      .rejects.toThrow('Pipedream API token not found');
  });
});
```

### Integration Tests

```javascript
// Test file: backend/tests/pipedreamIntegration.test.js  
describe('Pipedream Integration', () => {
  test('should search services and return results', async () => {
    const director = new DirectorService();
    
    const result = await director.handlePipedreamSearchServices({ query: 'gmail' }, 'test_workflow');
    
    expect(result.services).toBeArray();
    expect(result.services.length).toBeGreaterThan(0);
    expect(result.services[0]).toHaveProperty('app_slug');
    expect(result.services[0]).toHaveProperty('name');
  });
  
  test('should get components for a service', async () => {
    const director = new DirectorService();
    
    const result = await director.handlePipedreamGetComponents({ app_slug: 'gmail' }, 'test_workflow');
    
    expect(result.components).toBeArray();
    expect(result.components[0]).toHaveProperty('component_id');
    expect(result.components[0]).toHaveProperty('name');
  });
});
```

### End-to-End Workflow Tests

```javascript
// Test complete workflow with mocked Pipedream API
describe('Pipedream Workflow Execution', () => {
  test('should execute gmail search workflow', async () => {
    // Mock Pipedream API responses
    nock('https://api.pipedream.com')
      .post('/v1/components/gmail-search-emails/execute')
      .reply(200, {
        emails: [
          { id: '123', subject: 'Test Email', from: 'test@example.com' }
        ],
        count: 1
      });
    
    const workflow = [
      {
        type: 'pipedream_connect',
        alias: 'search_emails',
        config: {
          component_id: 'gmail-search-emails',
          params: { query: 'test' },
          store: { 'emails': 'foundEmails' }
        }
      }
    ];
    
    const executor = new NodeExecutor();
    const result = await executor.executeWorkflow(workflow, 'test_workflow');
    
    expect(result.foundEmails).toHaveLength(1);
    expect(result.foundEmails[0].subject).toBe('Test Email');
  });
});
```

---

## Performance & Optimization

### Caching Strategy

```javascript
// Cache service and component data to reduce API calls
class PipedreamCache {
  constructor() {
    this.servicesCache = new Map(); // query -> results
    this.componentsCache = new Map(); // app_slug -> components
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
  }
  
  getCachedServices(query) {
    const cached = this.servicesCache.get(query);
    if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
      return cached.data;
    }
    return null;
  }
  
  setCachedServices(query, data) {
    this.servicesCache.set(query, {
      data,
      timestamp: Date.now()
    });
  }
}
```

### Rate Limiting

```javascript
// Implement rate limiting for Pipedream API calls
class RateLimiter {
  constructor(requestsPerMinute = 60) {
    this.requests = [];
    this.limit = requestsPerMinute;
  }
  
  async waitIfNeeded() {
    const now = Date.now();
    this.requests = this.requests.filter(time => now - time < 60000);
    
    if (this.requests.length >= this.limit) {
      const oldestRequest = Math.min(...this.requests);
      const waitTime = 60000 - (now - oldestRequest);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.requests.push(now);
  }
}
```

### Batch Operations

```javascript
// For workflows with multiple API calls, implement batching
async executeBatchAPIOperations(operations) {
  const batchSize = 5; // Process 5 at a time
  const results = [];
  
  for (let i = 0; i < operations.length; i += batchSize) {
    const batch = operations.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(op => this.executeAPIComponent(op.token, op.component_id, op.auth_config, op.params))
    );
    results.push(...batchResults);
    
    // Rate limiting delay between batches
    if (i + batchSize < operations.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}
```

---

## Monitoring & Logging

### Comprehensive Logging

```javascript
// Enhanced logging for Pipedream operations
class PipedreamLogger {
  static logDiscoveryCall(toolName, args, result) {
    console.log(`[PIPEDREAM_DISCOVERY] ${toolName}:`, {
      input: args,
      output: {
        count: result.services?.length || result.components?.length || 0,
        success: !result.error
      },
      timestamp: new Date().toISOString()
    });
  }
  
  static logComponentExecution(componentId, params, result, executionTime) {
    console.log(`[PIPEDREAM_EXECUTION] ${componentId}:`, {
      params: Object.keys(params),
      success: !!result,
      executionTime: `${executionTime}ms`,
      timestamp: new Date().toISOString()
    });
  }
  
  static logAuthenticationAttempt(method, success, error) {
    console.log(`[PIPEDREAM_AUTH] ${method}:`, {
      success,
      error: error?.message,
      timestamp: new Date().toISOString()
    });
  }
}
```

### Error Tracking

```javascript
// Track and categorize Pipedream errors for debugging
class PipedreamErrorTracker {
  static trackError(operation, error, context) {
    const errorData = {
      operation,
      error_type: error.name,
      error_message: error.message,
      context: {
        workflow_id: context.workflowId,
        node_alias: context.nodeAlias,
        component_id: context.componentId
      },
      timestamp: new Date().toISOString()
    };
    
    // Log to console for development
    console.error('[PIPEDREAM_ERROR]', errorData);
    
    // TODO: Send to error tracking service in production
    // sendToErrorTracker(errorData);
  }
}
```

---

## Migration Path & Backwards Compatibility

### No Breaking Changes
- New node type and tools are additive
- Existing workflows continue working unchanged
- No modifications to existing Director functionality

### Gradual Adoption
```javascript
// Directors can gradually adopt API automation
// Old way: Browser automation only
{
  type: 'browser_action',
  config: { action: 'navigate', url: 'https://gmail.com' }
}

// New way: Choose best approach
{
  type: 'pipedream_connect', // Faster, more reliable
  config: { component_id: 'gmail-search-emails' }
}
```

### Feature Flags
```javascript
// Environment variable to enable/disable Pipedream integration
const PIPEDREAM_ENABLED = process.env.PIPEDREAM_ENABLED !== 'false';

// Graceful degradation when disabled
if (!PIPEDREAM_ENABLED) {
  throw new Error('Pipedream integration is disabled. Set PIPEDREAM_ENABLED=true to enable API automation.');
}
```

---

## Future Enhancement Roadmap

### Phase 2: OAuth Integration (Week 4-6)
- Pipedream Connect Link integration
- Automatic user authentication flows
- Multi-user token management

### Phase 3: Advanced Features (Week 8-12)
- Webhook support for real-time triggers
- Pipedream workflow templates
- Advanced error recovery and retries
- Performance analytics dashboard

### Phase 4: Enterprise Features (Future)
- Team authentication management
- Custom component development
- Advanced monitoring and alerting
- Compliance and audit logging

---

## Support & Documentation

### Director Prompts Update
The Director system prompt should be updated to include:

```
**API Automation Capabilities**

You now have access to 2,800+ API integrations through Pipedream Connect:

1. **Discovery Phase**:
   - Use `pipedream_search_services('gmail')` to find services
   - Use `pipedream_get_components('gmail')` to see available actions

2. **Execution Phase**:
   - Create `pipedream_connect` nodes for API operations
   - API calls are 100x faster than browser automation
   - Choose API over browser when possible for standard operations

3. **When to Use API vs Browser**:
   - ✅ API: Gmail search, Airtable CRUD, Slack messaging, standard operations
   - ✅ Browser: Complex UI, custom forms, visual interactions, proprietary systems

4. **Authentication**:
   - Development: Uses environment variables
   - Production: User provides tokens via context variables
   - Format: `auth_config: { token: '{{service_token}}' }`
```

### User Documentation Template

```markdown
# Using API Automation with Director

## Quick Start
1. Set your Pipedream API token: `PIPEDREAM_API_TOKEN=your_token`
2. Ask Director: "Search Gmail for investor emails using API"
3. Director will discover Gmail components and create efficient workflows

## Authentication Setup
[Instructions for obtaining and configuring service tokens]

## Supported Services
[List of popular services with examples]

## Troubleshooting
[Common issues and solutions]
```

---

## Implementation Checklist

### Pre-Implementation
- [ ] Pipedream Connect account setup
- [ ] API token obtained and configured
- [ ] Test service tokens acquired (Gmail, Airtable)
- [ ] Development environment prepared

### Week 1: Core Implementation
- [ ] Add `pipedream_connect` node type to nodeExecutor
- [ ] Implement authentication resolution chain
- [ ] Add basic component execution method
- [ ] Create node schema in toolDefinitions
- [ ] Basic error handling and logging

### Week 2: Discovery Tools
- [ ] Implement `pipedream_search_services` tool
- [ ] Implement `pipedream_get_components` tool  
- [ ] Add tool handlers to DirectorService
- [ ] Integration testing with real Pipedream API
- [ ] Caching and rate limiting implementation

### Week 3: Testing & Polish
- [ ] Comprehensive unit tests
- [ ] Integration tests with multiple services
- [ ] End-to-end workflow tests
- [ ] Error handling validation
- [ ] Performance optimization

### Week 4: Documentation & Deployment
- [ ] Director prompt updates
- [ ] User documentation creation
- [ ] Deployment guide
- [ ] Example workflows
- [ ] Production readiness checklist

---

## Conclusion

This implementation plan provides a comprehensive roadmap for integrating Pipedream Connect into Director 2.0. The hybrid architecture leverages the best of both worlds: Director's sophisticated browser automation for complex UI interactions, and Pipedream's extensive API ecosystem for efficient data operations.

The progressive enhancement approach ensures immediate value while building toward a production-ready OAuth-enabled system. The clear separation between discovery tools and execution nodes maintains architectural cleanliness while providing maximum flexibility.

This integration will position Director 2.0 as a truly comprehensive automation platform, capable of handling any workflow from simple API calls to complex multi-step processes involving both browsers and APIs.

**Ready for implementation.** 🚀

---

*This document serves as the definitive technical specification for Pipedream Connect integration. All implementation should follow the patterns and decisions outlined here to ensure consistency and maintainability.*