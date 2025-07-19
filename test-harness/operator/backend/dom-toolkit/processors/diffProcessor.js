/**
 * Diff Processor - Computes differences between DOM snapshots
 */

export class DiffProcessor {
  constructor() {
    // Track what types of changes to detect
    this.changeTypes = {
      added: true,
      removed: true,
      modified: true
    };
  }

  /**
   * Compute diff between two snapshots
   */
  computeDiff(prevSnapshot, currSnapshot) {
    const changes = {
      added: [],
      removed: [],
      modified: []
    };

    // Create lookup maps for efficient comparison
    const prevMap = this.createNodeMap(prevSnapshot);
    const currMap = this.createNodeMap(currSnapshot);

    // Find added and modified nodes
    for (const [nodeId, currNode] of currMap) {
      const prevNode = prevMap.get(nodeId);
      
      if (!prevNode) {
        // Node was added
        changes.added.push(this.createNodeSummary(currNode));
      } else {
        // Check if node was modified
        const modifications = this.detectModifications(prevNode, currNode);
        if (modifications) {
          changes.modified.push({
            id: `[${nodeId}]`,
            tag: currNode.tag,
            changes: modifications
            // Don't include full node summary to save tokens
          });
        }
      }
    }

    // Find removed nodes
    for (const [nodeId, prevNode] of prevMap) {
      if (!currMap.has(nodeId)) {
        changes.removed.push(this.createNodeSummary(prevNode));
      }
    }

    return changes;
  }

  /**
   * Create a map of nodes by their backend ID or position
   */
  createNodeMap(snapshot) {
    const map = new Map();
    
    if (!snapshot || !snapshot.nodes) return map;

    for (const node of snapshot.nodes) {
      // Use backend ID if available, otherwise use a composite key
      const key = node.backendId || this.createNodeKey(node);
      map.set(key, node);
    }

    return map;
  }

  /**
   * Create a stable key for nodes without backend IDs
   */
  createNodeKey(node) {
    // Use combination of tag, key attributes, and position
    const parts = [
      node.tag,
      node.attributes?.id || '',
      node.attributes?.name || '',
      node.attributes?.['data-testid'] || '',
      node.parentId || 'root',
      node.depth
    ];
    return parts.join(':');
  }

  /**
   * Detect modifications between two nodes
   */
  detectModifications(prevNode, currNode) {
    const changes = {};

    // Check text changes
    if (prevNode.text !== currNode.text) {
      changes.text = {
        old: prevNode.text,
        new: currNode.text
      };
    }

    // Check visibility changes
    if (prevNode.visible !== currNode.visible) {
      changes.visibility = {
        old: prevNode.visible,
        new: currNode.visible
      };
    }

    // Check viewport changes
    if (prevNode.inViewport !== currNode.inViewport) {
      changes.inViewport = {
        old: prevNode.inViewport,
        new: currNode.inViewport
      };
    }

    // Check attribute changes
    const attrChanges = this.compareAttributes(
      prevNode.attributes || {},
      currNode.attributes || {}
    );
    if (Object.keys(attrChanges).length > 0) {
      changes.attributes = attrChanges;
    }

    // Check layout changes (position/size)
    if (this.hasLayoutChanged(prevNode.layout, currNode.layout)) {
      changes.layout = {
        old: prevNode.layout,
        new: currNode.layout
      };
    }

    // Return null if no changes detected
    return Object.keys(changes).length > 0 ? changes : null;
  }

  /**
   * Compare attributes between nodes
   */
  compareAttributes(prevAttrs, currAttrs) {
    const changes = {};

    // Check for changed or removed attributes
    for (const [key, prevValue] of Object.entries(prevAttrs)) {
      const currValue = currAttrs[key];
      if (currValue === undefined) {
        changes[key] = { old: prevValue, new: null };
      } else if (prevValue !== currValue) {
        changes[key] = { old: prevValue, new: currValue };
      }
    }

    // Check for added attributes
    for (const [key, currValue] of Object.entries(currAttrs)) {
      if (!(key in prevAttrs)) {
        changes[key] = { old: null, new: currValue };
      }
    }

    return changes;
  }

  /**
   * Check if layout has changed significantly
   */
  hasLayoutChanged(prevLayout, currLayout) {
    if (!prevLayout && !currLayout) return false;
    if (!prevLayout || !currLayout) return true;

    // Check if position or size changed by more than 1px (to avoid floating point issues)
    const threshold = 1;
    return (
      Math.abs((prevLayout.x || 0) - (currLayout.x || 0)) > threshold ||
      Math.abs((prevLayout.y || 0) - (currLayout.y || 0)) > threshold ||
      Math.abs((prevLayout.width || 0) - (currLayout.width || 0)) > threshold ||
      Math.abs((prevLayout.height || 0) - (currLayout.height || 0)) > threshold
    );
  }

