/**
 * DOM Capture - Efficient CDP-based DOM snapshot capture
 */

import crypto from 'crypto';

export class DOMCapture {
  constructor() {
    this.processedSnapshots = new Map();
  }

  /**
   * Capture DOM snapshot using Chrome DevTools Protocol
   * Single CDP call for maximum efficiency
   */
  async captureSnapshot(page) {
    console.log('[DOMCapture] Starting snapshot capture');
    
    try {
      // Get CDP session
      const client = await page.context().newCDPSession(page);
      
      // Get viewport information first
      const viewport = await page.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        contentHeight: document.documentElement.scrollHeight,
        contentWidth: document.documentElement.scrollWidth
      }));

      // Single CDP call for efficiency
      const cdpSnapshot = await client.send('DOMSnapshot.captureSnapshot', {
        computedStyles: [
          'visibility',
          'display',
          'opacity',
          'position',
          'overflow',
          'pointer-events',
          'user-select',
          'z-index',
          'transform',
          'clip-path',
          'filter',
          'mix-blend-mode',
          'isolation',
          'contain',
          'content-visibility'
        ],
        includePaintOrder: true,
        includeDOMRects: true,
        includeTextColorOpacities: false,
        includeBlendedBackgroundColors: false,
        captureAreaScreenshot: false,
        includeShadowTree: true,  // Enable shadow DOM capture
        includeShadowRoots: true  // Include shadow root nodes
      });

      // Process the raw snapshot into our optimized format
      let processed;
      try {
        processed = this.processSnapshot(cdpSnapshot, viewport);
      } catch (processError) {
        console.error('[DOMCapture] Process error:', processError);
        throw new Error(`Failed to process CDP snapshot: ${processError.message}`);
      }
      
      if (!processed) {
        throw new Error('Failed to process CDP snapshot - no result');
      }
      
      // Generate unique ID for this snapshot
      processed.id = this.generateSnapshotId();
      processed.timestamp = Date.now();
      processed.viewport = viewport;
      
      console.log(`[DOMCapture] Snapshot captured: ${processed.nodeCount} nodes`);
      
      return processed;
    } catch (error) {
      console.error('[DOMCapture] Error capturing snapshot:', error);
      throw new Error(`Failed to capture DOM snapshot: ${error.message}`);
    }
  }

  /**
   * Process CDP snapshot into our optimized format
   */
  processSnapshot(cdpSnapshot, viewport) {
    const { documents, strings } = cdpSnapshot;
    if (!documents || documents.length === 0) {
      throw new Error('No documents in CDP snapshot');
    }

    // We only care about the main document
    const doc = documents[0];
    const { nodes, layout, textBoxes } = doc;
    
    // Debug log
    console.log('[DOMCapture] Document structure:', {
      hasNodes: !!nodes,
      nodesKeys: nodes ? Object.keys(nodes).slice(0, 5) : null,
      hasLayout: !!layout,
      nodeCount: nodes?.parentIndex?.length
    });

    // Build our node map
    const nodeMap = new Map();
    const processedNodes = [];
    
    // Build parent-child relationships
    const parentMap = new Map();
    const childrenMap = new Map();
    
    // Get the node count from one of the arrays
    const nodeCount = nodes.parentIndex.length;
    console.log(`[DOMCapture] Processing ${nodeCount} nodes`);
    
    // First pass: create nodes and establish relationships
    for (let index = 0; index < nodeCount; index++) {
      const parentIndex = nodes.parentIndex[index];
      if (parentIndex !== undefined && parentIndex >= 0) {
        parentMap.set(index, parentIndex);
        if (!childrenMap.has(parentIndex)) {
          childrenMap.set(parentIndex, []);
        }
        childrenMap.get(parentIndex).push(index);
      }
    }

    // Second pass: build processed nodes with all info
    for (let index = 0; index < nodeCount; index++) {
      const nodeType = nodes.nodeType[index];
      const nodeName = this.getString(strings, nodes.nodeName[index]);
      
      // Skip non-element nodes for efficiency (comments, etc)
      if (nodeType !== 1 && nodeType !== 3) { // 1=Element, 3=Text
        continue;
      }

      const processedNode = {
        id: index,
        backendId: nodes.backendNodeId?.[index],
        type: nodeType,
        tag: nodeName.toLowerCase(),
        parentId: parentMap.get(index),
        childIds: childrenMap.get(index) || [],
        depth: this.calculateDepth(index, parentMap),
        attributes: this.extractAttributes(nodes.attributes?.[index], strings),
        layout: layout?.nodeIndex?.includes(index) ? 
          this.extractLayout(layout, index, viewport) : null,
        text: null, // Will be filled in third pass
        computedStyle: this.extractComputedStyles(doc, nodes, index) // Add computed styles
      };

      // Calculate visibility with computed styles if available
      processedNode.visible = this.isVisible(processedNode, doc, index);
      processedNode.inViewport = this.isInViewport(processedNode, viewport);

      nodeMap.set(index, processedNode);
      processedNodes.push(processedNode);
    }
    
    // Third pass: extract text content (needs nodeMap to be complete)
    for (const node of processedNodes) {
      node.text = this.extractTextContent(node, nodes, nodeMap, childrenMap, strings);
    }
    
    console.log(`[DOMCapture] Processed ${processedNodes.length} nodes`);
    
    return {
      nodes: processedNodes,
      nodeMap,
      nodeCount: processedNodes.length,
      maxDepth: Math.max(...processedNodes.map(n => n.depth), 0)
    };
  }

  /**
   * Extract attributes into a clean object
   */
  extractAttributes(attrIndices, strings) {
    if (!attrIndices || attrIndices.length === 0) return {};
    
    const attrs = {};
    for (let i = 0; i < attrIndices.length; i += 2) {
      const name = this.getString(strings, attrIndices[i]);
      const value = this.getString(strings, attrIndices[i + 1]);
      attrs[name] = value;
    }
    return attrs;
  }

  /**
   * Extract layout information
   */
  extractLayout(layout, nodeIndex, viewport) {
    const layoutIndex = layout.nodeIndex.indexOf(nodeIndex);
    if (layoutIndex === -1) return null;

    // Google's CDP format: each element in bounds array is a sub-array with coordinates
    if (layout.bounds && Array.isArray(layout.bounds[layoutIndex])) {
      const boundsArray = layout.bounds[layoutIndex];
      
      // Skip if no bounds data
      if (!boundsArray || boundsArray.length < 4) return null;
      
      // Extract coordinates from the array
      const [x, y, width, height] = boundsArray;
      
      // Skip if bounds are invalid
      if (x === undefined || y === undefined || width === undefined || height === undefined ||
          width === 0 || height === 0) {
        return null;
      }
      
      return {
        x,
        y,
        width,
        height,
        absoluteY: y + viewport.scrollY
      };
    }
    // Handle styles-based layout (complex sites)
    else if (layout.styles && Array.isArray(layout.styles)) {
      // Complex structure: bounds contains multiple rects per node based on styles
      let boundsOffset = 0;
      
      // Calculate offset by summing style counts for previous nodes
      for (let i = 0; i < layoutIndex; i++) {
        const styleCount = layout.styles[i] || 0;
        // Each style represents a rect with 4 values (x, y, width, height)
        boundsOffset += styleCount * 4;
      }
      
      // Get the first bounds for this node (primary bounding box)
      const x = layout.bounds[boundsOffset];
      const y = layout.bounds[boundsOffset + 1];
      const width = layout.bounds[boundsOffset + 2];
      const height = layout.bounds[boundsOffset + 3];
      
      // Skip if bounds are invalid
      if (x === undefined || y === undefined || width === undefined || height === undefined ||
          width === 0 || height === 0) {
        return null;
      }
      
      return {
        x,
        y,
        width,
        height,
        absoluteY: y + viewport.scrollY
      };
    } else {
      // Simple structure: 4 values per node in flat array
      const baseIndex = layoutIndex * 4;
      
      // Get bounds for this node
      const x = layout.bounds[baseIndex];
      const y = layout.bounds[baseIndex + 1];
      const width = layout.bounds[baseIndex + 2];
      const height = layout.bounds[baseIndex + 3];
      
      // Skip if bounds are undefined or invalid
      if (x === undefined || y === undefined || width === undefined || height === undefined ||
          width === 0 || height === 0) {
        return null;
      }

      return {
        x,
        y,
        width,
        height,
        absoluteY: y + viewport.scrollY
      };
    }
  }

  /**
   * Extract text content from node and its children
   */
  extractTextContent(node, nodes, nodeMap, childrenMap, strings) {
    // For text nodes, return the nodeValue directly
    if (node.type === 3) { // Text node
      if (nodes.nodeValue && nodes.nodeValue[node.id] >= 0) {
        const text = this.getString(strings, nodes.nodeValue[node.id]);
        return text ? text.trim().replace(/\s+/g, ' ') : null;
      }
      return null;
    }
    
    // For element nodes, collect text from child text nodes
    if (node.type === 1) { // Element node
      const textParts = [];
      
      // Get all child indices from the raw nodes data
      const childIndices = childrenMap.get(node.id) || [];
      
      for (const childIdx of childIndices) {
        const childType = nodes.nodeType[childIdx];
        
        // If it's a text node, get its text
        if (childType === 3 && nodes.nodeValue[childIdx] >= 0) {
          const text = this.getString(strings, nodes.nodeValue[childIdx]);
          if (text && text.trim()) {
            textParts.push(text.trim());
          }
        }
        
        // If it's an element node that we processed, recurse
        const childNode = nodeMap.get(childIdx);
        if (childNode && childNode.type === 1) {
          const childText = this.extractTextContent(childNode, nodes, nodeMap, childrenMap, strings);
          if (childText) {
            textParts.push(childText);
          }
        }
      }
      
      if (textParts.length > 0) {
        return textParts.join(' ').replace(/\s+/g, ' ');
      }
    }
    
    return null;
  }

  /**
   * Check if element is visible
   */
  isVisible(node, doc, nodeIndex) {
    // Text nodes are visible if their parent is visible
    if (node.type === 3) return true;
    
    // No layout info could mean hidden or just not rendered
    // Be more permissive for elements without layout
    if (!node.layout) {
      // Check common hidden tags
      const hiddenTags = ['script', 'style', 'meta', 'link', 'title', 'head'];
      if (hiddenTags.includes(node.tag)) return false;
      
      // Otherwise assume potentially visible
      return true;
    }
    
    // Check for zero dimensions
    if (node.layout.width === 0 || node.layout.height === 0) return false;
    
    // Check computed styles if available
    if (doc.computedStyles) {
      const styleIndex = doc.nodes.nodeIndex?.indexOf(nodeIndex);
      if (styleIndex >= 0 && doc.computedStyles[styleIndex]) {
        const styles = doc.computedStyles[styleIndex];
        
        // Check visibility
        const visibilityIdx = doc.computedStyles.propertyNames?.indexOf('visibility');
        if (visibilityIdx >= 0 && styles[visibilityIdx] === 'hidden') return false;
        
        // Check display
        const displayIdx = doc.computedStyles.propertyNames?.indexOf('display');
        if (displayIdx >= 0 && styles[displayIdx] === 'none') return false;
        
        // Check opacity
        const opacityIdx = doc.computedStyles.propertyNames?.indexOf('opacity');
        if (opacityIdx >= 0 && parseFloat(styles[opacityIdx]) === 0) return false;
      }
    }
    
    return true;
  }

  /**
   * Check if element is in viewport
   */
  isInViewport(node, viewport) {
    if (!node.layout) return false;
    
    const { y, height } = node.layout;
    const viewportBottom = viewport.scrollY + viewport.height;
    
    // Check if any part of the element is in viewport
    return (y + height) > viewport.scrollY && y < viewportBottom;
  }

  /**
   * Extract computed styles for a node
   */
  extractComputedStyles(doc, nodes, nodeIndex) {
    if (!doc.computedStyles) return null;
    
    // Find the style index for this node
    const styleIndex = nodes.nodeIndex?.indexOf(nodeIndex);
    if (styleIndex < 0 || !doc.computedStyles[styleIndex]) return null;
    
    const styles = doc.computedStyles[styleIndex];
    const propertyNames = doc.computedStyles.propertyNames || [];
    const result = {};
    
    // Map property names to values
    propertyNames.forEach((propName, idx) => {
      if (styles[idx] !== undefined) {
        result[propName] = styles[idx];
      }
    });
    
    return result;
  }

  /**
   * Calculate node depth in tree
   */
  calculateDepth(nodeIndex, parentMap) {
    let depth = 0;
    let current = nodeIndex;
    
    while (parentMap.has(current)) {
      depth++;
      current = parentMap.get(current);
    }
    
    return depth;
  }

  /**
   * Get string from string table
   */
  getString(strings, index) {
    return strings[index] || '';
  }

  /**
   * Generate unique snapshot ID
   */
  generateSnapshotId() {
    return crypto.randomBytes(4).toString('hex');
  }
}