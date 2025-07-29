import { supabase } from '../config/supabase.js';

export class VariableManagementService {
  constructor() {
    this.supabase = supabase;
    this.maxChunkLength = 100;
    this.sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth', 'credential'];
  }

  /**
   * Find all iterate nodes that reference a specific variable
   * @param {string} workflowId - The workflow ID
   * @param {string} variableKey - The variable key being updated
   * @returns {Array} Array of iterate node positions that reference this variable
   */
  async findIterateNodesReferencingVariable(workflowId, variableKey) {
    try {
      // Get all iterate nodes in the workflow
      const { data: iterateNodes, error } = await this.supabase
        .from('nodes')
        .select('position, config')
        .eq('workflow_id', workflowId)
        .eq('type', 'iterate');

      if (error) {
        console.error('[VariableManagementService] Error finding iterate nodes:', error);
        return [];
      }

      if (!iterateNodes || iterateNodes.length === 0) {
        return [];
      }

      // Find nodes that reference this variable
      const referencingNodes = [];
      for (const node of iterateNodes) {
        if (node.config?.over) {
          // Check if the 'over' field references our variable
          // Handle different formats: "variableKey", "state.variableKey", "{{variableKey}}"
          const overValue = node.config.over;
          if (
            overValue === variableKey ||
            overValue === `state.${variableKey}` ||
            overValue === `{{${variableKey}}}` ||
            overValue.includes(`{{${variableKey}.`) // For nested references like {{animals.items}}
          ) {
            referencingNodes.push(node.position);
          }
        }
      }

      return referencingNodes;
    } catch (error) {
      console.error('[VariableManagementService] Exception finding iterate nodes:', error);
      return [];
    }
  }

  /**
   * Clean up stale iteration variables for specific iterate nodes
   * @param {string} workflowId - The workflow ID
   * @param {Array<number>} nodePositions - Array of iterate node positions
   */
  async cleanupIterationVariables(workflowId, nodePositions) {
    if (!nodePositions || nodePositions.length === 0) {
      return;
    }

    const ms = Date.now();
    console.log(`[VAR_CLEANUP ${ms}] Cleaning up iteration variables for nodes: ${nodePositions.join(', ')}`);

    try {
      // Build cleanup patterns for each node position
      const cleanupConditions = nodePositions.map(pos => `key.like.%@iter:${pos}:%`);
      
      // Delete all matching iteration variables
      const { data: deletedVars, error } = await this.supabase
        .from('workflow_memory')
        .delete()
        .eq('workflow_id', workflowId)
        .or(cleanupConditions.join(','))
        .select('key');

      if (error) {
        console.error(`[VAR_CLEANUP ${ms}] Error cleaning up iteration variables:`, error);
        return;
      }

      const deletedCount = deletedVars?.length || 0;
      console.log(`[VAR_CLEANUP ${ms}] Deleted ${deletedCount} stale iteration variables`);
      if (deletedCount > 0) {
        console.log(`[VAR_CLEANUP ${ms}] Deleted keys:`, deletedVars.map(v => v.key).join(', '));
      }
    } catch (error) {
      console.error(`[VAR_CLEANUP ${ms}] Exception during cleanup:`, error);
    }
  }

  /**
   * Get formatted variables for Director 2.0 context (Part 4)
   * Returns chunked display with sensitive data masking
   */
  async getFormattedVariables(workflowId) {
    if (!workflowId) {
      return 'No variables available (no workflow context)';
    }

    try {
      const variables = await this.getAllVariables(workflowId);
      
      if (!variables || variables.length === 0) {
        return 'No variables stored yet';
      }

      const formatted = variables.map(({ key, value }) => {
        const displayValue = this.formatVariableForDisplay(key, value);
        return `- ${key} = ${displayValue}`;
      }).join('\n');

      return formatted;
    } catch (error) {
      console.error('[VariableManagementService] Error getting formatted variables:', error);
      return `Error loading variables: ${error.message}`;
    }
  }

