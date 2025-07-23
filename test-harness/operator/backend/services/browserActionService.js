/**
 * BrowserActionService - Unified browser action execution service
 * 
 * This service consolidates all browser actions (navigate, click, type, etc.) into a single
 * implementation used by Director, Scout, and other services. It eliminates code duplication
 * and ensures consistent behavior across all browser interactions.
 */

export class BrowserActionService {
  constructor(nodeExecutor, workflowId, browserStateService) {
    this.nodeExecutor = nodeExecutor;
    this.workflowId = workflowId;
    this.browserStateService = browserStateService;
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
    const { selector, tabName, timeout = 10000 } = config;
    
    if (!selector) {
      throw new Error('click action requires selector parameter');
    }
    
    const page = await this.resolveTargetPage(tabName);
    
    // Wait for element to be clickable
    await page.waitForSelector(selector, { 
      timeout,
      state: 'visible'
    });
    
    // Click the element
    await page.click(selector);
    
    return { 
      clicked: selector,
      tab: tabName || this.nodeExecutor.activeTabName || 'main'
    };
  }

  async type(config) {
    const { selector, text, tabName, timeout = 10000 } = config;
    
    if (!selector || text === undefined) {
      throw new Error('type action requires selector and text parameters');
    }
    
    const page = await this.resolveTargetPage(tabName);
    
    // Wait for element
    await page.waitForSelector(selector, { 
      timeout,
      state: 'visible' 
    });
    
    // Clear existing text and type new
    await page.click(selector, { clickCount: 3 });
    await page.type(selector, text);
    
    return { 
      typed: text,
      selector,
      tab: tabName || this.nodeExecutor.activeTabName || 'main'
    };
  }

  async keypress(config) {
    const { key, tabName } = config;
    
    if (!key) {
      throw new Error('keypress action requires key parameter');
    }
    
    const page = await this.resolveTargetPage(tabName);
    
    // Press the key
    await page.keyboard.press(key);
    
    return { 
      pressed: key,
      tab: tabName || this.nodeExecutor.activeTabName || 'main'
    };
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
      maxScrollAttempts = 30
    } = config;
    
