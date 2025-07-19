/**
 * Selector Hints Generator - Create multiple selector options for elements
 * Provides robust selector alternatives for the Director to choose from
 */

export class SelectorHints {
  constructor() {
    // Maximum number of hints to generate
    this.maxHints = 1;  // Changed from 4 to 1 for optimization
    
    // Preferred attribute order for selectors
    this.preferredAttributes = [
      'id', 'data-testid', 'data-test', 'data-cy', 
      'name', 'aria-label', 'type', 'role'
    ];
  }

  /**
   * Generate selector hints for an element
   * Now returns only the shortest unique selector for token efficiency
   */
  generate(element, snapshot) {
    const hints = [];
    
    // 1. ID selector (highest priority and usually shortest)
    const idHint = this.generateIdSelector(element);
    if (idHint) hints.push(idHint);

    // 2. Data attribute selectors
    const dataHints = this.generateDataSelectors(element);
    hints.push(...dataHints);

    // 3. Unique attribute selectors
    const attrHints = this.generateAttributeSelectors(element);
    hints.push(...attrHints);

    // 4. Text-based selector (for buttons/links)
    const textHint = this.generateTextSelector(element);
    if (textHint) hints.push(textHint);

    // 5. Structural selector (as fallback)
    const structuralHint = this.generateStructuralSelector(element, snapshot);
    if (structuralHint) {
      hints.push(structuralHint);
    }

    // Sort by length and return the shortest
    // In case of tie, prefer ID > data-testid > name > others
    const uniqueHints = [...new Set(hints)];
    const priorityOrder = ['#', '[data-testid=', '[data-test=', '[name=', '[aria-label='];
    
    return uniqueHints
      .sort((a, b) => {
        // First sort by length
        if (a.length !== b.length) {
          return a.length - b.length;
        }
        // If same length, sort by priority
        const aPriority = priorityOrder.findIndex(p => a.startsWith(p));
        const bPriority = priorityOrder.findIndex(p => b.startsWith(p));
        return (bPriority === -1 ? 999 : bPriority) - (aPriority === -1 ? 999 : aPriority);
      })
      .slice(0, 1);  // Return only the best selector
  }

  /**
   * Generate ID-based selector
   */
  generateIdSelector(element) {
    if (element.attributes?.id) {
      // Ensure ID is valid for CSS selector
      const id = element.attributes.id;
      if (this.isValidCssIdentifier(id)) {
        return `#${id}`;
      } else {
        // Escape special characters
        return `[id="${this.escapeAttributeValue(id)}"]`;
      }
    }
    return null;
  }

  /**
   * Generate data attribute selectors
   */
  generateDataSelectors(element) {
    const hints = [];
    if (!element.attributes) return hints;

    // Look for test-related data attributes
    const testAttributes = [
      'data-testid', 'data-test', 'data-test-id',
      'data-cy', 'data-qa', 'data-testing'
    ];

    for (const attr of testAttributes) {
      if (element.attributes[attr]) {
        hints.push(`[${attr}="${this.escapeAttributeValue(element.attributes[attr])}"]`);
      }
    }

    // Look for other meaningful data attributes
    for (const [key, value] of Object.entries(element.attributes)) {
      if (key.startsWith('data-') && 
          !testAttributes.includes(key) && 
          value && 
          value.length < 50) { // Skip very long values
        
        // Only include if it seems meaningful (not a hash or UUID)
        if (!this.looksLikeHash(value)) {
          hints.push(`[${key}="${this.escapeAttributeValue(value)}"]`);
        }
      }
    }

    return hints;
  }