  /**
   * Get all variables for a workflow
   */
  async getAllVariables(workflowId) {
    try {
      const queryStart = Date.now();
      const { data, error } = await this.supabase
        .from('workflow_memory')
        .select('key, value, created_at, updated_at')
        .eq('workflow_id', workflowId)
        .order('key');
      
      if (error) {
        console.error(`Failed to fetch variables: ${error.message}`);
        throw error;
      }
      
      const variables = data || [];
      return variables;
    } catch (error) {
      console.error(`Error in getAllVariables: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get single variable by key
   */
  async getVariable(workflowId, key) {
    if (key === 'all') {
      // Special case: return all variables in detail
      const variables = await this.getAllVariables(workflowId);
      return variables.reduce((acc, { key, value }) => {
        acc[key] = value;
        return acc;
      }, {});
    }

    try {
      const { data, error } = await this.supabase
        .from('workflow_memory')
        .select('value')
        .eq('workflow_id', workflowId)
        .eq('key', key)
        .single();
      
      if (error && error.code === 'PGRST116') {
        // No rows returned
        return null;
      }
      if (error) {
        console.error(`Failed to read variable: ${error.message}`);
        throw error;
      }

      return data?.value || null;
    } catch (error) {
      console.error(`[VariableManagementService] Error getting variable ${key}:`, error);
      throw error;
    }
  }

  /**
   * Set variable with optional validation
   */
  async setVariable(workflowId, key, value, schema = null, reason = null) {
    try {
      // Optional JSON schema validation
      if (schema) {
        this.validateAgainstSchema(value, schema);
      }

      const { data, error } = await this.supabase
        .from('workflow_memory')
        .upsert({
          workflow_id: workflowId,
          key: key,
          value: value
        }, {
          onConflict: 'workflow_id, key'
        })
        .select()
        .single();
      
      if (error) {
        console.error(`Failed to write variable: ${error.message}`);
        throw error;
      }

      // Smart cleanup: Find and clean up stale iteration variables when source data changes
      // This ensures previews always show correct data
      const iterateNodes = await this.findIterateNodesReferencingVariable(workflowId, key);
      if (iterateNodes.length > 0) {
        await this.cleanupIterationVariables(workflowId, iterateNodes);
      }
      
      return { success: true, key, value, reason };
    } catch (error) {
      console.error(`[VariableManagementService] Error setting variable ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete single variable
   */
  async deleteVariable(workflowId, key) {
    try {
      const { error } = await this.supabase
        .from('workflow_memory')
        .delete()
        .eq('workflow_id', workflowId)
        .eq('key', key);

      if (error) throw error;

      console.log(`[VariableManagementService] Deleted variable ${key}`);
      return { success: true, deleted: key };
    } catch (error) {
      console.error(`[VariableManagementService] Error deleting variable ${key}:`, error);
      throw error;
    }
  }

  /**
   * Clear all variables for a workflow
   */
  async clearAllVariables(workflowId) {
    try {
      const { data, error } = await this.supabase
        .from('workflow_memory')
        .delete()
        .eq('workflow_id', workflowId)
        .select('key');

      if (error) throw error;

      const deletedCount = data?.length || 0;
      console.log(`[VariableManagementService] Cleared ${deletedCount} variables for workflow ${workflowId}`);
      
      return { success: true, deletedCount, deletedKeys: data?.map(row => row.key) || [] };
    } catch (error) {
      console.error('[VariableManagementService] Error clearing all variables:', error);
      throw error;
    }
  }

  /**
   * Search variables by pattern
   */
  async searchVariables(workflowId, pattern) {
    try {
      const { data, error } = await this.supabase
        .from('workflow_memory')
        .select('key, value')
        .eq('workflow_id', workflowId)
        .ilike('key', `%${pattern}%`)
        .order('key');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error(`[VariableManagementService] Error searching variables with pattern ${pattern}:`, error);
      throw error;
    }
  }

  /**
   * Get variables from specific node (e.g., all variables starting with "node4")
   */
  async getNodeVariables(workflowId, nodeId) {
    try {
      const nodePrefix = `node${nodeId}`;
      const { data, error } = await this.supabase
        .from('workflow_memory')
        .select('key, value')
        .eq('workflow_id', workflowId)
        .or(`key.eq.${nodePrefix},key.like.${nodePrefix}.%,key.like.${nodePrefix}@%`)
        .order('key');

      if (error) throw error;
      
      const result = {};
      data?.forEach(({ key, value }) => {
        result[key] = value;
      });
      
      return result;
    } catch (error) {
      console.error(`[VariableManagementService] Error getting node ${nodeId} variables:`, error);
      throw error;
    }
  }

  /**
   * Format variable for chunked display in Director context
   */
  formatVariableForDisplay(key, value) {
    // Check for sensitive data
    if (this.isSensitiveKey(key)) {
      return '[hidden]';
    }

    // Handle null/undefined
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';

    // Handle arrays with preview
    if (Array.isArray(value)) {
      if (value.length === 0) return '[] (empty)';
      
      const firstElement = JSON.stringify(value[0]);
      if (value.length === 1) return `[${firstElement}]`;
      
      if (firstElement.length > 80) {
        return `[${firstElement.substring(0, 80)}..., +${value.length - 1} more]`;
      }
      return `[${firstElement}, +${value.length - 1} more]`;
    }

    // Handle objects
    if (typeof value === 'object') {
      const stringValue = JSON.stringify(value);
      if (stringValue.length <= this.maxChunkLength) {
        return stringValue;
      }
      return stringValue.substring(0, this.maxChunkLength) + '...';
    }

    // Handle primitives
    const stringValue = String(value);
    if (stringValue.length <= this.maxChunkLength) {
      return stringValue;
    }
    return stringValue.substring(0, this.maxChunkLength) + '...';
  }

  /**
   * Check if a key contains sensitive information
   */
  isSensitiveKey(key) {
    const lowerKey = key.toLowerCase();
    return this.sensitiveKeys.some(pattern => lowerKey.includes(pattern));
  }

  /**
   * Validate value against JSON schema (optional feature)
   */
  validateAgainstSchema(value, schema) {
    // Basic JSON schema validation
    // This is a simplified implementation - could be enhanced with ajv library
    
    if (schema.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== schema.type) {
        throw new Error(`Variable validation failed: expected ${schema.type}, got ${actualType}`);
      }
    }

    if (schema.type === 'object' && schema.properties) {
      for (const [prop, propSchema] of Object.entries(schema.properties)) {
        if (value[prop] !== undefined) {
          this.validateAgainstSchema(value[prop], propSchema);
        }
      }
    }

    if (schema.type === 'array' && schema.items && value.length > 0) {
      for (const item of value) {
        this.validateAgainstSchema(item, schema.items);
      }
    }

    // Add more validation rules as needed
    return true;
  }

  /**
   * Get variable statistics for debugging
   */
  async getVariableStats(workflowId) {
    try {
      const variables = await this.getAllVariables(workflowId);
      const stats = {
        total: variables.length,
        types: {},
        nodeVariables: 0,
        customVariables: 0,
        iterationVariables: 0
      };

      variables.forEach(({ key, value }) => {
        // Count by type
        const type = Array.isArray(value) ? 'array' : typeof value;
        stats.types[type] = (stats.types[type] || 0) + 1;

        // Count by category
        if (key.startsWith('node')) {
          stats.nodeVariables++;
        } else if (key.includes('@iter:')) {
          stats.iterationVariables++;
        } else {
          stats.customVariables++;
        }
      });

      return stats;
    } catch (error) {
      console.error('[VariableManagementService] Error getting variable stats:', error);
      throw error;
    }
  }

  /**
   * Clean up all iteration variables for a workflow
   * Useful for debugging or when resetting workflow state
   */
  async cleanupAllIterationVariables(workflowId) {
    try {
      const { data: deletedVars, error } = await this.supabase
        .from('workflow_memory')
        .delete()
        .eq('workflow_id', workflowId)
        .like('key', '%@iter:%')
        .select('key');

      if (error) {
        console.error('[VariableManagementService] Error cleaning up all iteration variables:', error);
        throw error;
      }

      const deletedCount = deletedVars?.length || 0;
      console.log(`[VariableManagementService] Cleaned up ${deletedCount} iteration variables`);
      
      return { success: true, deletedCount, deletedKeys: deletedVars?.map(v => v.key) || [] };
    } catch (error) {
      console.error('[VariableManagementService] Exception cleaning up iteration variables:', error);
      throw error;
    }
  }

  // ==================== RECORD MANAGEMENT METHODS ====================

  /**
   * Create a new record with initial data
   * @param {string} workflowId - The workflow ID
   * @param {string} recordId - The record ID (e.g., "email_001" or "temp:runId:nodeAlias:0001")
   * @param {string} recordType - The record type (e.g., "email", "temp")
   * @param {object} initialData - Initial data to store in the record
   * @param {string} iterationNodeAlias - The node that created this record
   */
  async createRecord(workflowId, recordId, recordType, initialData = {}, iterationNodeAlias = null) {
    try {
      // Ensure initial data follows the reserved structure
      const recordData = {
        fields: initialData.fields || {},
        vars: initialData.vars || {},
        targets: initialData.targets || {},
        history: initialData.history || []
      };

      // If initialData has other keys, put them in fields by default
      Object.keys(initialData).forEach(key => {
        if (!['fields', 'vars', 'targets', 'history'].includes(key)) {
          recordData.fields[key] = initialData[key];
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

      // Use UPSERT for idempotent operations
      const { data, error } = await this.supabase
        .from('workflow_records')
        .upsert(record, {
          onConflict: 'workflow_id,record_id'
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to create record: ${error.message}`);
      
      console.log(`[RecordManagement] Created record ${recordId} of type ${recordType}`);
      return data;
    } catch (error) {
      console.error(`[RecordManagement] Error creating record ${recordId}:`, error);
      throw error;
    }
  }

  /**
   * Update a record with path support and live context update
   * @param {string} workflowId - The workflow ID
   * @param {string} recordId - The record ID
   * @param {object} patch - Updates to apply (supports dot paths like "vars.classification")
   * @param {object} currentContext - Optional current record context to update in memory
   */
  async updateRecord(workflowId, recordId, patch, currentContext = null) {
    try {
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

      // Get existing record data
      const { data: existing, error: fetchError } = await this.supabase
        .from('workflow_records')
        .select('data')
        .eq('workflow_id', workflowId)
        .eq('record_id', recordId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw new Error(`Failed to fetch record: ${fetchError.message}`);
      }

      // Deep merge with path support
      const mergedData = this.deepMergeWithPaths(existing?.data || {}, dataUpdates);

      // Update the record
      const updatePayload = {
        ...topLevelUpdates,
        data: mergedData,
        updated_at: new Date().toISOString()
      };

      const { error: updateError } = await this.supabase
        .from('workflow_records')
        .update(updatePayload)
        .eq('workflow_id', workflowId)
        .eq('record_id', recordId);

      if (updateError) throw new Error(`Failed to update record: ${updateError.message}`);

      // Update live context if provided
      if (currentContext && currentContext.recordId === recordId) {
        currentContext.data = this.deepMergeWithPaths(currentContext.data, dataUpdates);
        Object.assign(currentContext, topLevelUpdates);
        console.log(`[RecordManagement] Updated live context for record ${recordId}`);
      }

      console.log(`[RecordManagement] Updated record ${recordId} with ${Object.keys(patch).length} fields`);
    } catch (error) {
      console.error(`[RecordManagement] Error updating record ${recordId}:`, error);
      throw error;
    }
  }

  /**
   * Deep merge with dot-path support
   * @param {object} target - Target object
   * @param {object} patch - Patch object with potential dot paths
   */
  deepMergeWithPaths(target, patch) {
    const result = JSON.parse(JSON.stringify(target)); // Deep clone

    for (const [key, value] of Object.entries(patch)) {
      if (key.includes('.')) {
        // Handle dot path (e.g., "vars.classification")
        const parts = key.split('.');
        let current = result;
        
        // Navigate to the parent
        for (let i = 0; i < parts.length - 1; i++) {
          if (!current[parts[i]]) {
            current[parts[i]] = {};
          }
          current = current[parts[i]];
        }
        
        // Set the value
        current[parts[parts.length - 1]] = value;
      } else {
        // Direct key
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Get a single record
   * @param {string} workflowId - The workflow ID
   * @param {string} recordId - The record ID
   */
  async getRecord(workflowId, recordId) {
    try {
      const { data, error } = await this.supabase
        .from('workflow_records')
        .select('*')
        .eq('workflow_id', workflowId)
        .eq('record_id', recordId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new Error(`Failed to get record: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error(`[RecordManagement] Error getting record ${recordId}:`, error);
      throw error;
    }
  }

  /**
   * Get multiple records by IDs (for batch prefetching)
   * @param {string} workflowId - The workflow ID
   * @param {string[]} recordIds - Array of record IDs
   */
  async getRecordsByIds(workflowId, recordIds) {
    try {
      if (!recordIds || recordIds.length === 0) return [];

      const { data, error } = await this.supabase
        .from('workflow_records')
        .select('*')
        .eq('workflow_id', workflowId)
        .in('record_id', recordIds);

      if (error) throw new Error(`Failed to get records: ${error.message}`);

      return data || [];
    } catch (error) {
      console.error(`[RecordManagement] Error getting records by IDs:`, error);
      throw error;
    }
  }

  /**
   * Query records with pattern support
   * @param {string} workflowId - The workflow ID
   * @param {string} query - Query pattern (e.g., "email_*" or specific type)
   */
  async queryRecords(workflowId, query) {
    try {
      let supabaseQuery = this.supabase
        .from('workflow_records')
        .select('*')
        .eq('workflow_id', workflowId);

      // Parse query patterns
      if (query === '*') {
        // Return all records
      } else if (query.includes('_*')) {
        // Wildcard pattern: "email_*"
        const prefix = query.replace('_*', '_');
        supabaseQuery = supabaseQuery.like('record_id', `${prefix}%`);
      } else if (query.includes(',')) {
        // Multiple IDs: "email_001,email_002,email_003"
        const ids = query.split(',').map(id => id.trim());
        supabaseQuery = supabaseQuery.in('record_id', ids);
      } else {
        // Exact match
        supabaseQuery = supabaseQuery.eq('record_id', query);
      }

      const { data, error } = await supabaseQuery.order('created_at');
      if (error) throw new Error(`Failed to query records: ${error.message}`);

      return data || [];
    } catch (error) {
      console.error(`[RecordManagement] Error querying records:`, error);
      throw error;
    }
  }

  /**
   * Convert array to records with idempotent IDs
   * @param {string} workflowId - The workflow ID
   * @param {array} array - Array to convert
   * @param {string} recordType - Record type
   * @param {string} iterationNodeAlias - Node that's creating these records
   * @param {string} runId - Optional run ID for namespacing
   */
  async convertArrayToRecords(workflowId, array, recordType = 'temp', iterationNodeAlias = null, runId = null) {
    try {
      const records = [];
      const actualRunId = runId || new Date().getTime().toString();

      for (let i = 0; i < array.length; i++) {
        // Create namespaced ID for idempotency
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

      console.log(`[RecordManagement] Converted ${array.length} array items to records`);
      return records;
    } catch (error) {
      console.error('[RecordManagement] Error converting array to records:', error);
      throw error;
    }
  }

  /**
   * Delete a record
   * @param {string} workflowId - The workflow ID
   * @param {string} recordId - The record ID
   */
  async deleteRecord(workflowId, recordId) {
    try {
      const { error } = await this.supabase
        .from('workflow_records')
        .delete()
        .eq('workflow_id', workflowId)
        .eq('record_id', recordId);

      if (error) throw new Error(`Failed to delete record: ${error.message}`);

      console.log(`[RecordManagement] Deleted record ${recordId}`);
    } catch (error) {
      console.error(`[RecordManagement] Error deleting record ${recordId}:`, error);
      throw error;
    }
  }

  /**
   * Delete all records for a workflow
   * @param {string} workflowId - The workflow ID
   */
  async deleteAllRecords(workflowId) {
    try {
      const { data, error } = await this.supabase
        .from('workflow_records')
        .delete()
        .eq('workflow_id', workflowId)
        .select('record_id');

      if (error) throw new Error(`Failed to delete records: ${error.message}`);

      const deletedCount = data?.length || 0;
      console.log(`[RecordManagement] Deleted ${deletedCount} records for workflow ${workflowId}`);

      return { success: true, deletedCount, deletedIds: data?.map(r => r.record_id) || [] };
    } catch (error) {
      console.error('[RecordManagement] Error deleting all records:', error);
      throw error;
    }
  }
}