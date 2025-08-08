import BrowserStateService from './browserStateService.js';
import { formatSimplifiedTree, extractKeyAttributes } from '../../vendor/stagehand-pov/dist/src/formatting.js';
import { cleanStructuralNodes, removeRedundantTextChildren, filterRelevantNodes } from '../../vendor/stagehand-pov/dist/src/tree-utils.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Tab Inspection Service for Director 2.0
 * Provides tab content analysis using enhanced POV generation
 */
export class TabInspectionService {
  constructor() {
    this.browserStateService = new BrowserStateService();
    // Cache for DOM tree data: workflowId-tabName -> { tree, domMapping, url }
    this.elementCache = new Map();
  }

  /**
   * Inspect a browser tab with enhanced POV generation
   * This is the main implementation for the inspect_tab tool
   */
  async inspectTab(workflowId, tabName, inspectionType, instruction, nodeExecutor) {
    try {
      console.log(`[TabInspection] Inspecting tab "${tabName}" for workflow ${workflowId}`);
      
      // Get browser state to find the tab
      const browserState = await this.browserStateService.getBrowserState(workflowId);
      if (!browserState || !browserState.tabs) {
        throw new Error('No browser state available. Navigate to a page first.');
      }

      const tab = browserState.tabs.find(t => t.name === tabName);
      if (!tab) {
        throw new Error(`Tab "${tabName}" not found. Available tabs: ${browserState.tabs.map(t => t.name).join(', ')}`);
      }

      // Get the page instance from the workflow's browser
      const page = await this.getPageForTab(workflowId, tabName, nodeExecutor);
      if (!page) {
        throw new Error(`Could not access page for tab "${tabName}"`);
      }

      // Perform inspection based on type
      if (inspectionType === 'dom_snapshot') {
        return await this.getFullDOMSnapshot(page, workflowId, tabName);
      } else if (inspectionType === 'lightweight_exploration') {
        return await this.lightweightExploration(page, instruction);
      } else {
        throw new Error(`Unknown inspection type: ${inspectionType}. Use "dom_snapshot" or "lightweight_exploration"`);
      }

    } catch (error) {
      console.error('[TabInspection] Error:', error);
      throw error;
    }
  }

  /**
   * Get full DOM snapshot with enhanced selectors
   */
  async getFullDOMSnapshot(page, workflowId, tabName) {
    try {
      // Use CDP to get accessibility tree with proper backend node IDs
      const client = await page.context().newCDPSession(page);
      
      // Enable required domains in correct order
      await client.send('DOM.enable');
      await client.send('Accessibility.enable');
      
      // Get the document root for DOM operations (required for proper initialization)
      await client.send('DOM.getDocument');
      
      // Get the full accessibility tree with backend node IDs
      const { nodes } = await client.send('Accessibility.getFullAXTree');
      
      if (!nodes || nodes.length === 0) {
        return {
          type: 'dom_snapshot',
          content: '[No accessibility tree available]',
          elementCount: 0
        };
      }

      // Get DOM information for each node
      const enhancedNodes = await this.enhanceNodesWithDOM(client, nodes);
      
      // Convert to our format and apply formatting
      const tree = this.convertCDPSnapshot(enhancedNodes[0], enhancedNodes);
      
      // Clean and process the tree using our vendor functions
      let processed = cleanStructuralNodes(tree);
      if (processed) {
        processed = removeRedundantTextChildren(processed);
        processed = filterRelevantNodes(processed);
      }
      
      if (!processed) {
        return {
          type: 'dom_snapshot',
          content: '[Empty accessibility tree]',
          elementCount: 0
        };
      }

      // Cache the enhanced nodes for expand_dom_selector
      const cacheKey = `${workflowId}-${tabName}`;
      this.elementCache.set(cacheKey, {
        tree: processed,
        enhancedNodes: enhancedNodes,
        url: page.url(),
        timestamp: Date.now()
      });

      // Format clean output WITHOUT selectors (context-efficient)
      const cleanPOV = formatSimplifiedTree(processed);
      const elementCount = this.countElements(processed);

      return {
        type: 'dom_snapshot', 
        content: cleanPOV,
        elementCount: elementCount,
        url: page.url(),
        timestamp: new Date().toISOString(),
        note: 'Use expand_dom_selector(tabName, elementId) for detailed DOM attributes'
      };

    } catch (error) {
      console.error('[TabInspection] DOM snapshot error:', error);
      return {
        type: 'dom_snapshot',
        content: `[Error getting DOM snapshot: ${error.message}]`,
        elementCount: 0
      };
    }
  }

