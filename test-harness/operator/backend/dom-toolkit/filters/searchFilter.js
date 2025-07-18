/**
 * Search Filter - Find elements by various criteria
 * Like 'grep' for DOM elements
 */

export class SearchFilter {
  constructor() {
    // Cache compiled regexes for performance
    this.regexCache = new Map();
  }

  /**
   * Search for elements matching criteria
   */
  search(snapshot, options = {}) {
    const {
      query = {},
      limit = 20,
      context = null,
      visible = true
    } = options;

    // Validate query has at least one criterion
    if (!query.text && !query.selector && !query.attributes && !query.role && !query.tag) {
      return {
        elements: [],
        totalSearched: 0,
        error: 'At least one search criterion required (text, selector, attributes, role, or tag)'
      };
    }

    const matches = [];
    let totalSearched = 0;

    // If context is provided, find the context element first
    let contextNode = null;
    if (context) {
      contextNode = this.findElementById(snapshot, context);
      if (!contextNode) {
        return {
          elements: [],
          totalSearched: 0,
          error: `Context element ${context} not found`
        };
      }
    }

    // Determine which nodes to search
    const nodesToSearch = contextNode 
      ? this.getDescendants(contextNode, snapshot.nodeMap)
      : snapshot.nodes;

    // Search through nodes
    for (const node of nodesToSearch) {
      totalSearched++;

      // Skip non-element nodes
      if (node.type !== 1) continue;

      // Apply visibility filter
      if (visible && !node.visible) continue;

      // Check if node matches all criteria
      if (this.matchesQuery(node, query)) {
        matches.push(this.formatSearchResult(node, query));
        
        if (matches.length >= limit) {
          break;
        }
      }
    }

    return {
      elements: matches,
      totalSearched,
      matchesFound: matches.length,
      truncated: matches.length >= limit
    };
  }

