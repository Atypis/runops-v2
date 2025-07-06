/**
 * BrowserStateService - Real-time browser state management for Director 2.0
 * 
 * Provides real-time browser state visibility in Director's 6-part context.
 * Tracks tab information and active tab state for comprehensive debugging.
 */

import { supabase } from '../config/supabase.js';

class BrowserStateService {
  constructor() {
    // Store SSE connections for real-time updates
    // Format: { workflowId: [res1, res2, ...] }
    this.sseConnections = new Map();
  }

  /**
   * Update browser state for a workflow
   * Called by NodeExecutor when browser state changes
   */
  async updateBrowserState(workflowId, { tabs = [], activeTabName = null }) {
    try {
      console.log(`[BrowserStateService] Updating browser state for workflow ${workflowId}:`, {
        tabCount: tabs.length,
        activeTab: activeTabName,
        tabs: tabs.map(tab => ({ name: tab.name, url: tab.url }))
      });

      const { data, error } = await supabase
        .from('browser_state')
        .upsert({
          workflow_id: workflowId,
          tabs: tabs,
          active_tab_name: activeTabName,
          updated_at: new Date().toISOString()
        })
        .select();

      if (error) {
        console.error('[BrowserStateService] Error updating browser state:', error);
        throw error;
      }

      console.log(`[BrowserStateService] Browser state updated successfully for workflow ${workflowId}`);
      
      // Emit real-time update to SSE connections
      await this.emitBrowserStateUpdate(workflowId);
      
      return data[0];
    } catch (error) {
      console.error(`[BrowserStateService] Failed to update browser state for workflow ${workflowId}:`, error);
      throw error;
    }
  }

  /**
   * Get current browser state for a workflow
   * Used by DirectorService for 6-part context building
   */
  async getBrowserState(workflowId) {
    try {
      console.log(`[BrowserStateService] Fetching browser state for workflow: ${workflowId}`);
      
      const { data, error } = await supabase
        .from('browser_state')
        .select('*')
        .eq('workflow_id', workflowId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        console.error(`[BrowserStateService] Error fetching browser state for workflow ${workflowId}:`, error);
        throw error;
      }

      if (data) {
        console.log(`[BrowserStateService] Found browser state for workflow ${workflowId}:`, {
          tabCount: data.tabs?.length || 0,
          activeTab: data.active_tab_name,
          tabs: data.tabs?.map(tab => ({ name: tab.name, url: tab.url?.substring(0, 50) + '...' })) || []
        });
      } else {
        console.log(`[BrowserStateService] No browser state found for workflow ${workflowId}`);
      }

      // Return null if no browser state found (workflow hasn't started browser yet)
      return data || null;
    } catch (error) {
      console.error(`[BrowserStateService] Failed to get browser state for workflow ${workflowId}:`, error);
      return null; // Graceful fallback
    }
  }

  /**
   * Format browser state for Director context display
   * Converts raw browser state data into human-readable context
   */
  formatBrowserStateForContext(browserState) {
    if (!browserState || !browserState.tabs || browserState.tabs.length === 0) {
      return 'BROWSER STATE:\nNo browser session active';
    }

    const { tabs, active_tab_name } = browserState;
    const tabCount = tabs.length;
    
    let formattedState = `BROWSER STATE:\n${tabCount} tab${tabCount === 1 ? '' : 's'} open:\n`;
    
    for (const tab of tabs) {
      const isActive = tab.name === active_tab_name;
      const activeIndicator = isActive ? ' (Active)' : '';
      const url = tab.url || 'about:blank';
      
      formattedState += `- ${tab.name}${activeIndicator} = ${url}\n`;
    }

    return formattedState.trim();
  }

  /**
   * Clear browser state for a workflow
   * Called when workflow is reset or browser session ends
   */
  async clearBrowserState(workflowId) {
    try {
      console.log(`[BrowserStateService] Clearing browser state for workflow ${workflowId}`);

      const { error } = await supabase
        .from('browser_state')
        .delete()
        .eq('workflow_id', workflowId);

      if (error) {
        console.error(`[BrowserStateService] Error clearing browser state for workflow ${workflowId}:`, error);
        throw error;
      }

      console.log(`[BrowserStateService] Browser state cleared successfully for workflow ${workflowId}`);
    } catch (error) {
      console.error(`[BrowserStateService] Failed to clear browser state for workflow ${workflowId}:`, error);
      throw error;
    }
  }

  /**
   * Get browser state with formatted context in one call
   * Convenience method for DirectorService
   */
  async getBrowserStateContext(workflowId) {
    try {
      console.log(`[BrowserStateService] getBrowserStateContext called for workflow: ${workflowId}`);
      const browserState = await this.getBrowserState(workflowId);
      console.log(`[BrowserStateService] Raw browser state:`, browserState ? { 
        tabCount: browserState.tabs?.length, 
        activeTab: browserState.active_tab_name 
      } : null);
      
      const formattedContext = this.formatBrowserStateForContext(browserState);
      console.log(`[BrowserStateService] Formatted context:`, formattedContext);
      
      return formattedContext;
    } catch (error) {
      console.error(`[BrowserStateService] Failed to get browser state context for workflow ${workflowId}:`, error);
      return 'BROWSER STATE:\nError retrieving browser state';
    }
  }

