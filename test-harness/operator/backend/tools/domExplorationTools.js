/**
 * DOM Exploration Tools - Tool definitions for Director 3.0
 * Provides token-efficient DOM inspection capabilities
 */

export function createDOMExplorationTools() {
  return [
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
    }
  ];
}