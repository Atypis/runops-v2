# Unified Backend Data Service Implementation Plan

## Executive Summary

This document provides a comprehensive implementation plan for creating a unified backend data service that consolidates the current separate implementations of variables and records in the VariableManagementService. The goal is to eliminate code duplication, provide a consistent interface, and maintain clear separation of concerns while supporting both workflow variables and record-based iteration.

## Current State Analysis

### What We Have Today

The `VariableManagementService` currently handles both variables and records with parallel but separate implementations:

**Variables (Lines 1-467)**
- Stored in `workflow_memory` table
- Key-value pairs with workflow scope
- Methods: getAllVariables, getVariable, setVariable, deleteVariable, clearAllVariables
- Special handling for iteration variables (`@iter:` prefix)
- JSON schema validation support
- Sensitive data masking

**Records (Lines 468-790)**
- Stored in `workflow_records` table  
- Entity-based with unique IDs and structured data
- Methods: createRecord, updateRecord, getRecord, queryRecords, deleteRecord
- Progressive data accumulation with node namespacing
- Status tracking and error handling
- Batch operations and array-to-record conversion

### Code Duplication Identified

1. **Similar CRUD patterns** - Both have create/read/update/delete operations
2. **Error handling** - Duplicate console.error patterns and error throwing
3. **Supabase interactions** - Similar query building and result handling
4. **Validation logic** - Could share common validation utilities
5. **Formatting/display** - Similar chunking and sensitive data handling

### Integration Points

**NodeExecutor** (`nodeExecutor.js`)
- Uses variableService for both variables and records
- Calls createRecord, updateRecord, queryRecords, getRecordsByIds
- Record context management with push/pop stack

**DirectorService** (`directorService.js`)
- Primarily uses variable methods
- Calls getFormattedVariables, getAllVariables, getVariable, setVariable
- Handles cleanup of iteration variables

**Director Routes** (`routes/director.js`)
- Exposes getAllVariables and getFormattedVariables endpoints
- No record endpoints currently exposed

## Unified Service Design

### Architecture Overview

```
UnifiedDataService
├── Storage Layer (abstract interface)
│   ├── VariableStorage (workflow_memory)
│   └── RecordStorage (workflow_records)
├── Common Utilities
│   ├── Validation
│   ├── Formatting
│   └── Error Handling
└── Public API
    ├── Variables API
    ├── Records API
    └── Unified Query API
```

### Core Design Principles

1. **Single Responsibility** - Each storage type maintains its own logic
2. **Consistent Interface** - Unified method signatures where possible
3. **Progressive Enhancement** - Add unified features without breaking existing
4. **Type Safety** - Clear distinction between variables and records
5. **Performance** - Optimize common query patterns

## Implementation Plan

### Phase 1: Refactor Foundation (Week 1)

#### 1.1 Create Base Storage Interface

```javascript
// backend/services/storage/BaseStorage.js
export class BaseStorage {
  constructor(supabase, tableName) {
    this.supabase = supabase;
    this.tableName = tableName;
  }

  // Common CRUD operations
  async create(data) { throw new Error('Not implemented'); }
  async read(id) { throw new Error('Not implemented'); }
  async update(id, data) { throw new Error('Not implemented'); }
  async delete(id) { throw new Error('Not implemented'); }
  async query(filters) { throw new Error('Not implemented'); }
  
  // Common utilities
  async exists(id) {
    const result = await this.read(id);
    return result !== null;
  }
  
  handleError(operation, error) {
    console.error(`[${this.constructor.name}] Error in ${operation}:`, error);
    throw error;
  }
}
```

#### 1.2 Extract Variable Storage

