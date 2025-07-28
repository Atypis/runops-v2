/**
 * DOM Exploration Tools - Tool definitions for Director 3.0
 * Provides token-efficient DOM inspection capabilities
 */

export function createDOMExplorationTools() {
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
        name: 'dom_overview',
        description: 'Get a filtered overview of the current page showing structure, interactive elements, and key content. Returns element IDs that can be used with other DOM tools. This is your primary reconnaissance tool - use it first when exploring a new page or after navigation. More efficient than inspect_tab for understanding page structure.',
        parameters: {
          type: 'object',
          properties: {
            tabName: {
              type: 'string',
              description: 'Browser tab to analyze (defaults to active tab)'
            },
            filters: {
              type: 'object',
              description: 'Which content types to include (all true by default)',
              properties: {
                outline: {
                  type: 'boolean',
                  description: 'Include page structure (depth ≤ 2)'
                },
                interactives: {
                  type: 'boolean',
                  description: 'Include clickable/typeable elements'
                },
                headings: {
                  type: 'boolean',
                  description: 'Include headings and key text blocks'
                }
              },
              additionalProperties: false
            },
            visible: {
              type: 'boolean',
              description: 'Only include visible elements (default: true)'
            },
            viewport: {
              type: 'boolean',
              description: 'Only include elements in current viewport (default: true)'
            },
            max_rows: {
              type: 'number',
              description: 'Maximum elements per category (default: 30, max: 100)',
              minimum: 1,
              maximum: 100
            },
            diff_from: {
              type: ['string', 'boolean', 'null'],
              description: 'Compare to previous snapshot to see changes. Use true to compare with last snapshot for this tab, or provide a specific snapshotId. When set, response shows only what changed (added/removed/modified elements).'
            },
            include_full: {
              type: 'boolean',
              description: 'When using diff mode, also include the full overview sections (default: false)'
            },
            autoScroll: {
              type: 'boolean',
              description: 'Automatically scroll through the page to capture elements from virtualized content. When enabled, progressively scrolls and captures elements that only render when in view (default: false)'
            },
            maxScrollDistance: {
              type: 'number',
              description: 'Maximum distance to scroll in pixels when autoScroll is enabled (default: 5000)',
              minimum: 500,
              maximum: 50000
            },
            scrollContainer: {
              type: 'string',
              description: 'CSS selector for the scrollable container when autoScroll is enabled. If not provided, scrolls the main viewport.'
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
        name: 'dom_structure',
        description: 'Get pure structural view of the page DOM tree, like "ls" for web pages. Shows nested HTML structure without content. Use this when you need to understand page organization or find container elements.',
        parameters: {
          type: 'object',
          properties: {
            tabName: {
              type: 'string',
              description: 'Browser tab to analyze (defaults to active tab)'
            },
            depth: {
              type: 'number',
              description: 'Maximum depth to traverse (default: 3)',
              minimum: 1,
              maximum: 10
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
        name: 'dom_search',
        description: 'Search for specific elements by text, selector, attributes, or role. Like "grep" for DOM elements. Returns matching elements with their IDs for use with other tools.',
        parameters: {
          type: 'object',
          properties: {
            tabName: {
              type: 'string',
              description: 'Browser tab to search in (defaults to active tab)'
            },
            query: {
              type: 'object',
              description: 'Search criteria (at least one required)',
              properties: {
                text: {
                  type: 'string',
                  description: 'Find elements containing this text'
                },
                selector: {
                  type: 'string',
                  description: 'CSS selector to match'
                },
                attributes: {
                  type: 'object',
                  description: 'Match elements with these attribute values',
                  additionalProperties: { type: 'string' }
                },
                role: {
                  type: 'string',
                  description: 'ARIA role to match'
                },
                tag: {
                  type: 'string',
                  description: 'HTML tag name to match'
                }
              },
              additionalProperties: false
            },
            limit: {
              type: 'number',
              description: 'Maximum results to return (default: 20)',
              minimum: 1,
              maximum: 100
            },
            context: {
              type: 'string',
              description: 'Element ID to search within (from previous tool results)'
            },
            visible: {
              type: 'boolean',
              description: 'Only search visible elements (default: true)'
            },
            autoScroll: {
              type: 'boolean',
              description: 'Automatically scroll to search for elements not in current DOM. Useful for virtualized content where elements only exist when scrolled into view (default: false)'
            },
            maxScrollDistance: {
              type: 'number',
              description: 'Maximum distance to scroll in pixels when autoScroll is enabled (default: 5000)',
              minimum: 500,
              maximum: 50000
            },
            scrollContainer: {
              type: 'string',
              description: 'CSS selector for the scrollable container when autoScroll is enabled. If not provided, scrolls the main viewport.'
            }
          },
          required: ['query'],
          additionalProperties: false
        },
        strict: true
      }
    },
    {
      type: 'function',
      function: {
        name: 'dom_inspect',
        description: 'Get detailed information about a specific element. Like "cat/read" for DOM elements. Use element IDs from other DOM tools (e.g., "[123]"). Returns comprehensive details including attributes, text, styles, and relationships.',
        parameters: {
          type: 'object',
          properties: {
            tabName: {
              type: 'string',
              description: 'Browser tab containing the element (defaults to active tab)'
            },
            elementId: {
              type: 'string',
              description: 'Element ID from previous tool results (e.g., "[123]" or "123")',
              pattern: '^\\[?\\d+\\]?$'
            },
            include: {
              type: 'object',
              description: 'What information to include',
              properties: {
                attributes: {
                  type: 'boolean',
                  description: 'Include all element attributes (default: true)'
                },
                computedStyles: {
                  type: 'boolean',
                  description: 'Include computed CSS styles (default: false)'
                },
                children: {
                  type: 'boolean',
                  description: 'Include immediate children (default: true)'
                },
                siblings: {
                  type: 'boolean',
                  description: 'Include sibling elements (default: false)'
                },
                parents: {
                  type: 'boolean',
                  description: 'Include parent chain (default: true)'
                },
                text: {
                  type: 'boolean',
                  description: 'Include all text content (default: true)'
                }
              },
              additionalProperties: false
            }
          },
          required: ['elementId'],
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
    }
  ];
}