    if (!scrollIntoViewSelector) {
      throw new Error('scrollIntoView action requires scrollIntoViewSelector parameter');
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
    
    // Strategy 1: Try direct scrollIntoView if element exists
    try {
      await page.waitForSelector(scrollIntoViewSelector, { timeout: 2000, state: 'attached' });
      
      const scrolled = await page.evaluate((params) => {
        const { sel, options } = params;
        const element = document.querySelector(sel);
        if (element) {
          element.scrollIntoView(options);
          return true;
        }
        return false;
      }, {
        sel: scrollIntoViewSelector,
        options: {
          behavior: scrollBehavior,
          block: scrollBlock, 
          inline: scrollInline
        }
      });
      
      if (scrolled) {
        // Wait for scroll animation to complete and element to be visible
        await page.waitForTimeout(300); // Brief pause for smooth scrolling
        await page.waitForSelector(scrollIntoViewSelector, { timeout: timeout - 2300, state: 'visible' });
        
        return {
          scrolledIntoView: scrollIntoViewSelector,
          method: 'direct',
          behavior: scrollBehavior,
          tab: tabName || this.nodeExecutor.activeTabName || 'main'
        };
      }
    } catch (directError) {
      console.log(`[BrowserActionService] Direct scrollIntoView failed, trying progressive scroll: ${directError.message}`);
    }
    
    // Strategy 2: Progressive container scrolling for virtualized content
    let attempt = 0;
    const scrollStep = 500; // pixels per scroll
    let currentDirection = scrollDirection === 'both' ? 'down' : scrollDirection;
    let hasReversed = false;
    
    while (attempt < maxScrollAttempts && (Date.now() - startTime) < timeout) {
      attempt++;
      
      try {
        // Check if element appeared
        const exists = await page.evaluate((sel) => {
          return !!document.querySelector(sel);
        }, scrollIntoViewSelector);
        
        if (exists) {
          // Element found! Now scroll it into view
          await page.evaluate((params) => {
            const { sel, options } = params;
            const element = document.querySelector(sel);
            if (element) {
              element.scrollIntoView(options);
            }
          }, {
            sel: scrollIntoViewSelector,
            options: { behavior: scrollBehavior, block: scrollBlock, inline: scrollInline }
          });
          
          await page.waitForTimeout(300); // Let scroll complete
          await page.waitForSelector(scrollIntoViewSelector, { 
            timeout: Math.max(1000, timeout - (Date.now() - startTime)), 
            state: 'visible' 
          });
          
          return {
            scrolledIntoView: scrollIntoViewSelector,
            method: 'progressive',
            attempts: attempt,
            behavior: scrollBehavior,
            direction: scrollDirection,
            tab: tabName || this.nodeExecutor.activeTabName || 'main'
          };
        }
      } catch (checkError) {
        // Element still not found, continue scrolling
        console.log(`[BrowserActionService] Scroll attempt ${attempt}/${maxScrollAttempts}: element not found yet (direction: ${currentDirection})`);
      }
      
      // Check if we've reached the end and should reverse direction
      if (scrollDirection === 'both' && !hasReversed) {
        const atBoundary = await page.evaluate((params) => {
          const { containerSel, direction } = params;
          if (containerSel) {
            const container = document.querySelector(containerSel);
            if (container) {
              if (direction === 'down') {
                return container.scrollTop + container.clientHeight >= container.scrollHeight - 10;
              } else {
                return container.scrollTop <= 10;
              }
            }
          } else {
            if (direction === 'down') {
              return window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 10;
            } else {
              return window.scrollY <= 10;
            }
          }
        }, { containerSel: scrollContainer, direction: currentDirection });
        
        if (atBoundary) {
          console.log(`[BrowserActionService] Reached ${currentDirection} boundary, reversing direction`);
          currentDirection = currentDirection === 'down' ? 'up' : 'down';
          hasReversed = true;
          // Reset to opposite end
          if (scrollContainer) {
            await page.evaluate((params) => {
              const { containerSel, direction } = params;
              const container = document.querySelector(containerSel);
              if (container) {
                container.scrollTop = direction === 'down' ? 0 : container.scrollHeight;
              }
            }, { containerSel: scrollContainer, direction: currentDirection });
          } else {
            await page.evaluate((direction) => {
              window.scrollTo(0, direction === 'down' ? 0 : document.documentElement.scrollHeight);
            }, currentDirection);
          }
        }
      }
      
      // Scroll in the current direction
      const scrollAmount = currentDirection === 'up' ? -scrollStep : scrollStep;
      
      if (scrollContainer) {
        const containerExists = await page.evaluate((containerSel) => {
          return !!document.querySelector(containerSel);
        }, scrollContainer);
        
        if (!containerExists) {
          throw new Error(`Scroll container "${scrollContainer}" not found`);
        }
        
        await page.evaluate((params) => {
          const { containerSel, step } = params;
          const container = document.querySelector(containerSel);
          if (container) {
            container.scrollTop += step;
          }
        }, { containerSel: scrollContainer, step: scrollAmount });
      } else {
        // Scroll main viewport
        await page.evaluate((step) => {
          window.scrollBy(0, step);
        }, scrollAmount);
      }
      
      // Brief pause for DOM updates in virtualized grids
      await page.waitForTimeout(200);
    }
    
    // Get final scroll position for diagnostics
    const finalScrollInfo = await page.evaluate(() => {
      return {
        scrollY: window.scrollY,
        scrollHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight
      };
    });
    
    throw new Error(
      `Failed to scroll element "${scrollIntoViewSelector}" into view after ${attempt} attempts. ` +
      `Scrolled ${scrolled}px total. Final position: ${finalScrollInfo.scrollY}px / ${finalScrollInfo.scrollHeight}px total height. ` +
      `Element may not exist or selector may be incorrect.`
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
        if (isReactVirtualized && rowHeight && rowHeight > 0 && !providedRowHeight) {
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
            const rect = rowElement.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            console.log(`[scrollToRow] Found row with selector: ${selector}`, {
              rowTop: rect.top,
              rowBottom: rect.bottom,
              containerTop: containerRect.top,
              containerBottom: containerRect.bottom,
              isVisible: rect.top >= containerRect.top && rect.bottom <= containerRect.bottom
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