```javascript
// backend/services/storage/VariableStorage.js
export class VariableStorage extends BaseStorage {
  constructor(supabase) {
    super(supabase, 'workflow_memory');
    this.maxChunkLength = 100;
    this.sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth', 'credential'];
  }

  async create({ workflowId, key, value }) {
    const { data, error } = await this.supabase
      .from(this.tableName)
      .upsert({
        workflow_id: workflowId,
        key: key,
        value: value
      }, {
        onConflict: 'workflow_id, key'
      })
      .select()
      .single();
      
    if (error) this.handleError('create', error);
    return data;
  }

  async read({ workflowId, key }) {
    if (key === 'all') {
      return this.query({ workflowId });
    }

    const { data, error } = await this.supabase
      .from(this.tableName)
      .select('value')
      .eq('workflow_id', workflowId)
      .eq('key', key)
      .single();
      
    if (error && error.code !== 'PGRST116') {
      this.handleError('read', error);
    }
    
    return data?.value || null;
  }

  async query({ workflowId, pattern, nodeId }) {
    let query = this.supabase
      .from(this.tableName)
      .select('key, value, created_at, updated_at')
      .eq('workflow_id', workflowId);

    if (pattern) {
      query = query.ilike('key', `%${pattern}%`);
    }

    if (nodeId) {
      const nodePrefix = `node${nodeId}`;
      query = query.or(`key.eq.${nodePrefix},key.like.${nodePrefix}.%,key.like.${nodePrefix}@%`);
    }

    const { data, error } = await query.order('key');
    if (error) this.handleError('query', error);
    
    return data || [];
  }

  // Variable-specific methods
  async findIterateReferences(workflowId, variableKey) {
    // Move existing logic here
  }

  async cleanupIterationVariables(workflowId, nodePositions) {
    // Move existing logic here
  }

  formatForDisplay(key, value) {
    // Move existing logic here
  }

  isSensitive(key) {
    const lowerKey = key.toLowerCase();
    return this.sensitiveKeys.some(pattern => lowerKey.includes(pattern));
  }
}
```

#### 1.3 Extract Record Storage

```javascript
// backend/services/storage/RecordStorage.js
export class RecordStorage extends BaseStorage {
  constructor(supabase) {
    super(supabase, 'workflow_records');
  }

  async create({ workflowId, recordId, recordType, data, iterationNodeAlias }) {
    // Ensure data follows reserved structure
    const recordData = {
      fields: data.fields || {},
      vars: data.vars || {},
      targets: data.targets || {},
      history: data.history || []
    };

    // Handle legacy data format
    Object.keys(data).forEach(key => {
      if (!['fields', 'vars', 'targets', 'history'].includes(key)) {
        recordData.fields[key] = data[key];
      }
    });

    const record = {
      workflow_id: workflowId,
      record_id: recordId,
      record_type: recordType,
      iteration_node_alias: iterationNodeAlias,
      data: recordData,
      status: 'discovered'
    };

    const { data: result, error } = await this.supabase
      .from(this.tableName)
      .upsert(record, {
        onConflict: 'workflow_id,record_id'
      })
      .select()
      .single();

    if (error) this.handleError('create', error);
    return result;
  }

  async update({ workflowId, recordId, patch, currentContext }) {
    // Separate top-level fields from data fields
    const topLevelFields = ['status', 'error_message', 'processed_at', 'retry_count'];
    const topLevelUpdates = {};
    const dataUpdates = {};

    for (const [key, value] of Object.entries(patch)) {
      if (topLevelFields.includes(key)) {
        topLevelUpdates[key] = value;
      } else {
        dataUpdates[key] = value;
      }
    }

    // Get existing data and merge
    const existing = await this.read({ workflowId, recordId });
    const mergedData = this.deepMergeWithPaths(existing?.data || {}, dataUpdates);

    const updatePayload = {
      ...topLevelUpdates,
      data: mergedData,
      updated_at: new Date().toISOString()
    };

    const { error } = await this.supabase
      .from(this.tableName)
      .update(updatePayload)
      .eq('workflow_id', workflowId)
      .eq('record_id', recordId);

    if (error) this.handleError('update', error);

    // Update live context if provided
    if (currentContext && currentContext.recordId === recordId) {
      currentContext.data = mergedData;
      Object.assign(currentContext, topLevelUpdates);
    }
  }

  async query({ workflowId, pattern, type, status, ids }) {
    let query = this.supabase
      .from(this.tableName)
      .select('*')
      .eq('workflow_id', workflowId);

    if (pattern) {
      if (pattern === '*') {
        // Return all
      } else if (pattern.includes('_*')) {
        const prefix = pattern.replace('_*', '_');
        query = query.like('record_id', `${prefix}%`);
      } else {
        query = query.eq('record_id', pattern);
      }
    }

    if (type) {
      query = query.eq('record_type', type);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (ids && ids.length > 0) {
      query = query.in('record_id', ids);
    }

    const { data, error } = await query.order('created_at');
    if (error) this.handleError('query', error);
    
    return data || [];
  }

  deepMergeWithPaths(target, patch) {
    // Move existing logic here
  }
}
```

