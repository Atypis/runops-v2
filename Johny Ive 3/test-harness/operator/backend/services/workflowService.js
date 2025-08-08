import { supabase } from '../config/supabase.js';

export class WorkflowService {
  async createWorkflow({ name, description }) {
    const { data, error } = await supabase
      .from('workflows')
      .insert({
        goal: name || 'New workflow',
        status: 'building'
      })
      .select()
      .single();
      
    if (error) throw error;
    return data;
  }

  async getWorkflow(id) {
    const { data, error } = await supabase
      .from('workflows')
      .select(`
        *,
        nodes (*)
      `)
      .eq('id', id)
      .single();
      
    // Sort nodes by position
    if (data?.nodes) {
      data.nodes.sort((a, b) => a.position - b.position);
    }
      
    if (error) throw error;
    return data;
  }

  async listWorkflows() {
    const { data, error } = await supabase
      .from('workflows')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    return data;
  }

  async updateWorkflow(id, updates) {
    const { data, error } = await supabase
      .from('workflows')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
      
    if (error) throw error;
    return data;
  }

  async deleteWorkflow(id) {
    const { error } = await supabase
      .from('workflows')
      .delete()
      .eq('id', id);
      
    if (error) throw error;
    return { success: true };
  }
}