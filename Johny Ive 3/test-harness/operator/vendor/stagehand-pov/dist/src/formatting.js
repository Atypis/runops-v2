/**
 * Enhanced POV formatting with DOM selector extraction
 * Modified from Stagehand's formatSimplifiedTree for Director 2.0
 * 
 * ⚠️ NOTE: This is pure JavaScript (no TypeScript compilation). 
 * See vendor/stagehand-pov/README.md for maintenance instructions.
 */
import { AUTOMATION_ATTRIBUTES } from './types.js';
/**
 * Clean text by normalizing spaces and removing excess whitespace
 * From Stagehand lib/a11y/utils.ts
 */
export function cleanText(text) {
    return text
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, ' ')
        .trim();
}
/**
 * Extract key DOM attributes for stable selector generation
 * This is our enhancement for Director 2.0
 */
export function extractKeyAttributes(properties) {
    if (!properties || properties.length === 0)
        return '';
    const attrs = [];
    for (const prop of properties) {
        if (AUTOMATION_ATTRIBUTES.includes(prop.name) && prop.value?.value) {
            const name = prop.name;
            const value = prop.value.value;
            // Format based on attribute type
            if (name === 'id') {
                attrs.push(`#${value}`);
            }
            else if (name === 'class') {
                // Only include if it looks stable (not random generated)
                const classes = value.split(' ').filter(c => !c.match(/^[a-f0-9]{8}-/) && // No UUIDs
                    !c.match(/^css-[0-9]+/) && // No CSS modules
                    c.length > 2 // Not too short
                );
                if (classes.length > 0) {
                    attrs.push(`.${classes.join('.')}`);
                }
            }
            else if (name === 'href') {
                // Escape quotes in href
                attrs.push(`[href="${value.replace(/"/g, '\\"')}"]`);
            }
            else {
                // Standard attribute selector
                attrs.push(`[${name}="${value.replace(/"/g, '\\"')}"]`);
            }
        }
    }
    return attrs.join('');
}
/**
 * Format the accessibility tree into LLM-friendly text representation
 * Enhanced version of Stagehand's formatSimplifiedTree
 *
 * @param node - The accessibility node to format
 * @param level - Current indentation level
 * @returns Formatted string representation with inline selectors
 */
export function formatSimplifiedTree(node, level = 0) {
    const indent = "  ".repeat(level);
    const idLabel = node.encodedId ?? node.nodeId;
    const namePart = node.name ? `: ${cleanText(node.name)}` : "";
    // Clean Stagehand output without DOM selectors (keep context manageable)
    const currentLine = `${indent}[${idLabel}] ${node.role}${namePart}\n`;
    // Recursively format children
    const childrenLines = node.children
        ?.map((c) => formatSimplifiedTree(c, level + 1))
        .join("") ?? "";
    return currentLine + childrenLines;
}
/**
 * Format a tree with options for selector inclusion
 * Allows flexibility for different inspection modes
 */
export function formatTreeWithOptions(node, options = {}) {
    const { includeSelectors = true, maxDepth = Infinity, skipRoles = [] } = options;
    function formatNode(n, level) {
        if (level > maxDepth || skipRoles.includes(n.role)) {
            return '';
        }
        const indent = "  ".repeat(level);
        const idLabel = n.encodedId ?? n.nodeId;
        const namePart = n.name ? `: ${cleanText(n.name)}` : "";
        const selectorPart = includeSelectors ? extractKeyAttributes(n.properties) : '';
        const currentLine = `${indent}[${idLabel}] ${n.role}${selectorPart}${namePart}\n`;
        const childrenLines = n.children
            ?.map((c) => formatNode(c, level + 1))
            .join("") ?? "";
        return currentLine + childrenLines;
    }
    return formatNode(node, 0);
}