  /**
   * Generate attribute-based selectors
   */
  generateAttributeSelectors(element) {
    const hints = [];
    if (!element.attributes) return hints;

    // Name attribute (great for form inputs)
    if (element.attributes.name) {
      const selector = `${element.tag}[name="${this.escapeAttributeValue(element.attributes.name)}"]`;
      hints.push(selector);
    }

    // Aria-label (good for accessibility)
    if (element.attributes['aria-label']) {
      const selector = `${element.tag}[aria-label="${this.escapeAttributeValue(element.attributes['aria-label'])}"]`;
      hints.push(selector);
    }

    // Type + other attributes for inputs
    if (element.tag === 'input' && element.attributes.type) {
      const type = element.attributes.type;
      
      // Add placeholder if exists
      if (element.attributes.placeholder) {
        hints.push(`input[type="${type}"][placeholder="${this.escapeAttributeValue(element.attributes.placeholder)}"]`);
      } else {
        hints.push(`input[type="${type}"]`);
      }
    }

    // Role-based selector
    if (element.attributes.role) {
      hints.push(`[role="${element.attributes.role}"]`);
    }

    // Href for links (only if not too long)
    if (element.tag === 'a' && element.attributes.href) {
      const href = element.attributes.href;
      if (href.length < 50 && !href.startsWith('javascript:')) {
        hints.push(`a[href="${this.escapeAttributeValue(href)}"]`);
      } else if (href.includes('#')) {
        // Include anchor links
        const anchor = href.substring(href.indexOf('#'));
        hints.push(`a[href$="${this.escapeAttributeValue(anchor)}"]`);
      }
    }

    return hints;
  }

  /**
   * Generate text-based selector
   */
  generateTextSelector(element) {
    // Only for elements where text is a good identifier
    if (!['button', 'a'].includes(element.tag) && element.attributes?.role !== 'button') {
      return null;
    }

    const text = element.text || element.attributes?.['aria-label'];
    if (!text || text.length > 50) return null;

    // Clean and escape text
    const cleanText = text.trim();
    if (!cleanText) return null;

    // Use :contains pseudo-selector (note: this is not standard CSS)
    // The Director's browser automation likely supports this
    return `${element.tag}:contains('${this.escapeTextForSelector(cleanText)}')`;
  }

  /**
   * Generate structural selector based on position
   */
  generateStructuralSelector(element, snapshot) {
    // Build a selector based on element's position in parent
    // This is a fallback when no better selector exists
    
    const tag = element.tag;
    const classes = this.getStableClasses(element);
    
    let selector = tag;
    
    // Add stable classes
    if (classes.length > 0) {
      selector += '.' + classes.slice(0, 2).join('.'); // Max 2 classes
    }

    // If we have parent info from snapshot, we could add :nth-child
    // For now, keep it simple
    
    return selector;
  }

  /**
   * Get stable classes (excluding dynamic ones)
   */
  getStableClasses(element) {
    if (!element.attributes?.class) return [];

    const classes = element.attributes.class.split(' ').filter(c => {
      // Filter out likely dynamic classes
      return c && 
        !c.match(/^js-/) && // JavaScript hooks
        !c.match(/^is-/) && // State classes
        !c.match(/^has-/) && // State classes  
        !c.match(/^hover/) && // Hover states
        !c.match(/^active/) && // Active states
        !c.match(/^focus/) && // Focus states
        !c.match(/\d{4,}/) && // Timestamps or IDs
        c.length < 30; // Very long classes are often generated
    });

    return classes;
  }

  /**
   * Check if value looks like a hash or UUID
   */
  looksLikeHash(value) {
    // UUID pattern
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      return true;
    }
    
    // Hash-like pattern (long string of hex characters)
    if (/^[0-9a-f]{16,}$/i.test(value)) {
      return true;
    }

    // Base64-like pattern
    if (/^[A-Za-z0-9+/]{20,}={0,2}$/.test(value)) {
      return true;
    }

    return false;
  }

  /**
   * Check if string is valid CSS identifier
   */
  isValidCssIdentifier(str) {
    // CSS identifier rules: start with letter, -, or _
    // followed by letters, digits, -, _
    return /^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(str);
  }

  /**
   * Escape attribute value for use in selector
   */
  escapeAttributeValue(value) {
    // Escape quotes and backslashes
    return value.replace(/["\\]/g, '\\$&');
  }

  /**
   * Escape text for use in :contains selector
   */
  escapeTextForSelector(text) {
    // Escape single quotes and backslashes
    return text.replace(/['\\]/g, '\\$&');
  }
}