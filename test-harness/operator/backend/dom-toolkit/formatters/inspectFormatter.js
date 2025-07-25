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
    
    // Basic info
    lines.push(`Type: ${element.type} (${element.tag})`);
    lines.push(`Visible: ${element.visible} | In Viewport: ${element.inViewport}`);

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

    // Evidence section
    if (element.evidence) {
      lines.push('');
      lines.push('[EVIDENCE]');
      
      // Layout
      lines.push('');
      lines.push('Layout:');
      if (element.evidence.layout) {
        lines.push(`  bounds: [${element.evidence.layout.x}, ${element.evidence.layout.y}, ${element.evidence.layout.width}, ${element.evidence.layout.height}]`);
      } else {
        lines.push('  bounds: null (no layout info)');
      }
      
      // Computed styles
      if (element.evidence.computedStyle && Object.keys(element.evidence.computedStyle).length > 0) {
        lines.push('');
        lines.push('Computed Style:');
        for (const [key, value] of Object.entries(element.evidence.computedStyle)) {
          lines.push(`  ${key}: ${value}`);
        }
      }
      
      // Parent chain blockers
      if (element.evidence.parentChain && element.evidence.parentChain.length > 0) {
        lines.push('');
        lines.push('Parent Chain:');
        element.evidence.parentChain.forEach((parent, i) => {
          const blockers = [];
          if (!parent.visible) blockers.push('hidden');
          if (!parent.layout) blockers.push('no-layout');
          if (parent.style?.includes('pointer-events: none')) blockers.push('pointer-events:none');
          if (parent.style?.includes('display: none')) blockers.push('display:none');
          
          let line = `  ${parent.id} ${parent.tag}`;
          if (parent.class) line += `.${parent.class.split(' ')[0]}`;
          if (blockers.length > 0) line += ` [${blockers.join(', ')}]`;
          lines.push(line);
        });
      }
      
      // Duplicates
      if (element.evidence.duplicates && element.evidence.duplicates.length > 0) {
        lines.push('');
        lines.push('Duplicates:');
        element.evidence.duplicates.forEach(dup => {
          let line = `  ${dup.id}`;
          const props = [];
          if (dup.hasLayout) props.push('has-layout');
          if (dup.visible) props.push('visible');
          if (dup.inViewport) props.push('in-viewport');
          if (props.length > 0) line += ` [${props.join(', ')}]`;
          if (dup.bounds) line += ` bounds:[${dup.bounds.join(',')}]`;
          lines.push(line);
        });
      }
      
      // Occlusion
      if (element.evidence.occlusion) {
        lines.push('');
        lines.push('Occlusion:');
        if (element.evidence.occlusion.isOccluded) {
          lines.push(`  blocked: true`);
          if (element.evidence.occlusion.occludedBy) {
            const occ = element.evidence.occlusion.occludedBy;
            lines.push(`  by: ${occ.selector} (${occ.tag})`);
          }
          // Show sample results
          element.evidence.occlusion.samples.forEach((sample, i) => {
            if (!sample.isTarget && sample.topElement) {
              lines.push(`  sample${i}: [${sample.point[0]},${sample.point[1]}] → ${sample.topElement.selector}`);
            }
          });
        } else {
          lines.push('  blocked: false (element is clickable)');
        }
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