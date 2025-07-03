import { supabase } from '../config/supabase.js';

export class PlanService {
  /**
   * Create initial plan for a workflow
   */
  async createPlan(workflowId, planData) {
    // Validate plan structure
    this.validatePlanStructure(planData);
    
    const { data, error } = await supabase
      .from('director_plans')
      .insert({
        workflow_id: workflowId,
        plan_version: 1,
        plan_data: planData
      })
      .select()
      .single();
      
    if (error) throw error;
    return data;
  }

  /**
   * Get the current (latest version) plan for a workflow
   */
  async getCurrentPlan(workflowId) {
    if (!workflowId) return null;
    
    try {
      const { data, error } = await supabase
        .from('director_plans')
        .select('*')
        .eq('workflow_id', workflowId)
        .order('plan_version', { ascending: false })
        .limit(1)
        .single();
        
      // Return null if no plan exists (not an error)
      if (error && error.code === 'PGRST116') return null;
      if (error) throw error;
      
      return data;
    } catch (error) {
      // If table doesn't exist yet, return null gracefully
      if (error.code === '42P01') {
        console.log('Note: director_plans table does not exist yet. Run the migration first.');
        return null;
      }
      throw error;
    }
  }

  /**
   * Update plan (creates new version, keeps history)
   */
  async updatePlan(workflowId, planData, reason = 'Plan updated') {
    try {
      // Validate plan structure
      this.validatePlanStructure(planData);
      
      // Get current version number
      const currentPlan = await this.getCurrentPlan(workflowId);
      const nextVersion = currentPlan ? currentPlan.plan_version + 1 : 1;
      
      // Add metadata to plan data
      const enhancedPlanData = {
        ...planData,
        _metadata: {
          update_reason: reason,
          updated_at: new Date().toISOString(),
          version: nextVersion
        }
      };
      
      const { data, error } = await supabase
        .from('director_plans')
        .insert({
          workflow_id: workflowId,
          plan_version: nextVersion,
          plan_data: enhancedPlanData
        })
        .select()
        .single();
        
      if (error) throw error;
      return data;
    } catch (error) {
      // If table doesn't exist yet, provide a helpful error
      if (error.code === '42P01') {
        throw new Error('director_plans table does not exist. Please run the migration first: see manual-migration.sql');
      }
      throw error;
    }
  }

  /**
   * Get plan history for debugging and audit trail
   */
  async getPlanHistory(workflowId) {
    const { data, error } = await supabase
      .from('director_plans')
      .select('*')
      .eq('workflow_id', workflowId)
      .order('plan_version', { ascending: false });
      
    if (error) throw error;
    return data || [];
  }

  /**
   * Get specific plan version
   */
  async getPlanVersion(workflowId, version) {
    const { data, error } = await supabase
      .from('director_plans')
      .select('*')
      .eq('workflow_id', workflowId)
      .eq('plan_version', version)
      .single();
      
    if (error) throw error;
    return data;
  }

  /**
   * Validate plan structure matches Director 2.0 format
   */
  validatePlanStructure(planData) {
    if (!planData || typeof planData !== 'object') {
      throw new Error('Plan data must be an object');
    }

    const required = ['overall_goal', 'current_phase', 'phases'];
    for (const field of required) {
      if (!planData[field]) {
        throw new Error(`Plan is missing required field: ${field}`);
      }
    }

    if (!Array.isArray(planData.phases)) {
      throw new Error('Plan phases must be an array');
    }

    // Validate each phase
    for (const phase of planData.phases) {
      if (!phase.phase_name || !phase.status) {
        throw new Error('Each phase must have phase_name and status');
      }
      
      const validStatuses = ['pending', 'in_progress', 'completed', 'failed'];
      if (!validStatuses.includes(phase.status)) {
        throw new Error(`Invalid phase status: ${phase.status}. Must be one of: ${validStatuses.join(', ')}`);
      }

      if (phase.tasks && !Array.isArray(phase.tasks)) {
        throw new Error('Phase tasks must be an array');
      }

      // Validate each task
      if (phase.tasks) {
        for (const task of phase.tasks) {
          if (!task.task_id || !task.description || !task.status) {
            throw new Error('Each task must have task_id, description, and status');
          }
          
          if (!validStatuses.includes(task.status)) {
            throw new Error(`Invalid task status: ${task.status}. Must be one of: ${validStatuses.join(', ')}`);
          }
        }
      }
    }

    return true;
  }

  /**
   * Auto-update plan task status when nodes complete
   * This will be called by nodeExecutor when nodes finish successfully
   */
  async updateTaskStatusForNode(workflowId, nodeId, status = 'completed') {
    const currentPlan = await this.getCurrentPlan(workflowId);
    if (!currentPlan) return null;

    const planData = { ...currentPlan.plan_data };
    let taskUpdated = false;

    // Find tasks that reference this node and update their status
    for (const phase of planData.phases) {
      if (phase.tasks) {
        for (const task of phase.tasks) {
          if (task.node_ids && task.node_ids.includes(nodeId)) {
            task.status = status;
            taskUpdated = true;
            
            // If task completed, check if phase is complete
            if (status === 'completed') {
              const allTasksComplete = phase.tasks.every(t => t.status === 'completed');
              if (allTasksComplete && phase.status !== 'completed') {
                phase.status = 'completed';
              }
            }
          }
        }
      }
    }

    // Only update if we actually changed something
    if (taskUpdated) {
      return await this.updatePlan(
        workflowId, 
        planData, 
        `Auto-updated task status for node ${nodeId} to ${status}`
      );
    }

    return null;
  }

  /**
   * Get plan summary for context injection
   */
  getPlanSummary(planData) {
    if (!planData) return 'No plan available';

    const { overall_goal, current_phase, phases, next_actions, blockers, notes } = planData;
    
    let summary = `CURRENT PLAN:\n`;
    summary += `Goal: ${overall_goal}\n`;
    summary += `Current Phase: ${current_phase}\n\n`;
    
    summary += `PHASES:\n`;
    for (const phase of phases) {
      summary += `• ${phase.phase_name} (${phase.status})\n`;
      if (phase.tasks) {
        for (const task of phase.tasks) {
          const statusIcon = task.status === 'completed' ? '✓' : 
                           task.status === 'in_progress' ? '→' : 
                           task.status === 'failed' ? '✗' : '○';
          summary += `  ${statusIcon} ${task.description}\n`;
        }
      }
    }
    
    if (next_actions && next_actions.length > 0) {
      summary += `\nNEXT ACTIONS:\n`;
      for (const action of next_actions) {
        summary += `• ${action}\n`;
      }
    }
    
    if (blockers && blockers.length > 0) {
      summary += `\nBLOCKERS:\n`;
      for (const blocker of blockers) {
        summary += `• ${blocker}\n`;
      }
    }
    
    if (notes) {
      summary += `\nNOTES: ${notes}\n`;
    }
    
    return summary;
  }
}