/**
 * Interactives Filter - Find clickable/typeable elements
 * The workhorse for finding actionable UI elements
 */

export class InteractivesFilter {
  constructor() {
    // Interactive HTML tags
    this.interactiveTags = new Set([
      'button', 'a', 'input', 'select', 'textarea'
    ]);

    // Interactive ARIA roles (subset of WAI-ARIA widget roles)
    this.interactiveRoles = new Set([
      'button', 'link', 'textbox', 'combobox', 'checkbox', 
      'radio', 'switch', 'tab', 'menuitem', 'option',
      'searchbox', 'spinbutton', 'slider'
    ]);

    // Input types that are interactive
    this.interactiveInputTypes = new Set([
      'text', 'password', 'email', 'number', 'tel', 'url',
      'search', 'date', 'time', 'datetime-local', 'month',
      'week', 'color', 'file', 'checkbox', 'radio', 'submit',
      'button', 'reset'
    ]);
  }

  /**
   * Filter nodes to find interactive elements
   */
  filter(snapshot, options = {}) {
    const { 
      visible = true, 
      viewport = true, 
      max_rows = 30,
      roleFilter = null 
    } = options;
    
    const elements = [];
    let truncated = false;

    // Traverse all nodes looking for interactive elements
    for (const node of snapshot.nodes) {
      if (elements.length >= max_rows) {
        truncated = true;
        break;
      }

      // Skip non-element nodes
      if (node.type !== 1) continue;

      // Apply visibility filter
      if (visible && !node.visible) continue;

      // Apply viewport filter
      if (viewport && !node.inViewport) continue;

      // Check if interactive
      if (!this.isInteractive(node, roleFilter)) continue;

      // Format and add element
      const formatted = this.formatInteractiveElement(node);
      if (formatted) {
        elements.push(formatted);
      }
    }

    return { elements, truncated };
  }

  /**
   * Check if node is interactive
   */
  isInteractive(node, roleFilter = null) {
    // Check role filter first if provided
    if (roleFilter && roleFilter.length > 0) {
      const nodeRole = node.attributes.role || this.inferRole(node);
      if (!roleFilter.includes(nodeRole)) return false;
    }

    // Check by tag
    if (this.interactiveTags.has(node.tag)) {
      // Special handling for inputs
      if (node.tag === 'input') {
        const type = node.attributes.type || 'text';
        return this.interactiveInputTypes.has(type);
      }
      return true;
    }

    // Check by ARIA role
    if (node.attributes.role && this.interactiveRoles.has(node.attributes.role)) {
      return true;
    }

    // Check for click handlers (onclick attribute)
    if (node.attributes.onclick) {
      return true;
    }

    // Check for contenteditable
    if (node.attributes.contenteditable === 'true') {
      return true;
    }

    // Check for tabindex (makes element focusable/interactive)
    if (node.attributes.tabindex && node.attributes.tabindex !== '-1') {
      return true;
    }

    return false;
  }

  /**
   * Format interactive element for output
   */
  formatInteractiveElement(node) {
    const element = {
      id: `[${node.id}]`,
      type: this.getInteractiveType(node),
      tag: node.tag
    };

    // Add text content for buttons and links
    if (node.tag === 'button' || node.tag === 'a' || node.attributes.role === 'button') {
      const text = this.extractText(node);
      if (text) {
        element.text = this.truncateText(text, 50);
      }
    }

    // Add label for form inputs
    const label = this.extractLabel(node);
    if (label) {
      element.label = this.truncateText(label, 50);
    }

    // Add current value for inputs (truncated)
    if (this.hasValue(node)) {
      const value = node.attributes.value || '';
      if (value) {
        element.value = this.truncateText(value, 80);
      }
    }

    // Add key attributes
    element.attributes = this.extractKeyAttributes(node);

    return element;
  }