  /**
   * Create a compact summary for a node (matching dom_overview format)
   * This replaces the verbose summaries with the same format used in regular overview
   */
  createNodeSummary(node) {
    const summary = {
      id: `[${node.id}]`,
      tag: node.tag
    };
    
    const LONG_ATTR_THRESHOLD = 40;

    // Match the format from InteractivesFilter.formatInteractiveElement
    if (node.tag === 'button' || node.tag === 'a' || node.attributes?.role === 'button') {
      if (node.text) {
        summary.text = this.truncateText(node.text, 50);
      }
    }
    
    // For inputs, add placeholder or name if short enough
    if (node.tag === 'input' || node.tag === 'textarea' || node.tag === 'select') {
      if (node.attributes?.placeholder && node.attributes.placeholder.length <= LONG_ATTR_THRESHOLD) {
        summary.placeholder = node.attributes.placeholder;
      } else if (node.attributes?.name) {
        summary.name = node.attributes.name;
      }
    }

    // Add key identifying attributes (compact format)
    if (node.attributes?.id) {
      summary.id_attr = node.attributes.id;
    } else if (node.attributes?.class) {
      // First class only, like in overview
      summary.class = node.attributes.class.split(' ')[0];
    }
    
    // Only add href for links if short or it's the only identifier
    if (node.tag === 'a' && node.attributes?.href) {
      const href = node.attributes.href;
      const hasOtherIdentifiers = node.text || node.attributes?.id || node.attributes?.['aria-label'];
      
      if (href.length <= LONG_ATTR_THRESHOLD) {
        summary.href = href;
      } else if (!hasOtherIdentifiers && href.length > 0) {
        // Only include if it's the sole identifier, and truncate it
        summary.href = href.substring(0, 20) + '...';
      }
      // Otherwise omit the href entirely
    }

    return summary;
  }

  /**
   * Truncate text helper
   */
  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Filter changes using bi-temporal filtering
   * Uses the same filters as dom_overview but considers both snapshots
   */
  filterChanges(changes, filters, filterInstances, oldSnapshot, newSnapshot, options = {}) {
    const { visible = true, viewport = true } = options;
    const filtered = {
      added: [],
      removed: [],
      modified: []
    };

    // Pre-compute which nodes pass filters in each snapshot for O(1) lookup
    const passesInOld = this.computeFilteredNodes(oldSnapshot, filters, filterInstances, { visible, viewport });
    const passesInNew = this.computeFilteredNodes(newSnapshot, filters, filterInstances, { visible, viewport });

    // Filter added nodes - check if they pass filters in NEW snapshot
    for (const summary of changes.added) {
      const nodeId = parseInt(summary.id.replace(/[\[\]]/g, ''));
      if (passesInNew.has(nodeId)) {
        filtered.added.push(summary);
      }
    }

    // Filter removed nodes - check if they passed filters in OLD snapshot
    for (const summary of changes.removed) {
      const nodeId = parseInt(summary.id.replace(/[\[\]]/g, ''));
      if (passesInOld.has(nodeId)) {
        filtered.removed.push(summary);
      }
    }

    // Filter modified nodes - include if they pass in EITHER snapshot
    // OR if it's a visibility change on a relevant element type
    for (const change of changes.modified) {
      const nodeId = parseInt(change.id.replace(/[\[\]]/g, ''));
      const oldNode = oldSnapshot.nodeMap.get(nodeId);
      const newNode = newSnapshot.nodeMap.get(nodeId);
      
      // Include if relevant in either temporal state
      if (passesInOld.has(nodeId) || passesInNew.has(nodeId)) {
        filtered.modified.push(change);
      }
      // Special case: visibility flip on relevant element type
      else if (change.changes.visibility && this.isRelevantElementType(newNode || oldNode)) {
        filtered.modified.push(change);
      }
    }

    return filtered;
  }

  /**
   * Compute which nodes pass the overview filters for a given snapshot
   * Returns a Set of node IDs for O(1) lookup
   */
  computeFilteredNodes(snapshot, filters, filterInstances, options) {
    const passingNodes = new Set();
    
    if (!snapshot || !snapshot.nodes) return passingNodes;

    // Run each enabled filter and collect the node IDs
    if (filters.outline && filterInstances.outline) {
      const result = filterInstances.outline.filter(snapshot, options);
      result.elements.forEach(elem => {
        const nodeId = parseInt(elem.id.replace(/[\[\]]/g, ''));
        passingNodes.add(nodeId);
      });
    }

    if (filters.interactives && filterInstances.interactives) {
      const result = filterInstances.interactives.filter(snapshot, options);
      result.elements.forEach(elem => {
        const nodeId = parseInt(elem.id.replace(/[\[\]]/g, ''));
        passingNodes.add(nodeId);
      });
    }

    if (filters.headings && filterInstances.headings) {
      const result = filterInstances.headings.filter(snapshot, options);
      result.elements.forEach(elem => {
        const nodeId = parseInt(elem.id.replace(/[\[\]]/g, ''));
        passingNodes.add(nodeId);
      });
    }

    return passingNodes;
  }

  /**
   * Check if element type is relevant for visibility change tracking
   */
  isRelevantElementType(node) {
    if (!node) return false;
    
    // Interactive elements
    const interactiveTags = ['button', 'a', 'input', 'select', 'textarea', 'form'];
    if (interactiveTags.includes(node.tag)) return true;
    
    // Headings and text
    if (/^h[1-6]$/.test(node.tag)) return true;
    if (node.tag === 'p' && node.text && node.text.length > 50) return true;
    
    // Elements with interactive roles
    const interactiveRoles = ['button', 'link', 'textbox', 'navigation', 'main', 'search'];
    if (node.attributes?.role && interactiveRoles.includes(node.attributes.role)) return true;
    
    // Error messages, alerts, etc.
    const alertRoles = ['alert', 'alertdialog', 'status', 'log'];
    if (node.attributes?.role && alertRoles.includes(node.attributes.role)) return true;
    
    return false;
  }
}