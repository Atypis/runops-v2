/**
 * Headings Filter - Extract headings and key text blocks
 * Helps understand page content and context
 */

export class HeadingsFilter {
  constructor() {
    // Heading tags
    this.headingTags = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
    
    // Minimum length for paragraph text to be considered "key text"
    this.minParagraphLength = 50;
    
    // Maximum text length to return
    this.maxTextLength = 100;
  }

  /**
   * Filter nodes to find headings and key text
   */
  filter(snapshot, options = {}) {
    const { 
      visible = true, 
      viewport = true, 
      max_rows = 20 
    } = options;
    
    const elements = [];
    let truncated = false;

    // Collect all text elements first
    const textElements = [];

    for (const node of snapshot.nodes) {
      // Skip non-element nodes
      if (node.type !== 1) continue;

      // Apply visibility filter
      if (visible && !node.visible) continue;

      // Check if it's a heading or key text
      if (this.isHeadingOrKeyText(node)) {
        textElements.push({
          node,
          priority: this.getPriority(node),
          inViewport: node.inViewport
        });
      }
    }

    // Sort by priority and viewport status
    textElements.sort((a, b) => {
      // Viewport elements first if filter is on
      if (viewport) {
        if (a.inViewport && !b.inViewport) return -1;
        if (!a.inViewport && b.inViewport) return 1;
      }
      // Then by priority (lower is better)
      return a.priority - b.priority;
    });

    // Take top elements up to max_rows
    for (const item of textElements) {
      if (elements.length >= max_rows) {
        truncated = true;
        break;
      }

      // Skip non-viewport elements if filter is on
      if (viewport && !item.inViewport) continue;

      const formatted = this.formatHeadingElement(item.node);
      if (formatted) {
        elements.push(formatted);
      }
    }

    return { elements, truncated };
  }

  /**
   * Check if node is a heading or key text
   */
  isHeadingOrKeyText(node) {
    // Check if it's a heading
    if (this.headingTags.has(node.tag)) {
      return node.text && node.text.trim().length > 0;
    }

    // Check if it's a paragraph with significant text
    if (node.tag === 'p' && node.text) {
      const textLength = node.text.trim().length;
      return textLength >= this.minParagraphLength;
    }

    // Check for elements with heading roles
    if (node.attributes.role === 'heading' && node.text) {
      return node.text.trim().length > 0;
    }

    // Check for styled text that might be important
    if (node.tag === 'div' || node.tag === 'span') {
      // Check for aria-level (indicates heading)
      if (node.attributes['aria-level'] && node.text) {
        return node.text.trim().length > 0;
      }
      
      // Could check for large font sizes here if we had computed styles
      // For now, skip generic divs/spans
    }

    return false;
  }

  /**
   * Get priority for sorting (lower is higher priority)
   */
  getPriority(node) {
    // H1 is highest priority
    if (node.tag === 'h1') return 1;
    if (node.tag === 'h2') return 2;
    if (node.tag === 'h3') return 3;
    if (node.tag === 'h4') return 4;
    if (node.tag === 'h5') return 5;
    if (node.tag === 'h6') return 6;
    
    // Aria headings by level
    if (node.attributes.role === 'heading') {
      const level = parseInt(node.attributes['aria-level'] || '6');
      return Math.min(level, 6);
    }
    
    // Paragraphs are lower priority
    if (node.tag === 'p') return 10;
    
    // Everything else
    return 20;
  }

  /**
   * Format heading element for output
   */
  formatHeadingElement(node) {
    if (!node.text) return null;

    const text = node.text.trim();
    if (!text) return null;

    const element = {
      id: `[${node.id}]`,
      tag: node.tag,
      text: this.truncateText(text, this.maxTextLength)
    };

    // Include original length if truncated
    if (text.length > this.maxTextLength) {
      element.length = text.length;
    }

    // Add aria-level for non-standard headings
    if (node.attributes.role === 'heading' && node.attributes['aria-level']) {
      element.level = parseInt(node.attributes['aria-level']);
    }

    return element;
  }

  /**
   * Truncate text to specified length
   */
  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    
    // Try to break at word boundary
    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.8) {
      // If we have a decent amount of text before the last space, break there
      return truncated.substring(0, lastSpace) + '...';
    }
    
    // Otherwise just truncate
    return truncated.substring(0, maxLength - 3) + '...';
  }
}