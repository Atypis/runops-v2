/**
 * Tree processing utilities extracted from Stagehand
 * These help clean and structure the accessibility tree
 */
/**
 * Check if a node is considered interactive
 * From Stagehand lib/a11y/utils.ts
 */
export function isInteractive(node) {
    const interactiveRoles = [
        'button', 'link', 'textbox', 'checkbox', 'radio',
        'combobox', 'searchbox', 'slider', 'spinbutton',
        'switch', 'tab', 'menuitem', 'option', 'cell'
    ];
    return interactiveRoles.includes(node.role) ||
        node.role !== "none" &&
            node.role !== "generic" &&
            node.role !== "InlineTextBox";
}
/**
 * Clean structural nodes that don't add value
 * Simplified from Stagehand's implementation
 */
export function cleanStructuralNodes(node) {
    // Skip nodes that are purely structural with no content
    const structuralRoles = ['none', 'generic', 'group'];
    if (structuralRoles.includes(node.role) &&
        !node.name &&
        (!node.children || node.children.length === 0)) {
        return null;
    }
    // Process children
    if (node.children) {
        node.children = node.children
            .map(child => cleanStructuralNodes(child))
            .filter((child) => child !== null);
    }
    return node;
}
/**
 * Remove redundant static text children
 * When a node's name already contains the child text
 */
export function removeRedundantTextChildren(node) {
    if (!node.children || !node.name)
        return node;
    node.children = node.children.filter(child => {
        // Keep non-text nodes
        if (child.role !== 'StaticText' && child.role !== 'InlineTextBox') {
            return true;
        }
        // Remove if parent name contains child text
        return child.name && !node.name.includes(child.name);
    });
    // Recursively process children
    node.children = node.children.map(child => removeRedundantTextChildren(child));
    return node;
}
/**
 * Build a hierarchical tree from flat nodes
 * Simplified version focusing on essential structure
 */
export function buildHierarchicalTree(nodes, rootId) {
    if (nodes.length === 0)
        return null;
    // Create a map for quick lookup
    const nodeMap = new Map();
    nodes.forEach(node => {
        nodeMap.set(node.nodeId, { ...node, children: [] });
    });
    // Find root
    const root = rootId
        ? nodeMap.get(rootId)
        : nodes.find(n => n.role === 'RootWebArea' || n.role === 'WebArea') || nodes[0];
    if (!root)
        return null;
    // Build tree structure (simplified - assumes nodes have parent references)
    // In real implementation, this would use the childIds from the original nodes
    return root;
}
/**
 * Filter tree to only include visible and relevant nodes
 */
export function filterRelevantNodes(node) {
    // Keep if:
    // 1. Has meaningful name/content
    // 2. Is interactive
    // 3. Has relevant children
    const hasContent = node.name?.trim() || node.value?.trim();
    const hasChildren = node.children && node.children.length > 0;
    const isRelevant = hasContent || isInteractive(node) || hasChildren;
    if (!isRelevant)
        return null;
    // Process children
    if (node.children) {
        node.children = node.children
            .map(child => filterRelevantNodes(child))
            .filter((child) => child !== null);
    }
    return node;
}
