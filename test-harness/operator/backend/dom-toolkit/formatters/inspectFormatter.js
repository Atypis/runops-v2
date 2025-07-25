/**
 * Inspect Formatter - Format element inspection results
 */

export class InspectFormatter {
  /**
   * Format inspection results
   */
  formatInspectResults(data) {
    const lines = [];
    
    // Header
    lines.push(`=== ELEMENT INSPECTION: ${data.element.id} ===`);
    lines.push(`URL: ${data.url}`);
    lines.push('');

    // Element details
    lines.push('[ELEMENT DETAILS]');
    lines.push(...this.formatElementDetails(data.element));
    lines.push('');

    // Context sections
    if (data.context.parents && data.context.parents.length > 0) {
      lines.push('[PARENT CHAIN]');
      lines.push(...this.formatParentChain(data.context.parents));
      lines.push('');
    }

    if (data.context.children && data.context.children.length > 0) {
      lines.push(`[CHILDREN - ${data.context.children.length} elements]`);
      lines.push(...this.formatChildren(data.context.children));
      lines.push('');
    }

    if (data.context.siblings && data.context.siblings.length > 0) {
      lines.push('[SIBLINGS]');
      lines.push(...this.formatSiblings(data.context.siblings));
      lines.push('');
    }

    // Selector hints
    if (data.element.selectors && data.element.selectors.length > 0) {
      lines.push('[SUGGESTED SELECTORS]');
      data.element.selectors.forEach((sel, i) => {
        lines.push(`${i + 1}. ${sel}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Format element details
   */
  formatElementDetails(element) {
    const lines = [];
    
    // Basic info with actionability
    lines.push(`Type: ${element.type} (${element.tag})`);
    lines.push(`Visible: ${element.visible} | In Viewport: ${element.inViewport} | Actionable: ${element.actionability?.isActionable || false}`);

    // Position if available
    if (element.position) {
      lines.push(`Position: ${element.position.x},${element.position.y} ` +
                 `Size: ${element.position.width}x${element.position.height}`);
    }

    // Interactive info
    if (element.interactive) {
      lines.push(`Interactive: ${element.interactive.type} ` +
                 `(${element.interactive.enabled ? 'enabled' : 'disabled'})`);
    }

    // Actionability analysis
    if (element.actionability && element.actionability.issues.length > 0) {
      lines.push('');
      lines.push('[ACTIONABILITY ANALYSIS]');
      
      // Issues
      for (const issue of element.actionability.issues) {
        lines.push(`❌ Not clickable: ${issue}`);
      }
      
      // Bounding box if available
      if (element.position) {
        lines.push(`📦 Bounding Box: {x: ${element.position.x}, y: ${element.position.y}, width: ${element.position.width}, height: ${element.position.height}}`);
      }
      
      // Scroll container if detected
      if (element.actionability.scrollContainer) {
        lines.push(`📜 Scroll Container: ${element.actionability.scrollContainer}`);
      }
      
      // Suggestions
      if (element.actionability.suggestions.length > 0) {
        lines.push('');
        lines.push('[SUGGESTED ACTIONS]');
        element.actionability.suggestions.forEach((suggestion, i) => {
          lines.push(`${i + 1}. ${suggestion}`);
        });
      }
    }

    // Attributes
    if (element.attributes) {
      lines.push('');
      lines.push('Attributes:');
      for (const [key, value] of Object.entries(element.attributes)) {
        const displayValue = value.length > 100 ? value.substring(0, 100) + '...' : value;
        lines.push(`  ${key}: "${displayValue}"`);
      }
    }

    // Text content
    if (element.text) {
      lines.push('');
      lines.push('Text Content:');
      for (const [source, content] of Object.entries(element.text)) {
        lines.push(`  ${source}: "${content}"`);
      }
    }

    return lines;
  }

  /**
   * Format parent chain
   */
  formatParentChain(parents) {
    return parents.map((parent, i) => {
      let line = `${'  '.repeat(i)}↑ ${parent.id} ${parent.tag}`;
      if (parent.idAttr) {
        line += `#${parent.idAttr}`;
      } else if (parent.classes) {
        const firstClass = parent.classes.split(' ')[0];
        line += `.${firstClass}`;
      }
      return line;
    });
  }

  /**
   * Format children
   */
  formatChildren(children) {
    return children.slice(0, 10).map(child => {
      let line = `  ${child.id} ${child.tag} (${child.type})`;
      if (child.text) {
        line += ` "${child.text}"`;
      }
      if (child.childCount > 0) {
        line += ` [${child.childCount} children]`;
      }
      return line;
    });
  }

  /**
   * Format siblings
   */
  formatSiblings(siblings) {
    const before = siblings.filter(s => s.position === 'before').reverse();
    const after = siblings.filter(s => s.position === 'after');
    const lines = [];

    // Before siblings
    before.forEach(sib => {
      lines.push(`  ↑ ${sib.id} ${sib.tag} (${sib.type})`);
    });

    // Current element marker
    lines.push(`  → [CURRENT ELEMENT]`);

    // After siblings
    after.forEach(sib => {
      lines.push(`  ↓ ${sib.id} ${sib.tag} (${sib.type})`);
    });

    return lines;
  }
}