### Phase 2: Unified Service Layer (Week 1-2)

#### 2.1 Create Unified Data Service

```javascript
// backend/services/UnifiedDataService.js
import { VariableStorage } from './storage/VariableStorage.js';
import { RecordStorage } from './storage/RecordStorage.js';
import { SchemaValidator } from './SchemaValidator.js';

export class UnifiedDataService {
  constructor(supabase) {
    this.variables = new VariableStorage(supabase);
    this.records = new RecordStorage(supabase);
    this.validator = new SchemaValidator();
  }

  // ===== Variable Operations =====
  
  async getAllVariables(workflowId) {
    return this.variables.query({ workflowId });
  }

  async getVariable(workflowId, key) {
    return this.variables.read({ workflowId, key });
  }

  async setVariable(workflowId, key, value, schema = null, reason = null) {
    if (schema) {
      this.validator.validate(value, schema);
    }

    const result = await this.variables.create({ workflowId, key, value });

    // Smart cleanup for iteration variables
    const iterateNodes = await this.variables.findIterateReferences(workflowId, key);
    if (iterateNodes.length > 0) {
      await this.variables.cleanupIterationVariables(workflowId, iterateNodes);
    }

    return { success: true, key, value, reason };
  }

  async deleteVariable(workflowId, key) {
    return this.variables.delete({ workflowId, key });
  }

  async clearAllVariables(workflowId) {
    return this.variables.deleteAll({ workflowId });
  }

  // ===== Record Operations =====

  async createRecord(workflowId, recordId, recordType, initialData = {}, iterationNodeAlias = null) {
    return this.records.create({
      workflowId,
      recordId,
      recordType,
      data: initialData,
      iterationNodeAlias
    });
  }

  async updateRecord(workflowId, recordId, patch, currentContext = null) {
    return this.records.update({
      workflowId,
      recordId,
      patch,
      currentContext
    });
  }

  async getRecord(workflowId, recordId) {
    return this.records.read({ workflowId, recordId });
  }

  async getRecordsByIds(workflowId, recordIds) {
    return this.records.query({ workflowId, ids: recordIds });
  }

  async queryRecords(workflowId, query) {
    return this.records.query({ workflowId, pattern: query });
  }

  async deleteRecord(workflowId, recordId) {
    return this.records.delete({ workflowId, recordId });
  }

  async deleteAllRecords(workflowId) {
    return this.records.deleteAll({ workflowId });
  }

  // ===== Unified Operations =====

  async getData(workflowId, options = {}) {
    const { bucket = 'all', pattern, includeMetadata = false } = options;
    
    const result = {
      workflow_id: workflowId,
      timestamp: new Date().toISOString()
    };

    if (bucket === 'all' || bucket === 'global') {
      result.global = await this.getVariablesFormatted(workflowId);
    }

    if (bucket === 'all' || bucket === 'records') {
      const records = pattern 
        ? await this.queryRecords(workflowId, pattern)
        : await this.queryRecords(workflowId, '*');
      
      result.records = this.formatRecords(records, includeMetadata);
    }

    if (bucket.match(/^[a-z]+_\d{3}$/)) {
      // Specific record request
      const record = await this.getRecord(workflowId, bucket);
      result.records = record ? { [bucket]: this.formatRecord(record, includeMetadata) } : {};
    }

    return result;
  }

  async clearData(workflowId, options = {}) {
    const { type = 'all', pattern } = options;
    const result = {};

    if (type === 'all' || type === 'variables') {
      result.variables = await this.clearAllVariables(workflowId);
    }

    if (type === 'all' || type === 'records') {
      if (pattern) {
        const records = await this.queryRecords(workflowId, pattern);
        for (const record of records) {
          await this.deleteRecord(workflowId, record.record_id);
        }
        result.records = { deleted: records.length, pattern };
      } else {
        result.records = await this.deleteAllRecords(workflowId);
      }
    }

    return result;
  }

  // ===== Formatting Methods =====

  async getFormattedVariables(workflowId) {
    const variables = await this.getAllVariables(workflowId);
    
    if (!variables || variables.length === 0) {
      return 'No variables stored yet';
    }

    return variables.map(({ key, value }) => {
      const displayValue = this.variables.formatForDisplay(key, value);
      return `- ${key} = ${displayValue}`;
    }).join('\n');
  }

  formatRecords(records, includeMetadata) {
    const formatted = {};
    
    for (const record of records) {
      formatted[record.record_id] = this.formatRecord(record, includeMetadata);
    }
    
    return formatted;
  }

  formatRecord(record, includeMetadata) {
    const formatted = {
      type: record.record_type,
      data: record.data
    };

    if (includeMetadata) {
      formatted.status = record.status;
      formatted.created_at = record.created_at;
      formatted.updated_at = record.updated_at;
      if (record.error_message) {
        formatted.error = record.error_message;
      }
    }

    return formatted;
  }

  // ===== Statistics & Debugging =====

  async getStats(workflowId) {
    const [variables, records] = await Promise.all([
      this.getAllVariables(workflowId),
      this.queryRecords(workflowId, '*')
    ]);

    return {
      variables: {
        total: variables.length,
        types: this.countTypes(variables),
        categories: this.categorizeVariables(variables)
      },
      records: {
        total: records.length,
        byType: this.groupBy(records, 'record_type'),
        byStatus: this.groupBy(records, 'status')
      }
    };
  }

  // ===== Legacy Support =====

  async convertArrayToRecords(workflowId, array, recordType = 'temp', iterationNodeAlias = null, runId = null) {
    const records = [];
    const actualRunId = runId || new Date().getTime().toString();

    for (let i = 0; i < array.length; i++) {
      const recordId = `temp:${actualRunId}:${iterationNodeAlias || 'unknown'}:${String(i + 1).padStart(4, '0')}`;
      
      const record = await this.createRecord(workflowId, recordId, recordType, {
        fields: {
          value: array[i],
          index: i,
          total: array.length
        }
      }, iterationNodeAlias);

      records.push(record);
    }

    return records;
  }

  // ===== Helper Methods =====

  countTypes(items) {
    const types = {};
    items.forEach(({ value }) => {
      const type = Array.isArray(value) ? 'array' : typeof value;
      types[type] = (types[type] || 0) + 1;
    });
    return types;
  }

  categorizeVariables(variables) {
    const categories = {
      nodeVariables: 0,
      iterationVariables: 0,
      customVariables: 0
    };

    variables.forEach(({ key }) => {
      if (key.startsWith('node')) {
        categories.nodeVariables++;
      } else if (key.includes('@iter:')) {
        categories.iterationVariables++;
      } else {
        categories.customVariables++;
      }
    });

    return categories;
  }

  groupBy(items, field) {
    const groups = {};
    items.forEach(item => {
      const value = item[field];
      groups[value] = (groups[value] || 0) + 1;
    });
    return groups;
  }
}
```

