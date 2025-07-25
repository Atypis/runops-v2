/**
 * Element Inspector - Deep dive into element details
 * Provides comprehensive information about a specific element
 */

export class ElementInspector {
  constructor() {
    // Configuration for what to include
    this.maxTextLength = 500;
    this.maxAttributeValueLength = 200;
  }

  /**
   * Inspect an element by ID
   */
  inspect(snapshot, elementId, options = {}) {
    const {
      include = {
        attributes: true,
        computedStyles: false,
        children: true,
        siblings: false,
        parents: true,
        text: true
      }
    } = options;

    // Parse element ID
    const id = parseInt(elementId.replace(/[\[\]]/g, ''));
    const node = snapshot.nodeMap.get(id);

    if (!node) {
      return {
        success: false,
        error: `Element ${elementId} not found`
      };
    }

    // Build comprehensive element info
    const result = {
      success: true,
      element: this.buildElementInfo(node, include, snapshot.nodeMap),
      context: {}
    };

    // Add parent chain if requested
    if (include.parents) {
      result.context.parents = this.getParentChain(node, snapshot.nodeMap);
    }

    // Add children if requested
    if (include.children) {
      result.context.children = this.getChildren(node, snapshot.nodeMap);
    }

    // Add siblings if requested
    if (include.siblings) {
      result.context.siblings = this.getSiblings(node, snapshot.nodeMap);
    }

    return result;
  }

  /**
   * Build element information
   */
  buildElementInfo(node, include, nodeMap) {
    const info = {
      id: `[${node.id}]`,
      tag: node.tag,
      type: this.getElementType(node)
    };

    // Add visibility info
    info.visible = node.visible;
    info.inViewport = node.inViewport;

    // Add layout info if available
    if (node.layout) {
      info.position = {
        x: Math.round(node.layout.x),
        y: Math.round(node.layout.y),
        width: Math.round(node.layout.width),
        height: Math.round(node.layout.height)
      };
    }

    // Add attributes if requested
    if (include.attributes && node.attributes) {
      info.attributes = this.formatAttributes(node.attributes);
    }

    // Add text content if requested
    if (include.text) {
      info.text = this.getTextContent(node);
    }

    // Add selector suggestions
    info.selectors = this.generateSelectors(node);

    // Add interaction info
    if (this.isInteractive(node)) {
      info.interactive = {
        type: this.getInteractionType(node),
        enabled: !node.attributes?.disabled
      };
    }

    // Add actionability analysis
    info.actionability = this.analyzeActionability(node, nodeMap);

    return info;
  }

  /**
   * Analyze element actionability and provide suggestions
   */
  analyzeActionability(node, nodeMap) {
    const analysis = {
      isActionable: false,
      issues: [],
      suggestions: [],
      scrollContainer: null
    };

    // Check basic actionability
    if (!node.visible) {
      analysis.issues.push('Element is not visible');
      analysis.suggestions.push('Element may be hidden by CSS or parent visibility');
    }

    // Check for zero dimensions
    if (node.layout) {
      if (node.layout.height === 0) {
        analysis.issues.push('Element has zero height (0px)');
        analysis.suggestions.push('Element may be in a virtual scrolling container');
        
        // Find scroll container
        const scrollContainer = this.findScrollContainer(node, nodeMap);
        if (scrollContainer) {
          analysis.scrollContainer = scrollContainer;
          analysis.suggestions.push(`Use scrollIntoView with scrollContainer: "${scrollContainer}"`);
        }
        
        // Gmail-specific pattern
        if (node.tag === 'tr' && node.attributes?.class?.includes('zA')) {
          analysis.suggestions.push('Pattern: Gmail virtual scrolling detected');
          if (!scrollContainer) {
            analysis.scrollContainer = 'div.Cp';
            analysis.suggestions.push('Use scrollIntoView with scrollContainer: "div.Cp"');
          }
        }
      }
      
      if (node.layout.width === 0) {
        analysis.issues.push('Element has zero width (0px)');
      }
    } else {
      analysis.issues.push('No layout information available');
      analysis.suggestions.push('Element might not be rendered in the DOM');
    }

    // Check viewport status
    if (!node.inViewport && node.visible) {
      analysis.issues.push('Element is outside viewport');
      analysis.suggestions.push('Scroll element into view before interacting');
    }

    // Check if element is disabled
    if (node.attributes?.disabled) {
      analysis.issues.push('Element is disabled');
      analysis.suggestions.push('Element cannot be interacted with while disabled');
    }

    // Check if element is readonly
    if (node.attributes?.readonly) {
      analysis.issues.push('Element is readonly');
      analysis.suggestions.push('Element content cannot be modified');
    }

    // Check pointer-events
    if (node.attributes?.style?.includes('pointer-events: none')) {
      analysis.issues.push('Element has pointer-events: none');
      analysis.suggestions.push('Element cannot receive mouse events');
    }

    // Determine overall actionability
    const canInteract = this.isInteractive(node);
    const hasNoBlockingIssues = analysis.issues.length === 0 || 
      (analysis.issues.length === 1 && analysis.issues[0] === 'Element is outside viewport');
    
    analysis.isActionable = canInteract && hasNoBlockingIssues;

    // Add general suggestions based on element type
    if (canInteract && !analysis.isActionable) {
      if (node.tag === 'button' || node.tag === 'a') {
        analysis.suggestions.push('Alternative: Click inner element like span or text');
      }
      
      if (node.attributes?.class) {
        analysis.suggestions.push(`Alternative: Try selector ".${node.attributes.class.split(' ')[0]}"`);
      }
    }

    return analysis;
  }

