/**
 * BrowserStateService - Real-time browser state management for Director 2.0
 * 
 * Provides real-time browser state visibility in Director's 6-part context.
 * Tracks tab information and active tab state for comprehensive debugging.
 */

import { supabase } from '../config/supabase.js';

class BrowserStateService {
  constructor(nodeExecutor = null) {
    // Store SSE connections for real-time updates
    // Format: { workflowId: [res1, res2, ...] }
    this.sseConnections = new Map();
    // Buffer recent variable updates for when connections re-establish
    // Format: { workflowId: [{ type, data, timestamp }, ...] }
    this.pendingUpdates = new Map();
    // Reference to NodeExecutor for live browser state inspection
    this.nodeExecutor = nodeExecutor;
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
   * NEW: Uses live snapshot approach - directly inspects browser instead of database cache
   * Convenience method for DirectorService
   */
  async getBrowserStateContext(workflowId) {
    try {
      console.log(`[BrowserStateService] getBrowserStateContext called for workflow: ${workflowId}`);
      
      // NEW: Try live browser inspection first (most accurate)
      if (this.nodeExecutor) {
        try {
          console.log(`[BrowserStateService] Attempting live browser state inspection...`);
          const liveTabs = await this.nodeExecutor.getCurrentTabsInfo();
          const liveActiveTab = this.nodeExecutor.activeTabName;
          
          const liveBrowserState = {
            tabs: liveTabs,
            active_tab_name: liveActiveTab
          };
          
          console.log(`[BrowserStateService] Live browser state:`, { 
            tabCount: liveTabs?.length, 
            activeTab: liveActiveTab 
          });
          
          const formattedContext = this.formatBrowserStateForContext(liveBrowserState);
          console.log(`[BrowserStateService] Live formatted context:`, formattedContext);
          
          return formattedContext;
        } catch (liveError) {
          console.warn(`[BrowserStateService] Live inspection failed, falling back to cached state:`, liveError.message);
        }
      } else {
        console.warn(`[BrowserStateService] NodeExecutor not available, using cached state`);
      }
      
      // Fallback to cached database state if live inspection fails
      const browserState = await this.getBrowserState(workflowId);
      console.log(`[BrowserStateService] Cached browser state:`, browserState ? { 
        tabCount: browserState.tabs?.length, 
        activeTab: browserState.active_tab_name 
      } : null);
      
      const formattedContext = this.formatBrowserStateForContext(browserState);
      console.log(`[BrowserStateService] Cached formatted context:`, formattedContext);
      
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
    const timestamp = new Date().toISOString();
    const connectionId = `${workflowId}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    // Add a unique identifier to the response object for tracking
    res._connectionId = connectionId;
    res._connectedAt = timestamp;
    
    if (!this.sseConnections.has(workflowId)) {
      this.sseConnections.set(workflowId, []);
    }
    
    const connections = this.sseConnections.get(workflowId);
    connections.push(res);
    
    console.log(`[SSE] Connection added for workflow ${workflowId}. Total connections: ${connections.length}`);
    
    // Send any buffered updates to the new connection
    this.sendPendingUpdates(workflowId, res);
  }

  /**
   * Send any buffered updates to a newly connected client
   */
  sendPendingUpdates(workflowId, res) {
    const pendingUpdates = this.pendingUpdates.get(workflowId);
    if (!pendingUpdates || pendingUpdates.length === 0) {
      return;
    }

    console.log(`[SSE] Sending ${pendingUpdates.length} buffered updates to new connection`);
    
    pendingUpdates.forEach((update) => {
      try {
        const { bufferedAt, ...updateData } = update; // Remove bufferedAt before sending
        const data = JSON.stringify(updateData);
        res.write(`data: ${data}\n\n`);
      } catch (error) {
        console.error(`[SSE] Error sending buffered update:`, error.message);
      }
    });
    
    // Clear the pending updates after sending
    this.pendingUpdates.delete(workflowId);
  }

  removeSSEConnection(workflowId, res, reason = 'unknown') {
    const timestamp = new Date().toISOString();
    const connectionId = res._connectionId || 'unknown';
    const connectedAt = res._connectedAt || 'unknown';
    const connectionDuration = res._connectedAt ? 
      ((new Date() - new Date(res._connectedAt)) / 1000).toFixed(2) + 's' : 'unknown';
    
    console.log(`[SSE] Connection removed for workflow ${workflowId}. Reason: ${reason}, Duration: ${connectionDuration}`);
    
    if (this.sseConnections.has(workflowId)) {
      const connections = this.sseConnections.get(workflowId);
      const index = connections.indexOf(res);
      if (index !== -1) {
        connections.splice(index, 1);
        console.log(`[SSE] Successfully removed connection. Remaining: ${connections.length}`);
        
        // Clean up empty arrays
        if (connections.length === 0) {
          this.sseConnections.delete(workflowId);
          console.log(`[SSE] No more connections for workflow ${workflowId}, cleaning up`);
        }
      } else {
        console.log(`[SSE] WARNING: Connection not found in array!`);
      }
    } else {
      console.log(`[SSE] WARNING: No connections found for workflow ${workflowId}`);
    }
    
    console.log(`[SSE] All workflows with connections: ${Array.from(this.sseConnections.keys()).join(', ')}`);
    console.log(`[SSE] ==========================================================`);
  }

  async emitBrowserStateUpdate(workflowId) {
    console.log(`[SSE] Attempting to emit browser state update for workflow ${workflowId}`);
    console.log(`[SSE] Current connections map:`, Array.from(this.sseConnections.entries()).map(([wf, conns]) => 
      `${wf}: ${conns.length} connections`
    ));
    
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
        type: 'browserStateUpdate',
        formattedDisplay: browserStateContext,
        rawState: rawBrowserState,
        timestamp: new Date().toISOString()
      });

      console.log(`[SSE] Emitting browser state update to ${connections.length} connections for workflow ${workflowId}`);

      // Send to all connected clients
      const deadConnections = [];
      connections.forEach((res, index) => {
        try {
          const connectionId = res._connectionId || 'unknown';
          console.log(`[SSE] Sending browser state update to connection ${connectionId} (index ${index})`);
          res.write(`data: ${data}\n\n`);
          console.log(`[SSE] Successfully sent browser state update to connection ${connectionId}`);
        } catch (error) {
          console.error(`[SSE] ERROR: Failed to send to connection ${index}:`, error.message);
          console.error(`[SSE] Connection appears to be dead, marking for removal`);
          deadConnections.push(index);
        }
      });
      
      // Remove dead connections
      if (deadConnections.length > 0) {
        console.log(`[SSE] Removing ${deadConnections.length} dead connections`);
        deadConnections.reverse().forEach(index => {
          const res = connections[index];
          this.removeSSEConnection(workflowId, res, 'write_failed');
        });
      }

    } catch (error) {
      console.error(`[SSE] Error emitting browser state update:`, error);
    }
  }

  /**
   * Emit variable storage update to connected clients
   * Called when a node stores a variable
   */
  async emitVariableUpdate(workflowId, variableKey, value, nodeAlias) {
    const updateData = {
      type: 'variableUpdate',
      variableKey,
      nodeAlias,
      value,
      timestamp: new Date().toISOString()
    };
    
    console.log(`[SSE] ==================== VARIABLE UPDATE ====================`);
    console.log(`[SSE] Workflow ID: ${workflowId}`);
    console.log(`[SSE] Variable Key: ${variableKey}`);
    console.log(`[SSE] Node Alias: ${nodeAlias}`);
    console.log(`[SSE] Value type: ${typeof value}`);
    console.log(`[SSE] Current connections map:`, Array.from(this.sseConnections.entries()).map(([wf, conns]) => 
      `${wf}: ${conns.length} connections`
    ));

    const connections = this.sseConnections.get(workflowId);
    if (!connections || connections.length === 0) {
      console.log(`[SSE] WARNING: No connections found for workflow ${workflowId}`);
      console.log(`[SSE] Buffering variable update for later delivery`);
      console.log(`[SSE] All workflows with connections: ${Array.from(this.sseConnections.keys()).join(', ')}`);
      
      // Buffer the update for when connections re-establish
      if (!this.pendingUpdates.has(workflowId)) {
        this.pendingUpdates.set(workflowId, []);
      }
      this.pendingUpdates.get(workflowId).push({
        ...updateData,
        bufferedAt: Date.now()
      });
      
      // Keep only recent updates (last 5 minutes)
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      const before = this.pendingUpdates.get(workflowId).length;
      this.pendingUpdates.set(workflowId, 
        this.pendingUpdates.get(workflowId).filter(update => update.bufferedAt > fiveMinutesAgo)
      );
      const after = this.pendingUpdates.get(workflowId).length;
      
      console.log(`[SSE] Buffered updates: ${after} (cleaned ${before - after} old updates)`);
      console.log(`[SSE] ========================================================`);
      return;
    }

    const data = JSON.stringify(updateData);
    console.log(`[SSE] Emitting variable update for ${variableKey} to ${connections.length} connections`);

    const deadConnections = [];
    connections.forEach((res, index) => {
      try {
        const connectionId = res._connectionId || 'unknown';
        console.log(`[SSE] Sending variable update to connection ${connectionId} (index ${index})`);
        res.write(`data: ${data}\n\n`);
        console.log(`[SSE] Successfully sent variable update to connection ${connectionId}`);
      } catch (error) {
        console.error(`[SSE] ERROR: Failed to send variable update to connection ${index}:`, error.message);
        console.error(`[SSE] Connection appears to be dead, marking for removal`);
        deadConnections.push({ index, res });
      }
    });

    // Remove dead connections
    if (deadConnections.length > 0) {
      console.log(`[SSE] Removing ${deadConnections.length} dead connections`);
      deadConnections.forEach(({ res }) => {
        this.removeSSEConnection(workflowId, res, 'write_failed_during_variable_update');
      });
    }
    
    console.log(`[SSE] Variable update complete. Active connections: ${this.sseConnections.get(workflowId)?.length || 0}`);
    console.log(`[SSE] ========================================================`);
  }
}

export default BrowserStateService;