### Phase 3: Migration & Integration (Week 2)

#### 3.1 Update Existing Services

```javascript
// backend/services/variableManagementService.js
// Transform into a facade that delegates to UnifiedDataService
import { UnifiedDataService } from './UnifiedDataService.js';

export class VariableManagementService {
  constructor() {
    // Initialize unified service
    this.unifiedService = new UnifiedDataService(supabase);
    
    // Maintain backwards compatibility properties
    this.supabase = supabase;
    this.maxChunkLength = 100;
    this.sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth', 'credential'];
  }

  // Delegate all methods to unified service
  async getAllVariables(workflowId) {
    return this.unifiedService.getAllVariables(workflowId);
  }

  async getVariable(workflowId, key) {
    return this.unifiedService.getVariable(workflowId, key);
  }

  async setVariable(workflowId, key, value, schema, reason) {
    return this.unifiedService.setVariable(workflowId, key, value, schema, reason);
  }

  // ... delegate all other methods

  // Maintain any methods that don't cleanly map
  formatVariableForDisplay(key, value) {
    return this.unifiedService.variables.formatForDisplay(key, value);
  }
}
```

#### 3.2 Update Integration Points

```javascript
// backend/services/nodeExecutor.js
// Update to use unified service
constructor(sharedBrowserStateService = null, dataService = null) {
  // ... existing code
  this.dataService = dataService || new UnifiedDataService(supabase);
  this.variableService = this.dataService; // Backwards compatibility
}

// backend/services/directorService.js
// Update initialization
constructor() {
  // ... existing code
  this.dataService = new UnifiedDataService(supabase);
  this.variableManagementService = this.dataService; // Backwards compatibility
}
```