  /**
   * Expand DOM selector details for a specific element
   * Surgical tool to get full DOM attributes without flooding context
   */
  async expandDomSelector(workflowId, tabName, elementId) {
    try {
      console.log(`[TabInspection] Expanding DOM selector for element ${elementId} in tab \"${tabName}\" (workflow ${workflowId})`);
      
      // Check cache for tree data
      const cacheKey = `${workflowId}-${tabName}`;
      const cached = this.elementCache.get(cacheKey);
      
      if (!cached) {
        return {
          type: 'expand_dom_selector',
          error: 'No cached DOM tree found. Run inspect_tab first.'
        };
      }
      
      // Find the element in the tree
      const element = this.findElementById(cached.tree, elementId);
      if (!element) {
        return {
          type: 'expand_dom_selector',
          error: `Element ID \"${elementId}\" not found in accessibility tree.`
        };
      }
      
      // Find the enhanced node with DOM attributes
      const enhancedNode = cached.enhancedNodes.find(n => 
        n.nodeId === element.nodeId || n.encodedId === elementId
      );
      
      if (!enhancedNode || !enhancedNode.properties) {
        return {
          type: 'expand_dom_selector',
          elementId: elementId,
          role: element.role,
          name: element.name,
          selectors: [],
          attributes: {},
          note: 'No DOM attributes available for this element'
        };
      }
      
      // Extract all DOM attributes
      const allAttributes = {};
      enhancedNode.properties.forEach(prop => {
        if (prop.value && prop.value.value) {
          allAttributes[prop.name] = prop.value.value;
        }
      });
      
      // Generate selector options
      const selectors = this.generateSelectorOptions(allAttributes);
      
      return {
        type: 'expand_dom_selector',
        elementId: elementId,
        role: element.role,
        name: element.name,
        selectors: selectors,
        attributes: allAttributes,
        url: cached.url,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('[TabInspection] Error expanding DOM selector:', error);
      return {
        type: 'expand_dom_selector',
        error: `Error expanding selector: ${error.message}`
      };
    }
  }

  /**
   * Find element by ID in accessibility tree
   */
  findElementById(node, targetId) {
    if (!node) return null;
    
    // Check if this is the target node
    const nodeId = node.encodedId || node.nodeId;
    if (nodeId == targetId) {
      return node;
    }
    
    // Search children recursively
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        const found = this.findElementById(child, targetId);
        if (found) return found;
      }
    }
    
