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
   * Primary tool: Take screenshot for visual reconnaissance
   * Essential for 90%+ of automation tasks - use this first
   */
  async getScreenshot(options = {}, nodeExecutor) {
    try {
      const page = await this.getPageForTab(options.tabName || 'main', nodeExecutor);
      
      // Take screenshot with proper path handling
      const timestamp = Date.now();
      const filename = `screenshot_${timestamp}.png`;
      const screenshotPath = `/tmp/${filename}`;
      
      await page.screenshot({ 
        path: screenshotPath,
        fullPage: options.fullPage || false,
        type: 'png'
      });
      
      return {
        success: true,
        screenshotPath: screenshotPath,
        filename: filename,
        timestamp: timestamp,
        fullPage: options.fullPage || false,
        message: `Screenshot saved: ${screenshotPath}`
      };
      
    } catch (error) {
      console.error('[DOMToolkitService] Screenshot error:', error);
      return {
        success: false,
        error: error.message,
        message: 'Failed to take screenshot'
      };
    }
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
      
      // Apply smart defaults for diffs to prevent token explosion
      if (options.diff_from) {
        options.max_rows = Math.min(options.max_rows || 10, 15); // Max 15 changes per type for diffs
        // Force filtering for diffs
        if (!options.filters) {
          options.filters = { interactives: true }; // Only show interactive changes by default
        }
      }
      
      // Call toolkit implementation
      const result = await domToolkit.domOverview(page, options);
      
      // ALWAYS return only formatted string to prevent token explosion
      if (result.success) {
        const formatted = domToolkit.formatter.formatResponse(result);
        return {
          success: true,
          output: formatted,
          snapshotId: result.snapshotId
        };
      }
      
      return {
        success: false,
        error: result.error || 'Unknown error',
        tabName: options.tabName || 'main'
      };
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
      
      if (result.success) {
        // Format structure tree
        const lines = ['=== DOM STRUCTURE ===', ''];
        lines.push(...domToolkit.formatter.formatStructureTree(result.structure));
        lines.push('', `Total nodes: ${result.summary.total_nodes}`);
        
        return {
          success: true,
          output: lines.join('\n')
        };
      }
      
      return {
        success: false,
        error: result.error || 'Failed to get DOM structure',
        tabName: options.tabName || 'main'
      };
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
      
      if (result.success) {
        const formatted = this.searchFormatter.formatSearchResults({
          ...result,
          query: options.query,
          visibilityStats: result.summary.visibilityStats,
          patterns: result.summary.patterns
        });
        
        return {
          success: true,
          output: formatted
        };
      }
      
      return {
        success: false,
        error: result.error || 'Search failed',
        tabName: options.tabName || 'main'
      };
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
      
      if (result.success) {
        const formatted = this.inspectFormatter.formatInspectResults(result);
        
        return {
          success: true,
          output: formatted
        };
      }
      
      return {
        success: false,
        error: result.error || 'Inspect failed',
        tabName: options.tabName || 'main'
      };
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
   * dom_actionable implementation - REMOVED FROM TOOL LIST 
   * Keeping implementation for potential reintroduction
   */
  /*
  async domActionable(options = {}, nodeExecutor) {
    try {
      const page = await this.getPageForTab(options.tabName || 'main', nodeExecutor);
      
      // Add workflow ID to page for caching
      if (nodeExecutor?.currentWorkflow?.id) {
        page._workflowId = nodeExecutor.currentWorkflow.id;
      }
      
      const result = await domToolkit.domActionable(page, options);
      
      if (result.success) {      
        // Format the actionable elements response
        const lines = ['=== ACTIONABLE ELEMENTS ===', ''];
        
        if (result.elements.length === 0) {
          lines.push('No actionable elements found.');
        } else {
          result.elements.forEach(element => {
            const text = element.text ? ` "${element.text}"` : '';
            const newMarker = element.isNew ? '*' : ''; // Browser-Use parity
            const bounds = element.bounds ? ` [${element.bounds.join(',')}]` : '';
            lines.push(`${newMarker}${element.id} ${element.tag}[${element.type}]${text}${bounds}`);
          });
        }
        
        lines.push('');
        lines.push(`[SUMMARY] Found: ${result.total} | Shown: ${result.elements.length} | Truncated: ${result.truncated}`);
        
        if (result.screenshot_url) {
          lines.push('');
          lines.push(`📸 Screenshot with numbered highlights: ${result.screenshot_url}`);
          lines.push('💡 MCP users: Use Read tool with the file path above to view the image');
        }

        return {
          success: true,
          output: lines.join('\n'),
          snapshotId: result.snapshotId,
          screenshot_url: result.screenshot_url,
          elementCount: result.total
        };
      }
      
      return {
        success: false,
        error: result.error || 'Failed to get actionable elements',
        tabName: options.tabName || 'main'
      };
    } catch (error) {
      console.error('[DOMToolkitService] Error in domActionable:', error);
      return {
        success: false,
        error: error.message,
        tabName: options.tabName || 'main'
      };
    }
  }

  /**
   * dom_actionable_ax - AX Tree + Simple Rules approach (NEW)
   */
  async domActionableAX(options = {}, nodeExecutor) {
    try {
      const page = await this.getPageForTab(options.tabName || 'main', nodeExecutor);
      
      // Add workflow ID to page for caching
      if (nodeExecutor?.currentWorkflow?.id) {
        page._workflowId = nodeExecutor.currentWorkflow.id;
      }
      
      const result = await domToolkit.domActionableAX(page, options);
      
      if (result.success) {
        return {
          success: true,
          output: result.output,
          snapshotId: result.snapshotId,
          screenshot_url: result.screenshot_url,
          elementCount: result.elementCount
        };
      }
      
      return {
        success: false,
        error: result.error || 'Failed to get AX actionable elements',
        suggestion: result.suggestion,
        tabName: options.tabName || 'main'
      };
    } catch (error) {
      console.error('[DOMToolkitService] Error in domActionableAX:', error);
      return {
        success: false,
        error: error.message,
        tabName: options.tabName || 'main'
      };
    }
  }
  */

  /**
   * dom_check_portals implementation
   */
  async domCheckPortals(options = {}, nodeExecutor) {
    try {
      const page = await this.getPageForTab(options.tabName || 'main', nodeExecutor);
      
      // Add workflow ID to page for caching
      if (nodeExecutor?.currentWorkflow?.id) {
        page._workflowId = nodeExecutor.currentWorkflow.id;
      }
      
      const result = await domToolkit.domCheckPortals(page, options);
      
      if (result.success) {
        // Format the response
        const lines = ['=== PORTAL CHECK RESULTS ===', ''];
        
        if (result.newPortals.length === 0) {
          lines.push('No new portal/overlay elements detected.');
        } else {
          lines.push(`Found ${result.newPortals.length} new portal element(s):`);
          lines.push('');
          
          result.newPortals.forEach((portal, index) => {
            lines.push(`${index + 1}. ${portal.type} ${portal.id}`);
            if (portal.class) lines.push(`   Class: ${portal.class}`);
            if (portal.role) lines.push(`   Role: ${portal.role}`);
            if (portal.visible) lines.push(`   Visibility: ${portal.visible ? 'visible' : 'hidden'}`);
            if (portal.selector_hints) {
              lines.push(`   Selector: ${portal.selector_hints}`);
            }
            if (portal.contentPreview) {
              lines.push('   Content preview:');
              portal.contentPreview.forEach(item => {
                lines.push(`     - <${item.tag}>${item.text ? ` "${item.text}"` : ''}`);
              });
            }
            lines.push('');
          });
        }
        
        if (result.baseline) {
          lines.push(`Compared against snapshot: ${result.baseline}`);
        }
        
        return {
          success: true,
          output: lines.join('\n'),
          portalCount: result.newPortals.length
        };
      }
      
      return {
        success: false,
        error: result.error || 'Failed to check for portals',
        tabName: options.tabName || 'main'
      };
    } catch (error) {
      console.error('[DOMToolkitService] Error in domCheckPortals:', error);
      return {
        success: false,
        error: error.message,
        tabName: options.tabName || 'main'
      };
    }
  }

  /**
   * Get ActionableFilter code as string for browser injection
   */
  getActionableFilterCode() {
    // Read the ActionableFilter class and inject it
    return `
      class ActionableFilter {
        constructor() {
          this.interactiveTags = new Set([
            'a', 'button', 'input', 'select', 'textarea', 'label', 
            'details', 'summary', 'option', 'menuitem'
          ]);
          
          this.interactiveRoles = new Set([
            'button', 'link', 'menuitem', 'menuitemradio', 'menuitemcheckbox',
            'radio', 'checkbox', 'tab', 'switch', 'slider', 'spinbutton',
            'combobox', 'searchbox', 'textbox', 'listbox', 'option', 'scrollbar'
          ]);
          
          this.ariaStateAttrs = ['aria-expanded', 'aria-pressed', 'aria-selected', 'aria-checked'];
          this.frameworkAttrs = ['ng-click', '@click', 'v-on:click', 'onclick'];
          
          this.clickableClasses = [
            'clickable', 'selectable', 'interactive', 'actionable',
            'rowSelectionEnabled', 'rowExpansionEnabled', 'cellClickable', 'hoverable',
            'data-row', 'table-row', 'list-item', 'card', 'dataRow'
          ];
          
          this.clickableTestIds = [
            'data-row', 'data-cell', 'clickable', 'selectable',
            'list-item', 'card', 'tile', 'row'
          ];
        }
        
        isActionableElementLive(element) {
          const tagName = element.tagName.toLowerCase();
          
          if (this.interactiveTags.has(tagName)) {
            if (this.isElementDisabledLive(element)) return false;
            return true;
          }
          
          const role = element.getAttribute('role');
          if (role && this.interactiveRoles.has(role)) return true;
          
          if (element.tabIndex >= 0) return true;
          
          if (element.isContentEditable || element.getAttribute('contenteditable') === 'true') {
            return true;
          }
          
          if (this.hasClickHandlersLive(element)) return true;
          
          if (this.ariaStateAttrs.some(attr => element.hasAttribute(attr))) return true;
          
          if (element.draggable) return true;
          
          const className = element.className || '';
          if (this.clickableClasses.some(cls => className.includes(cls))) {
            return true;
          }
          
          if (this.hasClickableParent(element)) {
            return true;
          }
          
          const testId = element.getAttribute('data-testid') || '';
          if (this.clickableTestIds.some(pattern => testId.includes(pattern))) {
            return true;
          }
          
          const style = window.getComputedStyle(element);
          if (style.cursor === 'pointer') return true;
          
          if (style.pointerEvents === 'none') return false;
          
          return false;
        }
        
        hasClickableParent(element, maxDepth = 5) {
          let current = element.parentElement;
          let depth = 0;
          
          while (current && depth < maxDepth) {
            const className = current.className || '';
            
            if (this.clickableClasses.some(cls => className.includes(cls))) {
              return true;
            }
            
            if (className.includes('rowSelectionEnabled') || 
                className.includes('rowExpansionEnabled') ||
                className.includes('dataRow')) {
              return true;
            }
            
            const testId = current.getAttribute('data-testid') || '';
            if (this.clickableTestIds.some(pattern => testId.includes(pattern))) {
              return true;
            }
            
            current = current.parentElement;
            depth++;
          }
          
          return false;
        }
        
        isElementDisabledLive(element) {
          if (element.disabled) return true;
          if (element.getAttribute('disabled') !== null) return true;
          if (element.getAttribute('aria-disabled') === 'true') return true;
          if (element.readOnly) return true;
          if (element.inert) return true;
          
          const style = window.getComputedStyle(element);
          if (style.cursor === 'not-allowed' || style.cursor === 'disabled') return true;
          
          return false;
        }
        
        hasClickHandlersLive(element) {
          if (element.onclick || element.getAttribute('onclick')) return true;
          
          if (this.frameworkAttrs.some(attr => element.hasAttribute(attr))) return true;
          
          try {
            if (typeof getEventListeners === 'function') {
              const listeners = getEventListeners(element);
              const mouseEvents = ['click', 'mousedown', 'mouseup', 'touchstart', 'touchend'];
              return mouseEvents.some(event => listeners[event] && listeners[event].length > 0);
            }
          } catch (e) {
            const eventProps = ['onclick', 'onmousedown', 'onmouseup'];
            return eventProps.some(prop => typeof element[prop] === 'function');
          }
          
          return false;
        }
      }
    `;
  }

  /**
   * Visual click inspection - get detailed element info at coordinates
   */
  async domClickInspect(options = {}, nodeExecutor) {
    try {
      const page = await this.getPageForTab(options.tabName || 'main', nodeExecutor);
      
      if (nodeExecutor?.currentWorkflow?.id) {
        page._workflowId = nodeExecutor.currentWorkflow.id;
      }

      // Call the visual inspector in the browser context
      const result = await page.evaluate((params) => {
        // Inline ActionableFilter for consistent actionability detection
        class ActionableFilter {
          constructor() {
            this.interactiveTags = new Set([
              'a', 'button', 'input', 'select', 'textarea', 'label', 
              'details', 'summary', 'option', 'menuitem'
            ]);
            
            this.interactiveRoles = new Set([
              'button', 'link', 'menuitem', 'menuitemradio', 'menuitemcheckbox',
              'radio', 'checkbox', 'tab', 'switch', 'slider', 'spinbutton',
              'combobox', 'searchbox', 'textbox', 'listbox', 'option', 'scrollbar'
            ]);
            
            this.ariaStateAttrs = ['aria-expanded', 'aria-pressed', 'aria-selected', 'aria-checked'];
            this.frameworkAttrs = ['ng-click', '@click', 'v-on:click', 'onclick'];
            
            this.clickableClasses = [
              'clickable', 'selectable', 'interactive', 'actionable',
              'rowSelectionEnabled', 'rowExpansionEnabled', 'cellClickable', 'hoverable',
              'data-row', 'table-row', 'list-item', 'card', 'dataRow'
            ];
            
            this.clickableTestIds = [
              'data-row', 'data-cell', 'clickable', 'selectable',
              'list-item', 'card', 'tile', 'row'
            ];
          }
          
          isActionableElementLive(element) {
            const tagName = element.tagName.toLowerCase();
            
            if (this.interactiveTags.has(tagName)) {
              if (this.isElementDisabledLive(element)) return false;
              return true;
            }
            
            const role = element.getAttribute('role');
            if (role && this.interactiveRoles.has(role)) return true;
            
            if (element.tabIndex >= 0) return true;
            
            if (element.isContentEditable || element.getAttribute('contenteditable') === 'true') {
              return true;
            }
            
            if (this.hasClickHandlersLive(element)) return true;
            
            if (this.ariaStateAttrs.some(attr => element.hasAttribute(attr))) return true;
            
            if (element.draggable) return true;
            
            const className = element.className || '';
            if (this.clickableClasses.some(cls => className.includes(cls))) {
              return true;
            }
            
            if (this.hasClickableParent(element)) {
              return true;
            }
            
            const testId = element.getAttribute('data-testid') || '';
            if (this.clickableTestIds.some(pattern => testId.includes(pattern))) {
              return true;
            }
            
            const style = window.getComputedStyle(element);
            if (style.cursor === 'pointer') return true;
            
            if (style.pointerEvents === 'none') return false;
            
            return false;
          }
          
          hasClickableParent(element, maxDepth = 5) {
            let current = element.parentElement;
            let depth = 0;
            
            while (current && depth < maxDepth) {
              const className = current.className || '';
              
              if (this.clickableClasses.some(cls => className.includes(cls))) {
                return true;
              }
              
              if (className.includes('rowSelectionEnabled') || 
                  className.includes('rowExpansionEnabled') ||
                  className.includes('dataRow')) {
                return true;
              }
              
              const testId = current.getAttribute('data-testid') || '';
              if (this.clickableTestIds.some(pattern => testId.includes(pattern))) {
                return true;
              }
              
              current = current.parentElement;
              depth++;
            }
            
            return false;
          }
          
          isElementDisabledLive(element) {
            if (element.disabled) return true;
            if (element.getAttribute('disabled') !== null) return true;
            if (element.getAttribute('aria-disabled') === 'true') return true;
            if (element.readOnly) return true;
            if (element.inert) return true;
            
            const style = window.getComputedStyle(element);
            if (style.cursor === 'not-allowed' || style.cursor === 'disabled') return true;
            
            return false;
          }
          
          hasClickHandlersLive(element) {
            if (element.onclick || element.getAttribute('onclick')) return true;
            
            if (this.frameworkAttrs.some(attr => element.hasAttribute(attr))) return true;
            
            try {
              if (typeof getEventListeners === 'function') {
                const listeners = getEventListeners(element);
                const mouseEvents = ['click', 'mousedown', 'mouseup', 'touchstart', 'touchend'];
                return mouseEvents.some(event => listeners[event] && listeners[event].length > 0);
              }
            } catch (e) {
              const eventProps = ['onclick', 'onmousedown', 'onmouseup'];
              return eventProps.some(prop => typeof element[prop] === 'function');
            }
            
            return false;
          }
        }
        
        class VisualInspector {
          async inspectAtCoordinates(x, y, options = {}) {
            const {
              includeParentChain = true,
              includeChildren = false,
              generateSelectors = true,
              checkActionability = true,
              includeNearbyElements = false,
              searchRadius = 50
            } = options;

            // Get element at exact coordinates
            const targetElement = document.elementFromPoint(x, y);
            
            if (!targetElement) {
              return {
                success: false,
                error: `No element found at coordinates [${x}, ${y}]`,
                coordinates: { x, y }
              };
            }

            const result = {
              success: true,
              coordinates: { x, y },
              target: await this.getElementDetails(targetElement, {
                includeParentChain,
                includeChildren,
                generateSelectors,
                checkActionability
              })
            };

            // Include nearby elements if requested
            if (includeNearbyElements) {
              result.nearbyElements = await this.findNearbyElements(x, y, searchRadius);
            }

            return result;
          }

          async getElementDetails(element, options) {
            const rect = element.getBoundingClientRect();
            const styles = window.getComputedStyle(element);
            
            const details = {
              tag: element.tagName.toLowerCase(),
              text: this.extractText(element),
              bounds: [
                Math.round(rect.x),
                Math.round(rect.y), 
                Math.round(rect.width),
                Math.round(rect.height)
              ],
              attributes: this.getAllAttributes(element),
              visible: this.isElementVisible(element),
              inViewport: this.isInViewport(rect)
            };

            // Generate multiple selector options
            if (options.generateSelectors) {
              details.selectors = this.generateStableSelectors(element);
            }

            // Check actionability against current filters (simplified)
            if (options.checkActionability) {
              details.actionability = this.checkActionability(element);
            }

            // Include parent chain
            if (options.includeParentChain) {
              details.parentChain = this.getParentChain(element);
            }

            // Include children
            if (options.includeChildren) {
              details.children = Array.from(element.children).map(child => ({
                tag: child.tagName.toLowerCase(),
                text: this.extractText(child).substring(0, 50),
                bounds: this.getBounds(child)
              }));
            }

            return details;
          }

          generateStableSelectors(element) {
            const selectors = [];
            
            // 1. ID selector (most stable)
            if (element.id) {
              selectors.push({
                selector: `#${element.id}`,
                reliability: 'high',
                type: 'id'
              });
            }

            // 2. Data attribute selectors (test-friendly)
            const dataAttrs = ['data-testid', 'data-cy', 'data-test', 'data-qa'];
            for (const attr of dataAttrs) {
              const value = element.getAttribute(attr);
              if (value) {
                selectors.push({
                  selector: `[${attr}="${value}"]`,
                  reliability: 'high',
                  type: 'data-attribute'
                });
              }
            }

            // 3. Unique class combinations
            if (element.className) {
              const classes = element.className.split(' ').filter(c => c.length > 0);
              if (classes.length > 0) {
                selectors.push({
                  selector: `.${classes.join('.')}`,
                  reliability: 'medium',
                  type: 'class'
                });
              }
            }

            // 4. ARIA selectors
            const ariaLabel = element.getAttribute('aria-label');
            if (ariaLabel) {
              selectors.push({
                selector: `[aria-label="${ariaLabel}"]`,
                reliability: 'medium',
                type: 'aria'
              });
            }

            // 5. Text-based selectors (least stable)
            const text = this.extractText(element);
            if (text && text.length < 50) {
              selectors.push({
                selector: `${element.tagName.toLowerCase()}:has-text("${text}")`,
                reliability: 'low',
                type: 'text',
                note: 'Pseudo-selector, may need framework-specific adaptation'
              });
            }

            return selectors;
          }

          checkActionability(element) {
            const actionableFilter = new ActionableFilter();
            const style = window.getComputedStyle(element);
            
            return {
              isActionable: actionableFilter.isActionableElementLive(element),
              isVisible: element.offsetWidth > 0 && element.offsetHeight > 0,
              cursor: style.cursor,
              tabIndex: element.tabIndex,
              hasClickHandlers: actionableFilter.hasClickHandlersLive(element),
              reasons: this.getActionabilityReasons(element, actionableFilter)
            };
          }

          isElementActionable(element) {
            const tagName = element.tagName.toLowerCase();
            const interactiveTags = ['a', 'button', 'input', 'select', 'textarea', 'label'];
            const interactiveRoles = ['button', 'link', 'menuitem', 'checkbox', 'radio', 'tab'];
            
            // Tag whitelist
            if (interactiveTags.includes(tagName)) return true;
            
            // ARIA roles
            const role = element.getAttribute('role');
            if (role && interactiveRoles.includes(role)) return true;
            
            // Tabindex
            if (element.tabIndex >= 0) return true;
            
            // Click handlers
            if (this.hasClickHandlers(element)) return true;
            
            // Cursor pointer
            const style = window.getComputedStyle(element);
            if (style.cursor === 'pointer') return true;
            
            // Semantic classes (Airtable patterns)
            const className = element.className || '';
            const clickableClasses = ['clickable', 'selectable', 'rowSelectionEnabled', 'data-row'];
            if (clickableClasses.some(cls => className.includes(cls))) return true;
            
            // Test ID patterns
            const testId = element.getAttribute('data-testid') || '';
            if (testId === 'data-row') return true;
            
            return false;
          }

          hasClickHandlers(element) {
            if (element.onclick) return true;
            if (element.getAttribute('onclick')) return true;
            
            // Framework handlers
            const frameworkAttrs = ['ng-click', '@click', 'v-on:click'];
            return frameworkAttrs.some(attr => element.hasAttribute(attr));
          }

          getActionabilityReasons(element, actionableFilter) {
            const reasons = [];
            const tagName = element.tagName.toLowerCase();
            
            if (actionableFilter.interactiveTags.has(tagName)) {
              reasons.push(`✅ Interactive tag: ${tagName}`);
            } else {
              reasons.push(`❌ Non-interactive tag: ${tagName}`);
            }
            
            const role = element.getAttribute('role');
            if (role && actionableFilter.interactiveRoles.has(role)) {
              reasons.push(`✅ ARIA role: ${role}`);
            } else {
              reasons.push(`❌ No ARIA role`);
            }
            
            if (element.tabIndex >= 0) {
              reasons.push(`✅ Focusable (tabIndex: ${element.tabIndex})`);
            } else {
              reasons.push(`❌ Not focusable`);
            }
            
            const style = window.getComputedStyle(element);
            if (style.cursor === 'pointer') {
              reasons.push(`✅ Cursor: pointer`);
            } else {
              reasons.push(`❌ Cursor: ${style.cursor}`);
            }
            
            // Check for parent clickability
            if (actionableFilter.hasClickableParent(element)) {
              reasons.push(`✅ Has clickable parent (rowSelectionEnabled/dataRow)`);
            }
            
            return reasons;
          }

          extractText(element) {
            if (element.textContent && element.textContent.trim()) {
              return element.textContent.trim();
            }
            return element.placeholder || element.title || element.alt || element.value || '';
          }

          getAllAttributes(element) {
            const attrs = {};
            for (const attr of element.attributes) {
              attrs[attr.name] = attr.value;
            }
            return attrs;
          }

          isElementVisible(element) {
            return element.offsetWidth > 0 && element.offsetHeight > 0;
          }

          isInViewport(rect) {
            return rect.bottom > 0 && rect.right > 0 && 
                   rect.top < window.innerHeight && rect.left < window.innerWidth;
          }

          getBounds(element) {
            const rect = element.getBoundingClientRect();
            return [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)];
          }

          getParentChain(element) {
            const chain = [];
            let parent = element.parentElement;
            let level = 1;
            
            while (parent && level <= 5) {
              chain.push({
                level,
                tag: parent.tagName.toLowerCase(),
                id: parent.id || null,
                classes: parent.className || null,
                text: this.extractText(parent).substring(0, 30) || null
              });
              parent = parent.parentElement;
              level++;
            }
            
            return chain;
          }

          async findNearbyElements(centerX, centerY, radius) {
            const nearby = [];
            const searchPoints = this.generateSearchPoints(centerX, centerY, radius);
            
            for (const point of searchPoints) {
              const element = document.elementFromPoint(point.x, point.y);
              if (element && !nearby.some(n => n.element === element)) {
                if (this.isElementActionable(element)) {
                  nearby.push({
                    distance: Math.sqrt(Math.pow(point.x - centerX, 2) + Math.pow(point.y - centerY, 2)),
                    bounds: this.getBounds(element),
                    text: this.extractText(element).substring(0, 30),
                    tag: element.tagName.toLowerCase()
                  });
                }
              }
            }
            
            return nearby.sort((a, b) => a.distance - b.distance).slice(0, 10);
          }

          generateSearchPoints(centerX, centerY, radius) {
            const points = [];
            const steps = 8; // 8 directions
            
            for (let i = 0; i < steps; i++) {
              const angle = (i * 2 * Math.PI) / steps;
              points.push({
                x: centerX + Math.cos(angle) * radius,
                y: centerY + Math.sin(angle) * radius
              });
            }
            
            return points;
          }
        }

        const inspector = new VisualInspector();
        return inspector.inspectAtCoordinates(params.x, params.y, params.options);
      }, { x: options.x, y: options.y, options: options });

      if (result.success) {
        return {
          success: true,
          output: this.formatClickInspectOutput(result, options),
          element: result.target,
          coordinates: result.coordinates,
          selectors: result.target.selectors
        };
      }

      return {
        success: false,
        error: result.error,
        coordinates: result.coordinates
      };

    } catch (error) {
      console.error('[DOMToolkitService] Error in domClickInspect:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Format the click inspect output for human readability
   */
  formatClickInspectOutput(result, options) {
    const lines = [];
    const target = result.target;
    
    lines.push('=== VISUAL CLICK INSPECTION ===');
    lines.push(`Coordinates: [${result.coordinates.x}, ${result.coordinates.y}]`);
    lines.push('');
    
    // Target element details
    lines.push('[TARGET ELEMENT]');
    lines.push(`Tag: ${target.tag}`);
    lines.push(`Text: "${target.text}"`);
    lines.push(`Bounds: [${target.bounds.join(', ')}]`);
    lines.push(`Visible: ${target.visible ? '✅' : '❌'} | In Viewport: ${target.inViewport ? '✅' : '❌'}`);
    lines.push('');
    
    // Actionability analysis
    if (target.actionability) {
      const actionability = target.actionability;
      lines.push('[ACTIONABILITY ANALYSIS]');
      lines.push(`Detected as Actionable: ${actionability.isActionable ? '✅' : '❌'}`);
      
      if (actionability.reasons) {
        lines.push('Reasons:');
        actionability.reasons.forEach(reason => {
          lines.push(`- ${reason}`);
        });
      }
      
      lines.push(`- Cursor style: ${actionability.cursor}`);
      lines.push(`- Tab index: ${actionability.tabIndex}`);
      lines.push(`- Has click handlers: ${actionability.hasClickHandlers ? '✅' : '❌'}`);
      lines.push('');
    }
    
    // Recommended selectors
    if (target.selectors && target.selectors.length > 0) {
      lines.push('[RECOMMENDED SELECTORS]');
      target.selectors.forEach((sel, index) => {
        lines.push(`${index + 1}. ${sel.selector} (${sel.reliability} reliability - ${sel.type})`);
        if (sel.note) lines.push(`   Note: ${sel.note}`);
      });
      lines.push('');
    }
    
    // Parent chain
    if (target.parentChain && target.parentChain.length > 0) {
      lines.push('[PARENT CHAIN]');
      target.parentChain.forEach(parent => {
        const id = parent.id ? `#${parent.id}` : '';
        const classes = parent.classes ? `.${parent.classes.split(' ').join('.')}` : '';
        const text = parent.text ? ` "${parent.text}"` : '';
        lines.push(`↑ ${parent.tag}${id}${classes}${text}`);
      });
      lines.push('');
    }
    
    // Children
    if (target.children && target.children.length > 0) {
      lines.push('[CHILDREN]');
      target.children.forEach(child => {
        lines.push(`↓ ${child.tag} "${child.text}" [${child.bounds.join(', ')}]`);
      });
      lines.push('');
    }
    
    // Nearby elements
    if (result.nearbyElements && result.nearbyElements.length > 0) {
      lines.push('[NEARBY ACTIONABLE ELEMENTS]');
      result.nearbyElements.forEach((nearby, index) => {
        lines.push(`${index + 1}. ${nearby.tag} "${nearby.text}" (${Math.round(nearby.distance)}px away)`);
        lines.push(`   Bounds: [${nearby.bounds.join(', ')}]`);
      });
      lines.push('');
    }
    
    // Debug insights
    lines.push('[DEBUG INSIGHTS]');
    if (target.actionability && !target.actionability.isActionable) {
      lines.push('💡 Element should be actionable but isn\'t detected');
      lines.push('💡 Consider enhancing actionable filter for this pattern');
    }
    
    // Suggested actions
    if (target.selectors && target.selectors.length > 0) {
      const bestSelector = target.selectors[0];
      lines.push('');
      lines.push('[SUGGESTED ACTIONS]');
      lines.push(`- Test click: browser_action({action: "click", selector: "${bestSelector.selector}"})`);
      lines.push('- Manual verify: Click element to confirm it\'s actually interactive');
      
      if (target.actionability && !target.actionability.isActionable) {
        lines.push('- Debug filter: Check why element isn\'t triggering detection');
      }
    }
    
    return lines.join('\n');
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