#### 3.3 Add New API Endpoints

```javascript
// backend/routes/director.js

// Unified data endpoint
router.get('/workflows/:id/data', async (req, res, next) => {
  try {
    const { bucket = 'all', pattern, metadata } = req.query;
    const data = await directorService.dataService.getData(
      req.params.id,
      { 
        bucket, 
        pattern, 
        includeMetadata: metadata === 'true' 
      }
    );
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// Data statistics endpoint
router.get('/workflows/:id/data/stats', async (req, res, next) => {
  try {
    const stats = await directorService.dataService.getStats(req.params.id);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// Clear data endpoint
router.delete('/workflows/:id/data', async (req, res, next) => {
  try {
    const { type = 'all', pattern } = req.query;
    const result = await directorService.dataService.clearData(
      req.params.id,
      { type, pattern }
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});
```

### Phase 4: Testing & Documentation (Week 2-3)

#### 4.1 Unit Tests

```javascript
// backend/tests/UnifiedDataService.test.js
describe('UnifiedDataService', () => {
  describe('Variable Operations', () => {
    test('should set and get variables', async () => {
      const service = new UnifiedDataService(mockSupabase);
      await service.setVariable('workflow1', 'testKey', 'testValue');
      const value = await service.getVariable('workflow1', 'testKey');
      expect(value).toBe('testValue');
    });

    test('should validate schema when provided', async () => {
      const service = new UnifiedDataService(mockSupabase);
      const schema = { type: 'string' };
      await expect(
        service.setVariable('workflow1', 'key', 123, schema)
      ).rejects.toThrow();
    });
  });

  describe('Record Operations', () => {
    test('should create and query records', async () => {
      const service = new UnifiedDataService(mockSupabase);
      await service.createRecord('workflow1', 'email_001', 'email', {
        fields: { subject: 'Test' }
      });
      
      const records = await service.queryRecords('workflow1', 'email_*');
      expect(records).toHaveLength(1);
      expect(records[0].record_id).toBe('email_001');
    });

    test('should update records with path support', async () => {
      const service = new UnifiedDataService(mockSupabase);
      await service.createRecord('workflow1', 'email_001', 'email', {});
      await service.updateRecord('workflow1', 'email_001', {
        'vars.classification': 'investor'
      });
      
      const record = await service.getRecord('workflow1', 'email_001');
      expect(record.data.vars.classification).toBe('investor');
    });
  });

  describe('Unified Operations', () => {
    test('should get all data', async () => {
      const service = new UnifiedDataService(mockSupabase);
      const data = await service.getData('workflow1');
      expect(data).toHaveProperty('global');
      expect(data).toHaveProperty('records');
    });
  });
});
```

