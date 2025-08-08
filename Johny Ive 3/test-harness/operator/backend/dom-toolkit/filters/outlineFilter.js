/**
 * Outline Filter - Extract page structure (depth ≤ 2)
 * Like 'ls' command for DOM
 */

export class OutlineFilter {
  constructor() {
    // Semantic tags that provide good structural overview
    this.semanticTags = new Set([
      'header', 'nav', 'main', 'section', 'article', 'aside', 
      'footer', 'form', 'dialog', 'details', 'figure', 'table'
    ]);
    
    // Container tags that might have semantic meaning
    this.containerTags = new Set([
      'div', 'span'
    ]);
  }

  /**
   * Filter nodes to show page outline
   */
  filter(snapshot, options = {}) {
    const { visible = true, max_rows = 30, depth = 2 } = options;
    const elements = [];
    let truncated = false;

    // Start from body or root
    const rootNodes = this.findRootNodes(snapshot.nodes);
    
    for (const root of rootNodes) {
      if (elements.length >= max_rows) {
        truncated = true;
        break;
      }

      // Traverse tree depth-first, but only to specified depth
      this.traverseNode(root, snapshot.nodeMap, elements, {
        visible,
        maxDepth: depth,
        maxRows: max_rows,
        currentDepth: 0
      });
    }

    return { elements, truncated };
  }

  /**
   * Get pure structural tree (for dom_structure tool)
   */
  getStructure(snapshot, options = {}) {
    const { depth = 3 } = options;
    
    const rootNodes = this.findRootNodes(snapshot.nodes);
    const structure = [];

    for (const root of rootNodes) {
      const tree = this.buildStructureTree(root, snapshot.nodeMap, depth, 0);
      if (tree) structure.push(tree);
    }

    return structure;
  }

  /**
   * Find root nodes to start traversal (html, body, or document root)
   */
  findRootNodes(nodes) {
    // Look for body first, then html, then any root
    let body = nodes.find(n => n.tag === 'body');
    if (body) return [body];

    let html = nodes.find(n => n.tag === 'html');
    if (html) return [html];

    // Return nodes without parents
    return nodes.filter(n => n.parentId === undefined || n.parentId === null);
  }

  /**
   * Traverse node tree for outline
   */
  traverseNode(node, nodeMap, elements, options) {
    const { visible, maxDepth, maxRows, currentDepth } = options;

    // Stop if we've reached max rows
    if (elements.length >= maxRows) return;

    // Skip if too deep
    if (currentDepth > maxDepth) return;

    // Skip invisible nodes if visibility filter is on
    if (visible && !node.visible) return;

    // Include this node if it's meaningful for structure
    if (this.isStructuralNode(node)) {
      elements.push(this.formatOutlineElement(node, nodeMap));
    }

    // Traverse children
    if (node.childIds && currentDepth < maxDepth) {
      for (const childId of node.childIds) {
        const child = nodeMap.get(childId);
        if (child) {
          this.traverseNode(child, nodeMap, elements, {
            ...options,
            currentDepth: currentDepth + 1
          });
        }
      }
    }
  }

  /**
   * Build structure tree for dom_structure
   */
  buildStructureTree(node, nodeMap, maxDepth, currentDepth) {
    if (currentDepth > maxDepth) return null;

    const tree = {
      tag: node.tag,
      id: `[${node.id}]`,
      depth: currentDepth
    };

    // Add identifying attributes
    if (node.attributes.id) {
      tree.id_attr = node.attributes.id;
    }
    if (node.attributes.class) {
      tree.classes = node.attributes.class;
    }

    // Add children count
    const visibleChildren = this.countVisibleChildren(node, nodeMap);
    if (visibleChildren > 0) {
      tree.children = visibleChildren;
    }

    // Add child trees if within depth
    if (node.childIds && currentDepth < maxDepth) {
      tree.childNodes = [];
      for (const childId of node.childIds) {
        const child = nodeMap.get(childId);
        if (child && this.isStructuralNode(child)) {
          const childTree = this.buildStructureTree(child, nodeMap, maxDepth, currentDepth + 1);
          if (childTree) tree.childNodes.push(childTree);
        }
      }
      if (tree.childNodes.length === 0) {
        delete tree.childNodes;
      }
    }

    return tree;
  }

  /**
   * Check if node is meaningful for structure
   */
  isStructuralNode(node) {
    // Always include semantic tags
    if (this.semanticTags.has(node.tag)) return true;

    // Include containers with id or meaningful class
    if (this.containerTags.has(node.tag)) {
      if (node.attributes.id) return true;
      if (node.attributes.class) {
        // Check for meaningful class names
        const classes = node.attributes.class.toLowerCase();
        if (classes.includes('container') || 
            classes.includes('wrapper') ||
            classes.includes('content') ||
            classes.includes('sidebar') ||
            classes.includes('header') ||
            classes.includes('footer')) {
          return true;
        }
      }
    }

    // Skip most other tags for outline
    return false;
  }

  /**
   * Format node for outline display
   */
  formatOutlineElement(node, nodeMap) {
    const element = {
      id: `[${node.id}]`,
      tag: node.tag,
      depth: node.depth
    };

    // Add identifying attributes
    if (node.attributes.id) {
      element.id_attr = node.attributes.id;
    }

    // Add meaningful classes
    if (node.attributes.class) {
      const classes = node.attributes.class.split(' ')
        .filter(c => c && !c.match(/^js-/)) // Skip JS hook classes
        .slice(0, 3) // Limit to 3 classes
        .join(' ');
      if (classes) element.classes = classes;
    }

    // Count direct visible children
    const childCount = this.countVisibleChildren(node, nodeMap);
    if (childCount > 0) {
      element.child_count = childCount;
    }

    return element;
  }

  /**
   * Count visible child elements
   */
  countVisibleChildren(node, nodeMap) {
    if (!node.childIds) return 0;
    
    return node.childIds.filter(childId => {
      const child = nodeMap.get(childId);
      return child && child.visible && child.type === 1; // Element nodes only
    }).length;
  }
}