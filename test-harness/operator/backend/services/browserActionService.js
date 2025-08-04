/**
 * BrowserActionService - Unified browser action execution service
 * 
 * This service consolidates all browser actions (navigate, click, type, etc.) into a single
 * implementation used by Director, Scout, and other services. It eliminates code duplication
 * and ensures consistent behavior across all browser interactions.
 */

// Shared shadow DOM traversal helpers
const shadowDOMHelpers = {
  // Deep selector that works across shadow boundaries
  querySelectorDeep(selector, root = document) {
    // Handle >> syntax for explicit shadow piercing
    if (selector.includes('>>')) {
      const parts = selector.split('>>').map(p => p.trim());
      let elements = [root];
      
      for (const part of parts) {
        const newElements = [];
        for (const el of elements) {
          const searchRoot = el.shadowRoot || el;
          newElements.push(...searchRoot.querySelectorAll(part));
        }
        elements = newElements;
      }
      
      return elements[0] || null;
    }
    
    // Fast path: try in the current root
    const lightMatch = root.querySelector(selector);
    if (lightMatch) return lightMatch;
    
    // Slow path: descend into every shadow root
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.shadowRoot) {
        const match = this.querySelectorDeep(selector, node.shadowRoot);
        if (match) return match;
      }
    }
    return null;
  },

  // Get scroll parent that crosses shadow boundaries
  getScrollParentAcrossShadows(node) {
    let cur = node;
    while (cur && cur !== document.documentElement) {
      const style = cur instanceof Element ? getComputedStyle(cur) : null;
      if (
        style &&
        /(auto|scroll|overlay)/.test(style.overflowY) &&
        cur.scrollHeight > cur.clientHeight
      ) {
        return cur;
      }
      // Step out through shadow boundary if needed
      const root = cur.getRootNode();
      cur = cur.parentElement || (root instanceof ShadowRoot ? root.host : null);
    }
    return document.scrollingElement || document.documentElement;
  },

  // Check if element is visible
  isElementVisible(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    return rect.width > 0 && 
           rect.height > 0 && 
           style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0';
  }
};

export class BrowserActionService {
  constructor(nodeExecutor, workflowId, browserStateService) {
    this.nodeExecutor = nodeExecutor;
    this.workflowId = workflowId;
    this.browserStateService = browserStateService;
  }

  /**
   * Resolve index value supporting numbers, negative indices, and keywords
   * @param {number|string} nth - The index value
   * @param {number} totalElements - Total number of elements
   * @returns {number} The resolved index
   */
  resolveIndex(nth, totalElements) {
    // Handle keywords
    if (nth === 'first') return 0;
    if (nth === 'last') return totalElements - 1;
    
    // Handle numeric indices
    const index = typeof nth === 'number' ? nth : parseInt(nth);
    
    if (isNaN(index)) {
      throw new Error(`Invalid index value: ${nth}. Expected number, "first", or "last".`);
    }
    
    // Handle negative indices (from end)
    if (index < 0) {
      return totalElements + index;
    }
    
    return index;
  }

  /**
   * Process selector for shadow DOM piercing
   * @param {string} selector - The original selector
   * @param {boolean} useShadowDOM - Whether to enable shadow DOM piercing
   * @returns {string} The processed selector
   */
  processShadowDOMSelector(selector, useShadowDOM) {
    // If useShadowDOM is false, return original selector
    if (!useShadowDOM) {
      return selector;
    }

    // Check if selector already has pierce prefix
    if (selector.startsWith('pierce/')) {
      return selector;
    }

    // Check if selector uses Playwright's >> syntax for shadow piercing
    if (selector.includes('>>')) {
      return selector;
    }

    // Add pierce prefix for shadow DOM traversal
    // In Playwright, we use >> to pierce shadow boundaries
    // Convert standard selectors to shadow-piercing selectors
    // Example: "div.shadow-host button" becomes "div.shadow-host >> button"
    
    // Parse selector to handle attribute selectors correctly
    // We need to avoid splitting spaces inside [], (), or quotes
    const parts = [];
    let current = '';
    let inBrackets = 0;
    let inParens = 0;
    let inQuotes = null;
    let escaped = false;
    
    for (let i = 0; i < selector.length; i++) {
      const char = selector[i];
      
      if (escaped) {
        current += char;
        escaped = false;
        continue;
      }
      
      if (char === '\\') {
        escaped = true;
        current += char;
        continue;
      }
      
      // Track quotes
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = char;
        current += char;
        continue;
      } else if (char === inQuotes) {
        inQuotes = null;
        current += char;
        continue;
      }
      
      // Track brackets and parens (only when not in quotes)
      if (!inQuotes) {
        if (char === '[') inBrackets++;
        else if (char === ']') inBrackets--;
        else if (char === '(') inParens++;
        else if (char === ')') inParens--;
        
        // Split on space only if not inside brackets, parens, or quotes
        if (char === ' ' && inBrackets === 0 && inParens === 0) {
          if (current.trim()) {
            parts.push(current.trim());
            current = '';
          }
          continue;
        }
      }
      
      current += char;
    }
    
    // Add last part
    if (current.trim()) {
      parts.push(current.trim());
    }
    
    // If only one part, no need for shadow piercing
    if (parts.length <= 1) {
      return selector;
    }
    
