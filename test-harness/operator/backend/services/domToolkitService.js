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

  // Note: dom_actionable and dom_actionable_ax methods removed from tool list
  // Implementation preserved in dom-toolkit/ for potential reintroduction

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
        
        class SmartSelectorFilter {
          constructor() {
            // Common utility class patterns to deprioritize
            this.utilityPatterns = [
              /^mt\d+$/, /^mb\d+$/, /^ml\d+$/, /^mr\d+$/, /^mx\d+$/, /^my\d+$/,  // Margin
              /^pt\d+$/, /^pb\d+$/, /^pl\d+$/, /^pr\d+$/, /^px\d+$/, /^py\d+$/,  // Padding
              /^text-/, /^bg-/, /^border-/, /^rounded-/, /^shadow-/,              // Styling
              /^flex/, /^grid/, /^items-/, /^justify-/, /^self-/,                 // Layout
              /^w-\d+$/, /^h-\d+$/, /^min-/, /^max-/,                            // Sizing
              /^hover:/, /^focus:/, /^active:/, /^disabled:/,                     // States
              /^css-[a-z0-9]{6,}$/i,                                             // CSS-in-JS
              /^[a-z0-9]{8}$/i                                                    // Random hashes
            ];
            
            // High-value attributes for stable selectors
            this.stableAttributes = [
              'data-testid', 'data-cy', 'data-test', 'data-qa', 'data-id',
              'data-automation-id', 'data-row-id', 'data-cell-id'
            ];
            
            // Framework indicators
            this.frameworkPatterns = {
              react: ['data-reactroot', '__reactInternalInstance', '__reactFiber'],
              vue: ['v-for', 'v-if', 'v-show', 'v-model', '@click', ':class'],
              angular: ['ng-repeat', 'ng-if', 'ng-show', 'ng-model', 'ng-click', '*ngFor', '*ngIf']
            };
          }
          
          isUtilityClass(className) {
            return this.utilityPatterns.some(pattern => pattern.test(className));
          }
          
          isDynamicClass(className) {
            // CSS-in-JS or hash-based classes
            return /^css-[a-z0-9]{6,}$/i.test(className) || 
                   /^[a-z0-9]{8,}$/i.test(className) ||
                   className.includes('__') && className.includes('--');
          }
          
          getMeaningfulClasses(element) {
            if (!element.className) return [];
            
            const classes = element.className.split(' ').filter(c => c.length > 0);
            return classes.filter(cls => 
              !this.isUtilityClass(cls) && 
              !this.isDynamicClass(cls)
            );
          }
          
          getQualityScore(selector) {
            // Higher scores = better quality
            const scores = {
              'id': 100,
              'data-attribute': 90,
              'aria': 80,
              'name-attribute': 75,
              'context-direct': 70,
              'href-attribute': 65,
              'meaningful-class': 60,
              'context': 50,
              'tag-attribute': 45,
              'class-combo': 40,
              'text': 30,
              'sibling': 25,
              'position': 20,
              'xpath': 15
            };
            
            // Special scoring for data attributes
            if (selector.type === 'attribute' || selector.type === 'tag-attribute') {
              if (this.stableAttributes.includes(selector.attribute)) {
                return 95;
              }
              if (selector.attribute?.startsWith('aria-')) {
                return 80;
              }
              if (selector.attribute === 'name' || selector.attribute === 'type') {
                return 75;
              }
            }
            
            // Penalize utility class combinations
            if (selector.type === 'class-combo' && selector.selector) {
              const classes = selector.selector.match(/\.[a-zA-Z0-9_-]+/g) || [];
              const utilityCount = classes.filter(cls => 
                this.isUtilityClass(cls.substring(1))
              ).length;
              if (utilityCount > 1) {
                return 20; // Low score for utility combos
              }
            }
            
            return scores[selector.type] || 30;
          }
          
          filterAndRankSelectors(selectors, options = {}) {
            const {
              maxSelectors = 5,
              mode = 'smart',
              includeNonUnique = false
            } = options;
            
            // Filter invalid and optionally non-unique
            let filtered = selectors.filter(sel => {
              if (!sel.validation?.isValid) return false;
              if (!includeNonUnique && !sel.validation?.isUnique) return false;
              return true;
            });
            
            // Calculate quality scores
            filtered = filtered.map(sel => ({
              ...sel,
              qualityScore: this.getQualityScore(sel)
            }));
            
            // Sort by quality score, then by uniqueness, then by match count
            filtered.sort((a, b) => {
              // Quality score first
              if (a.qualityScore !== b.qualityScore) {
                return b.qualityScore - a.qualityScore;
              }
              
              // Unique selectors before non-unique
              if (a.validation.isUnique !== b.validation.isUnique) {
                return a.validation.isUnique ? -1 : 1;
              }
              
              // Fewer matches is better
              return a.validation.matchCount - b.validation.matchCount;
            });
            
            if (mode === 'smart') {
              // Smart mode: Ensure diversity in selector types
              const selected = [];
              const seenTypes = new Set();
              
              for (const selector of filtered) {
                // Always include the best selector
                if (selected.length === 0) {
                  selected.push(selector);
                  seenTypes.add(selector.type);
                  continue;
                }
                
                // For additional selectors, prefer different types
                const typeBonus = seenTypes.has(selector.type) ? 0 : 10;
                selector.diversityScore = selector.qualityScore + typeBonus;
                
                // Skip very similar selectors
                const isDuplicate = selected.some(sel => 
                  sel.selector === selector.selector ||
                  (sel.type === selector.type && sel.qualityScore === selector.qualityScore)
                );
                
                if (!isDuplicate) {
                  selected.push(selector);
                  seenTypes.add(selector.type);
                }
                
                if (selected.length >= maxSelectors) break;
              }
              
              return selected;
            }
            
            // Balanced/exhaustive mode: Just limit by count
            return filtered.slice(0, maxSelectors);
          }
          
          generateWarnings(element, selectors) {
            const warnings = [];
            
            // Check if only low-quality selectors available
            const bestScore = Math.max(...selectors.map(s => s.qualityScore || 0));
            
            if (bestScore < 40) {
              warnings.push({
                level: 'HIGH',
                message: 'No stable selectors found - only positional or class-based selectors available',
                suggestion: 'Consider adding data-testid or unique IDs to improve automation reliability'
              });
            } else if (bestScore < 70) {
              warnings.push({
                level: 'MEDIUM', 
                message: 'Selectors may be fragile - no test-specific attributes found',
                suggestion: 'Add data-testid="unique-name" for more reliable automation'
              });
            }
            
            // Check for CSS-in-JS
            if (element.className && this.isDynamicClass(element.className.split(' ')[0])) {
              warnings.push({
                level: 'MEDIUM',
                message: 'Element uses dynamically generated classes that may change between builds',
                suggestion: 'Rely on data attributes or ARIA labels instead of class names'
              });
            }
            
            // Check if we had to fall back to position selectors
            const hasPositional = selectors.some(s => s.type === 'position' || s.type.includes('nth'));
            if (hasPositional && selectors[0]?.type === 'position') {
              warnings.push({
                level: 'HIGH',
                message: 'Best available selector is position-based and may break if DOM structure changes',
                suggestion: 'Add stable attributes to this element for reliable automation'
              });
            }
            
            return warnings;
          }
        }
        
        class ExhaustiveSelectorGenerator {
          constructor() {
            this.MAX_ATTRIBUTE_LENGTH = 100;
            this.MAX_TEXT_LENGTH = 50;
            this.MAX_COMBO_DEPTH = 3;
          }

          /**
           * Main entry point - generates candidates based on mode
           */
          async generateCandidateSelectors(element, mode = 'stable') {
            if (mode === 'stable') {
              // Use existing stable selector generation
              return this.generateStableSelectors(element);
            }
            
            const selectors = [];
            
            // In exhaustive mode, generate ALL selector types
            selectors.push(...this.generateIdSelectors(element));
            selectors.push(...this.generateAttributeSelectors(element));
            selectors.push(...this.generateClassSelectors(element));
            selectors.push(...this.generatePositionSelectors(element));
            selectors.push(...this.generateTextSelectors(element));
            selectors.push(...this.generateContextSelectors(element));
            selectors.push(...this.generateSiblingSelectors(element));
            selectors.push(...this.generateFrameworkSelectors(element));
            selectors.push(...this.generateAriaSelectors(element));
            selectors.push(...this.generateCombinationSelectors(element));
            
            return selectors;
          }

          /**
           * Existing stable selector generation
           */
          generateStableSelectors(element) {
            const selectors = [];
            
            // 1. ID selector (most stable)
            if (element.id) {
              selectors.push({
                selector: `#${element.id}`,
                type: 'id',
                specificity: 100,
                strategy: 'stable'
              });
            }

            // 2. Data attribute selectors (test-friendly)
            const dataAttrs = ['data-testid', 'data-cy', 'data-test', 'data-qa', 'data-id'];
            for (const attr of dataAttrs) {
              const value = element.getAttribute(attr);
              if (value) {
                selectors.push({
                  selector: `[${attr}="${CSS.escape(value)}"]`,
                  type: 'data-attribute',
                  attribute: attr,
                  specificity: 90,
                  strategy: 'stable'
                });
              }
            }

            // 3. Unique class combinations
            if (element.className) {
              const classes = element.className.split(' ').filter(c => c.length > 0 && !c.match(/^[a-z0-9]{8}$/i));
              if (classes.length > 0) {
                selectors.push({
                  selector: `.${classes.map(c => CSS.escape(c)).join('.')}`,
                  type: 'class-combo',
                  specificity: 20 * classes.length,
                  strategy: 'stable'
                });
              }
            }

            // 4. ARIA selectors
            const ariaLabel = element.getAttribute('aria-label');
            if (ariaLabel && ariaLabel.length < this.MAX_TEXT_LENGTH) {
              selectors.push({
                selector: `[aria-label="${CSS.escape(ariaLabel)}"]`,
                type: 'aria',
                specificity: 50,
                strategy: 'stable'
              });
            }

            // 5. Text-based selectors (least stable)
            const text = element.textContent?.trim();
            if (text && text.length < this.MAX_TEXT_LENGTH) {
              selectors.push({
                selector: `${element.tagName.toLowerCase()}:contains("${text}")`,
                type: 'text',
                specificity: 5,
                strategy: 'stable',
                requiresLibrary: 'jquery/playwright'
              });
            }

            return selectors;
          }

          /**
           * Generate ID-based selectors
           */
          generateIdSelectors(element) {
            if (!element.id) return [];
            
            return [{
              selector: `#${CSS.escape(element.id)}`,
              type: 'id',
              specificity: 100,
              strategy: 'exhaustive'
            }];
          }

          /**
           * Generate all attribute selectors
           */
          generateAttributeSelectors(element) {
            const selectors = [];
            
            for (const attr of element.attributes) {
              // Skip certain attributes
              if (['class', 'id', 'style'].includes(attr.name)) continue;
              if (attr.value.length > this.MAX_ATTRIBUTE_LENGTH) continue;
              
              // Single attribute selector
              selectors.push({
                selector: `[${attr.name}="${CSS.escape(attr.value)}"]`,
                type: 'attribute',
                attribute: attr.name,
                specificity: this.getAttributeSpecificity(attr.name),
                strategy: 'exhaustive'
              });
              
              // Tag + attribute combo
              selectors.push({
                selector: `${element.tagName.toLowerCase()}[${attr.name}="${CSS.escape(attr.value)}"]`,
                type: 'tag-attribute',
                attribute: attr.name,
                specificity: this.getAttributeSpecificity(attr.name) + 10,
                strategy: 'exhaustive'
              });
            }
            
            return selectors;
          }

          /**
           * Generate class-based selectors
           */
          generateClassSelectors(element) {
            if (!element.className) return [];
            
            const selectors = [];
            const classes = element.className.split(' ').filter(c => c.length > 0);
            
            // Single classes
            classes.forEach(cls => {
              selectors.push({
                selector: `.${CSS.escape(cls)}`,
                type: 'class',
                specificity: 10,
                strategy: 'exhaustive'
              });
              
              // Tag + class
              selectors.push({
                selector: `${element.tagName.toLowerCase()}.${CSS.escape(cls)}`,
                type: 'tag-class',
                specificity: 15,
                strategy: 'exhaustive'
              });
            });
            
            // All possible class combinations (2-3 classes)
            for (let size = 2; size <= Math.min(classes.length, 3); size++) {
              const combinations = this.getCombinations(classes, size);
              combinations.forEach(combo => {
                selectors.push({
                  selector: `.${combo.map(c => CSS.escape(c)).join('.')}`,
                  type: 'class-combo',
                  specificity: 10 * combo.length,
                  strategy: 'exhaustive'
                });
              });
            }
            
            return selectors;
          }

          /**
           * Generate position-based selectors
           */
          generatePositionSelectors(element) {
            const selectors = [];
            const parent = element.parentElement;
            if (!parent) return selectors;
            
            const siblings = Array.from(parent.children);
            const index = siblings.indexOf(element);
            const tagName = element.tagName.toLowerCase();
            const sameTagSiblings = siblings.filter(el => el.tagName === element.tagName);
            const tagIndex = sameTagSiblings.indexOf(element);
            
            // nth-child selectors
            selectors.push({
              selector: `:nth-child(${index + 1})`,
              type: 'nth-child',
              specificity: 1,
              strategy: 'exhaustive'
            });
            
            // nth-of-type selectors
            selectors.push({
              selector: `${tagName}:nth-of-type(${tagIndex + 1})`,
              type: 'nth-of-type',
              specificity: 2,
              strategy: 'exhaustive'
            });
            
            // First/last child
            if (index === 0) {
              selectors.push({
                selector: ':first-child',
                type: 'first-child',
                specificity: 3,
                strategy: 'exhaustive'
              });
              
              selectors.push({
                selector: `${tagName}:first-of-type`,
                type: 'first-of-type',
                specificity: 3,
                strategy: 'exhaustive'
              });
            }
            
            if (index === siblings.length - 1) {
              selectors.push({
                selector: ':last-child',
                type: 'last-child',
                specificity: 3,
                strategy: 'exhaustive'
              });
              
              selectors.push({
                selector: `${tagName}:last-of-type`,
                type: 'last-of-type',
                specificity: 3,
                strategy: 'exhaustive'
              });
            }
            
            // Only child
            if (siblings.length === 1) {
              selectors.push({
                selector: ':only-child',
                type: 'only-child',
                specificity: 4,
                strategy: 'exhaustive'
              });
            }
            
            return selectors;
          }

          /**
           * Generate text-based selectors
           */
          generateTextSelectors(element) {
            const selectors = [];
            const text = element.textContent?.trim();
            
            if (!text || text.length > this.MAX_TEXT_LENGTH) return selectors;
            
            const tagName = element.tagName.toLowerCase();
            
            // jQuery/Playwright :contains
            selectors.push({
              selector: `:contains("${text}")`,
              type: 'text-contains',
              specificity: 5,
              strategy: 'exhaustive',
              requiresLibrary: 'jquery/playwright'
            });
            
            // Tag + contains
            selectors.push({
              selector: `${tagName}:contains("${text}")`,
              type: 'tag-text-contains',
              specificity: 7,
              strategy: 'exhaustive',
              requiresLibrary: 'jquery/playwright'
            });
            
            // XPath text selectors
            selectors.push({
              selector: `//*[text()="${text}"]`,
              type: 'xpath-exact-text',
              specificity: 6,
              strategy: 'exhaustive',
              isXPath: true
            });
            
            selectors.push({
              selector: `//*[contains(text(), "${text}")]`,
              type: 'xpath-contains-text',
              specificity: 5,
              strategy: 'exhaustive',
              isXPath: true
            });
            
            // Normalized space XPath
            selectors.push({
              selector: `//*[normalize-space()="${text}"]`,
              type: 'xpath-normalized-text',
              specificity: 6,
              strategy: 'exhaustive',
              isXPath: true
            });
            
            return selectors;
          }

          /**
           * Generate context-based selectors (parent > child)
           */
          generateContextSelectors(element, maxDepth = 3) {
            const selectors = [];
            const tagName = element.tagName.toLowerCase();
            
            // Build parent chain
            const parents = [];
            let current = element.parentElement;
            let depth = 0;
            
            while (current && depth < maxDepth) {
              const parentDescriptor = this.getElementDescriptor(current);
              if (parentDescriptor) {
                parents.push(parentDescriptor);
              }
              current = current.parentElement;
              depth++;
            }
            
            // Generate selectors for each parent level
            for (let i = 0; i < parents.length; i++) {
              const parentChain = parents.slice(0, i + 1).reverse();
              const contextSelector = parentChain.join(' ') + ' ' + tagName;
              
              selectors.push({
                selector: contextSelector,
                type: 'context',
                depth: i + 1,
                specificity: 15 * (i + 1),
                strategy: 'exhaustive'
              });
              
              // Also with direct child combinator
              const directChildSelector = parentChain.join(' > ') + ' > ' + tagName;
              selectors.push({
                selector: directChildSelector,
                type: 'context-direct',
                depth: i + 1,
                specificity: 20 * (i + 1),
                strategy: 'exhaustive'
              });
            }
            
            return selectors;
          }

          /**
           * Generate sibling-based selectors
           */
          generateSiblingSelectors(element) {
            const selectors = [];
            const prev = element.previousElementSibling;
            const next = element.nextElementSibling;
            const tagName = element.tagName.toLowerCase();
            
            if (prev) {
              const prevDescriptor = this.getElementDescriptor(prev);
              if (prevDescriptor) {
                // Adjacent sibling
                selectors.push({
                  selector: `${prevDescriptor} + ${tagName}`,
                  type: 'adjacent-sibling',
                  specificity: 25,
                  strategy: 'exhaustive'
                });
                
                // General sibling
                selectors.push({
                  selector: `${prevDescriptor} ~ ${tagName}`,
                  type: 'general-sibling',
                  specificity: 20,
                  strategy: 'exhaustive'
                });
              }
            }
            
            return selectors;
          }

          /**
           * Generate framework-specific selectors
           */
          generateFrameworkSelectors(element) {
            const selectors = [];
            
            // React
            const reactProps = this.getReactProps(element);
            if (reactProps) {
              selectors.push({
                selector: `[data-reactroot] ${element.tagName.toLowerCase()}`,
                type: 'react',
                specificity: 30,
                strategy: 'exhaustive',
                framework: 'react'
              });
            }
            
            // Vue
            const vueAttrs = ['v-for', 'v-if', 'v-show', 'v-model', '@click', ':class'];
            vueAttrs.forEach(attr => {
              if (element.hasAttribute(attr)) {
                selectors.push({
                  selector: `[${attr}]`,
                  type: 'vue-directive',
                  specificity: 35,
                  strategy: 'exhaustive',
                  framework: 'vue'
                });
              }
            });
            
            // Angular
            const ngAttrs = ['ng-repeat', 'ng-if', 'ng-show', 'ng-model', 'ng-click', '*ngFor', '*ngIf'];
            ngAttrs.forEach(attr => {
              if (element.hasAttribute(attr)) {
                selectors.push({
                  selector: `[${attr}]`,
                  type: 'angular-directive',
                  specificity: 35,
                  strategy: 'exhaustive',
                  framework: 'angular'
                });
              }
            });
            
            return selectors;
          }

          /**
           * Generate ARIA-based selectors
           */
          generateAriaSelectors(element) {
            const selectors = [];
            const ariaAttrs = [
              'aria-label', 'aria-labelledby', 'aria-describedby',
              'aria-controls', 'aria-owns', 'role'
            ];
            
            ariaAttrs.forEach(attr => {
              const value = element.getAttribute(attr);
              if (value && value.length < this.MAX_ATTRIBUTE_LENGTH) {
                selectors.push({
                  selector: `[${attr}="${CSS.escape(value)}"]`,
                  type: 'aria',
                  attribute: attr,
                  specificity: 45,
                  strategy: 'exhaustive'
                });
              }
            });
            
            return selectors;
          }

          /**
           * Generate combination selectors
           */
          generateCombinationSelectors(element) {
            const selectors = [];
            const attrs = Array.from(element.attributes)
              .filter(a => !['class', 'id', 'style'].includes(a.name))
              .filter(a => a.value.length < 50);
            
            // 2-attribute combinations
            for (let i = 0; i < attrs.length && i < 5; i++) {
              for (let j = i + 1; j < attrs.length && j < i + 3; j++) {
                selectors.push({
                  selector: `[${attrs[i].name}="${CSS.escape(attrs[i].value)}"][${attrs[j].name}="${CSS.escape(attrs[j].value)}"]`,
                  type: 'attribute-combo',
                  specificity: 40,
                  strategy: 'exhaustive'
                });
              }
            }
            
            // Attribute + class combinations
            if (element.className) {
              const firstClass = element.className.split(' ')[0];
              attrs.slice(0, 3).forEach(attr => {
                selectors.push({
                  selector: `.${CSS.escape(firstClass)}[${attr.name}="${CSS.escape(attr.value)}"]`,
                  type: 'class-attribute-combo',
                  specificity: 35,
                  strategy: 'exhaustive'
                });
              });
            }
            
            return selectors;
          }

          /**
           * Helper: Get element descriptor for building compound selectors
           */
          getElementDescriptor(element) {
            if (element.id) {
              return `#${CSS.escape(element.id)}`;
            }
            
            let descriptor = element.tagName.toLowerCase();
            
            if (element.className) {
              const firstClass = element.className.split(' ')[0];
              if (firstClass) {
                descriptor += `.${CSS.escape(firstClass)}`;
              }
            }
            
            // Add distinctive attribute if no id/class
            if (!element.id && !element.className) {
              for (const attr of ['data-testid', 'data-id', 'name', 'type']) {
                const value = element.getAttribute(attr);
                if (value && value.length < 30) {
                  descriptor += `[${attr}="${CSS.escape(value)}"]`;
                  break;
                }
              }
            }
            
            return descriptor;
          }

          /**
           * Helper: Get combinations of array elements
           */
          getCombinations(arr, size) {
            const result = [];
            
            function combine(start, combo) {
              if (combo.length === size) {
                result.push([...combo]);
                return;
              }
              
              for (let i = start; i < arr.length; i++) {
                combo.push(arr[i]);
                combine(i + 1, combo);
                combo.pop();
              }
            }
            
            combine(0, []);
            return result;
          }

          /**
           * Helper: Get attribute specificity score
           */
          getAttributeSpecificity(attrName) {
            const rankings = {
              'data-testid': 90,
              'data-cy': 90,
              'data-test': 90,
              'data-qa': 90,
              'data-id': 85,
              'data-automation-id': 85,
              'id': 100,  // Handled separately but included for completeness
              'name': 70,
              'type': 60,
              'role': 55,
              'aria-label': 50,
              'aria-labelledby': 48,
              'placeholder': 40,
              'title': 35,
              'alt': 35,
              'value': 25,
              'href': 20,
              'src': 20
            };
            
            // Check for data-* attributes not in the list
            if (attrName.startsWith('data-')) {
              return 75;
            }
            
            return rankings[attrName] || 15;
          }

          /**
           * Helper: Check if element has React fiber
           */
          getReactProps(element) {
            // Check for React fiber properties
            const keys = Object.keys(element);
            return keys.some(key => key.startsWith('__react'));
          }

          /**
           * Validate all selectors in batch
           */
          async validateAllSelectors(candidates) {
            const results = [];
            
            for (const candidate of candidates) {
              try {
                // Skip XPath selectors in CSS validation
                if (candidate.isXPath) {
                  const xpathResult = document.evaluate(
                    candidate.selector,
                    document,
                    null,
                    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                    null
                  );
                  
                  results.push({
                    ...candidate,
                    validation: {
                      isValid: true,
                      matchCount: xpathResult.snapshotLength,
                      isUnique: xpathResult.snapshotLength === 1,
                      isXPath: true,
                      matches: []  // XPath match details omitted for performance
                    }
                  });
                  continue;
                }
                
                // CSS selector validation
                const elements = document.querySelectorAll(candidate.selector);
                
                results.push({
                  ...candidate,
                  validation: {
                    isValid: true,
                    matchCount: elements.length,
                    isUnique: elements.length === 1,
                    matches: Array.from(elements).slice(0, 3).map(el => ({
                      tag: el.tagName.toLowerCase(),
                      id: el.id || undefined,
                      text: el.textContent?.substring(0, 30) || undefined,
                      classes: el.className || undefined
                    }))
                  }
                });
              } catch (error) {
                results.push({
                  ...candidate,
                  validation: {
                    isValid: false,
                    matchCount: 0,
                    isUnique: false,
                    error: error.message
                  }
                });
              }
            }
            
            return results;
          }

          /**
           * Rank selectors by quality
           */
          rankSelectors(validatedSelectors, options = {}) {
            const { includeNonUnique = true, maxSelectors = 50 } = options;
            
            // Filter out non-unique if requested
            let selectors = validatedSelectors;
            if (!includeNonUnique) {
              selectors = selectors.filter(s => s.validation.isUnique);
            }
            
            // Sort by quality
            selectors.sort((a, b) => {
              // Invalid selectors go last
              if (!a.validation.isValid && b.validation.isValid) return 1;
              if (a.validation.isValid && !b.validation.isValid) return -1;
              
              // Unique selectors first
              if (a.validation.isUnique && !b.validation.isUnique) return -1;
              if (!a.validation.isUnique && b.validation.isUnique) return 1;
              
              // Both unique or both non-unique - sort by specificity
              if (a.specificity !== b.specificity) {
                return b.specificity - a.specificity;
              }
              
              // Same specificity - prefer fewer matches
              return a.validation.matchCount - b.validation.matchCount;
            });
            
            // Limit results
            return selectors.slice(0, maxSelectors);
          }

          /**
           * Main discovery method that combines generation and validation
           */
          async discoverSelectors(element, options = {}) {
            const {
              mode = 'smart',
              validateAll = true,
              maxSelectors = null,
              includeNonUnique = true
            } = options;
            
            // Set smart defaults based on mode
            const actualMaxSelectors = maxSelectors || {
              'smart': 5,
              'balanced': 15,
              'exhaustive': 50
            }[mode] || 5;
            
            // Generate candidates based on mode
            let candidates;
            if (mode === 'smart' || mode === 'balanced') {
              // For smart/balanced, generate exhaustive list then filter
              candidates = await this.generateCandidateSelectors(element, 'exhaustive');
            } else {
              // Exhaustive mode
              candidates = await this.generateCandidateSelectors(element, 'exhaustive');
            }
            
            // Always validate in smart/balanced mode
            const shouldValidate = validateAll || mode === 'smart' || mode === 'balanced';
            
            if (shouldValidate) {
              const validated = await this.validateAllSelectors(candidates);
              
              // Use smart filtering for smart/balanced modes
              if (mode === 'smart' || mode === 'balanced') {
                const filter = new SmartSelectorFilter();
                return filter.filterAndRankSelectors(validated, {
                  maxSelectors: actualMaxSelectors,
                  mode,
                  includeNonUnique
                });
              }
              
              // Exhaustive mode: use original ranking
              return this.rankSelectors(validated, { 
                includeNonUnique, 
                maxSelectors: actualMaxSelectors 
              });
            }
            
            // Return unvalidated candidates (limited)
            return candidates.slice(0, actualMaxSelectors);
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
              searchRadius = 50,
              // New options
              selectorMode = 'smart',
              validateSelectors = null,  // Will be auto-set based on mode
              maxSelectors = null,
              includeNonUnique = true,
              outputFormat = 'compact'
            } = options;
            
            // Auto-enable validation for smart/balanced/exhaustive modes
            const shouldValidate = validateSelectors !== null 
              ? validateSelectors 
              : (selectorMode !== 'stable');

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
                checkActionability,
                // Pass new options
                selectorMode,
                validateSelectors: shouldValidate,
                maxSelectors,
                includeNonUnique,
                outputFormat
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

            // Generate selectors with new system
            if (options.generateSelectors) {
              details.selectors = await this.generateSelectors(element, {
                mode: options.selectorMode,
                validateSelectors: options.validateSelectors,
                maxSelectors: options.maxSelectors,
                includeNonUnique: options.includeNonUnique
              });
              
              // Add statistics
              details.selectorStats = {
                total: details.selectors.length,
                unique: details.selectors.filter(s => s.validation?.isUnique).length,
                valid: details.selectors.filter(s => s.validation?.isValid).length,
                invalid: details.selectors.filter(s => !s.validation?.isValid).length
              };
              
              // Generate warnings for smart/balanced modes
              if (options.selectorMode === 'smart' || options.selectorMode === 'balanced') {
                const filter = new SmartSelectorFilter();
                details.warnings = filter.generateWarnings(element, details.selectors);
              }
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

          async generateSelectors(element, options = {}) {
            const generator = new ExhaustiveSelectorGenerator();
            
            const {
              mode = 'stable',
              validateSelectors = (mode === 'exhaustive'), // Auto-validate in exhaustive mode
              maxSelectors = 50,
              includeNonUnique = true
            } = options;
            
            // Use the new discovery method
            const selectors = await generator.discoverSelectors(element, {
              mode,
              validateAll: validateSelectors,
              maxSelectors,
              includeNonUnique
            });
            
            return selectors;
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
          selectors: result.target.selectors,
          selectorStats: result.target.selectorStats,
          warnings: result.target.warnings
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
    
    // Warnings (for smart/balanced modes)
    if (target.warnings && target.warnings.length > 0) {
      lines.push('[WARNINGS]');
      target.warnings.forEach(warning => {
        const icon = warning.level === 'HIGH' ? '⚠️' : warning.level === 'MEDIUM' ? '⚡' : 'ℹ️';
        lines.push(`${icon} ${warning.message}`);
        if (warning.suggestion) {
          lines.push(`   → ${warning.suggestion}`);
        }
      });
      lines.push('');
    }
    
    // Selectors based on output format
    if (target.selectors && target.selectors.length > 0) {
      if (options.outputFormat === 'compact') {
        // Compact format for smart/balanced modes
        lines.push('[SELECTORS]');
        target.selectors.forEach((sel, index) => {
          const uniqueIcon = sel.validation?.isUnique ? '✅' : '⚠️';
          const qualityIcon = sel.qualityScore >= 80 ? '⭐' : sel.qualityScore >= 50 ? '👍' : '🔧';
          lines.push(`${index + 1}. ${uniqueIcon} ${qualityIcon} ${sel.selector}`);
        });
        
        if (options.selectorMode === 'smart' && target.selectorStats) {
          lines.push('');
          lines.push(`ℹ️ Showing best ${target.selectors.length} of ${target.selectorStats.total} possible selectors`);
          lines.push(`   Use selectorMode: 'balanced' for more options or 'exhaustive' for all`);
        }
      } else {
        // Detailed format (current behavior)
        lines.push('[DISCOVERED SELECTORS]');
        
        // Show summary for exhaustive mode
        if (target.selectorStats && options.selectorMode === 'exhaustive') {
          lines.push('');
          lines.push('[SELECTOR DISCOVERY SUMMARY]');
          lines.push(`Total selectors generated: ${target.selectorStats.total}`);
          lines.push(`✅ Valid selectors: ${target.selectorStats.valid}`);
          lines.push(`🎯 Unique selectors: ${target.selectorStats.unique}`);
          lines.push(`❌ Invalid selectors: ${target.selectorStats.invalid}`);
          lines.push('');
        }
        
        // Group by uniqueness
        const uniqueSelectors = target.selectors.filter(s => s.validation?.isUnique);
      const nonUniqueSelectors = target.selectors.filter(s => s.validation && !s.validation.isUnique);
      const invalidSelectors = target.selectors.filter(s => !s.validation?.isValid);
      
      if (uniqueSelectors.length > 0) {
        lines.push('');
        lines.push('🎯 UNIQUE SELECTORS (Recommended):');
        uniqueSelectors.slice(0, 10).forEach((sel, index) => {
          let line = `${index + 1}. ${sel.selector}`;
          line += ` (${sel.type}, specificity: ${sel.specificity})`;
          if (sel.requiresLibrary) line += ` [Requires: ${sel.requiresLibrary}]`;
          lines.push(line);
        });
      }
      
      if (nonUniqueSelectors.length > 0 && options.includeNonUnique !== false) {
        lines.push('');
        lines.push(`⚠️ NON-UNIQUE SELECTORS (${nonUniqueSelectors.length} total):`);
        nonUniqueSelectors.slice(0, 5).forEach((sel, index) => {
          let line = `${index + 1}. ${sel.selector}`;
          line += ` (matches: ${sel.validation.matchCount})`;
          lines.push(line);
          
          // Show what else it matches
          if (sel.validation.matches && sel.validation.matches.length > 1) {
            sel.validation.matches.slice(1, 3).forEach(match => {
              lines.push(`   └─ Also matches: <${match.tag}> "${match.text || ''}"`)
            });
          }
        });
      }
      
      if (invalidSelectors.length > 0) {
        lines.push('');
        lines.push(`❌ INVALID SELECTORS (${invalidSelectors.length} total):`);
        invalidSelectors.slice(0, 3).forEach((sel, index) => {
          lines.push(`${index + 1}. ${sel.selector} - Error: ${sel.validation.error}`);
        });
      }
      
      lines.push('');
      }
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
      const bestSelector = target.selectors.find(s => s.validation?.isUnique) || target.selectors[0];
      lines.push('[SUGGESTED ACTIONS]');
      lines.push(`- Best selector: ${bestSelector.selector}`);
      lines.push(`- Test click: browser_action({action: "click", selector: "${bestSelector.selector}"})`);
      
      if (options.selectorMode === 'stable' && target.selectorStats?.unique === 0) {
        lines.push('- 💡 Try exhaustive mode for more selector options: selectorMode: "exhaustive"');
      }
      
      lines.push('');
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