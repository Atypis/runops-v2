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
            changes: modifications,
            current: this.createNodeSummary(currNode)
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
   * Create a summary for a node (for added/removed lists)
   */
  createNodeSummary(node) {
    const summary = {
      id: `[${node.id}]`,
      tag: node.tag,
      text: node.text
    };

    // Add key attributes
    if (node.attributes) {
      const keyAttrs = {};
      const importantAttrs = ['id', 'class', 'name', 'type', 'role', 'href', 'aria-label'];
      
      for (const attr of importantAttrs) {
        if (node.attributes[attr]) {
          keyAttrs[attr] = node.attributes[attr];
        }
      }
      
      if (Object.keys(keyAttrs).length > 0) {
        summary.attributes = keyAttrs;
      }
    }

    // Add visibility info
    summary.visible = node.visible;
    summary.inViewport = node.inViewport;

    return summary;
  }

  /**
   * Filter changes to only include elements that would pass overview filters
   */
  filterChanges(changes, filters, snapshot) {
    const filtered = {
      added: [],
      removed: [],
      modified: []
    };

    // For added/modified nodes, check if they pass current filters
    if (changes.added.length > 0 || changes.modified.length > 0) {
      const nodeMap = new Map();
      snapshot.nodes.forEach(node => nodeMap.set(node.id, node));

      // Filter added nodes
      for (const summary of changes.added) {
        const nodeId = parseInt(summary.id.replace(/[\[\]]/g, ''));
        const node = nodeMap.get(nodeId);
        if (node && this.passesFilters(node, filters)) {
          filtered.added.push(summary);
        }
      }

      // Filter modified nodes
      for (const change of changes.modified) {
        const nodeId = parseInt(change.id.replace(/[\[\]]/g, ''));
        const node = nodeMap.get(nodeId);
        if (node && this.passesFilters(node, filters)) {
          filtered.modified.push(change);
        }
      }
    }

    // Removed nodes are always included if they previously passed filters
    filtered.removed = changes.removed;

    return filtered;
  }

  /**
   * Check if a node passes the overview filters
   */
  passesFilters(node, filters) {
    // This will be called with actual filter instances
    // For now, simplified check based on node type
    
    // Always include interactive elements
    const interactiveTags = ['button', 'a', 'input', 'select', 'textarea'];
    if (interactiveTags.includes(node.tag)) return true;

    // Include headings
    if (/^h[1-6]$/.test(node.tag)) return true;

    // Include major structural elements
    if (node.childIds && node.childIds.length > 5) return true;

    // Include elements with key roles
    const importantRoles = ['navigation', 'button', 'link', 'textbox', 'main', 'search'];
    if (node.attributes?.role && importantRoles.includes(node.attributes.role)) return true;

    return false;
  }
}