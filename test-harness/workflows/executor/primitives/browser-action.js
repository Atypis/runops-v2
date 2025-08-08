import { BasePrimitive } from './base-primitive.js';

/**
 * Browser Action Primitive - Handles browser interactions
 * 
 * Purpose: All side-effectful browser operations that change state
 * Methods: goto, click, type, wait, openNewTab, switchTab
 */
export class BrowserActionPrimitive extends BasePrimitive {
  async execute({ action, url, selector, text, value, duration, tabName, name, path, fullPage, ...options }) {
    // Map legacy parameters for backward compatibility
    const method = action;
    
    console.log(`🌐 Browser action: ${method}`);
    
    // Log current state for debugging
    if (this.currentPage) {
      console.log(`   Current tab URL: ${this.currentPage.url()}`);
    }
    
    switch (method) {
      case 'goto':
      case 'navigate':
        return await this.navigateTo(url);
      
      case 'click':
        return await this.clickElement(selector);
      
      case 'type':
        return await this.typeText(selector, text || value);
      
      case 'wait':
        return await this.wait(duration);
      
      case 'openNewTab':
        return await this.openNewTab(url, { name, ...options });
      
      case 'switchTab':
        return await this.switchTab(tabName || name);
      
      case 'back':
        return await this.goBack();
      
      case 'forward':
        return await this.goForward();
      
      case 'refresh':
        return await this.refresh();
      
      case 'screenshot':
        return await this.takeScreenshot(selector, { path, fullPage, ...options });
      
      case 'listTabs':
        return await this.listTabs();
      
      case 'getCurrentTab':
        return await this.getCurrentTab();
      
      default:
        throw new Error(`Unknown browser action: ${method}`);
    }
  }

  async navigateTo(url) {
    console.log(`   Navigating to: ${url}`);
    try {
      await this.currentPage.goto(url, { 
        waitUntil: 'domcontentloaded', 
        timeout: 60000 
      });
      // Try networkidle but don't fail if it times out
      try {
        await this.currentPage.waitForLoadState('networkidle', { timeout: 10000 });
      } catch (e) {
        console.log('   Note: networkidle timeout, but page loaded');
      }
    } catch (error) {
      console.error(`   ❌ Navigation failed: ${error.message}`);
      throw error;
    }
    console.log(`   ✓ Navigation complete: ${this.currentPage.url()}`);
    return { success: true, url: this.currentPage.url() };
  }

  async clickElement(target) {
    console.log(`   Click target: "${target}"`);
    // Use StageHand's AI-powered click on any page
    await this.currentPage.act(`click on ${target}`);
    return { success: true, action: 'clicked' };
  }

  async typeText(target, data) {
    const text = this.resolveVariable(data) || data;
    console.log(`   Type data: "${data}" resolved to: "${text}"`);
    // Use StageHand's AI-powered type on any page
    await this.currentPage.act(`type "${text}" into ${target}`);
    return { success: true, typed: text };
  }

  async wait(duration) {
    const ms = duration || 1000;
    console.log(`   Waiting for ${ms}ms...`);
    await new Promise(resolve => setTimeout(resolve, ms));
    return { success: true, waited: ms };
  }

  async openNewTab(url, options = {}) {
    // Create new page using StageHand's context - it will have AI capabilities!
    const newPage = await this.stagehand.context.newPage();
    
    // Store the new page with a name
    const tabName = options.name || `tab_${Date.now()}`;
    this.pages[tabName] = newPage;
    this.currentPage = newPage; // This becomes the active page
    console.log(`   ✓ New tab opened: ${tabName}`);
    
    // Navigate if URL provided
    if (url) {
      await newPage.goto(url);
      await newPage.waitForLoadState('networkidle');
    }
    
    return { success: true, tabName, url: newPage.url() };
  }

  async switchTab(target) {
    const targetTab = target || 'main';
    if (!this.pages[targetTab]) {
      console.error(`   ❌ Available tabs: ${Object.keys(this.pages).join(', ')}`);
      throw new Error(`Tab '${targetTab}' not found`);
    }
    this.currentPage = this.pages[targetTab];
    // Bring the tab to front for visibility
    await this.currentPage.bringToFront();
    console.log(`   ✓ Switched to tab: ${targetTab} (${this.currentPage.url()})`);
    return { success: true, currentTab: targetTab, url: this.currentPage.url() };
  }

  async goBack() {
    console.log(`   ⏪ Navigating back in history`);
    try {
      await this.currentPage.goBack({ waitUntil: 'domcontentloaded' });
      console.log(`   ✓ Navigated back to: ${this.currentPage.url()}`);
      return { success: true, url: this.currentPage.url() };
    } catch (error) {
      console.error(`   ❌ Failed to go back: ${error.message}`);
      throw error;
    }
  }

  async goForward() {
    console.log(`   ⏩ Navigating forward in history`);
    try {
      await this.currentPage.goForward({ waitUntil: 'domcontentloaded' });
      console.log(`   ✓ Navigated forward to: ${this.currentPage.url()}`);
      return { success: true, url: this.currentPage.url() };
    } catch (error) {
      console.error(`   ❌ Failed to go forward: ${error.message}`);
      throw error;
    }
  }

  async refresh() {
    console.log(`   🔄 Refreshing page`);
    try {
      await this.currentPage.reload({ waitUntil: 'domcontentloaded' });
      console.log(`   ✓ Page refreshed: ${this.currentPage.url()}`);
      return { success: true, url: this.currentPage.url() };
    } catch (error) {
      console.error(`   ❌ Failed to refresh: ${error.message}`);
      throw error;
    }
  }

  async takeScreenshot(selector, options = {}) {
    console.log(`   📸 Taking screenshot${selector ? ` of: ${selector}` : ' of full page'}`);
    try {
      const screenshotOptions = {
        path: options.path || `screenshot_${Date.now()}.png`,
        fullPage: options.fullPage !== false && !selector,
        ...options
      };
      
      let screenshot;
      if (selector) {
        // Screenshot specific element
        const element = await this.currentPage.locator(selector);
        screenshot = await element.screenshot(screenshotOptions);
      } else {
        // Screenshot full page or viewport
        screenshot = await this.currentPage.screenshot(screenshotOptions);
      }
      
      console.log(`   ✓ Screenshot saved to: ${screenshotOptions.path}`);
      return { 
        success: true, 
        path: screenshotOptions.path,
        size: screenshot.length 
      };
    } catch (error) {
      console.error(`   ❌ Screenshot failed: ${error.message}`);
      throw error;
    }
  }

  async listTabs() {
    const tabs = Object.keys(this.pages).map(name => ({
      name,
      url: this.pages[name].url(),
      isActive: this.pages[name] === this.currentPage
    }));
    console.log(`   📑 Available tabs: ${tabs.length}`);
    tabs.forEach(tab => {
      console.log(`      ${tab.isActive ? '▶' : '◦'} ${tab.name}: ${tab.url}`);
    });
    return { success: true, tabs };
  }

  async getCurrentTab() {
    const currentTabName = Object.entries(this.pages).find(
      ([name, page]) => page === this.currentPage
    )?.[0] || 'unknown';
    
    console.log(`   📍 Current tab: ${currentTabName} (${this.currentPage.url()})`);
    return { 
      success: true, 
      currentTab: currentTabName,
      url: this.currentPage.url() 
    };
  }
}