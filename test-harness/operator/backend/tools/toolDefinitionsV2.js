export function createToolDefinitions() {
  return [
    {
      type: 'function',
      function: {
        name: 'create_node',
        description: 'Create one or more nodes in the workflow. Pass an array with one element for a single node, or multiple elements for multiple nodes.',
        parameters: {
          type: 'object',
          properties: {
            nodes: {
              type: 'array',
              description: 'Array of nodes to create',
              minItems: 1,
              items: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    enum: ['browser_action', 'browser_ai_action', 'browser_query', 'browser_ai_query', 'transform', 'cognition', 'agent', 'iterate', 'route', 'handle', 'context', 'group'],
                    description: 'The type of node to create'
                  },
                  config: {
                    type: 'object',
                    description: 'Configuration specific to the node type',
                    properties: {
                      // Common property
                      store_variable: {
                        type: 'boolean',
                        description: 'Store this node\'s result as a reusable variable (default: false)'
                      },
                      
                      // browser_action properties (deterministic)
                      action: {
                        type: 'string',
                        enum: ['navigate', 'wait', 'openNewTab', 'switchTab', 'closeTab', 'back', 'forward', 'refresh', 'screenshot', 'listTabs', 'getCurrentTab', 'keypress', 'click', 'type', 'act'],
                        description: 'For browser_action: navigate, wait, openNewTab, switchTab, closeTab, back, forward, refresh, screenshot, listTabs, getCurrentTab, keypress. For browser_ai_action: click, type, act'
                      },
                      url: {
                        type: 'string',
                        description: 'For browser_action (navigate/openNewTab): URL to navigate to'
                      },
                      type: {
                        type: 'string',
                        enum: ['time', 'selector'],
                        description: 'For browser_action (wait): Type of wait - time in ms or wait for selector'
                      },
                      value: {
                        type: 'string',
                        description: 'For browser_action (wait): Milliseconds to wait or CSS selector to wait for'
                      },
                      duration: {
                        type: 'number',
                        description: 'For browser_action (wait with type=time): Milliseconds to wait (deprecated, use value instead)'
                      },
                      selector: {
                        type: 'string',
                        description: 'For browser_action (wait with type=selector): CSS selector to wait for (deprecated, use value instead)'
                      },
                      tabName: {
                        type: 'string',
                        description: 'For browser_action (switchTab/closeTab): Name of the tab to switch to or close'
                      },
                      name: {
                        type: 'string',
                        description: 'For browser_action (openNewTab/screenshot): Tab name or screenshot file name'
                      },
                      key: {
                        type: 'string',
                        description: 'For browser_action (keypress): Key to press (e.g., "Enter", "Escape", "Tab")'
                      },
                      fullPage: {
                        type: 'boolean',
                        description: 'For browser_action (screenshot): Whether to capture full page (default: false)'
                      },
                      
                      // browser_ai_action properties (AI-powered)
                      instruction: {
                        type: 'string',
                        description: 'For browser_ai_action/browser_ai_query: Natural language instruction describing what to do or extract'
                      },
                      text: {
                        type: 'string',
                        description: 'For browser_ai_action (type): The text to type into the element'
                      },
                      constraints: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'For browser_ai_action: Optional constraints or hints to guide the AI'
                      },
                      
                      // browser_query properties (deterministic validation)
                      method: {
                        type: 'string',
                        enum: ['validate', 'extract', 'observe', 'assess'],
                        description: 'For browser_query/browser_ai_query: The query method. browser_query only supports "validate"'
                      },
                      rules: {
                        type: 'array',
                        description: 'For browser_query (validate): Array of validation rules',
                        items: {
                          type: 'object',
                          properties: {
                            type: {
                              type: 'string',
                              enum: ['element_exists', 'element_absent'],
                              description: 'Type of validation rule'
                            },
                            selector: {
                              type: 'string',
                              description: 'CSS selector to check'
                            },
                            description: {
                              type: 'string',
                              description: 'Human-readable description of what we\'re checking'
                            }
                          },
                          required: ['type', 'selector'],
                          additionalProperties: false
                        }
                      },
                      onFailure: {
                        type: 'string',
                        enum: ['stop_workflow', 'continue_with_error'],
                        description: 'For browser_query: What to do if validation fails (default: stop_workflow)'
                      },
                      
                      // browser_ai_query properties (AI-powered extraction)
                      schema: {
                        type: 'object',
                        description: 'For browser_ai_query (extract): Optional JSON schema defining expected data structure. If omitted, AI will determine structure.'
                      },
                      expected: {
                        type: 'string',
                        description: 'For browser_ai_query (assess): Expected state or condition to check for'
                      }
                    },
                    additionalProperties: false
                  },
                  description: {
                    type: 'string',
                    description: 'Human-readable description of what this node does'
                  },
                  alias: {
                    type: 'string',
                    description: 'Required unique identifier for the node (snake_case format)',
                    pattern: '^[a-z][a-z0-9_]*$'
                  }
                },
                required: ['type', 'config', 'alias'],
                additionalProperties: false
              }
            }
          },
          required: ['nodes'],
          additionalProperties: false
        },
        strict: true
      }
    },
    // Add other tool definitions here as we refactor them
  ];
}