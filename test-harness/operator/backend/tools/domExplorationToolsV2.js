/**
 * DOM Exploration Tools V2 - Simplified visual-first tool definitions for Director
 * Provides screenshot-based inspection workflow with portal detection
 */

export function createDOMExplorationToolsV2() {
  return [
    {
      type: 'function',
      function: {
        name: 'get_screenshot',
        description: 'Take a screenshot of the current page for visual reconnaissance. This is your primary tool for understanding what\'s on the page - use this first to see what the user sees. Essential for 90%+ of automation tasks.',
        parameters: {
          type: 'object',
          properties: {
            tabName: {
              type: 'string',
              description: 'Browser tab to screenshot (defaults to active tab)'
            },
            fullPage: {
              type: 'boolean',
              description: 'Capture full scrollable page content (default: false - viewport only)',
              default: false
            }
          },
          additionalProperties: false
        },
        strict: true
      }
    },
    {
      type: 'function',
      function: {
        name: 'dom_click_inspect',
        description: 'Get detailed DOM information about the element at specific screen coordinates. Perfect for visual workflow building and debugging actionable detection. Bridges the gap between what you see in screenshots and programmatic DOM access.',
        parameters: {
          type: 'object',
          properties: {
            x: {
              type: 'number',
              description: 'X pixel coordinate (from screenshot or visual observation)',
              minimum: 0
            },
            y: {
              type: 'number', 
              description: 'Y pixel coordinate (from screenshot or visual observation)',
              minimum: 0
            },
            tabName: {
              type: 'string',
              description: 'Browser tab to inspect (defaults to active tab)'
            },
            includeParentChain: {
              type: 'boolean',
              description: 'Include full parent element hierarchy (default: true)',
              default: true
            },
            includeChildren: {
              type: 'boolean',
              description: 'Include immediate child elements (default: false)',
              default: false
            },
            generateSelectors: {
              type: 'boolean',
              description: 'Generate multiple stable selector options (default: true)',
              default: true
            },
            checkActionability: {
              type: 'boolean',
              description: 'Test element against actionable detection filters (default: true)',
              default: true
            },
            includeNearbyElements: {
              type: 'boolean',
              description: 'Include elements within 50px radius for context (default: false)',
              default: false
            },
            includeScreenshot: {
              type: 'boolean',
              description: '🔧 ADVANCED DEBUGGING: Include screenshot with target location highlighted. Only enable when visual confirmation is essential - adds ~1k tokens and processing time (default: false)',
              default: false
            },
            searchRadius: {
              type: 'number',
              description: 'Pixel radius to search for nearby actionable elements when includeNearbyElements is true (default: 50)',
              default: 50,
              minimum: 0,
              maximum: 200
            }
          },
          required: ['x', 'y'],
          additionalProperties: false
        },
        strict: true
      }
    },
    {
      type: 'function',
      function: {
        name: 'dom_check_portals',
        description: 'Check for new portal/overlay elements that appeared after an interaction. Compares current DOM against a previous snapshot to find elements added at body level (React portals, modals, dropdowns). Use after clicking buttons that might open popups.',
        parameters: {
          type: 'object',
          properties: {
            tabName: {
              type: 'string',
              description: 'Browser tab to check (defaults to active tab)'
            },
            sinceSnapshotId: {
              type: 'string',
              description: 'Compare against specific snapshot ID. If not provided, compares against the most recent snapshot for this tab.'
            },
            includeAll: {
              type: 'boolean',
              description: 'Include all body-level changes, not just portal patterns (default: false)'
            }
          },
          additionalProperties: false
        },
        strict: true
      }
    }
  ];
}