  /**
   * Update tab information (called when tabs are opened/closed/switched)
   */
  async updateTabs(workflowId, tabs, activeTabName = null) {
    return this.updateBrowserState(workflowId, { tabs, activeTabName });
  }

  /**
   * Update active tab (called when switching between tabs)
   */
  async updateActiveTab(workflowId, activeTabName) {
    try {
      // Get current state first to preserve tabs
      const currentState = await this.getBrowserState(workflowId);
      if (!currentState) {
        console.warn(`[BrowserStateService] Cannot update active tab - no browser state exists for workflow ${workflowId}`);
        return null;
      }

      return this.updateBrowserState(workflowId, {
        tabs: currentState.tabs,
        activeTabName
      });
    } catch (error) {
      console.error(`[BrowserStateService] Failed to update active tab for workflow ${workflowId}:`, error);
      throw error;
    }
  }

  /**
   * Add a new tab to browser state
   */
  async addTab(workflowId, tabName, tabUrl = 'about:blank', makeActive = true) {
    try {
      const currentState = await this.getBrowserState(workflowId);
      const currentTabs = currentState?.tabs || [];
      
      // Check if tab already exists
      const existingTab = currentTabs.find(tab => tab.name === tabName);
      if (existingTab) {
        console.log(`[BrowserStateService] Tab ${tabName} already exists, updating URL`);
        existingTab.url = tabUrl;
      } else {
        currentTabs.push({ name: tabName, url: tabUrl });
      }

      const activeTabName = makeActive ? tabName : (currentState?.active_tab_name || null);

      return this.updateBrowserState(workflowId, {
        tabs: currentTabs,
        activeTabName
      });
    } catch (error) {
      console.error(`[BrowserStateService] Failed to add tab for workflow ${workflowId}:`, error);
      throw error;
    }
  }

  /**
   * Remove a tab from browser state
   */
  async removeTab(workflowId, tabName) {
    try {
      const currentState = await this.getBrowserState(workflowId);
      if (!currentState) {
        console.warn(`[BrowserStateService] Cannot remove tab - no browser state exists for workflow ${workflowId}`);
        return null;
      }

      const updatedTabs = currentState.tabs.filter(tab => tab.name !== tabName);
      let activeTabName = currentState.active_tab_name;

      // If we removed the active tab, switch to first remaining tab
      if (activeTabName === tabName) {
        activeTabName = updatedTabs.length > 0 ? updatedTabs[0].name : null;
      }

      return this.updateBrowserState(workflowId, {
        tabs: updatedTabs,
        activeTabName
      });
    } catch (error) {
      console.error(`[BrowserStateService] Failed to remove tab for workflow ${workflowId}:`, error);
      throw error;
    }
  }

  /**
   * SSE Connection Management
   */
  addSSEConnection(workflowId, res) {
    if (!this.sseConnections.has(workflowId)) {
      this.sseConnections.set(workflowId, []);
    }
    this.sseConnections.get(workflowId).push(res);
    console.log(`[SSE] Added connection for workflow ${workflowId}. Total connections: ${this.sseConnections.get(workflowId).length}`);
  }

  removeSSEConnection(workflowId, res) {
    if (this.sseConnections.has(workflowId)) {
      const connections = this.sseConnections.get(workflowId);
      const index = connections.indexOf(res);
      if (index !== -1) {
        connections.splice(index, 1);
        console.log(`[SSE] Removed connection for workflow ${workflowId}. Remaining connections: ${connections.length}`);
        
        // Clean up empty arrays
        if (connections.length === 0) {
          this.sseConnections.delete(workflowId);
        }
      }
    }
  }

  async emitBrowserStateUpdate(workflowId) {
    const connections = this.sseConnections.get(workflowId);
    if (!connections || connections.length === 0) {
      console.log(`[SSE] No connections to emit browser state update for workflow ${workflowId}`);
      return;
    }

    try {
      // Get fresh browser state
      const browserStateContext = await this.getBrowserStateContext(workflowId);
      const rawBrowserState = await this.getBrowserState(workflowId);
      
      const data = JSON.stringify({
        formattedDisplay: browserStateContext,
        rawState: rawBrowserState,
        timestamp: new Date().toISOString()
      });

      console.log(`[SSE] Emitting browser state update to ${connections.length} connections for workflow ${workflowId}`);

      // Send to all connected clients
      connections.forEach((res, index) => {
        try {
          res.write(`data: ${data}\n\n`);
        } catch (error) {
          console.error(`[SSE] Error sending to connection ${index}:`, error.message);
          // Remove dead connection
          connections.splice(index, 1);
        }
      });

    } catch (error) {
      console.error(`[SSE] Error emitting browser state update:`, error);
    }
  }
}

export default BrowserStateService;