    return null;
  }

  /**
   * Generate selector options from DOM attributes
   */
  generateSelectorOptions(attributes) {
    const selectors = [];
    
    // ID selector (highest priority)
    if (attributes.id) {
      selectors.push(`#${attributes.id}`);
    }
    
    // Data attribute selectors (automation-friendly)
    const dataAttrs = [
      'data-testid', 'data-test', 'data-cy', 'data-qa', 'data-pw',
      'data-automation', 'data-component', 'data-role'
    ];
    dataAttrs.forEach(attr => {
      if (attributes[attr]) {
        selectors.push(`[${attr}=\"${attributes[attr]}\"]`);
      }
    });
    
    // Aria selectors
    if (attributes['aria-label']) {
      selectors.push(`[aria-label=\"${attributes['aria-label']}\"]`);
    }
    
    // Form attributes
    if (attributes.name) {
      selectors.push(`[name=\"${attributes.name}\"]`);
    }
    if (attributes.type) {
      selectors.push(`[type=\"${attributes.type}\"]`);
    }
    
    // Link attributes
    if (attributes.href) {
      selectors.push(`[href=\"${attributes.href}\"]`);
    }
    
    // Class selector (with stability filtering)
    if (attributes.class) {
      const classes = attributes.class.split(' ')
        .filter(c => 
          c && 
          !c.match(/^[a-f0-9]{8}-/) && // No UUIDs
          !c.match(/^css-[0-9]+/) &&   // No CSS modules
          c.length > 2                   // Not too short
        )
        .slice(0, 3); // Max 3 classes
      
      if (classes.length > 0) {
        selectors.push(`.${classes.join('.')}`);
      }
    }
    
    return selectors;
  }

  /**
   * Clear cache for a specific workflow-tab (called on page navigation)
   */
  clearCache(workflowId, tabName) {
    const cacheKey = `${workflowId}-${tabName}`;
    this.elementCache.delete(cacheKey);
    console.log(`[TabInspection] Cleared cache for ${cacheKey}`);
  }

  /**
   * Lightweight exploration with LLM analysis
   */
  async lightweightExploration(page, instruction) {
    try {
      // Get enhanced POV
      const snapshot = await page.accessibility.snapshot({ interestingOnly: false });
      const enhancedPOV = await this.convertToEnhancedPOV(snapshot);
      
      // TODO: In production, this would send to an LLM for analysis
      // For now, return a structured response
      const analysis = `[Analysis of page based on instruction: "${instruction}"]
      
Based on the DOM structure, here's what I found:
- Page URL: ${page.url()}
- Total elements: ${this.countElements(snapshot)}
- Interactive elements found
- Form fields detected
- Navigation links available

[This would be replaced with actual LLM analysis in production]`;

      return {
        type: 'lightweight_exploration',
        instruction: instruction,
        analysis: analysis,
        url: page.url(),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('[TabInspection] Exploration error:', error);
      return {
        type: 'lightweight_exploration',
        instruction: instruction,
        analysis: `[Error during exploration: ${error.message}]`
      };
    }
  }

  /**
   * Enhance accessibility nodes with DOM attributes using CDP
   */
  async enhanceNodesWithDOM(client, nodes) {
    const nodeMap = new Map();
    
    // Create a map for quick lookup
    nodes.forEach(node => {
      nodeMap.set(node.nodeId, node);
    });
    
    // Get DOM attributes for nodes with backend IDs
    let nodesWithBackendId = 0;
    let successfulAttributes = 0;
    
    for (const node of nodes) {
      if (node.backendDOMNodeId) {
        nodesWithBackendId++;
        
        try {
          // Use DOM.resolveNode to get object reference (more reliable than describeNode)
          const { object } = await client.send('DOM.resolveNode', {
            backendNodeId: node.backendDOMNodeId
          });
          
          if (object && object.objectId) {
            // Get DOM attributes using Runtime.callFunctionOn (avoids node ID issues)
            const { result } = await client.send('Runtime.callFunctionOn', {
              objectId: object.objectId,
              functionDeclaration: `
                function() {
                  // Only process Element nodes (avoid text nodes, comments, etc.)
                  if (this.nodeType !== 1) return null;
                  
                  const attrs = {};
                  if (this.attributes) {
                    // Fix: attributes is a NamedNodeMap, iterate correctly
                    for (let i = 0; i < this.attributes.length; i++) {
                      const attr = this.attributes[i];
                      attrs[attr.name] = attr.value;
                    }
                  }
                  return {
                    tagName: this.tagName ? this.tagName.toLowerCase() : '',
                    attributes: attrs,
                    id: this.id || '',
                    className: this.className || '',
                    type: this.type || '',
                    name: this.name || ''
                  };
                }
              `,
              returnByValue: true
            });
            
            // Check if we got valid DOM info
            if (result && result.value && result.value !== null) {
              const domInfo = result.value;
              
              // Only process element nodes
              if (domInfo !== null) {
                // Add properties to node in the format our formatter expects
                node.properties = this.convertAttributesToProperties(domInfo.attributes);
                if (node.properties.length > 0) {
                  successfulAttributes++;
                }
              }
            }
          }
          
        } catch (error) {
          // Node might not have DOM representation
          console.debug(`Could not get DOM attributes for node ${node.nodeId}:`, error.message);
        }
      }
    }
    
    console.log(`[TabInspection] Enhanced ${successfulAttributes} nodes out of ${nodesWithBackendId} nodes with backend IDs (total nodes: ${nodes.length})`);
    
    // Clean up CDP domains
    await client.send('Accessibility.disable');
    await client.send('DOM.disable');
    
    return nodes;
  }

  /**
   * Convert DOM attributes to our property format
   */
  convertAttributesToProperties(attributes) {
    const properties = [];
    
    // Scout's 20 automation attributes
    const targetAttributes = [
      'data-testid', 'data-test', 'data-cy', 'data-qa', 'data-pw',
      'data-test-id', 'data-automation', 'data-automation-id', 'data-selenium',
      'id', 'data-component', 'data-role', 'data-field',
      'aria-labelledby', 'aria-describedby', 'aria-controls',
      'href', 'formcontrolname', 'autocomplete', 'data-track',
      'type', 'name', 'class'
    ];
    
    Object.entries(attributes).forEach(([name, value]) => {
      if (targetAttributes.includes(name) && value) {
        properties.push({
          name,
          value: { type: 'string', value: String(value) }
        });
      }
    });
    
    return properties;
  }

  /**
   * Convert CDP snapshot to our format
   */
  convertCDPSnapshot(node, allNodes, nodeMap = new Map()) {
    if (!node) return null;
    
    // Create our node format
    const convertedNode = {
      nodeId: node.nodeId,
      role: node.role?.value || 'generic',
      name: node.name?.value,
      description: node.description?.value,
      value: node.value?.value,
      properties: node.properties || []
    };
    
    // Process children
    if (node.childIds && node.childIds.length > 0) {
      convertedNode.children = [];
      
      for (const childId of node.childIds) {
        const childNode = allNodes.find(n => n.nodeId === childId);
        if (childNode) {
          const convertedChild = this.convertCDPSnapshot(childNode, allNodes, nodeMap);
          if (convertedChild) {
            convertedNode.children.push(convertedChild);
          }
        }
      }
    }
    
    return convertedNode;
  }

  /**
   * Convert Playwright snapshot to enhanced POV format
   * Now includes DOM attributes for stable selectors
   */
  async convertToEnhancedPOV(snapshot, level = 0) {
    if (!snapshot) return '';
    
    const indent = '  '.repeat(level);
    const nodeId = snapshot.nodeId || `node-${Math.random().toString(36).substr(2, 9)}`;
    const role = snapshot.role || 'generic';
    const name = snapshot.name ? `: ${snapshot.name}` : '';
    
    // Extract selectors from both snapshot attributes and enhanced DOM attributes
    const selectors = this.extractSelectorsEnhanced(snapshot);
    
    // Build the enhanced line
    let line = `${indent}[${nodeId}] ${role}${selectors}${name}\n`;
    
    // Process children
    if (snapshot.children && Array.isArray(snapshot.children)) {
      for (const child of snapshot.children) {
        line += await this.convertToEnhancedPOV(child, level + 1);
      }
    }
    
    return line;
  }

  /**
   * Extract selectors from snapshot attributes
   * Simplified version focusing on key attributes
   */
  extractSelectors(snapshot) {
    const selectors = [];
    
    // Scout's 20 automation attributes
    const automationAttrs = [
      'data-testid', 'data-test', 'data-cy', 'data-qa', 'data-pw',
      'data-test-id', 'data-automation', 'data-automation-id', 'data-selenium',
      'id', 'data-component', 'data-role', 'data-field',
      'aria-labelledby', 'aria-describedby', 'aria-controls',
      'href', 'formcontrolname', 'autocomplete', 'data-track'
    ];
    
    // Check for ID
    if (snapshot.id) {
      selectors.push(`#${snapshot.id}`);
    }
    
    // Check for className
    if (snapshot.className) {
      const classes = snapshot.className.split(' ')
        .filter(c => c && !c.match(/^[a-f0-9]{8}-/)) // Filter out UUIDs
        .slice(0, 2); // Limit to first 2 classes
      if (classes.length > 0) {
        selectors.push(`.${classes.join('.')}`);
      }
    }
    
    // Check for other attributes
    if (snapshot.attributes) {
      for (const [key, value] of Object.entries(snapshot.attributes)) {
        if (automationAttrs.includes(key) && value) {
          selectors.push(`[${key}="${value}"]`);
        }
      }
    }
    
    // Check common properties
    if (snapshot.href) {
      selectors.push(`[href="${snapshot.href}"]`);
    }
    
    if (snapshot.type && ['button', 'input', 'select', 'textarea'].includes(snapshot.role)) {
      selectors.push(`[type="${snapshot.type}"]`);
    }
    
    return selectors.join('');
  }

  /**
   * Enhanced selector extraction using both snapshot and DOM attributes
   */
  extractSelectorsEnhanced(snapshot) {
    const selectors = [];
    
    // First check our enhanced DOM attributes
    if (snapshot.domAttributes) {
      // ID selector
      if (snapshot.domAttributes.id) {
        selectors.push(`#${snapshot.domAttributes.id}`);
      }
      
      // Data attributes (highest priority for automation)
      const dataAttrs = [
        'data-testid', 'data-test', 'data-cy', 'data-qa', 'data-pw',
        'data-test-id', 'data-automation', 'data-automation-id', 'data-selenium',
        'data-component', 'data-role', 'data-field', 'data-track'
      ];
      
      dataAttrs.forEach(attr => {
        if (snapshot.domAttributes[attr]) {
          selectors.push(`[${attr}="${snapshot.domAttributes[attr]}"]`);
        }
      });
      
      // Other useful attributes
      if (snapshot.domAttributes.href) {
        selectors.push(`[href="${snapshot.domAttributes.href}"]`);
      }
      
      if (snapshot.domAttributes.type) {
        selectors.push(`[type="${snapshot.domAttributes.type}"]`);
      }
      
      if (snapshot.domAttributes.name) {
        selectors.push(`[name="${snapshot.domAttributes.name}"]`);
      }
      
      // Class selector (limit to stable-looking classes)
      if (snapshot.domAttributes.class) {
        const classes = snapshot.domAttributes.class.split(' ')
          .filter(c => 
            c && 
            !c.match(/^[a-f0-9]{8}-/) && // No UUIDs
            !c.match(/^css-[0-9]+/) &&   // No CSS modules
            c.length > 2                   // Not too short
          )
          .slice(0, 2); // Max 2 classes
        
        if (classes.length > 0) {
          selectors.push(`.${classes.join('.')}`);
        }
      }
    }
    
    // Fall back to basic snapshot attributes if no DOM attributes
    if (selectors.length === 0) {
      return this.extractSelectors(snapshot);
    }
    
    return selectors.join('');
  }

  /**
   * Extract DOM attributes from all elements on the page
   */
  async extractDOMAttributes(page) {
    try {
      const domData = await page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        const attributeMap = new Map();
        
        // Scout's 20 automation attributes
        const targetAttributes = [
          'data-testid', 'data-test', 'data-cy', 'data-qa', 'data-pw',
          'data-test-id', 'data-automation', 'data-automation-id', 'data-selenium',
          'id', 'data-component', 'data-role', 'data-field',
          'aria-labelledby', 'aria-describedby', 'aria-controls',
          'href', 'formcontrolname', 'autocomplete', 'data-track',
          'type', 'name', 'class'
        ];
        
        elements.forEach((element, index) => {
          const attrs = {};
          let hasRelevantAttrs = false;
          
          targetAttributes.forEach(attrName => {
            const value = element.getAttribute(attrName);
            if (value) {
              attrs[attrName] = value;
              hasRelevantAttrs = true;
            }
          });
          
          if (hasRelevantAttrs) {
            // Create a unique identifier for the element
            const path = [];
            let current = element;
            while (current && current !== document.body) {
              const parent = current.parentElement;
              if (parent) {
                const index = Array.from(parent.children).indexOf(current);
                path.unshift(index);
              }
              current = parent;
            }
            attributeMap.set(path.join('-'), attrs);
          }
        });
        
        return Object.fromEntries(attributeMap);
      });
      
      return domData;
    } catch (error) {
      console.error('[TabInspection] Error extracting DOM attributes:', error);
      return {};
    }
  }

  /**
   * Enhance accessibility snapshot with DOM attributes
   */
  enhanceSnapshotWithAttributes(snapshot, domData, path = []) {
    if (!snapshot) return;
    
    // Try to match this node with DOM data
    const pathKey = path.join('-');
    if (domData[pathKey]) {
      snapshot.domAttributes = domData[pathKey];
    }
    
    // Process children
    if (snapshot.children && Array.isArray(snapshot.children)) {
      snapshot.children.forEach((child, index) => {
        this.enhanceSnapshotWithAttributes(child, domData, [...path, index]);
      });
    }
  }

  /**
   * Count elements in snapshot tree
   */
  countElements(snapshot) {
    if (!snapshot) return 0;
    
    let count = 1;
    if (snapshot.children && Array.isArray(snapshot.children)) {
      for (const child of snapshot.children) {
        count += this.countElements(child);
      }
    }
    return count;
  }

  /**
   * Get page instance for a specific tab
   * Note: This needs to be passed the nodeExecutor instance from DirectorService
   */
  async getPageForTab(workflowId, tabName, nodeExecutor) {
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
}

// Export singleton instance
export default new TabInspectionService();