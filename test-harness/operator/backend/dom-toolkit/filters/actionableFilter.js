/**
 * ActionableFilter - Browser-Use inspired actionability detection with Director enhancements
 * 
 * Implements sophisticated multi-heuristic filtering to identify truly interactive elements,
 * with aggressive filtering for elements that are disabled, occluded, or otherwise non-actionable.
 * 
 * Phase 1: Data-driven configuration support
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

export class ActionableFilter {
  constructor() {
    // Load configuration
    this.loadConfiguration();
    
    // Initialize static data structures (config-independent)
    // Interactive tag whitelist (Browser-Use approach)
    this.interactiveTags = new Set([
      'a', 'button', 'input', 'select', 'textarea', 'label', 
      'details', 'summary', 'option', 'menuitem'
    ]);
    
    // Interactive ARIA roles (Browser-Use approach)
    this.interactiveRoles = new Set([
      'button', 'link', 'menuitem', 'menuitemradio', 'menuitemcheckbox',
      'radio', 'checkbox', 'tab', 'switch', 'slider', 'spinbutton',
      'combobox', 'searchbox', 'textbox', 'listbox', 'option', 'scrollbar'
    ]);
    
    // ARIA state attributes that indicate interactivity
    this.ariaStateAttrs = ['aria-expanded', 'aria-pressed', 'aria-selected', 'aria-checked'];
    
    // Framework click handler attributes
    this.frameworkAttrs = ['ng-click', '@click', 'v-on:click', 'onclick'];
    
    // Semantic clickable classes (common patterns in modern apps)
    this.clickableClasses = [
      'clickable', 'selectable', 'interactive', 'actionable',
      'rowSelectionEnabled', 'rowExpansionEnabled', 'cellClickable', 'hoverable',
      'data-row', 'table-row', 'list-item', 'card', 'dataRow'
    ];
    
    // Test ID patterns that suggest clickability
    this.clickableTestIds = [
      'data-row', 'data-cell', 'clickable', 'selectable',
      'list-item', 'card', 'tile', 'row'
    ];
  }

  /**
   * Load configuration from JSON file
   */
  loadConfiguration() {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const configPath = join(__dirname, '../../config/actionable-weights.json');
      const configData = readFileSync(configPath, 'utf8');
      this.config = JSON.parse(configData);
    } catch (error) {
      console.warn('[ActionableFilter] Failed to load config, using defaults:', error.message);
      // Fallback to hardcoded defaults
      this.config = {
        weights: {
          interactiveTag: 10,
          ariaRole: 8,
          clickListener: 4,
          textLength: 3,
          tableCellTextBoost: 25,
          giantWrapperPenalty: -30,
          frameworkAttrs: 12,
          tabIndex: 8,
          draggable: 5,
          contentEditable: 10,
          ariaState: 8,
          clickableClasses: 10,
          decorativeElementPenalty: -5
        },
        rules: {
          tableSelectorRegex: "dataRow|rowSelectionEnabled|ag-row|tbody|tr|table|grid",
          maxAncestorDepth: 5,
          parentChildScoreDelta: 5,
          maxContainerAreaRatio: 0.3,
          minSignificantTextLength: 1,
          maxSignificantTextLength: 100,
          minElementArea: 144
        },
        features: {
          enableTableCellBoost: true,
          enableContainerPenalty: true,
          enableEventDelegation: true,
          enablePointerEventsCheck: true
        }
      };
    }
  }
  
  /**
   * Main filter method - determines if element is actionable
   * Now includes Shadow DOM and iframe traversal for Browser-Use parity
   */
  filter(snapshot, options = {}) {
    const { visible = true, viewport = true, max_rows = 50 } = options;
    const elements = [];
    let elementIndex = 1;
    
    // Traverse snapshot nodes (this handles the main DOM tree)
    for (const node of snapshot.nodes) {
      if (node.type !== 1) continue; // Only element nodes
      
      if (this.isActionableElement(node, snapshot) && 
          this.isElementSignificant(node) &&
          (!visible || this.isElementVisible(node)) &&
          (!viewport || this.isInViewport(node, snapshot))) {
        
        const element = {
          id: `[${elementIndex}]`,
          tag: node.tag,
          text: this.extractText(node).substring(0, 50) || '',
          type: this.getElementType(node)
        };
        
        // Store node reference for screenshot correlation
        element._nodeId = node.id; 
        elements.push(element);
        elementIndex++;
        
        if (max_rows > 0 && elements.length >= max_rows) {
          break;
        }
      }
    }
    
    return {
      elements,
      total: elements.length,
      truncated: max_rows > 0 && elements.length >= max_rows ? 1 : 0
    };
  }

  /**
   * Enhanced filter with live DOM traversal for Shadow DOM and iframe support
   * This method runs in the browser context for full Browser-Use parity
   */
  filterWithLiveTraversal(options = {}) {
    const { visible = true, viewport = true, max_rows = 50 } = options;
    const elements = [];
    let elementIndex = 1;
    const processedElements = new Set(); // Prevent duplicates
    
    // Browser-Use style traversal function
    const traverse = (node, offset = {x: 0, y: 0}) => {
      if (!node || max_rows > 0 && elements.length >= max_rows) return;
      
      if (node.nodeType === Node.ELEMENT_NODE) {
        const elementKey = this.getElementKey(node);
        if (!processedElements.has(elementKey)) {
          processedElements.add(elementKey);
          
          if (this.isActionableElementLive(node, offset) && 
              this.isElementSignificantLive(node) &&
              (!visible || this.isElementVisibleLive(node))) {
            
            const element = {
              id: `[${elementIndex}]`,
              tag: node.tagName.toLowerCase(),
              text: this.extractTextLive(node).substring(0, 50) || '',
              type: this.getElementTypeLive(node),
              _domElement: node // Store for screenshot correlation
            };
            
            elements.push(element);
            elementIndex++;
          }
        }
      }
      
      // Walk children
      for (const child of node.childNodes) {
        traverse(child, offset);
      }

      // Walk open shadow root (Browser-Use parity)
      if (node.shadowRoot && node.shadowRoot.mode === 'open') {
        traverse(node.shadowRoot, offset);
      }
    };

    // Start traversal from document body
    traverse(document.body);

    // Handle same-origin iframes (Browser-Use parity)
    for (const iframe of document.querySelectorAll('iframe')) {
      try {
        if (iframe.contentDocument && iframe.contentDocument.body) {
          const rect = iframe.getBoundingClientRect();
          const offset = { x: rect.left, y: rect.top };
          traverse(iframe.contentDocument.body, offset);
        }
      } catch (e) {
        // Cross-origin iframe - skip silently
        console.debug('[ActionableFilter] Skipping cross-origin iframe:', iframe.src);
      }
    }
    
    return {
      elements,
      total: elements.length,
      truncated: max_rows > 0 && elements.length >= max_rows ? 1 : 0
    };
  }
  
  /**
   * Core actionability detection with multi-heuristic approach
   */
  isActionableElement(node, snapshot) {
    // Fast rejection for obvious non-candidates
    if (!node || node.type !== 1) return false;
    if (node.attributes?.id === 'director-highlight-container') return false;
    
    const tagName = node.tag.toLowerCase();
    
    // 1. Tag whitelist (Browser-Use approach)
    if (this.interactiveTags.has(tagName)) {
      // Director enhancement: Check for disabled state
      if (this.isElementDisabled(node)) return false;
      return true;
    }
    
    // 2. ARIA roles (Browser-Use approach)  
    const role = node.attributes?.role;
    if (role && this.interactiveRoles.has(role)) return true;
    
    // 3. Tabindex check (Browser-Use approach)
    const tabIndex = node.attributes?.tabindex;
    if (tabIndex !== undefined && parseInt(tabIndex) >= 0) return true;
    
    // 4. Contenteditable (Director enhancement)
    if (node.attributes?.contenteditable === 'true' || 
        node.attributes?.contenteditable === '') return true;
    
    // 5. Event listener detection (Browser-Use approach)
    if (this.hasClickHandlers(node)) return true;
    
    // 6. ARIA state attributes (Browser-Use approach)
    if (this.ariaStateAttrs.some(attr => node.attributes?.hasOwnProperty(attr))) return true;
    
    // 7. Draggable (Browser-Use approach)
    if (node.attributes?.draggable === 'true') return true;
    
    return false;
  }
  
  /**
   * Comprehensive disabled detection (Director enhancement)
   */
  isElementDisabled(node) {
    const attrs = node.attributes || {};
    
    // Standard disabled checks
    if (attrs.disabled !== undefined) return true;
    if (attrs['aria-disabled'] === 'true') return true;
    if (attrs.readonly !== undefined) return true;
    if (attrs.inert !== undefined) return true;
    
    // Visual disabled indicators
    const style = attrs.style || '';
    if (style.includes('cursor: not-allowed') || 
        style.includes('cursor: disabled')) return true;
    
    return false;
  }
  
  /**
   * Click handler detection across frameworks
   */
  hasClickHandlers(node) {
    const attrs = node.attributes || {};
    
    // Check framework handlers and inline handlers
    return this.frameworkAttrs.some(attr => attrs.hasOwnProperty(attr));
  }
  
  /**
   * Enhanced visibility check
   */
  isElementVisible(node) {
    const attrs = node.attributes || {};
    const style = attrs.style || '';
    
    // Basic CSS visibility checks
    if (style.includes('display: none') || 
        style.includes('visibility: hidden') ||
        style.includes('opacity: 0')) return false;
    
    // Check computed visibility from snapshot
    if (node.isVisible === false) return false;
    
    return true;
  }
  
  /**
   * Viewport intersection check
   */
  isInViewport(node, snapshot) {
    if (!node.boundingBox || !snapshot.viewport) return true; // Assume visible if no data
    
    const box = node.boundingBox;
    const viewport = snapshot.viewport;
    
    return (
      box.x < viewport.width &&
      box.x + box.width > 0 &&
      box.y < viewport.height &&
      box.y + box.height > 0
    );
  }
  
  /**
   * Size-based noise reduction
   */
  isElementSignificant(node) {
    const box = node.boundingBox;
    if (!box) return true; // Assume significant if no size data
    
    const area = box.width * box.height;
    
    // Always include form controls regardless of size
    const alwaysInclude = ['button', 'input', 'select', 'textarea', 'a'];
    if (alwaysInclude.includes(node.tag.toLowerCase())) {
      return true;
    }
    
    // Skip very small non-control elements (noise reduction)
    return area >= 144; // 12x12 minimum
  }
  
  /**
   * Extract meaningful text from node
   */
  extractText(node) {
    // Try various text sources
    if (node.textContent && node.textContent.trim()) {
      return node.textContent.trim();
    }
    
    // Fallback to attributes
    const attrs = node.attributes || {};
    return attrs.placeholder || attrs.title || attrs.alt || attrs.value || '';
  }
  
  /**
   * Determine element type for classification
   */
  getElementType(node) {
    const tag = node.tag.toLowerCase();
    const type = node.attributes?.type;
    const role = node.attributes?.role;
    
    if (tag === 'button' || role === 'button') return 'button';
    if (tag === 'a') return 'link'; 
    if (tag === 'input') return type || 'input';
    if (tag === 'select') return 'select';
    if (tag === 'textarea') return 'textarea';
    if (node.attributes?.contenteditable === 'true') return 'contenteditable';
    
    return tag;
  }
  
  /**
   * Live DOM helper methods for Browser-Use parity traversal
   */
  
  getElementKey(element) {
    // Create unique key for deduplication
    const rect = element.getBoundingClientRect();
    return `${element.tagName}-${rect.x}-${rect.y}-${rect.width}-${rect.height}-${element.textContent?.substring(0, 20) || ''}`;
  }
  
  isActionableElementLive(element, offset = {x: 0, y: 0}) {
    const tagName = element.tagName.toLowerCase();
    
    // 1. Tag whitelist (Browser-Use approach)
    if (this.interactiveTags.has(tagName)) {
      if (this.isElementDisabledLive(element)) return false;
      return true;
    }
    
    // 2. ARIA roles (Browser-Use approach)  
    const role = element.getAttribute('role');
    if (role && this.interactiveRoles.has(role)) return true;
    
    // 3. Tabindex check (Browser-Use approach)
    if (element.tabIndex >= 0) return true;
    
    // 4. Contenteditable (Director enhancement)
    if (element.isContentEditable || element.getAttribute('contenteditable') === 'true') {
      return true;
    }
    
    // 5. Event listener detection (Browser-Use approach)
    if (this.hasClickHandlersLive(element)) return true;
    
    // 6. ARIA state attributes (Browser-Use approach)
    if (this.ariaStateAttrs.some(attr => element.hasAttribute(attr))) return true;
    
    // 7. Draggable (Browser-Use approach)
    if (element.draggable) return true;
    
    // 8. Semantic class detection (modern React apps)
    const className = element.className || '';
    if (this.clickableClasses.some(cls => className.includes(cls))) {
      return true;
    }
    
    // 8b. Parent chain semantic class detection (for table cells in clickable rows)
    if (this.hasClickableParent(element)) {
      return true;
    }
    
    // 9. Test ID patterns (data-testid, data-*, etc.)
    const testId = element.getAttribute('data-testid') || '';
    if (this.clickableTestIds.some(pattern => testId.includes(pattern))) {
      return true;
    }
    
    // 9b. Specific Airtable table row detection
    if (testId === 'data-row') {
      return true;
    }
    
    // 10. Cursor pointer detection (modern apps with CSS-only interactions)
    const style = window.getComputedStyle(element);
    if (style.cursor === 'pointer') return true;
    
    // 11. Pointer-events check (Browser-Use parity)  
    if (style.pointerEvents === 'none') return false;
    
    return false;
  }
  
  isElementDisabledLive(element) {
    // Enhanced disabled detection for live DOM
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
    // Check inline handlers
    if (element.onclick || element.getAttribute('onclick')) return true;
    
    // Check framework handlers  
    if (this.frameworkAttrs.some(attr => element.hasAttribute(attr))) return true;
    
    // Check programmatic listeners (Browser-Use approach)
    try {
      if (typeof getEventListeners === 'function') {
        const listeners = getEventListeners(element);
        const mouseEvents = ['click', 'mousedown', 'mouseup', 'touchstart', 'touchend'];
        return mouseEvents.some(event => listeners[event] && listeners[event].length > 0);
      }
    } catch (e) {
      // Fallback to property checks
      const eventProps = ['onclick', 'onmousedown', 'onmouseup'];
      return eventProps.some(prop => typeof element[prop] === 'function');
    }
    
    return false;
  }
  
  isElementVisibleLive(element) {
    // Enhanced visibility check for live DOM
    if (element.offsetWidth === 0 || element.offsetHeight === 0) return false;
    
    const style = window.getComputedStyle(element);
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    if (parseFloat(style.opacity) === 0) return false;
    
    // Use modern checkVisibility if available
    try {
      return element.checkVisibility({
        checkOpacity: true,
        checkVisibilityCSS: true
      });
    } catch (e) {
      return true; // Fallback if checkVisibility not supported
    }
  }
  
  isElementSignificantLive(element) {
    const rect = element.getBoundingClientRect();
    const area = rect.width * rect.height;
    
    // Always include form controls regardless of size
    const alwaysInclude = ['button', 'input', 'select', 'textarea', 'a'];
    if (alwaysInclude.includes(element.tagName.toLowerCase())) {
      return true;
    }
    
    // Always include table rows and other semantic elements
    const testId = element.getAttribute('data-testid') || '';
    const className = element.className || '';
    if (testId === 'data-row' || className.includes('rowSelectionEnabled')) {
      return true;
    }
    
    // Skip very small non-control elements (noise reduction)
    return area >= 144; // 12x12 minimum
  }
  
  extractTextLive(element) {
    // Try various text sources
    if (element.textContent && element.textContent.trim()) {
      return element.textContent.trim();
    }
    
    // Fallback to attributes
    return element.placeholder || element.title || element.alt || element.value || '';
  }
  
  getElementTypeLive(element) {
    const tag = element.tagName.toLowerCase();
    const type = element.getAttribute('type');
    const role = element.getAttribute('role');
    
    if (tag === 'button' || role === 'button') return 'button';
    if (tag === 'a') return 'link'; 
    if (tag === 'input') return type || 'input';
    if (tag === 'select') return 'select';
    if (tag === 'textarea') return 'textarea';
    if (element.isContentEditable) return 'contenteditable';
    
    return tag;
  }

  /**
   * Check if element has a clickable parent (for nested interactive patterns)
   */
  hasClickableParent(element, maxDepth = 5) {
    let current = element.parentElement;
    let depth = 0;
    
    while (current && depth < maxDepth) {
      const className = current.className || '';
      
      // Check for clickable parent classes
      if (this.clickableClasses.some(cls => className.includes(cls))) {
        return true;
      }
      
      // Check for Airtable-specific patterns
      if (className.includes('rowSelectionEnabled') || 
          className.includes('rowExpansionEnabled') ||
          className.includes('dataRow')) {
        return true;
      }
      
      // Check parent test IDs
      const testId = current.getAttribute('data-testid') || '';
      if (this.clickableTestIds.some(pattern => testId.includes(pattern))) {
        return true;
      }
      
      current = current.parentElement;
      depth++;
    }
    
    return false;
  }

  /**
   * Generate stable selectors for actionable elements (optional enhancement)
   */
  generateStableSelectors(node, snapshot) {
    const selectors = [];
    const attrs = node.attributes || {};
    
    // ID selector (most stable)
    if (attrs.id) {
      selectors.push(`#${attrs.id}`);
    }
    
    // Data attributes (test-friendly)
    Object.keys(attrs).forEach(attr => {
      if (attr.startsWith('data-test') || attr.startsWith('data-cy')) {
        selectors.push(`[${attr}="${attrs[attr]}"]`);
      }
    });
    
    // Class-based selectors
    if (attrs.class) {
      const classes = attrs.class.split(' ').filter(c => c.length > 0);
      if (classes.length > 0) {
        selectors.push(`.${classes[0]}`);
      }
    }
    
    // Attribute-based selectors
    if (attrs.name) {
      selectors.push(`${node.tag}[name="${attrs.name}"]`);
    }
    
    // Fallback tag selector
    selectors.push(node.tag.toLowerCase());
    
    return selectors;
  }
}