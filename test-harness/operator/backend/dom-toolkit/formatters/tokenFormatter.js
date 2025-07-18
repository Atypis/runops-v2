/**
 * Token Formatter - Format DOM data for minimal token usage
 * Balances readability with token efficiency
 */

export class TokenFormatter {
  constructor() {
    // Formatting options
    this.indentSize = 2;
    this.maxLineLength = 80;
  }

  /**
   * Format the complete DOM overview response
   */
  formatResponse(data) {
    const lines = [];
    
    // Header
    lines.push(`=== DOM OVERVIEW: ${data.url} ===`);
    lines.push('');

    // Format each section
    if (data.sections.outline && data.sections.outline.length > 0) {
      lines.push(...this.formatOutlineSection(data.sections.outline));
      lines.push('');
    }

    if (data.sections.interactives && data.sections.interactives.length > 0) {
      lines.push(...this.formatInteractivesSection(data.sections.interactives, data.summary));
      lines.push('');
    }

    if (data.sections.headings && data.sections.headings.length > 0) {
      lines.push(...this.formatHeadingsSection(data.sections.headings));
      lines.push('');
    }

    // Summary
    lines.push(...this.formatSummary(data.summary, data.snapshotId));

    return lines.join('\n');
  }

  /**
   * Format outline section
   */
  formatOutlineSection(elements) {
    const lines = ['[OUTLINE - Page Structure]'];
    
    for (const elem of elements) {
      const indent = '  '.repeat(elem.depth);
      let line = `${indent}${elem.id} ${elem.tag}`;
      
      // Add identifier
      if (elem.id_attr) {
        line += `#${elem.id_attr}`;
      } else if (elem.classes) {
        line += `.${elem.classes.split(' ')[0]}`; // First class only
      }

      // Add child count
      if (elem.child_count > 0) {
        line += ` (${elem.child_count} children)`;
      }

      lines.push(line);
    }

    return lines;
  }

  /**
   * Format interactives section
   */
  formatInteractivesSection(elements, summary) {
    const lines = [];
    
    // Count total including grouped
    const totalCount = elements.reduce((sum, elem) => {
      return sum + (elem.count || 1);
    }, 0);

    const truncated = summary.truncatedSections?.includes('interactives');
    const header = truncated 
      ? `[INTERACTIVES - ${totalCount}+ found, showing ${elements.length}]`
      : `[INTERACTIVES - ${totalCount} found]`;
    
    lines.push(header);

    for (const elem of elements) {
      lines.push(this.formatInteractiveElement(elem));
    }

    return lines;
  }

  /**
   * Format a single interactive element
   */
  formatInteractiveElement(elem) {
    let line = elem.id;

    // Handle grouped elements
    if (elem.group) {
      line += ` ${elem.count} similar: ${elem.tag}`;
      if (elem.selector_hints && elem.selector_hints[0]) {
        line += ` ${elem.selector_hints[0]}`;
      }
      return line;
    }

    // Regular elements
    line += ` ${elem.tag}`;

    // Add key identifier
    if (elem.attributes?.id) {
      line += `#${elem.attributes.id}`;
    } else if (elem.attributes?.name) {
      line += `[name="${elem.attributes.name}"]`;
    } else if (elem.selector_hints && elem.selector_hints[0]) {
      // Use first selector hint if no id/name
      const hint = elem.selector_hints[0];
      if (hint.length < 30) {
        line += ` ${hint}`;
      }
    }

    // Add text/label
    if (elem.text) {
      line += ` "${elem.text}"`;
    } else if (elem.label) {
      line += ` ${elem.label}`;
    } else if (elem.attributes?.placeholder) {
      line += ` placeholder="${elem.attributes.placeholder}"`;
    }

    // Add href for links (shortened)
    if (elem.tag === 'a' && elem.attributes?.href) {
      const href = elem.attributes.href;
      if (href.length < 30) {
        line += ` href="${href}"`;
      } else if (href.startsWith('/')) {
        // Show relative URLs
        line += ` href="${href.substring(0, 20)}..."`;
      }
    }

    // Add type for inputs
    if (elem.tag === 'input' && elem.attributes?.type && elem.attributes.type !== 'text') {
      line += ` (${elem.attributes.type})`;
    }

    // Add aria-label if no other text
    if (!elem.text && !elem.label && elem.attributes?.['aria-label']) {
      line += ` aria-label="${elem.attributes['aria-label']}"`;
    }

    return line;
  }

  /**
   * Format headings section
   */
  formatHeadingsSection(elements) {
    const lines = ['[HEADINGS & TEXT]'];

    for (const elem of elements) {
      let line = `${elem.id} ${elem.tag}: "${elem.text}"`;
      
      // Add length indicator if truncated
      if (elem.length) {
        line += ` (${elem.length} chars)`;
      }

      lines.push(line);
    }

    return lines;
  }

  /**
   * Format summary section
   */
  formatSummary(summary, snapshotId) {
    const lines = ['[SUMMARY]'];
    
    const parts = [
      `Snapshot: ${snapshotId}`,
      `Total: ${summary.total_elements}`,
      `Shown: ${summary.shown}`
    ];

    // Add truncation info
    if (summary.truncatedSections && summary.truncatedSections.length > 0) {
      parts.push(`Truncated: [${summary.truncatedSections.join(', ')}]`);
    }

    lines.push(parts.join(' | '));

    // Viewport info on second line
    const viewport = summary.viewport_info;
    lines.push(
      `Viewport: ${viewport.width}x${viewport.height} | ` +
      `Scroll: ${viewport.scroll_position}/${viewport.contentHeight}`
    );

    return lines;
  }

  /**
   * Format error response
   */
  formatError(error, tabName) {
    return [
      `=== DOM OVERVIEW ERROR ===`,
      `Tab: ${tabName}`,
      `Error: ${error}`,
      '',
      'Ensure the page is loaded and try again.'
    ].join('\n');
  }

  /**
   * Format structure tree (for dom_structure)
   */
  formatStructureTree(structure, indent = 0) {
    const lines = [];
    
    for (const node of structure) {
      const spacing = '  '.repeat(indent);
      let line = `${spacing}${node.tag}`;
      
      if (node.id_attr) {
        line += `#${node.id_attr}`;
      }
      
      if (node.classes) {
        const firstClass = node.classes.split(' ')[0];
        line += `.${firstClass}`;
      }

      if (node.children) {
        line += ` [${node.children}]`;
      }

      lines.push(line);

      if (node.childNodes) {
        lines.push(...this.formatStructureTree(node.childNodes, indent + 1));
      }
    }

    return lines;
  }
}