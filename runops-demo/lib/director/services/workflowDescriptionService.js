import { supabase } from '../config/supabase.js';

export class WorkflowDescriptionService {
  /**
   * Create initial description for a workflow
   */
  async createDescription(workflowId, descriptionData) {
    const { data, error } = await supabase
      .from('workflow_descriptions')
      .insert({
        workflow_id: workflowId,
        description_version: 1,
        description_data: descriptionData
      })
      .select()
      .single();
      
    if (error) throw error;
    return data;
  }

  /**
   * Get the current (latest version) description for a workflow
   */
  async getCurrentDescription(workflowId) {
    if (!workflowId) return null;
    
    try {
      const { data, error } = await supabase
        .from('workflow_descriptions')
        .select('*')
        .eq('workflow_id', workflowId)
        .order('description_version', { ascending: false })
        .limit(1)
        .single();
        
      // Return null if no description exists (not an error)
      if (error && error.code === 'PGRST116') return null;
      if (error) throw error;
      
      return data;
    } catch (error) {
      // If table doesn't exist yet, return null gracefully
      if (error.code === '42P01') {
        console.log('Note: workflow_descriptions table does not exist yet. Run the migration first.');
        return null;
      }
      throw error;
    }
  }

  /**
   * Update description (creates new version, keeps history)
   */
  async updateDescription(workflowId, descriptionData, reason = 'Description updated') {
    try {
      // Get current version number
      const currentDescription = await this.getCurrentDescription(workflowId);
      const nextVersion = currentDescription ? currentDescription.description_version + 1 : 1;
      
      // Manage revision history
      const revisionHistory = descriptionData.revision_history || [];
      
      // Add new revision entry
      revisionHistory.push({
        version: nextVersion,
        date: new Date().toISOString(),
        author: 'director',
        changes: reason
      });
      
      // Enhanced description with metadata
      const enhancedDescriptionData = {
        ...descriptionData,
        revision_history: revisionHistory,
        _metadata: {
          update_reason: reason,
          updated_at: new Date().toISOString(),
          version: nextVersion
        }
      };
      
      const { data, error } = await supabase
        .from('workflow_descriptions')
        .insert({
          workflow_id: workflowId,
          description_version: nextVersion,
          description_data: enhancedDescriptionData
        })
        .select()
        .single();
        
      if (error) throw error;
      return data;
    } catch (error) {
      // If table doesn't exist yet, provide a helpful error
      if (error.code === '42P01') {
        throw new Error('workflow_descriptions table does not exist. Please run the migration first.');
      }
      throw error;
    }
  }

  /**
   * Get description history for debugging and audit trail
   */
  async getDescriptionHistory(workflowId) {
    const { data, error } = await supabase
      .from('workflow_descriptions')
      .select('*')
      .eq('workflow_id', workflowId)
      .order('description_version', { ascending: false });
      
    if (error) throw error;
    return data || [];
  }

  /**
   * Get specific description version
   */
  async getDescriptionVersion(workflowId, version) {
    const { data, error } = await supabase
      .from('workflow_descriptions')
      .select('*')
      .eq('workflow_id', workflowId)
      .eq('description_version', version)
      .single();
      
    if (error) throw error;
    return data;
  }

