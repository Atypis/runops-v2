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

  async scrollIntoView(config) {
    const { 
      scrollIntoViewSelector, 
      scrollContainer,
      scrollBehavior = 'smooth',
      scrollBlock = 'start', 
      scrollInline = 'nearest',
      tabName,
      timeout = 10000,
      maxScrollAttempts = 30
    } = config;
    
    if (!scrollIntoViewSelector) {
      throw new Error('scrollIntoView action requires scrollIntoViewSelector parameter');
    }
    
    const page = await this.resolveTargetPage(tabName);
    const startTime = Date.now();
    
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
            tab: tabName || this.nodeExecutor.activeTabName || 'main'
          };
        }
      } catch (checkError) {
        // Element still not found, continue scrolling
        console.log(`[BrowserActionService] Scroll attempt ${attempt}/${maxScrollAttempts}: element not found yet`);
      }
      
      // Scroll container or viewport
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
        }, { containerSel: scrollContainer, step: scrollStep });
      } else {
        // Scroll main viewport
        await page.evaluate((step) => {
          window.scrollBy(0, step);
        }, scrollStep);
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
    const {
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
    
    if (!scrollContainer) {
      throw new Error('scrollToRow action requires scrollContainer parameter');
    }
    
    const page = await this.resolveTargetPage(tabName);
    
    // Wait for container to exist
    await page.waitForSelector(scrollContainer, { timeout, state: 'visible' });
    
    // Strategy: Progressive scrolling with grid type detection
    const result = await page.evaluate(async (params) => {
      const { containerSel, targetRow, rowHeight, behavior, maxAttempts } = params;
      const container = document.querySelector(containerSel);
      if (!container) return { success: false, error: 'Container not found' };
      
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
      const isReactWindow = !!container.querySelector('[style*="position: absolute"]');
      const isAirtable = !!container.classList.contains('gridView') || !!container.querySelector('.gridView');
      
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
        
        if (behavior === 'smooth') {
          container.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
        } else {
          container.scrollTop = targetScrollTop;
        }
        
        await wait(500);
        return { success: true, method: 'airtable-estimated', rowIndex: targetRow, scrollTop: targetScrollTop };
      }
      
      // Generic approach: Progressive scrolling
      const scrollStep = Math.max(200, container.clientHeight * 0.5); // 50% of viewport per step
      let attempts = 0;
      
      // Common row selectors
      const rowSelectors = [
        `[data-rowindex="${targetRow}"]`,
        `[data-row-index="${targetRow}"]`,
        `[data-row="${targetRow}"]`,
        `[data-index="${targetRow}"]`,
        `.row[data-index="${targetRow}"]`,
        `tr:nth-child(${targetRow + 1})`, // nth-child is 1-based
        `.dataRow:nth-child(${targetRow + 1})`
      ];
      
      while (attempts < maxAttempts) {
        // Check if target row is visible
        for (const selector of rowSelectors) {
          const rowElement = container.querySelector(selector);
          if (rowElement) {
            // Found it! Scroll into view
            rowElement.scrollIntoView({ behavior, block: 'center' });
            await wait(300);
            return { 
              success: true, 
              method: 'progressive-found', 
              rowIndex: targetRow, 
              attempts: attempts + 1,
              selector 
            };
          }
        }
        
        // Not found, scroll further
        container.scrollTop += scrollStep;
        attempts++;
        
        // Wait for virtualized rendering
        await wait(200);
        
        // Check if we've reached the end
        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 10) {
          // We're at the bottom, row doesn't exist
          const visibleRows = container.querySelectorAll('[data-rowindex], [data-row-index], [data-row], tr, .row, .dataRow').length;
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