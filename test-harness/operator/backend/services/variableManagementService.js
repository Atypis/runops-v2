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
}