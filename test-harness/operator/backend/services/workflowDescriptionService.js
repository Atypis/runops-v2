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
      success_criteria,
      decision_matrix,
      key_design_decisions,
      edge_case_policies,
      business_rules
    } = descriptionData;
    
    let summary = `WORKFLOW: ${workflow_name || 'Unnamed'}\n`;
    summary += `GOAL: ${goal || 'Not specified'}\n`;
    summary += `TRIGGER: ${trigger || 'Manual'}\n\n`;
    
    if (actors) {
      summary += `ACTORS:\n`;
      // Handle both string and array types
      if (Array.isArray(actors)) {
        actors.forEach(actor => summary += `• ${actor}\n`);
      } else if (typeof actors === 'string') {
        summary += `• ${actors}\n`;
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
    if (key_design_decisions && Object.keys(key_design_decisions).length > 0) {
      summary += `KEY DESIGN DECISIONS:\n`;
      Object.entries(key_design_decisions).forEach(([decision, details]) => {
        summary += `• ${decision}: ${details.decision || details}\n`;
        if (details.rationale) {
          summary += `  Rationale: ${details.rationale}\n`;
        }
      });
      summary += '\n';
    }
    
    // Include edge case count if present
    if (edge_case_policies && Object.keys(edge_case_policies).length > 0) {
      summary += `EDGE CASES: ${Object.keys(edge_case_policies).length} policies defined\n\n`;
    }
    
    if (success_criteria) {
      summary += `SUCCESS CRITERIA:\n`;
      // Handle both string and array types
      if (Array.isArray(success_criteria)) {
        success_criteria.forEach(criterion => summary += `✓ ${criterion}\n`);
      } else if (typeof success_criteria === 'string') {
        summary += `✓ ${success_criteria}\n`;
      }
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