/**
 * DOM Toolkit Service - Integration layer for DOM exploration tools
 * Bridges the DOM toolkit with the existing workflow infrastructure
 */

import BrowserStateService from './browserStateService.js';
import domToolkit from '../dom-toolkit/index.js';
import { SearchFormatter } from '../dom-toolkit/formatters/searchFormatter.js';
import { InspectFormatter } from '../dom-toolkit/formatters/inspectFormatter.js';

export class DOMToolkitService {
  constructor() {
    this.browserStateService = new BrowserStateService();
    this.searchFormatter = new SearchFormatter();
    this.inspectFormatter = new InspectFormatter();
  }

  /**
   * Main entry point for dom_overview tool
   */
  async domOverview(options = {}, nodeExecutor) {
    try {
      const page = await this.getPageForTab(options.tabName || 'main', nodeExecutor);
      
      // Add workflow ID to page for caching
      if (nodeExecutor?.currentWorkflow?.id) {
        page._workflowId = nodeExecutor.currentWorkflow.id;
      }
      
      // Call toolkit implementation
      const result = await domToolkit.domOverview(page, options);
      
      // Format response for consistency
      if (result.success && options.format !== 'raw') {
        result.formatted = domToolkit.formatter.formatResponse(result);
      }
      
      return result;
    } catch (error) {
      console.error('[DOMToolkitService] Error in domOverview:', error);
      return {
        success: false,
        error: error.message,
        tabName: options.tabName || 'main'
      };
    }
  }

  /**
   * dom_structure implementation
   */
  async domStructure(options = {}, nodeExecutor) {
    try {
      const page = await this.getPageForTab(options.tabName || 'main', nodeExecutor);
      
      // Add workflow ID to page for caching
      if (nodeExecutor?.currentWorkflow?.id) {
        page._workflowId = nodeExecutor.currentWorkflow.id;
      }
      
      const result = await domToolkit.domStructure(page, options);
      
      if (result.success && options.format !== 'raw') {
        // Format structure tree
        const lines = ['=== DOM STRUCTURE ===', ''];
        lines.push(...domToolkit.formatter.formatStructureTree(result.structure));
        lines.push('', `Total nodes: ${result.summary.total_nodes}`);
        result.formatted = lines.join('\n');
      }
      
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        tabName: options.tabName || 'main'
      };
    }
  }

  /**
   * dom_search implementation
   */
  async domSearch(options = {}, nodeExecutor) {
    try {
      const page = await this.getPageForTab(options.tabName || 'main', nodeExecutor);
      
      // Add workflow ID to page for caching
      if (nodeExecutor?.currentWorkflow?.id) {
        page._workflowId = nodeExecutor.currentWorkflow.id;
      }
      
      const result = await domToolkit.domSearch(page, options);
      
      // Add formatted output
      if (result.success && options.format !== 'raw') {
        result.formatted = this.searchFormatter.formatSearchResults({
          ...result,
          query: options.query
        });
      }
      
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        tabName: options.tabName || 'main'
      };
    }
  }

  /**
   * dom_inspect implementation
   */
  async domInspect(options = {}, nodeExecutor) {
    try {
      const page = await this.getPageForTab(options.tabName || 'main', nodeExecutor);
      
      // Add workflow ID to page for caching
      if (nodeExecutor?.currentWorkflow?.id) {
        page._workflowId = nodeExecutor.currentWorkflow.id;
      }
      
      const result = await domToolkit.domInspect(page, options);
      
      // Add formatted output
      if (result.success && options.format !== 'raw') {
        result.formatted = this.inspectFormatter.formatInspectResults(result);
      }
      
      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        tabName: options.tabName || 'main'
      };
    }
  }

  /**
   * Get page for a specific tab
   * Follows the same pattern as tabInspectionService
   */
  async getPageForTab(tabName = 'main', nodeExecutor) {
    // Check if stagehand is initialized
    if (!nodeExecutor || !nodeExecutor.stagehandInstance) {
      throw new Error('Browser not initialized. Execute a browser action first to initialize the browser.');
    }
    
    // Handle main tab
    if (tabName === 'main' || tabName === 'Main Tab') {
      return nodeExecutor.mainPage || nodeExecutor.stagehandInstance.page;
    }
    
    // Handle other tabs from stagehandPages
    if (nodeExecutor.stagehandPages && nodeExecutor.stagehandPages[tabName]) {
      return nodeExecutor.stagehandPages[tabName];
    }
    
    // If tab not found, list available tabs
    const availableTabs = ['main'];
    if (nodeExecutor.stagehandPages) {
      availableTabs.push(...Object.keys(nodeExecutor.stagehandPages));
    }
    
    throw new Error(`Tab "${tabName}" not found. Available tabs: ${availableTabs.join(', ')}`);
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats() {
    return domToolkit.cache.getStats();
  }

  /**
   * Clear cache for a specific workflow/tab
   */
  clearCache(workflowId, tabName = null) {
    if (tabName) {
      domToolkit.cache.clear(`${workflowId}-${tabName}`);
    } else {
      // Clear all cache entries for this workflow
      const stats = domToolkit.cache.getStats();
      stats.keys.forEach(key => {
        if (key.startsWith(`${workflowId}-`)) {
          domToolkit.cache.clear(key);
        }
      });
    }
  }
}

// Export singleton
export default new DOMToolkitService();