#### 4.2 Integration Tests

```javascript
// backend/tests/integration/workflowExecution.test.js
describe('Workflow Execution with Unified Data', () => {
  test('should handle record-based iteration', async () => {
    // Create test records
    await dataService.createRecord(workflowId, 'email_001', 'email', {
      fields: { subject: 'Test 1' }
    });
    await dataService.createRecord(workflowId, 'email_002', 'email', {
      fields: { subject: 'Test 2' }
    });

    // Execute iteration
    const result = await nodeExecutor.executeIterate({
      over_records: 'email_*',
      body: [/* test nodes */]
    }, workflowId);

    expect(result.processed).toBe(2);
    expect(result.failed).toBe(0);
  });
});
```

#### 4.3 Documentation

Create comprehensive documentation:

1. **API Reference** - Document all public methods of UnifiedDataService
2. **Migration Guide** - Step-by-step guide for updating existing code
3. **Best Practices** - When to use variables vs records
4. **Examples** - Common patterns and use cases

### Phase 5: Deployment & Monitoring (Week 3)

#### 5.1 Rollout Strategy

1. **Feature Flag** - Deploy behind feature flag for gradual rollout
2. **Backwards Compatibility** - Ensure all existing workflows continue working
3. **Performance Monitoring** - Track query performance and optimization opportunities
4. **Error Tracking** - Monitor for new error patterns

#### 5.2 Performance Optimizations

```javascript
// Add caching layer for frequently accessed data
class CachedDataService extends UnifiedDataService {
  constructor(supabase) {
    super(supabase);
    this.cache = new Map();
    this.cacheTimeout = 60000; // 1 minute
  }

  async getVariable(workflowId, key) {
    const cacheKey = `var:${workflowId}:${key}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.value;
    }

    const value = await super.getVariable(workflowId, key);
    this.cache.set(cacheKey, { value, timestamp: Date.now() });
    return value;
  }

  invalidateCache(workflowId, key = null) {
    if (key) {
      this.cache.delete(`var:${workflowId}:${key}`);
    } else {
      // Clear all cache for workflow
      for (const [k] of this.cache) {
        if (k.startsWith(`var:${workflowId}:`)) {
          this.cache.delete(k);
        }
      }
    }
  }
}
```

## Key Benefits

### 1. Code Reduction
- Eliminate ~300 lines of duplicate code
- Single source of truth for data operations
- Easier to maintain and extend

### 2. Consistent Interface
- Unified error handling
- Common validation patterns
- Standardized return formats

### 3. Enhanced Features
- Unified querying across variables and records
- Better debugging with combined stats
- Simplified testing

### 4. Performance
- Optimized query patterns
- Optional caching layer
- Batch operations where appropriate

### 5. Future Extensibility
- Easy to add new storage types
- Plugin architecture for custom behaviors
- Clear separation of concerns

## Risk Mitigation

### 1. Backwards Compatibility
- Maintain existing class interfaces
- Extensive testing of migration paths
- Feature flags for gradual rollout

### 2. Performance Impact
- Benchmark before and after
- Monitor query patterns
- Add caching where needed

### 3. Data Integrity
- Transaction support for critical operations
- Validation at multiple layers
- Comprehensive error handling

## Success Metrics

1. **Code Metrics**
   - 40% reduction in service layer code
   - 90% test coverage
   - Zero breaking changes

2. **Performance Metrics**
   - Query performance within 5% of current
   - Memory usage stable
   - No increase in error rates

3. **Developer Experience**
   - Simplified API surface
   - Better documentation
   - Easier debugging

## Timeline

- **Week 1**: Foundation refactoring and storage extraction
- **Week 2**: Unified service implementation and integration
- **Week 3**: Testing, documentation, and deployment
- **Week 4**: Monitoring, optimization, and cleanup

## Conclusion

This unified backend data service will significantly improve code maintainability while providing a consistent interface for both variables and records. The phased approach ensures minimal disruption while delivering immediate benefits through code consolidation and enhanced features.