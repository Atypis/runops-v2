/**
 * Portal Filter - Find portal roots and dialog elements
 * Detects React portals, modals, and similar overlay structures
 */

export class PortalFilter {
  constructor() {
    // Common portal root indicators
    this.portalPatterns = {
      classes: [
        'portal-root',
        'ReactModalPortal',
        'MuiModal-root',
        'modal-root',
        'overlay-root',
        'dialog-root',
        'popup-root',
        'tooltip-root',
        'dropdown-root'
      ],
      attributes: [
        'data-portal-root',
        'data-floating-ui-portal',
        'data-radix-portal',
        'data-reach-portal'
      ],
      roles: [
        'dialog',
        'menu',
        'listbox',
        'tooltip',
        'alertdialog'
      ]
    };
  }

  /**
   * Find portal root elements attached to body
   */
  findPortalRoots(snapshot, options = {}) {
    const { includeHidden = false } = options;
    const portals = [];

    // Look for direct children of body
    const bodyNode = snapshot.nodes.find(node => node.tag === 'body');
    if (!bodyNode) return { portals, truncated: false };

    // Get immediate children of body
    const bodyChildren = snapshot.nodes.filter(node => 
      node.parentId === bodyNode.id && node.type === 1
    );

    for (const node of bodyChildren) {
      // Skip if hidden and we're not including hidden
      if (!includeHidden && !node.visible) continue;

      // Check if this is likely a portal root
      if (this.isPortalRoot(node)) {
        const portal = this.formatPortalElement(node, snapshot);
        if (portal) {
          portals.push(portal);
        }
      }
    }

    return { portals, truncated: false };
  }

  /**
   * Check if a node is likely a portal root
   */
  isPortalRoot(node) {
    // Skip script and style tags
    if (node.tag === 'script' || node.tag === 'style') return false;

    // Check for portal class patterns
    if (node.attributes.class) {
      const classList = node.attributes.class.toLowerCase();
      for (const pattern of this.portalPatterns.classes) {
        if (classList.includes(pattern.toLowerCase())) {
          return true;
        }
      }
    }

    // Check for portal attributes
    for (const attr of this.portalPatterns.attributes) {
      if (node.attributes[attr] !== undefined) {
        return true;
      }
    }

    // Check for portal roles (at body level)
    if (node.attributes.role && this.portalPatterns.roles.includes(node.attributes.role)) {
      return true;
    }

    // Check if it's a div at body level with z-index (common for overlays)
    if (node.tag === 'div' && node.computedStyles) {
      const zIndex = parseInt(node.computedStyles.zIndex);
      if (!isNaN(zIndex) && zIndex > 100) {
        return true;
      }
    }

    // Check for position fixed/absolute at body level (common for modals)
    if (node.computedStyles && 
        (node.computedStyles.position === 'fixed' || 
         node.computedStyles.position === 'absolute')) {
      // Only consider it a portal if it has content
      return node.childCount > 0;
    }

    return false;
  }

  /**
   * Format portal element for output
   */
  formatPortalElement(node, snapshot) {
    const element = {
      id: `[${node.id}]`,
      type: 'portal-root',
      tag: node.tag,
      visible: node.visible
    };

    // Add identifying attributes
    if (node.attributes.class) {
      element.class = node.attributes.class;
    }

    if (node.attributes.id) {
      element.htmlId = node.attributes.id;
    }

    if (node.attributes.role) {
      element.role = node.attributes.role;
    }

    // Add portal-specific attributes
    const portalAttrs = {};
    for (const attr of this.portalPatterns.attributes) {
      if (node.attributes[attr] !== undefined) {
        portalAttrs[attr] = node.attributes[attr];
      }
    }
    if (Object.keys(portalAttrs).length > 0) {
      element.portalAttributes = portalAttrs;
    }

    // Check for shadow roots
    if (node.shadowRoot) {
      element.hasShadowRoot = true;
    }

    // Add positioning info
    if (node.computedStyles) {
      element.position = {
        type: node.computedStyles.position,
        zIndex: node.computedStyles.zIndex
      };
    }

    // Count child elements
    element.childCount = node.childCount || 0;

    // Get first-level content preview
    const children = snapshot.nodes.filter(n => n.parentId === node.id);
    const contentPreview = this.getContentPreview(children);
    if (contentPreview) {
      element.contentPreview = contentPreview;
    }

    return element;
  }

  /**
   * Get a preview of portal content
   */
  getContentPreview(children) {
    const preview = [];
    
    for (const child of children.slice(0, 3)) { // First 3 children
      if (child.type !== 1) continue;
      
      const item = {
        tag: child.tag
      };

      if (child.attributes.class) {
        item.class = child.attributes.class;
      }

      if (child.text) {
        item.text = child.text.substring(0, 50);
      }

      preview.push(item);
    }

    return preview.length > 0 ? preview : null;
  }
}