  /**
   * Determine interactive element type
   */
  getInteractiveType(node) {
    if (node.tag === 'a') return 'link';
    if (node.tag === 'button') return 'button';
    if (node.tag === 'select') return 'select';
    if (node.tag === 'textarea') return 'textarea';
    
    if (node.tag === 'input') {
      const type = node.attributes.type || 'text';
      if (type === 'checkbox' || type === 'radio') return type;
      if (type === 'submit' || type === 'button') return 'button';
      return 'input';
    }

    // Role-based type
    if (node.attributes.role === 'button') return 'button';
    if (node.attributes.role === 'link') return 'link';
    if (node.attributes.role === 'textbox') return 'input';

    return 'interactive';
  }

  /**
   * Extract visible text from node
   */
  extractText(node) {
    // Direct text content
    if (node.text) return node.text;

    // ARIA label
    if (node.attributes['aria-label']) {
      return node.attributes['aria-label'];
    }

    // Title attribute
    if (node.attributes.title) {
      return node.attributes.title;
    }

    // Value for inputs
    if (node.tag === 'input' && node.attributes.value) {
      return node.attributes.value;
    }

    return null;
  }

  /**
   * Extract label for form inputs
   */
  extractLabel(node) {
    // Check aria-label first
    if (node.attributes['aria-label']) {
      return node.attributes['aria-label'];
    }

    // Check placeholder
    if (node.attributes.placeholder) {
      return node.attributes.placeholder;
    }

    // Check associated label via aria-labelledby
    if (node.attributes['aria-labelledby']) {
      // This would need to look up the referenced element
      // For now, we'll skip this complexity
    }

    // Check name attribute as fallback
    if (node.attributes.name) {
      // Convert name to readable format (e.g., "user_email" -> "User email")
      return node.attributes.name
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .trim()
        .toLowerCase()
        .replace(/^\w/, c => c.toUpperCase());
    }

    return null;
  }

  /**
   * Extract key attributes for identification
   */
  extractKeyAttributes(node) {
    const attrs = {};
    const LONG_ATTR_THRESHOLD = 40;
    const LONG_ATTRS = ['href', 'src', 'placeholder', 'value'];

    // Always include these if present
    const includeAttrs = ['name', 'type', 'role', 'href', 'id'];
    
    for (const attr of includeAttrs) {
      if (node.attributes[attr]) {
        const value = node.attributes[attr];
        
        // Apply length filtering for long attributes
        if (LONG_ATTRS.includes(attr) && value.length > LONG_ATTR_THRESHOLD) {
          // Only include long attributes if they're the only identifying feature
          const hasOtherIdentifiers = node.text || 
                                     node.attributes.id || 
                                     node.attributes.name ||
                                     node.attributes['aria-label'];
          
          if (!hasOtherIdentifiers) {
            // Keep it but truncate for display
            const href = value;
            attrs[attr] = href.substring(0, 20) + '...';
          }
          // Otherwise skip this long attribute entirely
        } else {
          // Keep short attributes or non-long-attr types
          attrs[attr] = value;
        }
      }
    }

    // Include placeholder if no label and it's short enough
    if (!attrs['aria-label'] && node.attributes.placeholder) {
      const placeholder = node.attributes.placeholder;
      if (placeholder.length <= LONG_ATTR_THRESHOLD) {
        attrs.placeholder = placeholder;
      }
    }

    return attrs;
  }

  /**
   * Check if element can have a value
   */
  hasValue(node) {
    if (node.tag === 'input' || node.tag === 'textarea' || node.tag === 'select') {
      const type = node.attributes.type || 'text';
      // Skip types that don't have text values
      return type !== 'checkbox' && type !== 'radio' && type !== 'submit' && type !== 'button';
    }
    return false;
  }

  /**
   * Infer role from tag/type
   */
  inferRole(node) {
    if (node.tag === 'a') return 'link';
    if (node.tag === 'button') return 'button';
    if (node.tag === 'input') {
      const type = node.attributes.type || 'text';
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      return 'textbox';
    }
    if (node.tag === 'select') return 'combobox';
    if (node.tag === 'textarea') return 'textbox';
    return null;
  }

  /**
   * Truncate text to specified length
   */
  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }
}