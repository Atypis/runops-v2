export function createToolDefinitions() {
  // Define the node schema once to avoid duplication
  const nodeSchema = {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['browser_action', 'browser_ai_action', 'browser_query', 'browser_ai_query', 'transform', 'cognition', 'agent', 'iterate', 'route', 'handle', 'context', 'group'],
        description: 'The type of node'
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
          },
          
          // transform node properties
          operation: {
            type: 'string',
            enum: ['extract', 'filter', 'map', 'reduce', 'sort', 'merge', 'custom'],
            description: 'For transform: The data transformation operation'
          },
          source: {
            type: 'string',
            description: 'For transform: Variable reference to transform (e.g., "{{emails.result}}")'
          },
          expression: {
            type: 'string',
            description: 'For transform: JavaScript expression or function body'
          },
          
          // cognition node properties
          task: {
            type: 'string',
            description: 'For cognition: The reasoning task to perform'
          },
          inputs: {
            type: 'object',
            description: 'For cognition: Input variables to provide to the AI',
            additionalProperties: true
          },
          outputFormat: {
            type: 'string',
            enum: ['text', 'json', 'markdown'],
            description: 'For cognition: Expected output format'
          },
          
          // agent node properties
          goal: {
            type: 'string',
            description: 'For agent: The goal for the autonomous agent'
          },
          tools: {
            type: 'array',
            items: { type: 'string' },
            description: 'For agent: Available tools for the agent'
          },
          maxSteps: {
            type: 'number',
            description: 'For agent: Maximum steps before stopping'
          },
          
          // iterate node properties
          over: {
            type: 'string',
            description: 'For iterate: Variable to iterate over (e.g., "{{emails.result}}")'
          },
          variable: {
            type: 'string',
            description: 'For iterate: Name for the loop variable'
          },
          body: {
            type: 'array',
            items: { type: 'number' },
            description: 'For iterate: Node positions to execute in each iteration'
          },
          
          // route node properties
          condition: {
            type: 'string',
            description: 'For route: JavaScript expression that evaluates to true/false'
          },
          paths: {
            type: 'object',
            properties: {
              true: {
                type: 'array',
                items: { type: 'number' },
                description: 'Node positions to execute if condition is true'
              },
              false: {
                type: 'array',
                items: { type: 'number' },
                description: 'Node positions to execute if condition is false'
              }
            },
            description: 'For route: Conditional execution paths'
          },
          
          // handle node properties
          try: {
            type: 'array',
            items: { type: 'number' },
            description: 'For handle: Node positions to try'
          },
          catch: {
            type: 'array',
            items: { type: 'number' },
            description: 'For handle: Node positions to execute on error'
          },
          finally: {
            type: 'array',
            items: { type: 'number' },
            description: 'For handle: Node positions to always execute'
          },
          errorVariable: {
            type: 'string',
            description: 'For handle: Variable name to store error details'
          },
          
          // context node properties
          // operation already defined above for transform
          variables: {
            type: 'object',
            description: 'For context: Variables to set, clear, or modify',
            additionalProperties: true
          },
          
          // group node properties
          nodeRange: {
            type: 'string',
            description: 'For group: Range of nodes to group (e.g., "3-7" or "3,5,7-9")'
          },
          groupId: {
            type: 'string',
            description: 'For group: Unique identifier for the group'
          },
          params: {
            type: 'object',
            description: 'For group: Parameters to pass to the group',
            additionalProperties: true
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
  };

  return [
    {
      type: 'function',
      function: {
        name: 'add_or_replace_nodes',
        description: 'Add nodes to the workflow or replace existing nodes. Use target="end" to append, a number to insert at position, or a node alias/id to replace.',
        parameters: {
          type: 'object',
          properties: {
            target: {
              type: ['string', 'number'],
              description: 'Where to add/replace nodes: "end" to append, number for position insert (e.g., 5), or node alias/id to replace (e.g., "validate_form")'
            },
            nodes: {
              type: 'array',
              description: 'Array of nodes to add or replace. Each node MUST have an alias.',
              minItems: 1,
              items: nodeSchema
            }
          },
          required: ['target', 'nodes'],
          additionalProperties: false
        },
        strict: true
      }
    },
    {
      type: 'function',
      function: {
        name: 'delete_nodes',
        description: 'Delete one or more nodes from the workflow',
        parameters: {
          type: 'object',
          properties: {
            nodeIds: {
              type: 'array',
              description: 'Array of node IDs or aliases to delete',
              minItems: 1,
              items: {
                type: ['string', 'number'],
                description: 'Node ID (number) or alias (string) to delete'
              }
            },
            options: {
              type: 'object',
              description: 'Optional deletion settings',
              properties: {
                handleDependencies: {
                  type: 'boolean',
                  description: 'Update references in control flow nodes (default: true)'
                },
                deleteChildren: {
                  type: 'boolean',
                  description: 'Delete child nodes of control flow nodes (default: false)'
                },
                dryRun: {
                  type: 'boolean',
                  description: 'Preview deletion without actually deleting (default: false)'
                }
              },
              additionalProperties: false
            }
          },
          required: ['nodeIds'],
          additionalProperties: false
        },
        strict: true
      }
    },
    // Add other tool definitions here as we refactor them
  ];
}