  /**
   * Check if node matches search query
   */
  matchesQuery(node, query) {
    // All specified criteria must match (AND logic)
    
    // Tag filter
    if (query.tag && node.tag !== query.tag.toLowerCase()) {
      return false;
    }

    // Role filter
    if (query.role && node.attributes?.role !== query.role) {
      return false;
    }

    // Text search
    if (query.text) {
      if (!this.containsText(node, query.text)) {
        return false;
      }
    }

    // Selector matching
    if (query.selector) {
      if (!this.matchesSelector(node, query.selector)) {
        return false;
      }
    }

    // Attribute matching
    if (query.attributes) {
      if (!this.matchesAttributes(node, query.attributes)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if node contains text (case-insensitive)
   */
  containsText(node, searchText) {
    const lowerSearch = searchText.toLowerCase();
    
    // Check direct text content
    if (node.text && node.text.toLowerCase().includes(lowerSearch)) {
      return true;
    }

    // Check aria-label
    if (node.attributes?.['aria-label']?.toLowerCase().includes(lowerSearch)) {
      return true;
    }

    // Check value for inputs
    if (node.attributes?.value?.toLowerCase().includes(lowerSearch)) {
      return true;
    }

    // Check placeholder
    if (node.attributes?.placeholder?.toLowerCase().includes(lowerSearch)) {
      return true;
    }

    // Check title
    if (node.attributes?.title?.toLowerCase().includes(lowerSearch)) {
      return true;
    }

    return false;
  }

  /**
   * Check if node matches CSS selector
   */
  matchesSelector(node, selector) {
    // Simple selector matching - handles basic cases
    const selectorLower = selector.toLowerCase();

    // ID selector: #some-id
    if (selector.startsWith('#')) {
      const id = selector.substring(1);
      return node.attributes?.id === id;
    }

    // Class selector: .some-class
    if (selector.startsWith('.')) {
      const className = selector.substring(1);
      const classes = node.attributes?.class?.split(' ') || [];
      return classes.includes(className);
    }

    // Attribute selector: [name="value"]
    if (selector.startsWith('[') && selector.endsWith(']')) {
      return this.matchesAttributeSelector(node, selector);
    }

    // Tag selector: button, input, etc.
    if (/^[a-z]+$/i.test(selector)) {
      return node.tag === selectorLower;
    }

    // Tag with class: button.primary
    if (/^[a-z]+\.[a-z0-9-_]+$/i.test(selector)) {
      const [tag, className] = selector.split('.');
      if (node.tag !== tag.toLowerCase()) return false;
      const classes = node.attributes?.class?.split(' ') || [];
      return classes.includes(className);
    }

    // Tag with ID: button#submit
    if (/^[a-z]+#[a-z0-9-_]+$/i.test(selector)) {
      const [tag, id] = selector.split('#');
      return node.tag === tag.toLowerCase() && node.attributes?.id === id;
    }

    // For complex selectors, return false (would need full CSS parser)
    return false;
  }

  /**
   * Match attribute selector like [name="value"]
   */
  matchesAttributeSelector(node, selector) {
    // Remove brackets
    const inner = selector.slice(1, -1);
    
    // Parse different attribute selector formats
    if (inner.includes('=')) {
      const [attr, ...valueParts] = inner.split('=');
      const value = valueParts.join('=').replace(/^["']|["']$/g, ''); // Remove quotes
      
      if (inner.includes('*=')) {
        // Contains: [attr*=value]
        const attrName = attr.slice(0, -1);
        return node.attributes?.[attrName]?.includes(value);
      } else if (inner.includes('^=')) {
        // Starts with: [attr^=value]
        const attrName = attr.slice(0, -1);
        return node.attributes?.[attrName]?.startsWith(value);
      } else if (inner.includes('$=')) {
        // Ends with: [attr$=value]
        const attrName = attr.slice(0, -1);
        return node.attributes?.[attrName]?.endsWith(value);
      } else {
        // Exact match: [attr=value]
        return node.attributes?.[attr] === value;
      }
    } else {
      // Just presence: [attr]
      return node.attributes?.hasOwnProperty(inner);
    }
  }

  /**
   * Check if node matches all specified attributes
   */
  matchesAttributes(node, queryAttributes) {
    if (!node.attributes) return false;

    for (const [key, value] of Object.entries(queryAttributes)) {
      if (node.attributes[key] !== value) {
        return false;
      }
    }

    return true;
  }

  /**
   * Format search result for output
   */
  formatSearchResult(node, query) {
    const result = {
      id: `[${node.id}]`,
      tag: node.tag
    };

    // Add matched text if searching by text
    if (query.text) {
      if (node.text && node.text.toLowerCase().includes(query.text.toLowerCase())) {
        result.matchedText = this.highlightMatch(node.text, query.text);
      } else if (node.attributes?.['aria-label']?.toLowerCase().includes(query.text.toLowerCase())) {
        result.matchedText = `aria-label: ${this.highlightMatch(node.attributes['aria-label'], query.text)}`;
      }
    }

    // Add key attributes
    const attrs = {};
    if (node.attributes?.id) attrs.id = node.attributes.id;
    if (node.attributes?.class) attrs.class = node.attributes.class;
    if (node.attributes?.name) attrs.name = node.attributes.name;
    if (node.attributes?.type) attrs.type = node.attributes.type;
    if (node.attributes?.role) attrs.role = node.attributes.role;
    
    if (Object.keys(attrs).length > 0) {
      result.attributes = attrs;
    }

    // Add text preview if not already shown
    if (!result.matchedText && node.text) {
      result.text = node.text.length > 50 
        ? node.text.substring(0, 50) + '...'
        : node.text;
    }

    return result;
  }

  /**
   * Highlight matched text (simple approach)
   */
  highlightMatch(text, searchText) {
    // For now, just return the text with match context
    const index = text.toLowerCase().indexOf(searchText.toLowerCase());
    if (index === -1) return text;

    const start = Math.max(0, index - 20);
    const end = Math.min(text.length, index + searchText.length + 20);
    
    let result = '';
    if (start > 0) result += '...';
    result += text.substring(start, end);
    if (end < text.length) result += '...';
    
    return result;
  }

  /**
   * Find element by ID string like "[123]" or "123"
   */
  findElementById(snapshot, idString) {
    const id = parseInt(idString.replace(/[\[\]]/g, ''));
    return snapshot.nodeMap.get(id);
  }

  /**
   * Get all descendants of a node
   */
  getDescendants(node, nodeMap) {
    const descendants = [];
    const stack = [...(node.childIds || [])];

    while (stack.length > 0) {
      const childId = stack.pop();
      const child = nodeMap.get(childId);
      
      if (child) {
        descendants.push(child);
        if (child.childIds) {
          stack.push(...child.childIds);
        }
      }
    }

    return descendants;
  }
}