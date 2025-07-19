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
        case 'screenshot':
          return await this.screenshot(config);
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

  async screenshot(config) {
    const { tabName, path, fullPage = true, selector } = config;
    const page = await this.resolveTargetPage(tabName);
    
    const screenshotOptions = { 
      path,
      fullPage
    };
    
    if (selector) {
      // Screenshot specific element
      const element = await page.$(selector);
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }
      await element.screenshot(screenshotOptions);
      return { 
        screenshot: path || 'captured',
        element: selector
      };
    } else {
      // Screenshot full page
      await page.screenshot(screenshotOptions);
      return { 
        screenshot: path || 'captured',
        fullPage
      };
    }
  }

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
}

export default BrowserActionService;