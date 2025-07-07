/**
 * Stagehand POV - Enhanced Page Object View generation for Director 2.0
 *
 * This module provides LLM-friendly page representations with stable DOM selectors
 * for building deterministic RPA workflows.
 */
import { AUTOMATION_ATTRIBUTES } from './src/types.js';
import { formatTreeWithOptions } from './src/formatting.js';
import { cleanStructuralNodes, removeRedundantTextChildren, filterRelevantNodes } from './src/tree-utils.js';
export * from './src/types.js';
export * from './src/formatting.js';
export * from './src/tree-utils.js';
/**
 * Main API: Inspect a browser tab and generate enhanced POV
 *
 * @param page - Playwright page instance
 * @param options - Inspection options
 * @returns Enhanced POV string with inline selectors
 */
export async function inspectTab(page, options = {}) {
    try {
        // Get accessibility snapshot from Playwright
        const snapshot = await page.accessibility.snapshot({ interestingOnly: false });
        if (!snapshot) {
            return '[No accessibility tree available]';
        }
        // Convert Playwright snapshot to our format
        const tree = convertPlaywrightSnapshot(snapshot);
        // Clean and process the tree
        let processed = cleanStructuralNodes(tree);
        if (processed) {
            processed = removeRedundantTextChildren(processed);
            processed = filterRelevantNodes(processed);
        }
        if (!processed) {
            return '[Empty accessibility tree]';
        }
        // Format with selectors
        return formatTreeWithOptions(processed, {
            includeSelectors: options.includeSelectors ?? true,
            maxDepth: options.maxDepth,
            skipRoles: options.skipRoles
        });
    }
    catch (error) {
        console.error('Error inspecting tab:', error);
        return `[Error inspecting tab: ${error instanceof Error ? error.message : 'Unknown error'}]`;
    }
}
/**
 * Get both clean and enhanced POV representations
 * Useful when you need both for different purposes
 */
export async function inspectTabDual(page) {
    try {
        const snapshot = await page.accessibility.snapshot({ interestingOnly: false });
        if (!snapshot) {
            return {
                clean: '[No accessibility tree available]',
                enhanced: '[No accessibility tree available]',
                tree: null
            };
        }
        const tree = convertPlaywrightSnapshot(snapshot);
        let processed = cleanStructuralNodes(tree);
        if (processed) {
            processed = removeRedundantTextChildren(processed);
            processed = filterRelevantNodes(processed);
        }
        if (!processed) {
            return {
                clean: '[Empty accessibility tree]',
                enhanced: '[Empty accessibility tree]',
                tree: null
            };
        }
        return {
            clean: formatTreeWithOptions(processed, { includeSelectors: false }),
            enhanced: formatTreeWithOptions(processed, { includeSelectors: true }),
            tree: processed
        };
    }
    catch (error) {
        const errorMsg = `[Error: ${error instanceof Error ? error.message : 'Unknown'}]`;
        return {
            clean: errorMsg,
            enhanced: errorMsg,
            tree: null
        };
    }
}
/**
 * Convert Playwright accessibility snapshot to our format
 */
function convertPlaywrightSnapshot(snapshot) {
    const node = {
        nodeId: snapshot.nodeId || generateNodeId(),
        role: snapshot.role || 'generic',
        name: snapshot.name,
        description: snapshot.description,
        value: snapshot.value
    };
    // Extract properties from various Playwright snapshot fields
    const properties = [];
    // Add common attributes if present
    if (snapshot.attributes) {
        Object.entries(snapshot.attributes).forEach(([name, value]) => {
            if (AUTOMATION_ATTRIBUTES.includes(name)) {
                properties.push({
                    name,
                    value: { type: 'string', value: String(value) }
                });
            }
        });
    }
    // Check for specific properties Playwright exposes
    const checkProperties = [
        'id', 'className', 'href', 'type', 'name',
        'data-testid', 'data-test', 'data-cy', 'data-qa',
        'aria-label', 'aria-labelledby', 'aria-describedby'
    ];
    checkProperties.forEach(prop => {
        if (snapshot[prop]) {
            properties.push({
                name: prop === 'className' ? 'class' : prop,
                value: { type: 'string', value: String(snapshot[prop]) }
            });
        }
    });
    if (properties.length > 0) {
        node.properties = properties;
    }
    // Process children
    if (snapshot.children && Array.isArray(snapshot.children)) {
        node.children = snapshot.children.map((child) => convertPlaywrightSnapshot(child));
    }
    return node;
}
let nodeIdCounter = 0;
function generateNodeId() {
    return `node-${++nodeIdCounter}`;
}
/**
 * Lightweight exploration using POV
 * This will be used for the "lightweight_exploration" mode
 */
export async function exploreWithPOV(page, instruction) {
    const pov = await inspectTab(page);
    // TODO: In the real implementation, this would send the POV
    // to an LLM with the instruction for analysis
    // For now, return a placeholder
    return {
        pov,
        analysis: `[Analysis would be performed here based on: ${instruction}]`
    };
}
