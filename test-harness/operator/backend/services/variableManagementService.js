import { supabase } from '../config/supabase.js';

export class VariableManagementService {
  constructor() {
    this.supabase = supabase;
    this.maxChunkLength = 100;
    this.sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth', 'credential'];
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
      const { data, error } = await this.supabase
        .from('workflow_memory')
        .select('key, value, created_at, updated_at')
        .eq('workflow_id', workflowId)
        .order('key');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[VariableManagementService] Error getting all variables:', error);
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
      if (error) throw error;

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

      if (error) throw error;

      console.log(`[VariableManagementService] Set variable ${key}${reason ? ` (${reason})` : ''}`);
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
}