    // Join with >> for shadow piercing
    return parts.join(' >> ');
  }

  /**
   * Execute a browser action
   * @param {string} action - The action to perform
   * @param {object} config - Action-specific configuration
   * @returns {object} Result of the action
   */
  async execute(action, config = {}) {
    console.log(`[BrowserActionService] Executing ${action} with config:`, config);
    
    try {
      switch (action) {
        // Navigation actions
        case 'navigate':
          return await this.navigate(config);
        case 'back':
          return await this.goBack(config);
        case 'forward':
          return await this.goForward(config);
        case 'refresh':
          return await this.refresh(config);
          
        // Wait actions
        case 'wait':
          return await this.wait(config);
          
        // Tab management
        case 'openTab':
          return await this.openTab(config);
        case 'closeTab':
          return await this.closeTab(config);
        case 'switchTab':
          return await this.switchTab(config);
        case 'listTabs':
          return await this.listTabs(config);
          
        // State observation
        case 'getCurrentUrl':
          return await this.getCurrentUrl(config);
        case 'getTitle':
          return await this.getTitle(config);
          
        // Interaction
        case 'click':
          return await this.click(config);
        case 'type':
          return await this.type(config);
        case 'keypress':
          return await this.keypress(config);
        case 'clickAndWaitForPortal':
          return await this.clickAndWaitForPortal(config);
          
        // Scrolling
        case 'scrollIntoView':
          return await this.scrollIntoView(config);
        case 'scrollToRow':
          return await this.scrollToRow(config);
          
        // Profile management
        case 'listProfiles':
          return await this.listProfiles(config);
        case 'setProfile':
          return await this.setProfile(config);
        case 'snapshotProfile':
          return await this.snapshotProfile(config);
        case 'restoreProfile':
          return await this.restoreProfile(config);
        case 'loadProfile':
          return await this.loadProfile(config);
          
        default:
          throw new Error(`Unknown browser action: ${action}`);
      }
    } catch (error) {
      console.error(`[BrowserActionService] Error executing ${action}:`, error);
      throw error;
    }
  }

  /**
   * Resolve the target page based on tab name
   */
  async resolveTargetPage(tabName) {
    const stagehand = await this.nodeExecutor.getStagehand();
    
    // Default to active tab if not specified
    if (!tabName) {
      tabName = this.nodeExecutor.activeTabName || 'main';
    }
    
    // Handle main tab
    if (tabName === 'main') {
      return this.nodeExecutor.mainPage || stagehand.page;
    }
    
    // Check named tabs
    const page = this.nodeExecutor.stagehandPages?.[tabName];
    if (!page) {
      throw new Error(`Tab "${tabName}" does not exist. Use openTab first.`);
    }
    
    return page;
  }

  /**
   * Update browser state after actions
   */
  async updateBrowserState() {
    if (this.browserStateService && this.workflowId) {
      await this.nodeExecutor.updateBrowserStateInDB();
    }
  }

  // ===== Navigation Actions =====

  async navigate(config) {
    const { url, tabName, waitUntil = 'domcontentloaded' } = config;
    
    if (!url) {
      throw new Error('navigate action requires url parameter');
    }
    
    const page = await this.resolveTargetPage(tabName);
    await page.goto(url, { waitUntil });
    
    await this.updateBrowserState();
    
    return { 
      navigated: url,
      tab: tabName || this.nodeExecutor.activeTabName || 'main'
    };
  }

  async goBack(config) {
    const { tabName } = config;
    const page = await this.resolveTargetPage(tabName);
    
    await page.goBack();
    await this.updateBrowserState();
    
    return { 
      action: 'navigated back',
      tab: tabName || this.nodeExecutor.activeTabName || 'main'
    };
  }

  async goForward(config) {
    const { tabName } = config;
    const page = await this.resolveTargetPage(tabName);
    
    await page.goForward();
    await this.updateBrowserState();
    
    return { 
      action: 'navigated forward',
      tab: tabName || this.nodeExecutor.activeTabName || 'main'
    };
  }

  async refresh(config) {
    const { tabName } = config;
    const page = await this.resolveTargetPage(tabName);
    
    await page.reload();
    await this.updateBrowserState();
    
    return { 
      action: 'page refreshed',
      tab: tabName || this.nodeExecutor.activeTabName || 'main'
    };
  }

  // ===== Wait Actions =====

  async wait(config) {
    const { waitType, waitValue, tabName } = config;
    
    if (!waitType || waitValue === undefined) {
      throw new Error('wait action requires waitType and waitValue parameters');
    }
    
    const page = await this.resolveTargetPage(tabName);
    
    switch (waitType) {
      case 'time':
        const ms = parseInt(waitValue);
        await page.waitForTimeout(ms);
        return { 
          waited: `${ms}ms`,
          tab: tabName || this.nodeExecutor.activeTabName || 'main'
        };
        
      case 'selector':
        await page.waitForSelector(waitValue, { timeout: 30000 });
        return { 
          waited: `for selector "${waitValue}"`,
          tab: tabName || this.nodeExecutor.activeTabName || 'main'
        };
        
      case 'navigation':
        await page.waitForNavigation({ 
          waitUntil: waitValue || 'domcontentloaded' 
        });
        return { 
          waited: 'for navigation',
          tab: tabName || this.nodeExecutor.activeTabName || 'main'
        };
        
      default:
        throw new Error(`Unknown wait type: ${waitType}`);
    }
  }

  // ===== Tab Management =====

  async openTab(config) {
    const { url, name } = config;
    
    if (!name) {
      throw new Error('openTab requires a "name" parameter for tab tracking');
    }
    
    // Get Stagehand instance to access context
    const stagehand = await this.nodeExecutor.getStagehand();
    
    // Create new page through Stagehand's context
    const newPage = await stagehand.context.newPage();
    
    if (url) {
      await newPage.goto(url);
    }
    
    // Initialize stagehandPages if needed
    if (!this.nodeExecutor.stagehandPages) {
      this.nodeExecutor.stagehandPages = {};
    }
    
    // Check for name conflicts and auto-suffix
    let finalTabName = name;
    if (this.nodeExecutor.stagehandPages[finalTabName]) {
      let suffix = 2;
      while (this.nodeExecutor.stagehandPages[`${name}_${suffix}`]) {
        suffix++;
      }
      finalTabName = `${name}_${suffix}`;
      console.log(`[BrowserActionService] Tab name "${name}" already exists, using "${finalTabName}"`);
    }
    
    // Store the page reference
    this.nodeExecutor.stagehandPages[finalTabName] = newPage;
    
    // Make this the active tab
    this.nodeExecutor.activeTabName = finalTabName;
    
    await this.updateBrowserState();
    
    return { 
      opened: finalTabName,
      url: url || 'about:blank'
    };
  }

  async closeTab(config) {
    const { tabName } = config;
    
    if (!tabName || tabName === 'main') {
      throw new Error('Cannot close the main tab');
    }
    
    const page = this.nodeExecutor.stagehandPages?.[tabName];
    if (!page) {
      throw new Error(`Tab "${tabName}" does not exist`);
    }
    
    // Close the page
    await page.close();
    
    // Remove from tracked pages
    delete this.nodeExecutor.stagehandPages[tabName];
    
    // If this was the active tab, switch to main
    if (this.nodeExecutor.activeTabName === tabName) {
      this.nodeExecutor.activeTabName = 'main';
    }
    
    await this.updateBrowserState();
    
    return { 
      closed: tabName,
      activeTab: this.nodeExecutor.activeTabName
    };
  }

  async switchTab(config) {
    const { tabName } = config;
    
    if (!tabName) {
      throw new Error('switchTab requires tabName parameter');
    }
    
    // Verify tab exists
    if (tabName !== 'main' && !this.nodeExecutor.stagehandPages?.[tabName]) {
      throw new Error(`Tab "${tabName}" does not exist`);
    }
    
    // Update active tab
    this.nodeExecutor.activeTabName = tabName;
    
    await this.updateBrowserState();
    
    return { switchedTo: tabName };
  }

  async listTabs(config) {
    const tabs = [];
    
    // Add main tab
    tabs.push({
      name: 'main',
      active: this.nodeExecutor.activeTabName === 'main',
      url: this.nodeExecutor.mainPage ? this.nodeExecutor.mainPage.url() : 'unknown'
    });
    
    // Add named tabs
    if (this.nodeExecutor.stagehandPages) {
      for (const [name, page] of Object.entries(this.nodeExecutor.stagehandPages)) {
        tabs.push({
          name,
          active: this.nodeExecutor.activeTabName === name,
          url: page.url()
        });
      }
    }
    
    return { tabs };
  }

  // ===== State Observation =====

  async getCurrentUrl(config) {
    const { tabName } = config;
    const page = await this.resolveTargetPage(tabName);
    
    return { 
      url: page.url(),
      tab: tabName || this.nodeExecutor.activeTabName || 'main'
    };
  }

  async getTitle(config) {
    const { tabName } = config;
    const page = await this.resolveTargetPage(tabName);
    
    return { 
      title: await page.title(),
      tab: tabName || this.nodeExecutor.activeTabName || 'main'
    };
  }

  // ===== Interaction Actions =====

  async click(config) {
    // Enhanced defaults: Smart visibility filtering + auto-scrolling (matches nodeExecutor)
    const visibleOnly = config.visibleOnly !== false;        // Default: true
    const includeScrollable = config.includeScrollable !== false; // Default: true  
    const autoScroll = config.autoScroll !== false;          // Default: true
    const inViewportOnly = config.inViewportOnly === true;   // Default: false
    
    const { selector, tabName, timeout = 10000, useShadowDOM = false, nth } = config;
    
    if (!selector) {
      throw new Error('click action requires selector parameter');
    }
    
    const page = await this.resolveTargetPage(tabName);
    
    // Handle shadow DOM piercing
    const effectiveSelector = this.processShadowDOMSelector(selector, useShadowDOM);
    
    // Enhanced nth parameter handling with smart defaults (matches nodeExecutor)
    if (nth !== undefined) {
      // Phase 1: Get actionable elements (skip CSS hidden, include scrollable)
      const actionableIndexes = await page.evaluate(({ selector, filters }) => {
        const { visibleOnly, includeScrollable, inViewportOnly } = filters;
        const allElements = document.querySelectorAll(selector);
        const actionable = [];
        
        allElements.forEach((el, originalIndex) => {
          // Skip CSS hidden elements (can't be scrolled into existence)
          if (visibleOnly) {
            const styles = window.getComputedStyle(el);
            if (styles.display === 'none' || styles.visibility === 'hidden' || styles.opacity === '0') {
              return;
            }
          }
          
          // For viewport-only mode, check current viewport
          if (inViewportOnly) {
            const rect = el.getBoundingClientRect();
            const isInViewport = (
              rect.top >= 0 &&
              rect.left >= 0 &&
              rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
              rect.right <= (window.innerWidth || document.documentElement.clientWidth)
            );
            if (!isInViewport) {
              return;
            }
          }
          
          // Include elements that can be scrolled to (have dimensions)
          if (includeScrollable || inViewportOnly) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              actionable.push(originalIndex);
            }
          } else if (visibleOnly) {
            actionable.push(originalIndex);
          }
        });
        
        return actionable;
      }, { selector: effectiveSelector, filters: { visibleOnly, includeScrollable, inViewportOnly } });
      
      // Validate nth index against actionable elements
      const index = this.resolveIndex(nth, actionableIndexes.length);
      
      if (index >= actionableIndexes.length) {
        const filterText = (visibleOnly || inViewportOnly) ? 
          ` (after filtering for ${visibleOnly ? 'visible' : ''}${visibleOnly && inViewportOnly ? ' and ' : ''}${inViewportOnly ? 'in-viewport' : ''} elements)` : '';
        throw new Error(
          `No element at index ${nth} for selector: ${selector}. Found ${actionableIndexes.length} actionable elements${filterText}.`
        );
      }
      
      // Get the actual DOM index to target
      const targetDomIndex = actionableIndexes[index];
      
      // Phase 2: Click the target element with auto-scroll
      const targetElement = await page.locator(effectiveSelector).nth(targetDomIndex);
      
      // Auto-scroll if element is not in viewport and auto-scroll is enabled
      if (autoScroll) {
        await targetElement.scrollIntoViewIfNeeded();
        // Brief wait for scroll to complete
        await page.waitForTimeout(100);
      }
      
      await targetElement.click();
      
      // Enhanced result reporting
      const result = {
        clicked: selector,
        nth: index,
        targetDomIndex: targetDomIndex,
        totalElements: await page.locator(effectiveSelector).count(),
        actionableElements: actionableIndexes.length
      };
      
      if (visibleOnly || inViewportOnly || includeScrollable) {
        result.filteredBy = [];
        if (visibleOnly) result.filteredBy.push('visible');
        if (inViewportOnly) result.filteredBy.push('inViewport');
        if (includeScrollable) result.filteredBy.push('scrollable');
        if (autoScroll) result.scrolled = true;
      }
      
      return result;
    }
    
    // Wait for element to be clickable
    await page.waitForSelector(effectiveSelector, { 
      timeout,
      state: 'visible'
    });
    
    // For shadow DOM, we need to handle visibility-first matching
    if (useShadowDOM) {
      // Use evaluate to find and click the first visible element
      const clicked = await page.evaluate((params) => {
        const { sel, useShadowDOM } = params;
        
        // Helper to query all elements with shadow DOM support
        const findAllElements = (selector) => {
          if (!useShadowDOM) {
            return Array.from(document.querySelectorAll(selector));
          }
          
          // If selector has >> syntax, use explicit shadow piercing
          if (selector.includes('>>')) {
            const parts = selector.split('>>').map(p => p.trim());
            let elements = [document];
            
            for (let i = 0; i < parts.length; i++) {
              const part = parts[i];
              const newElements = [];
              
              for (const el of elements) {
                if (i === parts.length - 1) {
                  // Last part - select all matching elements
                  const root = el.shadowRoot || el;
                  newElements.push(...root.querySelectorAll(part));
                } else {
                  // Intermediate part - continue traversing
                  const root = el.shadowRoot || el;
                  const found = root.querySelector(part);
                  if (found) newElements.push(found);
                }
              }
              elements = newElements;
            }
            
            return elements;
          }
          
          // For selectors without >>, do a deep search through all shadow roots
          const results = [];
          
          // Helper to recursively search through shadow DOM
          const searchDeep = (root) => {
            // Search in current root
            results.push(...root.querySelectorAll(selector));
            
            // Search in all shadow roots
            const walker = document.createTreeWalker(
              root,
              NodeFilter.SHOW_ELEMENT,
              null,
              false
            );
            
            let node;
            while (node = walker.nextNode()) {
              if (node.shadowRoot) {
                searchDeep(node.shadowRoot);
              }
            }
          };
          
          searchDeep(document);
          return results;
        };
        
        // Helper to check if element is visible
        const isVisible = (element) => {
          if (!element) return false;
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          
          // Basic visibility checks
          if (rect.width <= 0 || 
              rect.height <= 0 || 
              style.display === 'none' || 
              style.visibility === 'hidden' || 
              style.opacity === '0') {
            return false;
          }
          
          // Check if element is within viewport
          const inViewport = rect.top < window.innerHeight && 
                           rect.bottom > 0 && 
                           rect.left < window.innerWidth && 
                           rect.right > 0;
          
          if (!inViewport) {
            return false;
          }
          
          // For shadow DOM elements, also check if the shadow host is visible
          const root = element.getRootNode();
          if (root instanceof ShadowRoot && root.host) {
            return isVisible(root.host);
          }
          
          return true;
        };
        
        // Find all matching elements
        const elements = findAllElements(sel);
        console.log(`[Shadow DOM Click] Found ${elements.length} elements matching selector: ${sel}`);
        
        // Debug: log visibility status of each element
        elements.forEach((el, index) => {
          const visible = isVisible(el);
          const rect = el.getBoundingClientRect();
          console.log(`[Shadow DOM Click] Element ${index}: ${el.tagName}, visible=${visible}, rect=`, {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height
          });
        });
        
        // Find first visible element
        const visibleElement = elements.find(el => isVisible(el));
        
        if (visibleElement) {
          visibleElement.click();
          return { success: true, count: elements.length, clickedIndex: elements.indexOf(visibleElement) };
        }
        
        return { success: false, count: elements.length, error: 'No visible element found' };
      }, { sel: effectiveSelector, useShadowDOM });
      
      if (!clicked.success) {
        throw new Error(`Failed to click: ${clicked.error} (found ${clicked.count} elements)`);
      }
      
      // Log if we clicked something other than the first element
      if (clicked.clickedIndex > 0) {
        console.log(`[BrowserActionService] Clicked element at index ${clicked.clickedIndex} (first ${clicked.clickedIndex} were not visible)`);
      }
    } else {
      // Standard click for non-shadow DOM
      try {
        await page.click(effectiveSelector);
      } catch (error) {
        // Enhance error message with actionability info
        if (error.message.includes('Timeout') && error.message.includes('exceeded')) {
          const elements = await page.$$(effectiveSelector);
          
          if (elements.length === 0) {
            throw new Error(`No elements found matching selector: ${selector}`);
          }
          
          // Check first element for visibility issues
          const firstElement = elements[0];
          const boundingBox = await firstElement.boundingBox();
          
          if (!boundingBox || boundingBox.height === 0) {
            // Try to find scroll container
            const scrollContainer = await page.evaluate((sel) => {
              const element = document.querySelector(sel);
              let parent = element?.parentElement;
              while (parent) {
                const style = getComputedStyle(parent);
                if (style.overflow === 'auto' || style.overflow === 'scroll') {
                  return parent.className || parent.id || parent.tagName;
                }
                parent = parent.parentElement;
              }
              return null;
            }, effectiveSelector);
            
            throw new Error(
              `Found ${elements.length} elements but they have zero height (virtual scrolling). ` +
              (scrollContainer ? 
                `Solution: Use scrollIntoView with scrollContainer: "${scrollContainer}" before clicking. ` :
                `Solution: Use scrollIntoView before clicking. `) +
              `For Gmail search results: scrollContainer: "div.Cp"`
            );
          } else {
            throw new Error(
              `Found ${elements.length} elements but none are visible. ` +
              `Element may be hidden or outside viewport. ` +
              `Try using scrollIntoView first.`
            );
          }
        }
        
        throw error;
      }
    }
    
    return { 
      clicked: selector,
      effectiveSelector: effectiveSelector !== selector ? effectiveSelector : undefined,
      tab: tabName || this.nodeExecutor.activeTabName || 'main'
    };
  }

  async type(config) {
    // Enhanced defaults: Smart visibility filtering + auto-scrolling (matches nodeExecutor)
    const visibleOnly = config.visibleOnly !== false;        // Default: true
    const includeScrollable = config.includeScrollable !== false; // Default: true  
    const autoScroll = config.autoScroll !== false;          // Default: true
    const inViewportOnly = config.inViewportOnly === true;   // Default: false
    
    const { selector, text, tabName, timeout = 10000, useShadowDOM = false, nth } = config;
    
    if (!selector || text === undefined) {
      throw new Error('type action requires selector and text parameters');
    }
    
    const page = await this.resolveTargetPage(tabName);
    
    // Handle shadow DOM piercing
    const effectiveSelector = this.processShadowDOMSelector(selector, useShadowDOM);
    
    // Enhanced nth parameter handling with smart defaults (matches nodeExecutor)
    if (nth !== undefined) {
      // Phase 1: Get actionable elements (skip CSS hidden, include scrollable)
      const actionableIndexes = await page.evaluate(({ selector, filters }) => {
        const { visibleOnly, includeScrollable, inViewportOnly } = filters;
        const allElements = document.querySelectorAll(selector);
        const actionable = [];
        
        allElements.forEach((el, originalIndex) => {
          // Skip CSS hidden elements (can't be scrolled into existence)
          if (visibleOnly) {
            const styles = window.getComputedStyle(el);
            if (styles.display === 'none' || styles.visibility === 'hidden' || styles.opacity === '0') {
              return;
            }
          }
          
          // For viewport-only mode, check current viewport
          if (inViewportOnly) {
            const rect = el.getBoundingClientRect();
            const isInViewport = (
              rect.top >= 0 &&
              rect.left >= 0 &&
              rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
              rect.right <= (window.innerWidth || document.documentElement.clientWidth)
            );
            if (!isInViewport) {
              return;
            }
          }
          
          // Include elements that can be scrolled to (have dimensions)
          if (includeScrollable || inViewportOnly) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              actionable.push(originalIndex);
            }
          } else if (visibleOnly) {
            actionable.push(originalIndex);
          }
        });
        
        return actionable;
      }, { selector: effectiveSelector, filters: { visibleOnly, includeScrollable, inViewportOnly } });
      
      // Validate nth index against actionable elements
      const index = this.resolveIndex(nth, actionableIndexes.length);
      
      if (index >= actionableIndexes.length) {
        const filterText = (visibleOnly || inViewportOnly) ? 
          ` (after filtering for ${visibleOnly ? 'visible' : ''}${visibleOnly && inViewportOnly ? ' and ' : ''}${inViewportOnly ? 'in-viewport' : ''} elements)` : '';
        throw new Error(
          `No element at index ${nth} for selector: ${selector}. Found ${actionableIndexes.length} actionable elements${filterText}.`
        );
      }
      
      // Get the actual DOM index to target
      const targetDomIndex = actionableIndexes[index];
      
      // Phase 2: Type into the target element with auto-scroll
      const targetElement = await page.locator(effectiveSelector).nth(targetDomIndex);
      
      // Auto-scroll if element is not in viewport and auto-scroll is enabled
      if (autoScroll) {
        await targetElement.scrollIntoViewIfNeeded();
        // Brief wait for scroll to complete
        await page.waitForTimeout(100);
      }
      
      await targetElement.fill(text);
      
      // Enhanced result reporting
      const result = {
        typed: text,
        selector: selector,
        nth: index,
        targetDomIndex: targetDomIndex,
        totalElements: await page.locator(effectiveSelector).count(),
        actionableElements: actionableIndexes.length
      };
      
      if (visibleOnly || inViewportOnly || includeScrollable) {
        result.filteredBy = [];
        if (visibleOnly) result.filteredBy.push('visible');
        if (inViewportOnly) result.filteredBy.push('inViewport');
        if (includeScrollable) result.filteredBy.push('scrollable');
        if (autoScroll) result.scrolled = true;
      }
      
      return result;
    }
    
    // Wait for element
    await page.waitForSelector(effectiveSelector, { 
      timeout,
      state: 'visible' 
    });
    
    // For shadow DOM, we need visibility-first matching
    if (useShadowDOM) {
      // Use the same visibility-first logic as click
      const typed = await page.evaluate((params) => {
        const { sel, text, useShadowDOM } = params;
        
        // Reuse the same helper functions
        const findAllElements = (selector) => {
          if (!useShadowDOM) {
            return Array.from(document.querySelectorAll(selector));
          }
          
          // If selector has >> syntax, use explicit shadow piercing
          if (selector.includes('>>')) {
            const parts = selector.split('>>').map(p => p.trim());
            let elements = [document];
            
            for (let i = 0; i < parts.length; i++) {
              const part = parts[i];
              const newElements = [];
              
              for (const el of elements) {
                if (i === parts.length - 1) {
                  const root = el.shadowRoot || el;
                  newElements.push(...root.querySelectorAll(part));
                } else {
                  const root = el.shadowRoot || el;
                  const found = root.querySelector(part);
                  if (found) newElements.push(found);
                }
              }
              elements = newElements;
            }
            
            return elements;
          }
          
          // For selectors without >>, do a deep search through all shadow roots
          const results = [];
          
          const searchDeep = (root) => {
            results.push(...root.querySelectorAll(selector));
            
            const walker = document.createTreeWalker(
              root,
              NodeFilter.SHOW_ELEMENT,
              null,
              false
            );
            
            let node;
            while (node = walker.nextNode()) {
              if (node.shadowRoot) {
                searchDeep(node.shadowRoot);
              }
            }
          };
          
          searchDeep(document);
          return results;
        };
        
        const isVisible = (element) => {
          if (!element) return false;
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          
          // Basic visibility checks
          if (rect.width <= 0 || 
              rect.height <= 0 || 
              style.display === 'none' || 
              style.visibility === 'hidden' || 
              style.opacity === '0') {
            return false;
          }
          
          // Check if element is within viewport
          const inViewport = rect.top < window.innerHeight && 
                           rect.bottom > 0 && 
                           rect.left < window.innerWidth && 
                           rect.right > 0;
          
          if (!inViewport) {
            return false;
          }
          
          // For shadow DOM elements, also check if the shadow host is visible
          const root = element.getRootNode();
          if (root instanceof ShadowRoot && root.host) {
            return isVisible(root.host);
          }
          
          return true;
        };
        
        // Find first visible element
        const elements = findAllElements(sel);
        const visibleElement = elements.find(el => isVisible(el));
        
        if (visibleElement) {
          // Clear and type
          visibleElement.focus();
          visibleElement.select ? visibleElement.select() : visibleElement.setSelectionRange(0, visibleElement.value.length);
          document.execCommand('delete');
          visibleElement.value = text;
          visibleElement.dispatchEvent(new Event('input', { bubbles: true }));
          visibleElement.dispatchEvent(new Event('change', { bubbles: true }));
          return { success: true, count: elements.length };
        }
        
        return { success: false, count: elements.length, error: 'No visible element found' };
      }, { sel: effectiveSelector, text, useShadowDOM });
      
      if (!typed.success) {
        throw new Error(`Failed to type: ${typed.error} (found ${typed.count} elements)`);
      }
    } else {
      // Standard type for non-shadow DOM
      await page.click(effectiveSelector, { clickCount: 3 });
      await page.type(effectiveSelector, text);
    }
    
    return { 
      typed: text,
      selector,
      effectiveSelector: effectiveSelector !== selector ? effectiveSelector : undefined,
      tab: tabName || this.nodeExecutor.activeTabName || 'main'
    };
  }

  async keypress(config) {
    const { key, modifiers = [], tabName } = config;
    
    if (!key) {
      throw new Error('keypress action requires key parameter');
    }
    
    // Validate modifiers
    const validModifiers = ['Shift', 'Alt', 'Control', 'Meta', 'ControlOrMeta'];
    const invalidModifiers = modifiers.filter(mod => !validModifiers.includes(mod));
    if (invalidModifiers.length > 0) {
      throw new Error(
        `Invalid modifiers: ${invalidModifiers.join(', ')}. ` +
        `Valid options: ${validModifiers.join(', ')}`
      );
    }
    
    const page = await this.resolveTargetPage(tabName);
    
    // Ensure page has focus for reliable key event handling
    await page.bringToFront();
    
    // Try to focus body as fallback if no element is focused
    const currentFocus = await page.evaluate(() => document.activeElement?.tagName);
    if (!currentFocus || currentFocus === 'HTML') {
      try {
        await page.focus('body');
      } catch (focusError) {
        // Fallback: click body to ensure focus
        await page.click('body');
      }
    }
    
    // Build key combination
    const keyCombo = modifiers.length > 0 ? `${modifiers.join('+')}+${key}` : key;
    
    // Multi-tier approach for maximum headless compatibility
    console.log(`[KEYPRESS] Attempting keypress: ${keyCombo}`);
    
    try {
      // Method 1: Locator-based approach (recommended by Playwright)
      const bodyLocator = page.locator('body');
      await bodyLocator.press(keyCombo);
      console.log('[KEYPRESS] Locator press succeeded');
    } catch (locatorError) {
      console.log('[KEYPRESS] Locator press failed, trying page keyboard:', locatorError.message);
      
      try {
        // Method 2: Page-level keyboard press
        await page.keyboard.press(keyCombo);
        console.log('[KEYPRESS] Page keyboard press succeeded');
      } catch (keyboardError) {
        console.log('[KEYPRESS] Page keyboard failed, using direct event dispatch:', keyboardError.message);
        
        // Method 3: CDP Raw Input (generates trusted events)
        try {
          console.log('[KEYPRESS] Using CDP Raw Input for trusted events');
          const client = await page.context().newCDPSession(page);
          
          // Parse the key combination
          const parts = keyCombo.split('+');
          const key = parts[parts.length - 1];
          const modifiers = parts.slice(0, -1);
          
          // Build modifier flags for CDP
          const modifierFlags = [];
          if (modifiers.includes('Alt')) modifierFlags.push('Alt');
          if (modifiers.includes('Control') || modifiers.includes('ControlOrMeta')) modifierFlags.push('Ctrl');
          if (modifiers.includes('Meta') || modifiers.includes('ControlOrMeta')) modifierFlags.push('Meta');
          if (modifiers.includes('Shift')) modifierFlags.push('Shift');
          
          // Map key to CDP key code
          const getKeyCode = (key) => {
            if (key.length === 1) {
              return key.toUpperCase().charCodeAt(0);
            }
            const keyMap = {
              'Enter': 13, 'Escape': 27, 'Tab': 9, 'Space': 32,
              'ArrowUp': 38, 'ArrowDown': 40, 'ArrowLeft': 37, 'ArrowRight': 39,
              'F1': 112, 'F2': 113, 'F3': 114, 'F4': 115, 'F5': 116,
              'F6': 117, 'F7': 118, 'F8': 119, 'F9': 120, 'F10': 121,
              'F11': 122, 'F12': 123
            };
            return keyMap[key] || key.charCodeAt(0);
          };
          
          const keyCode = getKeyCode(key);
          const keyText = key.length === 1 ? key : '';
          
          const modifierBits = modifierFlags.reduce((acc, mod) => {
            const modMap = { Alt: 1, Ctrl: 2, Meta: 4, Shift: 8 };
            return acc | (modMap[mod] || 0);
          }, 0);
          
          const code = key.length === 1 ? `Key${key.toUpperCase()}` : key;
          
          // 1️⃣ rawKeyDown → becomes DOM keydown (CRITICAL FIX)
          await client.send('Input.dispatchKeyEvent', {
            type: 'rawKeyDown',  // Changed from 'keyDown' to 'rawKeyDown'
            key: key,
            code: code,
            keyCode: keyCode,
            windowsVirtualKeyCode: keyCode,
            modifiers: modifierBits
          });
          
          // 2️⃣ char → becomes DOM keypress (for printable characters)
          if (key.length === 1) {
            await client.send('Input.dispatchKeyEvent', {
              type: 'char',
              key: key,
              code: code,
              text: keyText,
              unmodifiedText: keyText,  // Added unmodifiedText field
              keyCode: keyCode,
              windowsVirtualKeyCode: keyCode,
              modifiers: modifierBits
            });
          }
          
          // 3️⃣ keyUp → becomes DOM keyup
          await client.send('Input.dispatchKeyEvent', {
            type: 'keyUp',
            key: key,
            code: code,
            keyCode: keyCode,
            windowsVirtualKeyCode: keyCode,
            modifiers: modifierBits
          });
          
          await client.detach();
          console.log('[KEYPRESS] CDP Raw Input completed successfully');
          
        } catch (cdpError) {
          console.log('[KEYPRESS] CDP failed, falling back to direct dispatch:', cdpError.message);
          
          // Method 4: Enhanced JavaScript event dispatch (with full sequence)
          await page.evaluate((keyCombo) => {
            // Parse the key combination
            const parts = keyCombo.split('+');
            const key = parts[parts.length - 1];
            const modifiers = parts.slice(0, -1);
            
            const eventOptions = {
              key: key,
              code: key.length === 1 ? `Key${key.toUpperCase()}` : key,
              keyCode: key.length === 1 ? key.toUpperCase().charCodeAt(0) : 
                      key === 'Enter' ? 13 : key === 'Escape' ? 27 : 0,
              ctrlKey: modifiers.includes('Control') || modifiers.includes('ControlOrMeta'),
              altKey: modifiers.includes('Alt'),
              shiftKey: modifiers.includes('Shift'),
              metaKey: modifiers.includes('Meta') || modifiers.includes('ControlOrMeta'),
              bubbles: true,
              cancelable: true
            };
            
            const target = document.activeElement || document.body;
            
            // Dispatch full three-phase sequence
            target.dispatchEvent(new KeyboardEvent('keydown', eventOptions));
            
            // Add keypress for character keys (deprecated but some sites still use)
            if (key.length === 1) {
              target.dispatchEvent(new KeyboardEvent('keypress', eventOptions));
            }
            
            target.dispatchEvent(new KeyboardEvent('keyup', eventOptions));
            
            console.log('Enhanced keyboard events dispatched to:', target.tagName, eventOptions);
          }, keyCombo);
          console.log('[KEYPRESS] Enhanced event dispatch completed');
        }
      }
    }
    
    // Capture debugging information
    const debugInfo = await page.evaluate(() => ({
      activeElement: {
        tag: document.activeElement?.tagName || 'none',
        id: document.activeElement?.id || '',
        className: document.activeElement?.className || ''
      },
      hasFocus: document.hasFocus(),
      url: window.location.href
    }));
    
    return { 
      pressed: keyCombo,
      key,
      modifiers,
      focus: debugInfo,
      tab: tabName || this.nodeExecutor.activeTabName || 'main'
    };
  }

  // ===== Compound Actions =====

  async clickAndWaitForPortal(config) {
    const { 
      selector, 
      tabName, 
      timeout = 10000, 
      useShadowDOM = false,
      waitTimeout = 1000,
      portalWaitTimeout = 2000,
      returnPortalSelector = true
    } = config;
    
    if (!selector) {
      throw new Error('clickAndWaitForPortal action requires selector parameter');
    }
    
    const page = await this.resolveTargetPage(tabName);
    
    // Store baseline DOM state before click
    const baselineSnapshot = await page.evaluate(() => {
      // Get current body-level elements
      const bodyChildren = [];
      const body = document.body;
      if (body) {
        for (const child of body.children) {
          if (child.nodeType === 1) { // Element node
            bodyChildren.push({
              tag: child.tagName.toLowerCase(),
              id: child.id || '',
              className: child.className || '',
              key: `${child.tagName}-${child.id}-${child.className}`
            });
          }
        }
      }
      return bodyChildren;
    });
    
    // Perform the click
    const clickResult = await this.click({
      selector,
      tabName,
      timeout,
      useShadowDOM
    });
    
    // Wait for portal to appear
    await page.waitForTimeout(waitTimeout);
    
    // Check for new portal elements
    const portalCheck = await page.evaluate((baseline) => {
      const newPortals = [];
      const body = document.body;
      
      if (body) {
        // Build set of baseline keys
        const baselineKeys = new Set(baseline.map(el => el.key));
        
        // Check current body children
        for (const child of body.children) {
          if (child.nodeType === 1) {
            const key = `${child.tagName}-${child.id}-${child.className}`;
            
            // Is this element new?
            if (!baselineKeys.has(key)) {
              // Check if it looks like a portal
              const tag = child.tagName.toLowerCase();
              const className = child.className || '';
              const role = child.getAttribute('role') || '';
              
              const isPortal = 
                // Class-based detection
                /portal|modal|overlay|dialog|popup|dropdown|tooltip/i.test(className) ||
                // Role-based detection
                ['dialog', 'menu', 'listbox', 'tooltip', 'alertdialog'].includes(role) ||
                // Style-based detection
                (window.getComputedStyle(child).position === 'fixed' && 
                 parseInt(window.getComputedStyle(child).zIndex) > 100);
              
              if (isPortal || newPortals.length === 0) { // Include first new element even if not portal-like
                // Generate selector hints
                let selector = tag;
                if (child.id) {
                  selector = `#${child.id}`;
                } else if (child.className) {
                  const firstClass = child.className.split(' ')[0];
                  selector = `${tag}.${firstClass}`;
                }
                
                newPortals.push({
                  tag,
                  id: child.id || '',
                  className,
                  role,
                  selector,
                  isPortal,
                  visible: window.getComputedStyle(child).display !== 'none'
                });
              }
            }
          }
        }
      }
      
      return newPortals;
    }, baselineSnapshot);
    
    if (portalCheck.length === 0) {
      // No new portals found, wait a bit more and check again
      await page.waitForTimeout(portalWaitTimeout - waitTimeout);
      
      const secondCheck = await page.evaluate((baseline) => {
        const newPortals = [];
        const body = document.body;
        
        if (body) {
          const baselineKeys = new Set(baseline.map(el => el.key));
          
          for (const child of body.children) {
            if (child.nodeType === 1) {
              const key = `${child.tagName}-${child.id}-${child.className}`;
              
              if (!baselineKeys.has(key)) {
                const tag = child.tagName.toLowerCase();
                const className = child.className || '';
                const role = child.getAttribute('role') || '';
                
                const isPortal = 
                  /portal|modal|overlay|dialog|popup|dropdown|tooltip/i.test(className) ||
                  ['dialog', 'menu', 'listbox', 'tooltip', 'alertdialog'].includes(role) ||
                  (window.getComputedStyle(child).position === 'fixed' && 
                   parseInt(window.getComputedStyle(child).zIndex) > 100);
                
                if (isPortal || newPortals.length === 0) {
                  let selector = tag;
                  if (child.id) {
                    selector = `#${child.id}`;
                  } else if (child.className) {
                    const firstClass = child.className.split(' ')[0];
                    selector = `${tag}.${firstClass}`;
                  }
                  
                  newPortals.push({
                    tag,
                    id: child.id || '',
                    className,
                    role,
                    selector,
                    isPortal,
                    visible: window.getComputedStyle(child).display !== 'none'
                  });
                }
              }
            }
          }
        }
        
        return newPortals;
      }, baselineSnapshot);
      
      if (secondCheck.length > 0) {
        portalCheck.push(...secondCheck);
      }
    }
    
    // Build result
    const result = {
      clicked: clickResult.clicked,
      portalsFound: portalCheck.length,
      portals: portalCheck,
      tab: tabName || this.nodeExecutor.activeTabName || 'main'
    };
    
    // Add primary portal selector if requested
    if (returnPortalSelector && portalCheck.length > 0) {
      // Prefer visible portals that look like actual portals
      const bestPortal = portalCheck.find(p => p.visible && p.isPortal) || 
                         portalCheck.find(p => p.isPortal) ||
                         portalCheck[0];
      
      result.portalSelector = bestPortal.selector;
    }
    
    
    return result;
  }

  // ===== Scrolling Actions =====

  /**
   * Auto-detect common scroll containers on the page
   */
  async detectScrollContainer(page) {
    const containers = await page.evaluate(() => {
      // Common scroll container patterns
      const selectors = [
        // React Virtualized
        '.ReactVirtualized__Grid',
        '.ReactVirtualized__List',
        '.ReactVirtualized__Table',
        '.ReactVirtualized__Collection',
        
        // AG-Grid
        '.ag-body-viewport',
        '.ag-center-cols-viewport',
        
        // Generic virtualized/infinite scroll
        '[role="grid"]',
        '[data-virtualized="true"]',
        '.virtual-scroll',
        '.infinite-scroll',
        '.scrollable-container',
        
        // Common UI frameworks
        '.ant-table-body',  // Ant Design
        '.MuiDataGrid-virtualScroller',  // Material UI
        '.el-table__body-wrapper',  // Element UI
        
        // Custom patterns
        '[style*="overflow: auto"]',
        '[style*="overflow-y:auto"]',
        '[style*="overflow-y: auto"]',
        '[style*="overflow:auto"]'
      ];
      
      // Find first matching container that has scrollable content
      for (const selector of selectors) {
        try {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            // Check if element is scrollable
            if (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth) {
              // Verify it's not the body/html
              if (el !== document.body && el !== document.documentElement) {
                return {
                  found: true,
                  selector,
                  info: {
                    scrollHeight: el.scrollHeight,
                    clientHeight: el.clientHeight,
                    hasVerticalScroll: el.scrollHeight > el.clientHeight,
                    hasHorizontalScroll: el.scrollWidth > el.clientWidth
                  }
                };
              }
            }
          }
        } catch (e) {
          // Invalid selector, continue
        }
      }
      
      return { found: false };
    });
    
    if (containers.found) {
      console.log(`[BrowserActionService] Auto-detected scroll container: ${containers.selector}`, containers.info);
      return containers.selector;
    }
    
    return null;
  }

  async scrollIntoView(config) {
    let { 
      scrollIntoViewSelector, 
      scrollContainer,
      scrollBehavior = 'smooth',
      scrollBlock = 'start', 
      scrollInline = 'nearest',
      scrollDirection = 'down',  // NEW: 'up', 'down', or 'both'
      tabName,
      timeout = 10000,
      maxScrollAttempts = 30,
      useShadowDOM = false
    } = config;
    
    if (!scrollIntoViewSelector) {
      throw new Error('scrollIntoView action requires scrollIntoViewSelector parameter');
    }
    
    // Check for common pseudo-selectors that won't work with querySelector
    const pseudoSelectors = [':has-text(', ':text(', ':visible', ':hidden', ':contains('];
    const foundPseudo = pseudoSelectors.find(pseudo => scrollIntoViewSelector.includes(pseudo));
    if (foundPseudo) {
      throw new Error(
        `Playwright/jQuery pseudo-selectors like "${foundPseudo}" are not supported. ` +
        `The selector must be valid CSS that works with document.querySelector(). ` +
        `For text-based selection, use dom_search first to find the element, then use its ID or a standard CSS selector.`
      );
    }
    
    const page = await this.resolveTargetPage(tabName);
    const startTime = Date.now();
    
    // Auto-detect scroll container if not provided
    if (!scrollContainer) {
      const detected = await this.detectScrollContainer(page);
      if (detected) {
        scrollContainer = detected;
        console.log(`[BrowserActionService] Using auto-detected container: ${scrollContainer}`);
      }
    }
    
    // Handle shadow DOM piercing
    const effectiveSelector = this.processShadowDOMSelector(scrollIntoViewSelector, useShadowDOM);
    
    // Strategy 1: Try direct scrollIntoView if element exists
    try {
      await page.waitForSelector(effectiveSelector, { timeout: 2000, state: 'attached' });
      
      const scrollResult = await page.evaluate((params) => {
        const { sel, options, useShadowDOM } = params;
        
        // Inline the deep selector function
        const querySelectorDeep = (selector, root = document) => {
          // Handle >> syntax for explicit shadow piercing
          if (selector.includes('>>')) {
            const parts = selector.split('>>').map(p => p.trim());
            let elements = [root];
            
            for (const part of parts) {
              const newElements = [];
              for (const el of elements) {
                const searchRoot = el.shadowRoot || el;
                newElements.push(...searchRoot.querySelectorAll(part));
              }
              elements = newElements;
            }
            
            return elements[0] || null;
          }
          
          // Fast path: try in the current root
          const lightMatch = root.querySelector(selector);
          if (lightMatch) return lightMatch;
          
          // Slow path: descend into every shadow root
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
          let node;
          while ((node = walker.nextNode())) {
            if (node.shadowRoot) {
              const match = querySelectorDeep(selector, node.shadowRoot);
              if (match) return match;
            }
          }
          return null;
        };
        
        // Find element using appropriate method
        const element = useShadowDOM ? 
          querySelectorDeep(sel) :
          document.querySelector(sel);
        
        if (element) {
          console.log('[scrollIntoView] Found element:', element.tagName, element.className);
          
          // Get the element's position before scroll
          const rectBefore = element.getBoundingClientRect();
          console.log('[scrollIntoView] Position before:', { top: rectBefore.top, bottom: rectBefore.bottom });
          
          element.scrollIntoView(options);
          
          // Get position after scroll
          const rectAfter = element.getBoundingClientRect();
          console.log('[scrollIntoView] Position after:', { top: rectAfter.top, bottom: rectAfter.bottom });
          
          return { success: true, rectAfter };
        }
        
        console.log('[scrollIntoView] Element not found for selector:', sel);
        return { success: false };
      }, {
        sel: effectiveSelector,
        options: {
          behavior: scrollBehavior,
          block: scrollBlock, 
          inline: scrollInline
        },
        useShadowDOM
      });
      
      if (scrollResult.success) {
        // Wait for scroll animation to complete and element to be visible
        await page.waitForTimeout(300); // Brief pause for smooth scrolling
        await page.waitForSelector(effectiveSelector, { timeout: timeout - 2300, state: 'visible' });
        
        return {
          scrolledIntoView: scrollIntoViewSelector,
          method: 'direct',
          behavior: scrollBehavior,
          finalPosition: scrollResult.rectAfter,
          tab: tabName || this.nodeExecutor.activeTabName || 'main'
        };
      }
    } catch (directError) {
      console.log(`[BrowserActionService] Direct scrollIntoView failed, trying progressive scroll: ${directError.message}`);
    }
    
    // Strategy 2: Progressive container scrolling for virtualized content
    console.log('[BrowserActionService] Starting progressive scroll strategy');
    
    const progressiveScrollResult = await page.evaluate(async (params) => {
      const { sel, useShadowDOM, maxAttempts, scrollStep, scrollDirection, options } = params;
      
      // Inline all helper functions
      const querySelectorDeep = (selector, root = document) => {
        if (selector.includes('>>')) {
          const parts = selector.split('>>').map(p => p.trim());
          let elements = [root];
          
          for (const part of parts) {
            const newElements = [];
            for (const el of elements) {
              const searchRoot = el.shadowRoot || el;
              newElements.push(...searchRoot.querySelectorAll(part));
            }
            elements = newElements;
          }
          
          return elements[0] || null;
        }
        
        const lightMatch = root.querySelector(selector);
        if (lightMatch) return lightMatch;
        
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
        let node;
        while ((node = walker.nextNode())) {
          if (node.shadowRoot) {
            const match = querySelectorDeep(selector, node.shadowRoot);
            if (match) return match;
          }
        }
        return null;
      };
      
      const getScrollParentAcrossShadows = (node) => {
        let cur = node;
        while (cur && cur !== document.documentElement) {
          const style = cur instanceof Element ? getComputedStyle(cur) : null;
          if (
            style &&
            /(auto|scroll|overlay)/.test(style.overflowY) &&
            cur.scrollHeight > cur.clientHeight
          ) {
            console.log('[Progressive] Found scroll parent:', cur.tagName, cur.className);
            return cur;
          }
          // Step out through shadow boundary if needed
          const root = cur.getRootNode();
          cur = cur.parentElement || (root instanceof ShadowRoot ? root.host : null);
        }
        return document.scrollingElement || document.documentElement;
      };
      
      const isElementInViewport = (element) => {
        const rect = element.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= window.innerHeight;
      };
      
      // Progressive scroll implementation
      let attempt = 0;
      let lastScrollPos = 0;
      
      while (attempt < maxAttempts) {
        attempt++;
        
        // Try to find element
        const element = useShadowDOM ? 
          querySelectorDeep(sel) :
          document.querySelector(sel);
        
        if (element) {
          console.log(`[Progressive] Found element on attempt ${attempt}`);
          const rect = element.getBoundingClientRect();
          
          // Check if already visible
          if (isElementInViewport(element)) {
            console.log('[Progressive] Element already in viewport');
            return { success: true, attempts: attempt, rect, method: 'already-visible' };
          }
          
          // Find the correct scroll parent
          const scrollParent = getScrollParentAcrossShadows(element);
          console.log('[Progressive] Scroll parent:', scrollParent === document.documentElement ? 'document' : scrollParent.tagName);
          
          // Scroll element into view
          element.scrollIntoView(options);
          
          // Wait for scroll to complete
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Check final position
          const finalRect = element.getBoundingClientRect();
          console.log('[Progressive] Final position:', { top: finalRect.top, bottom: finalRect.bottom });
          
          if (isElementInViewport(element)) {
            return { success: true, attempts: attempt, rect: finalRect, method: 'scrolled-into-view' };
          }
        }
        
        // Element not found yet, scroll to load more content
        // Need to find appropriate scroll parent - might be inside a shadow DOM container
        let scrollParent = document.scrollingElement || document.documentElement;
        
        // If we're using shadow DOM, try to find a scroll parent that might be in shadow DOM
        if (useShadowDOM) {
          // Look for common scroll container patterns
          const possibleContainers = [
            '.ag-center-cols-viewport', // ag-grid
            '.ReactVirtualized__Grid',
            '.ReactVirtualized__List',
            '[data-viewport]',
            '.viewport',
            '.scroll-container',
            '.scrollable'
          ];
          
          for (const containerSel of possibleContainers) {
            const container = querySelectorDeep(containerSel);
            if (container && container.scrollHeight > container.clientHeight) {
              scrollParent = container;
              console.log('[Progressive] Found shadow DOM scroll container:', containerSel);
              break;
            }
          }
        }
        
        const currentScroll = scrollParent.scrollTop;
        
        if (scrollDirection === 'down' || scrollDirection === 'both') {
          scrollParent.scrollTop += scrollStep;
        } else {
          scrollParent.scrollTop -= scrollStep;
        }
        
        // Check if we actually scrolled
        if (Math.abs(scrollParent.scrollTop - currentScroll) < 1) {
          console.log('[Progressive] Cannot scroll further');
          break;
        }
        
        // Wait for content to render
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      // Final attempt to find element
      const finalElement = useShadowDOM ? 
        querySelectorDeep(sel) :
        document.querySelector(sel);
        
      if (finalElement) {
        const finalRect = finalElement.getBoundingClientRect();
        return { 
          success: false, 
          attempts: attempt, 
          rect: finalRect, 
          message: `Element found but not in viewport. Position: ${finalRect.top}` 
        };
      }
      
      return { success: false, attempts: attempt, message: 'Element not found after progressive scroll' };
    }, {
      sel: effectiveSelector,
      useShadowDOM,
      maxAttempts: maxScrollAttempts,
      scrollStep: 500,
      scrollDirection,
      options: {
        behavior: scrollBehavior,
        block: scrollBlock,
        inline: scrollInline
      }
    });
    
    if (progressiveScrollResult.success) {
      return {
        scrolledIntoView: scrollIntoViewSelector,
        method: 'progressive',
        attempts: progressiveScrollResult.attempts,
        behavior: scrollBehavior,
        finalPosition: progressiveScrollResult.rect,
        tab: tabName || this.nodeExecutor.activeTabName || 'main'
      };
    }
    
    // Progressive scroll failed
    throw new Error(
      progressiveScrollResult.message || 
      `Failed to scroll element into view after ${progressiveScrollResult.attempts} attempts`
    );
  }

  async scrollToRow(config) {
    let {
      scrollContainer,
      rowIndex,
      rowHeight,  // NEW: Optional row height for precise scrolling
      scrollBehavior = 'smooth',
      tabName,
      timeout = 10000,
      maxScrollAttempts = 30
    } = config;
    
    if (rowIndex === undefined || rowIndex === null) {
      throw new Error('scrollToRow action requires rowIndex parameter');
    }
    
    const page = await this.resolveTargetPage(tabName);
    
    // Auto-detect scroll container if not provided
    if (!scrollContainer) {
      const detected = await this.detectScrollContainer(page);
      if (detected) {
        scrollContainer = detected;
        console.log(`[BrowserActionService] Using auto-detected container for scrollToRow: ${scrollContainer}`);
      } else {
        throw new Error('scrollToRow requires scrollContainer parameter or a detectable scroll container on the page');
      }
    }
    
    // Wait for container to exist
    await page.waitForSelector(scrollContainer, { timeout, state: 'visible' });
    
    // Strategy: Progressive scrolling with grid type detection
    const result = await page.evaluate(async (params) => {
      const { containerSel, targetRow, behavior, maxAttempts } = params;
      let { rowHeight } = params; // Make rowHeight mutable
      const container = document.querySelector(containerSel);
      if (!container) return { success: false, error: 'Container not found' };
      
      console.log('[scrollToRow] Starting scroll operation:', {
        containerSelector: containerSel,
        targetRow,
        providedRowHeight: rowHeight,
        behavior,
        containerDimensions: {
          clientHeight: container.clientHeight,
          scrollHeight: container.scrollHeight,
          scrollTop: container.scrollTop
        }
      });
      
      // Helper function to wait
      const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      
      // If rowHeight is provided, use precise scrolling
      if (rowHeight && rowHeight > 0) {
        const targetScrollTop = targetRow * rowHeight;
        
        if (behavior === 'smooth') {
          container.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
        } else {
          container.scrollTop = targetScrollTop;
        }
        
        await wait(500); // Wait for scroll to complete
        
        // Verify if row is visible now
        const rowSelectors = [
          `[data-rowindex="${targetRow}"]`,
          `[data-row-index="${targetRow}"]`,
          `[data-row="${targetRow}"]`,
          `tr:nth-child(${targetRow + 1})`
        ];
        
        for (const selector of rowSelectors) {
          const rowElement = container.querySelector(selector);
          if (rowElement) {
            return { 
              success: true, 
              method: 'precise-rowHeight', 
              rowIndex: targetRow,
              rowHeight: rowHeight,
              scrollTop: targetScrollTop
            };
          }
        }
        
        // If not found with precise scroll, continue with progressive approach
      }
      
      // Detect common virtualized grid patterns
      const isAgGrid = !!container.querySelector('.ag-center-cols-viewport');
      const isReactVirtualized = container.classList.contains('ReactVirtualized__Grid') || 
                                  container.classList.contains('ReactVirtualized__List');
      const isReactWindow = !!container.querySelector('[style*="position: absolute"]');
      const isAirtable = !!container.classList.contains('gridView') || !!container.querySelector('.gridView');
      
      console.log('[scrollToRow] Grid detection results:', {
        isAgGrid,
        isReactVirtualized,
        isReactWindow,
        isAirtable,
        containerClasses: container.className,
        containerId: container.id
      });
      
      // Try to detect row height for React-Virtualized if not provided
      if (!rowHeight && isReactVirtualized) {
        console.log('[scrollToRow] React-Virtualized detected, attempting row height detection...');
        const firstRow = container.querySelector('[style*="position: absolute"][style*="top:"]');
        if (firstRow) {
          const style = firstRow.getAttribute('style');
          console.log('[scrollToRow] First row style:', style);
          const heightMatch = style.match(/height:\s*(\d+)px/);
          if (heightMatch) {
            rowHeight = parseInt(heightMatch[1]);
            console.log(`[scrollToRow] Successfully detected React-Virtualized row height: ${rowHeight}px`);
          } else {
            console.log('[scrollToRow] Could not extract height from style attribute');
          }
        } else {
          console.log('[scrollToRow] No positioned rows found for height detection');
          // Try alternative detection methods
          const allRows = container.querySelectorAll('[style*="position: absolute"]');
          console.log(`[scrollToRow] Found ${allRows.length} absolutely positioned elements`);
          if (allRows.length > 0) {
            // Log first few for debugging
            for (let i = 0; i < Math.min(3, allRows.length); i++) {
              console.log(`[scrollToRow] Row ${i} style:`, allRows[i].getAttribute('style'));
            }
          }
        }
        
        // If we detected a rowHeight for React-Virtualized, try precise scrolling
        if (isReactVirtualized && rowHeight && rowHeight > 0) {
          console.log('[scrollToRow] Using detected rowHeight for precise scrolling');
          const targetScrollTop = targetRow * rowHeight;
          
          console.log('[scrollToRow] Precise scroll calculation:', {
            targetRow,
            rowHeight,
            targetScrollTop,
            maxScroll: container.scrollHeight - container.clientHeight
          });
          
          if (targetScrollTop <= container.scrollHeight) {
            if (behavior === 'smooth') {
              container.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
            } else {
              container.scrollTop = targetScrollTop;
            }
            
            await wait(700); // Wait for scroll and render
            
            // Check React-Virtualized specific selectors
            const rowSelectors = [
              `div[style*="top: ${targetRow * rowHeight}px"]`,
              `[style*="top:${targetRow * rowHeight}px"]`,
              `[style*="top: ${targetRow * rowHeight}px;"]`
            ];
            
            console.log('[scrollToRow] Looking for row with selectors:', rowSelectors);
            
            for (const selector of rowSelectors) {
              const rowElement = container.querySelector(selector);
              if (rowElement) {
                console.log('[scrollToRow] Success! Found row with selector:', selector);
                return { 
                  success: true, 
                  method: 'detected-precise', 
                  rowIndex: targetRow,
                  detectedRowHeight: rowHeight,
                  scrollTop: targetScrollTop
                };
              }
            }
            
            console.log('[scrollToRow] Row not found after precise scroll, continuing to progressive approach');
          }
        }
      }
      
      // Try AG Grid API
      if (isAgGrid) {
        const gridElement = container.closest('.ag-root-wrapper');
        if (gridElement && gridElement.__agGridReact) {
          const gridApi = gridElement.__agGridReact.api;
          if (gridApi && gridApi.ensureIndexVisible) {
            gridApi.ensureIndexVisible(targetRow, 'middle');
            await wait(500); // Wait for scroll animation
            return { success: true, method: 'agGrid', rowIndex: targetRow };
          }
        }
      }
      
      // Try Airtable-style scrolling
      if (isAirtable) {
        const estimatedRowHeight = 32; // Common Airtable row height
        const targetScrollTop = targetRow * estimatedRowHeight;
        
        console.log('[scrollToRow] Using Airtable scrolling strategy:', {
          estimatedRowHeight,
          targetRow,
          targetScrollTop,
          currentScrollTop: container.scrollTop,
          maxScroll: container.scrollHeight - container.clientHeight
        });
        
        if (behavior === 'smooth') {
          container.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
        } else {
          container.scrollTop = targetScrollTop;
        }
        
        await wait(500);
        
        console.log('[scrollToRow] After Airtable scroll:', {
          newScrollTop: container.scrollTop,
          expectedScrollTop: targetScrollTop,
          scrollSuccessful: Math.abs(container.scrollTop - targetScrollTop) < 10
        });
        
        return { success: true, method: 'airtable-estimated', rowIndex: targetRow, scrollTop: targetScrollTop };
      }
      
      // Generic approach: Progressive scrolling
      const scrollStep = Math.max(200, container.clientHeight * 0.5); // 50% of viewport per step
      let attempts = 0;
      
      // For React-Virtualized without detected rowHeight, use a better default
      if (isReactVirtualized && !rowHeight) {
        rowHeight = 30; // Common React-Virtualized demo row height
        console.log('[scrollToRow] Using default React-Virtualized row height:', rowHeight);
      }
      
      console.log('[scrollToRow] Using progressive scrolling approach:', {
        scrollStep,
        maxAttempts,
        containerHeight: container.clientHeight
      });
      
      // Common row selectors - expanded to support more grid types
      const rowSelectors = [
        // AG-Grid and similar
        `[data-rowindex="${targetRow}"]`,
        `[data-row-index="${targetRow}"]`,
        `[row-index="${targetRow}"]`,
        `[data-row="${targetRow}"]`,
        
        // Tanstack Virtual and generic
        `[data-index="${targetRow}"]`,
        `.row[data-index="${targetRow}"]`,
        
        // ARIA accessibility patterns
        `[aria-rowindex="${targetRow + 1}"]`, // aria-rowindex is 1-based
        
        // Traditional HTML tables
        `tr:nth-child(${targetRow + 1})`, // nth-child is 1-based
        `.dataRow:nth-child(${targetRow + 1})`,
        
        // Class-based patterns
        `.row-${targetRow}`,
        `#row-${targetRow}`,
        
        // React-Virtualized style-based pattern (when rowHeight is known)
        ...(rowHeight > 0 ? [
          `div[style*="top: ${targetRow * rowHeight}px"]`,
          `[style*="top:${targetRow * rowHeight}px"]`,
          `[style*="top: ${targetRow * rowHeight}px;"]`
        ] : [])
      ];
      
      while (attempts < maxAttempts) {
        attempts++;
        console.log(`[scrollToRow] Progressive scroll attempt ${attempts}/${maxAttempts}:`, {
          currentScrollTop: container.scrollTop,
          scrollHeight: container.scrollHeight,
          remainingScroll: container.scrollHeight - container.scrollTop - container.clientHeight
        });
        
        // Check if target row is visible
        for (const selector of rowSelectors) {
          const rowElement = container.querySelector(selector);
          if (rowElement) {
            // For React-Virtualized style selectors, verify the content actually contains the row number
            if (selector.includes('style*="top:')) {
              const rowText = rowElement.textContent || '';
              const expectedRowPattern = new RegExp(`row\\s*${targetRow}\\b`, 'i');
              if (!expectedRowPattern.test(rowText)) {
                console.log(`[scrollToRow] Style selector matched but content doesn't match row ${targetRow}:`, {
                  selector,
                  actualText: rowText.substring(0, 100)
                });
                continue; // Skip this match, it's not the right row
              }
            }
            
            const rect = rowElement.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            console.log(`[scrollToRow] Found row with selector: ${selector}`, {
              rowTop: rect.top,
              rowBottom: rect.bottom,
              containerTop: containerRect.top,
              containerBottom: containerRect.bottom,
              isVisible: rect.top >= containerRect.top && rect.bottom <= containerRect.bottom,
              rowText: (rowElement.textContent || '').substring(0, 50)
            });
            
            // Found it! Scroll into view
            rowElement.scrollIntoView({ behavior, block: 'center' });
            await wait(300);
            return { 
              success: true, 
              method: 'progressive-found', 
              rowIndex: targetRow, 
              attempts: attempts,
              selector 
            };
          }
        }
        
        // Not found, scroll further
        const previousScrollTop = container.scrollTop;
        container.scrollTop += scrollStep;
        const actualScroll = container.scrollTop - previousScrollTop;
        
        console.log(`[scrollToRow] Scrolled by ${actualScroll}px (requested: ${scrollStep}px)`);
        
        // Wait for virtualized rendering
        await wait(200);
        
        // Check if we've reached the end
        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 10) {
          // We're at the bottom, row doesn't exist
          const visibleRows = container.querySelectorAll('[data-rowindex], [data-row-index], [data-row], tr, .row, .dataRow').length;
          console.log('[scrollToRow] Reached end of scrollable content:', {
            scrollTop: container.scrollTop,
            scrollHeight: container.scrollHeight,
            visibleRows,
            targetRow
          });
          return { 
            success: false, 
            error: `Row ${targetRow} not found (reached end of scrollable content at scrollTop: ${container.scrollTop}px)`,
            attempts,
            diagnostics: {
              containerHeight: container.clientHeight,
              scrollHeight: container.scrollHeight,
              finalScrollTop: container.scrollTop,
              visibleRowCount: visibleRows
            }
          };
        }
      }
      
      // Final attempt failed - provide diagnostics
      const visibleRows = container.querySelectorAll('[data-rowindex], [data-row-index], [data-row], tr, .row, .dataRow').length;
      const estimatedCurrentRow = Math.floor(container.scrollTop / (scrollStep / attempts));
      
      return { 
        success: false, 
        error: `Row ${targetRow} not found after ${attempts} attempts. Estimated position: ~row ${estimatedCurrentRow}`,
        diagnostics: {
          containerHeight: container.clientHeight,
          scrollHeight: container.scrollHeight,
          finalScrollTop: container.scrollTop,
          scrolledDistance: attempts * scrollStep,
          visibleRowCount: visibleRows
        }
      };
    }, {
      containerSel: scrollContainer,
      targetRow: rowIndex,
      rowHeight: rowHeight,
      behavior: scrollBehavior,
      maxAttempts: maxScrollAttempts
    });
    
    if (result.success) {
      await this.updateBrowserState();
      
      return {
        scrolledToRow: rowIndex,
        container: scrollContainer, 
        method: result.method,
        attempts: result.attempts || 1,
        selector: result.selector,
        tab: tabName || this.nodeExecutor.activeTabName || 'main'
      };
    } else {
      // Include diagnostics in error for better debugging
      const errorMsg = result.error || `Failed to scroll to row ${rowIndex}`;
      const error = new Error(errorMsg);
      if (result.diagnostics) {
        error.diagnostics = result.diagnostics;
        console.log('[BrowserActionService] Scroll diagnostics:', result.diagnostics);
      }
      throw error;
    }
  }

  // ===== Profile Management =====

  async listProfiles(config) {
    // List available browser profiles on disk
    const profiles = await this.nodeExecutor.listBrowserProfiles();
    
    return {
      profiles,
      count: profiles.length
    };
  }

  async setProfile(config) {
    const { profileName } = config;
    
    // If profileName is null, use default (no profile)
    if (!profileName) {
      console.log('[BrowserActionService] Switching to default browser (no profile)');
      
      // Restart browser without profile
      await this.nodeExecutor.cleanup();
      await this.nodeExecutor.getStagehand();
      
      return {
        profile: null,
        message: 'Using default browser (no profile)'
      };
    }
    
    // Switch to profile mode
    console.log(`[BrowserActionService] Switching to profile "${profileName}"`);
    
    // This will restart browser with the profile
    await this.nodeExecutor.cleanup();
    await this.nodeExecutor.getStagehand({
      profileName,
      persistStrategy: 'profileDir'
    });
    
    return {
      profile: profileName,
      message: `Browser restarted with profile "${profileName}"`
    };
  }

  async snapshotProfile(config) {
    const { profileName } = config;
    
    if (!profileName) {
      throw new Error('profileName is required for snapshotProfile');
    }
    
    // Create snapshot and upload to Supabase
    const result = await this.nodeExecutor.snapshotBrowserProfile(profileName);
    
    return result;
  }

  async restoreProfile(config) {
    const { profileName } = config;
    
    if (!profileName) {
      throw new Error('profileName is required for restoreProfile');
    }
    
    // Download and restore profile from Supabase
    const result = await this.nodeExecutor.restoreBrowserProfile(profileName);
    
    // Restart browser with restored profile
    await this.nodeExecutor.cleanup();
    await this.nodeExecutor.getStagehand({
      profileName,
      persistStrategy: 'profileDir'
    });
    
    return {
      ...result,
      browserRestarted: true
    };
  }

  async loadProfile(config) {
    const { profileName } = config;
    
    if (!profileName) {
      throw new Error('profileName is required for loadProfile');
    }
    
    console.log(`[BrowserActionService] Loading profile "${profileName}"...`);
    
    // Check if profile exists locally
    const localProfiles = await this.nodeExecutor.listBrowserProfiles();
    const existsLocally = localProfiles.includes(profileName);
    
    if (existsLocally) {
      console.log(`[BrowserActionService] Profile "${profileName}" found locally, using setProfile`);
      
      // Profile exists locally, just switch to it
      await this.nodeExecutor.cleanup();
      await this.nodeExecutor.getStagehand({
        profileName,
        persistStrategy: 'profileDir'
      });
      
      return {
        profile: profileName,
        source: 'local',
        message: `Loaded profile "${profileName}" from local storage`
      };
    } else {
      console.log(`[BrowserActionService] Profile "${profileName}" not found locally, attempting cloud restore`);
      
      try {
        // Try to restore from cloud
        const result = await this.nodeExecutor.restoreBrowserProfile(profileName);
        
        // Restart browser with restored profile
        await this.nodeExecutor.cleanup();
        await this.nodeExecutor.getStagehand({
          profileName,
          persistStrategy: 'profileDir'
        });
        
        return {
          profile: profileName,
          source: 'cloud',
          message: `Restored profile "${profileName}" from cloud snapshot`,
          snapshotFile: result.snapshotFile
        };
      } catch (error) {
        // Profile doesn't exist locally or in cloud
        throw new Error(`Profile "${profileName}" not found locally or in cloud. Create it first with setProfile.`);
      }
    }
  }
}

export default BrowserActionService;