  /**
   * Get formatted summary for context injection
   */
  getDescriptionSummary(descriptionData) {
    if (!descriptionData) return 'No description available';
    
    const { 
      workflow_name, 
      goal, 
      trigger, 
      happy_path_steps, 
      actors,
      actors_access, // Director uses this variant
      success_criteria,
      success_definition, // Director uses this variant
      decision_matrix,
      key_design_decisions,
      design_decisions, // Also check for this variant
      edge_case_policies,
      edge_cases, // Director uses this variant
      business_rules,
      data_contracts,
      data_contract, // Director uses this variant
      security_privacy,
      ui_considerations,
      date_scope,
      external_resources
    } = descriptionData;
    
    let summary = `WORKFLOW: ${workflow_name || 'Unnamed'}\n`;
    summary += `GOAL: ${goal || 'Not specified'}\n`;
    summary += `TRIGGER: ${trigger || 'Manual'}\n\n`;
    
    // Handle actors with variants
    const actorsList = actors || actors_access;
    if (actorsList) {
      summary += `ACTORS:\n`;
      // Handle both string and array types
      if (Array.isArray(actorsList)) {
        actorsList.forEach(actor => summary += `• ${actor}\n`);
      } else if (typeof actorsList === 'string') {
        summary += `• ${actorsList}\n`;
      }
      summary += '\n';
    }
    
    if (happy_path_steps) {
      summary += `HAPPY PATH:\n`;
      // Handle both string and array types
      if (Array.isArray(happy_path_steps)) {
        happy_path_steps.forEach(step => summary += `${step}\n`);
      } else if (typeof happy_path_steps === 'string') {
        summary += `${happy_path_steps}\n`;
      }
      summary += '\n';
    }
    
    // Include key decision points if present
    if (decision_matrix && Object.keys(decision_matrix).length > 0) {
      summary += `DECISION MATRIX:\n`;
      Object.entries(decision_matrix).forEach(([category, decisions]) => {
        summary += `• ${category}: ${Object.keys(decisions).length} branches\n`;
      });
      summary += '\n';
    }
    
    // Include key design decisions if present
    // Handle both object and array formats for flexibility
    // Also handle both "key_design_decisions" and "design_decisions" field names
    const designDecisions = key_design_decisions || design_decisions;
    if (designDecisions) {
      if (Array.isArray(designDecisions) && designDecisions.length > 0) {
        // Array format: [{id: "A", topic: "...", decision: "...", rationale: "..."}, ...]
        summary += `KEY DESIGN DECISIONS:\n`;
        designDecisions.forEach(item => {
          const topic = item.topic || item.id || 'Decision';
          summary += `• ${topic}: ${item.decision}\n`;
          if (item.rationale) {
            summary += `  Rationale: ${item.rationale}\n`;
          }
        });
        summary += '\n';
      } else if (typeof designDecisions === 'object' && Object.keys(designDecisions).length > 0) {
        // Object format: {decision_name: {decision: "...", rationale: "..."}, ...}
        summary += `KEY DESIGN DECISIONS:\n`;
        Object.entries(designDecisions).forEach(([key, value]) => {
          // Skip malformed keys that look like they contain data
          if (key.includes("':[") || key.includes('"]')) {
            return;
          }
          
          if (typeof value === 'object' && value !== null) {
            // If value has question/options/recommended structure
            if (value.question && value.options && value.recommended) {
              summary += `• ${key}: ${value.question}\n`;
              summary += `  Options: ${value.options.join(', ')}\n`;
              summary += `  Recommended: ${value.recommended}\n`;
            } 
            // If value has decision/rationale structure
            else if (value.decision) {
              summary += `• ${key}: ${value.decision}\n`;
              if (value.rationale) {
                summary += `  Rationale: ${value.rationale}\n`;
              }
            }
            // Fallback to showing all properties
            else {
              summary += `• ${key}: ${JSON.stringify(value)}\n`;
            }
          } else {
            summary += `• ${key}: ${value}\n`;
          }
        });
        summary += '\n';
      }
    }
    
    // Include edge case count if present (handle both variants)
    const edgeCases = edge_case_policies || edge_cases;
    if (edgeCases && Object.keys(edgeCases).length > 0) {
      summary += `EDGE CASES: ${Object.keys(edgeCases).length} policies defined\n\n`;
    }
    
    // Handle success criteria with variants
    const successList = success_criteria || success_definition;
    if (successList) {
      summary += `SUCCESS CRITERIA:\n`;
      // Handle both string and array types
      if (Array.isArray(successList)) {
        successList.forEach(criterion => summary += `✓ ${criterion}\n`);
      } else if (typeof successList === 'string') {
        summary += `✓ ${successList}\n`;
      }
      summary += '\n';
    }
    
    // Handle data contracts with variants
    const contracts = data_contracts || data_contract;
    if (contracts && Object.keys(contracts).length > 0) {
      summary += `DATA CONTRACTS: ${Object.keys(contracts).length} defined\n\n`;
    }
    
    // Add business rules if present
    if (business_rules && business_rules.length > 0) {
      summary += `BUSINESS RULES: ${business_rules.length} rules defined\n\n`;
    }
    
    // Add additional fields if present
    if (security_privacy) {
      summary += `SECURITY/PRIVACY: Defined\n`;
    }
    
    if (ui_considerations) {
      summary += `UI CONSIDERATIONS: Defined\n`;
    }
    
    if (date_scope) {
      summary += `DATE SCOPE: ${date_scope}\n`;
    }
    
    return summary;
  }

  /**
   * Suggest missing high-fidelity elements
   */
  suggestMissingElements(descriptionData) {
    const suggestions = [];
    
    if (!descriptionData.workflow_name) {
      suggestions.push('Give your workflow a descriptive name');
    }
    
    if (!descriptionData.goal) {
      suggestions.push('Define the overall goal of this automation');
    }
    
    if (!descriptionData.actors || descriptionData.actors.length === 0) {
      suggestions.push('List all systems and accounts involved (actors)');
    }
    
    if (!descriptionData.happy_path_steps || descriptionData.happy_path_steps.length === 0) {
      suggestions.push('Document the happy path steps in detail');
    }
    
    if (!descriptionData.decision_matrix) {
      suggestions.push('Add decision matrix for any branching logic');
    }
    
    if (!descriptionData.data_contracts) {
      suggestions.push('Define data contracts for all integrations');
    }
    
    if (!descriptionData.edge_case_policies) {
      suggestions.push('Specify how to handle edge cases and errors');
    }
    
    if (!descriptionData.business_rules || descriptionData.business_rules.length === 0) {
      suggestions.push('Document business rules and constraints');
    }
    
    if (!descriptionData.success_criteria || descriptionData.success_criteria.length === 0) {
      suggestions.push('Define clear success criteria');
    }
    
    return suggestions;
  }

  /**
   * Check if a plan task traces to the workflow description
   */
  checkTaskTraceability(taskDescription, descriptionData) {
    if (!descriptionData || !taskDescription) return false;
    
    // Check if task relates to any happy path step
    const happyPathText = (descriptionData.happy_path_steps || []).join(' ').toLowerCase();
    const taskLower = taskDescription.toLowerCase();
    
    // Simple keyword matching for now
    const keywords = taskLower.split(' ').filter(word => word.length > 3);
    const matchesHappyPath = keywords.some(keyword => happyPathText.includes(keyword));
    
    // Check if task relates to edge cases
    const edgeCaseText = JSON.stringify(descriptionData.edge_case_policies || {}).toLowerCase();
    const matchesEdgeCase = keywords.some(keyword => edgeCaseText.includes(keyword));
    
    return matchesHappyPath || matchesEdgeCase;
  }
}