  /**
   * Find the nearest scrollable container in parent chain
   */
  findScrollContainer(node, nodeMap) {
    let current = node;
    let depth = 0;

    while (current.parentId !== undefined && current.parentId !== null && depth < 10) {
      const parent = nodeMap.get(current.parentId);
      if (!parent) break;

      // Check if parent has overflow scroll/auto
      // Note: In real implementation, we'd check computed styles
      // For now, use common patterns
      if (parent.attributes?.class) {
        // Gmail pattern
        if (parent.attributes.class.includes('Cp') && parent.tag === 'div') {
          return 'div.Cp';
        }
        
        // Common scrollable container patterns
        if (parent.attributes.class.includes('scroll') || 
            parent.attributes.class.includes('overflow') ||
            parent.attributes.class.includes('viewport')) {
          return this.generateSelector(parent);
        }
      }

      // Check style attribute
      if (parent.attributes?.style && 
          (parent.attributes.style.includes('overflow: auto') || 
           parent.attributes.style.includes('overflow: scroll') ||
           parent.attributes.style.includes('overflow-y: auto') ||
           parent.attributes.style.includes('overflow-y: scroll'))) {
        return this.generateSelector(parent);
      }

      current = parent;
      depth++;

      // Stop at body
      if (parent.tag === 'body') break;
    }

    return null;
  }

  /**
   * Generate a simple selector for an element
   */
  generateSelector(node) {
    if (node.attributes?.id) {
      return `#${node.attributes.id}`;
    }
    if (node.attributes?.class) {
      const firstClass = node.attributes.class.split(' ')[0];
      return `${node.tag}.${firstClass}`;
    }
    return node.tag;
  }

