/**
 * Browser State Capture Service
 * 
 * Captures complete browser state for memory artifacts:
 * - DOM snapshots (full HTML for debugging)
 * - Current URL and navigation state  
 * - Browser session data
 * - Accessibility tree information
 * 
 * This service provides real data to replace placeholder methods
 * in ExecutionEngine for surgical debugging capabilities.
 */

import { hybridBrowserManager } from '../browser/HybridBrowserManager';

/**
 * Browser State Capture
 * 
 * Captures browser state for memory system including:
 * - DOM snapshots
 * - Current URL
 * - Active tab information
 * - Accessibility tree
 * - Session state
 * 
 * This provides the "what the AI saw" context for debugging
 */
export class BrowserStateCapture {
  /**
   * Get DOM snapshot of current page
   */
  static async getDOMSnapshot(executionId: string): Promise<string | undefined> {
    try {
      console.log(`📸 Capturing DOM snapshot for ${executionId}`);
      
      // Use 'extract' action to get DOM content via natural language
      const result = await hybridBrowserManager.executeAction(executionId, {
        type: 'extract',
        data: { 
          instruction: 'Extract the complete HTML content of the current page',
          schema: {
            html: 'string'
          }
        },
        stepId: 'memory-dom-capture'
      });
      
      const domSnapshot = result?.payload?.html || result?.html || result?.result?.html;
      
      if (domSnapshot && typeof domSnapshot === 'string') {
        console.log(`✅ DOM snapshot captured: ${domSnapshot.length} characters`);
        return domSnapshot;
      }
      
      console.warn('DOM snapshot result was not a string:', typeof domSnapshot);
      return undefined;
      
    } catch (error) {
      console.warn('Could not capture DOM snapshot:', error);
      return undefined;
    }
  }

  /**
   * Get current browser URL
   */
  static async getCurrentUrl(executionId: string): Promise<string | undefined> {
    try {
      console.log(`🌐 Getting current URL for ${executionId}`);
      
      // Get session to check if we can access browser state
      const session = hybridBrowserManager.getSessionByExecution(executionId);
      if (!session) {
        console.warn(`No session found for execution ${executionId}`);
        return undefined;
      }
      
      // Use extract action to get current URL
      const result = await hybridBrowserManager.executeAction(executionId, {
        type: 'extract',
        data: {
          instruction: 'Extract the current page URL',
          schema: {
            url: 'string'
          }
        },
        stepId: 'memory-url-capture'
      });
      
      const currentUrl = result?.payload?.url || result?.url || result?.result?.url;
      
      if (currentUrl && typeof currentUrl === 'string') {
        console.log(`✅ Current URL captured: ${currentUrl}`);
        return currentUrl;
      }
      
      return undefined;
      
    } catch (error) {
      console.warn('Could not get current URL:', error);
      return undefined;
    }
  }

  /**
   * Get active browser tab information
   */
  static async getActiveTab(executionId: string): Promise<string | undefined> {
    try {
      console.log(`🔖 Getting active tab for ${executionId}`);
      
      // Extract basic tab info using Stagehand
      const result = await hybridBrowserManager.executeAction(executionId, {
        type: 'extract',
        data: {
          instruction: 'Extract the page title and URL',
          schema: {
            title: 'string',
            url: 'string'
          }
        },
        stepId: 'memory-tab-capture'
      });
      
      const tabInfo = result?.payload || result?.result;
      
      if (tabInfo && tabInfo.title && tabInfo.url) {
        const tabData = JSON.stringify({
          title: tabInfo.title,
          url: tabInfo.url,
          timestamp: Date.now()
        });
        console.log(`✅ Active tab captured: ${tabData}`);
        return tabData;
      }
      
      // Fallback to simple identifier
      return `tab-${executionId}`;
      
    } catch (error) {
      console.warn('Could not get active tab:', error);
      return `tab-${executionId}-fallback`;
    }
  }

  /**
   * Capture accessibility tree for element selection debugging
   * This helps understand how the LLM "sees" the page elements
   */
  static async getAccessibilityTree(executionId: string): Promise<any> {
    try {
      console.log(`♿ Capturing accessibility tree for ${executionId}`);
      
      // Extract page structure using Stagehand
      const result = await hybridBrowserManager.executeAction(executionId, {
        type: 'extract',
        data: {
          instruction: 'Extract all interactive elements on the page including headings, buttons, links, and form inputs',
          schema: {
            title: 'string',
            headings: {
              type: 'array',
              items: {
                tag: 'string',
                text: 'string'
              }
            },
            buttons: {
              type: 'array', 
              items: {
                text: 'string',
                type: 'string'
              }
            },
            links: {
              type: 'array',
              items: {
                text: 'string',
                href: 'string'
              }
            },
            inputs: {
              type: 'array',
              items: {
                type: 'string',
                placeholder: { type: 'string', optional: true },
                name: { type: 'string', optional: true },
                id: { type: 'string', optional: true }
              }
            }
          }
        },
        stepId: 'memory-accessibility-capture'
      });
      
      const accessibilityData = result?.payload || result?.result;
      
      if (accessibilityData && typeof accessibilityData === 'object') {
        console.log(`✅ Accessibility tree captured: ${accessibilityData.headings?.length || 0} headings, ${accessibilityData.buttons?.length || 0} buttons, ${accessibilityData.links?.length || 0} links`);
        return {
          ...accessibilityData,
          timestamp: Date.now()
        };
      }
      
      return undefined;
      
    } catch (error) {
      console.warn('Could not capture accessibility tree:', error);
      return undefined;
    }
  }

  /**
   * Capture browser session state
   */
  static async getSessionState(executionId: string): Promise<Record<string, any>> {
    try {
      console.log(`🍪 Capturing session state for ${executionId}`);
      
      // Extract browser environment info using Stagehand
      const result = await hybridBrowserManager.executeAction(executionId, {
        type: 'extract',
        data: {
          instruction: 'Extract browser and page information including viewport size and basic environment details',
          schema: {
            user_agent: 'string',
            language: 'string',
            viewport: {
              width: 'number',
              height: 'number'
            }
          }
        },
        stepId: 'memory-session-capture'
      });
      
      const sessionData = result?.payload || result?.result;
      
      if (sessionData && typeof sessionData === 'object') {
        console.log(`✅ Session state captured: ${Object.keys(sessionData).length} properties`);
        return {
          ...sessionData,
          timestamp: Date.now()
        };
      }
      
      return {
        timestamp: Date.now(),
        executionId
      };
      
    } catch (error) {
      console.warn('Could not capture session state:', error);
      return {
        timestamp: Date.now(),
        executionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Take screenshot of current page
   */
  static async takeScreenshot(executionId: string): Promise<string | undefined> {
    try {
      console.log(`📷 Taking screenshot for ${executionId}`);
      
      // Get session to check if we can access browser
      const session = hybridBrowserManager.getSessionByExecution(executionId);
      if (!session) {
        console.warn(`No session found for execution ${executionId}`);
        return undefined;
      }
      
      // Use screenshot action
      const result = await hybridBrowserManager.executeAction(executionId, {
        type: 'screenshot',
        data: {},
        stepId: 'memory-screenshot-capture'
      });
      
      const screenshot = result?.screenshot || result?.payload?.screenshot;
      
      if (screenshot) {
        console.log(`✅ Screenshot captured`);
        return screenshot;
      }
      
      return undefined;
      
    } catch (error) {
      console.warn('Could not take screenshot:', error);
      return undefined;
    }
  }
} 