  /**
   * Get element type description
   */
  getElementType(node) {
    // Semantic type based on tag and role
    if (node.tag === 'button' || node.attributes?.role === 'button') {
      return 'button';
    }
    if (node.tag === 'a') {
      return 'link';
    }
    if (node.tag === 'input') {
      const type = node.attributes?.type || 'text';
      return `input-${type}`;
    }
    if (node.tag === 'select') {
      return 'dropdown';
    }
    if (node.tag === 'textarea') {
      return 'textarea';
    }
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(node.tag)) {
      return 'heading';
    }
    if (node.tag === 'img') {
      return 'image';
    }
    if (node.tag === 'form') {
      return 'form';
    }
    if (node.tag === 'table') {
      return 'table';
    }
    if (node.tag === 'nav') {
      return 'navigation';
    }
    return 'element';
  }

  /**
   * Format attributes for display
   */
  formatAttributes(attributes) {
    const formatted = {};
    
    for (const [key, value] of Object.entries(attributes)) {
      // Truncate very long values
      if (typeof value === 'string' && value.length > this.maxAttributeValueLength) {
        formatted[key] = value.substring(0, this.maxAttributeValueLength) + '...';
      } else {
        formatted[key] = value;
      }
    }

    return formatted;
  }

  /**
   * Get all text content from element
   */
  getTextContent(node) {
    const content = {
      direct: node.text || null,
      ariaLabel: node.attributes?.['aria-label'] || null,
      title: node.attributes?.title || null,
      placeholder: node.attributes?.placeholder || null,
      value: node.attributes?.value || null
    };

    // Remove nulls
    Object.keys(content).forEach(key => {
      if (content[key] === null) {
        delete content[key];
      } else if (content[key].length > this.maxTextLength) {
        content[key] = content[key].substring(0, this.maxTextLength) + '...';
      }
    });

    return Object.keys(content).length > 0 ? content : null;
  }

  /**
   * Generate selector suggestions
   */
  generateSelectors(node) {
    const selectors = [];

    // ID selector
    if (node.attributes?.id) {
      selectors.push(`#${node.attributes.id}`);
    }

    // Data-testid selector
    if (node.attributes?.['data-testid']) {
      selectors.push(`[data-testid="${node.attributes['data-testid']}"]`);
    }

    // Name selector for form elements
    if (node.attributes?.name && this.isFormElement(node)) {
      selectors.push(`${node.tag}[name="${node.attributes.name}"]`);
    }

    // Aria-label selector
    if (node.attributes?.['aria-label']) {
      selectors.push(`[aria-label="${node.attributes['aria-label']}"]`);
    }

    // Class-based selector (first two classes)
    if (node.attributes?.class) {
      const classes = node.attributes.class.split(' ')
        .filter(c => c && !c.match(/^(is-|has-|hover|active|focus)/))
        .slice(0, 2);
      if (classes.length > 0) {
        selectors.push(`${node.tag}.${classes.join('.')}`);
      }
    }

    // Tag selector as fallback
    if (selectors.length === 0) {
      selectors.push(node.tag);
    }

    return selectors;
  }

  /**
   * Check if element is interactive
   */
  isInteractive(node) {
    const interactiveTags = ['button', 'a', 'input', 'select', 'textarea'];
    const interactiveRoles = ['button', 'link', 'textbox', 'combobox', 'checkbox', 'radio'];
    
    return interactiveTags.includes(node.tag) ||
           interactiveRoles.includes(node.attributes?.role) ||
           node.attributes?.onclick ||
           node.attributes?.tabindex === '0';
  }

  /**
   * Get interaction type
   */
  getInteractionType(node) {
    if (node.tag === 'button' || node.attributes?.role === 'button') {
      return 'click';
    }
    if (node.tag === 'a') {
      return 'navigate';
    }
    if (node.tag === 'input' || node.tag === 'textarea') {
      return 'type';
    }
    if (node.tag === 'select') {
      return 'select';
    }
    return 'interact';
  }

  /**
   * Check if element is a form element
   */
  isFormElement(node) {
    return ['input', 'select', 'textarea', 'button'].includes(node.tag);
  }

  /**
   * Get parent chain up to body
   */
  getParentChain(node, nodeMap) {
    const chain = [];
    let current = node;
    let depth = 0;

    while (current.parentId !== undefined && current.parentId !== null && depth < 10) {
      const parent = nodeMap.get(current.parentId);
      if (!parent) break;

      chain.push({
        id: `[${parent.id}]`,
        tag: parent.tag,
        classes: parent.attributes?.class,
        idAttr: parent.attributes?.id
      });

      current = parent;
      depth++;

      // Stop at body
      if (parent.tag === 'body') break;
    }

    return chain;
  }

  /**
   * Get immediate children
   */
  getChildren(node, nodeMap) {
    if (!node.childIds || node.childIds.length === 0) {
      return [];
    }

    return node.childIds
      .map(childId => {
        const child = nodeMap.get(childId);
        if (!child || child.type !== 1) return null; // Only element nodes

        return {
          id: `[${child.id}]`,
          tag: child.tag,
          type: this.getElementType(child),
          text: child.text ? 
            (child.text.length > 50 ? child.text.substring(0, 50) + '...' : child.text) : 
            null,
          childCount: child.childIds?.length || 0
        };
      })
      .filter(Boolean)
      .slice(0, 20); // Limit to 20 children
  }

  /**
   * Get sibling elements
   */
  getSiblings(node, nodeMap) {
    if (node.parentId === undefined || node.parentId === null) {
      return [];
    }

    const parent = nodeMap.get(node.parentId);
    if (!parent || !parent.childIds) {
      return [];
    }

    const siblings = [];
    const nodeIndex = parent.childIds.indexOf(node.id);

    // Get up to 3 siblings before and after
    const start = Math.max(0, nodeIndex - 3);
    const end = Math.min(parent.childIds.length, nodeIndex + 4); // +4 to skip self

    for (let i = start; i < end; i++) {
      if (i === nodeIndex) continue; // Skip self

      const siblingId = parent.childIds[i];
      const sibling = nodeMap.get(siblingId);
      
      if (sibling && sibling.type === 1) { // Only element nodes
        siblings.push({
          id: `[${sibling.id}]`,
          tag: sibling.tag,
          type: this.getElementType(sibling),
          position: i < nodeIndex ? 'before' : 'after',
          distance: Math.abs(i - nodeIndex)
        });
      }
    }

    return siblings;
  }
}