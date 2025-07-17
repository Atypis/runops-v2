export function createToolDefinitions() {
  // Define node schemas with type-specific required fields using anyOf
  const nodeSchemas = [
    // browser_ai_query - uses AI to get content from the page with required schema
    {
      type: 'object',
      properties: {
        type: { const: 'browser_ai_query' },
        config: {
          type: 'object',
          properties: {
            instruction: {
              type: 'string',
              description: 'Natural language instruction describing what to get from the page'
            },
            schema: {
              type: 'object',
              description: 'Required JSON schema in proper JSON Schema format. Must use type definitions. Examples: {type: "object", properties: {title: {type: "string"}}} for objects, {type: "array", items: {type: "string"}} for arrays, {type: "boolean"} for booleans. Always specify types explicitly.',
              additionalProperties: true
            },
            store_variable: {
              type: 'boolean',
              description: 'Store this node\'s result as a reusable variable (default: false). When true, the result can be referenced using {{alias.property}} syntax in subsequent nodes.'
            }
          },
          required: ['instruction', 'schema'],
          additionalProperties: false
        },
        description: {
          type: 'string',
          description: 'Human-readable description of what this node does'
        },
        alias: {
          type: 'string',
          description: 'Required unique identifier for the node. Must be unique across the workflow. Format: snake_case (lowercase letters, numbers, underscores).',
          pattern: '^[a-z][a-z0-9_]*$'
        }
      },
      required: ['type', 'config', 'alias'],
      additionalProperties: false
    },
    // browser_ai_action - requires action and instruction
    {
      type: 'object',
      properties: {
        type: { const: 'browser_ai_action' },
        config: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['click', 'type', 'act'],
              description: 'The AI-powered action to perform'
            },
            instruction: {
              type: 'string',
              description: 'Natural language instruction describing what to do'
            },
            text: {
              type: 'string',
              description: 'For type action: The text to type into the element'
            },
            constraints: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional constraints or hints to guide the AI'
            },
            store_variable: {
              type: 'boolean',
              description: 'Store this node\'s result as a reusable variable (default: false). When true, the result can be referenced using {{alias.property}} syntax in subsequent nodes.'
            }
          },
          required: ['action', 'instruction'],
          additionalProperties: false
        },
        description: {
          type: 'string',
          description: 'Human-readable description of what this node does'
        },
        alias: {
          type: 'string',
          description: 'Required unique identifier for the node. Must be unique across the workflow. Format: snake_case (lowercase letters, numbers, underscores).',
          pattern: '^[a-z][a-z0-9_]*$'
        }
      },
      required: ['type', 'config', 'alias'],
      additionalProperties: false
    },
    // browser_action - requires action
    {
      type: 'object',
      properties: {
        type: { const: 'browser_action' },
        config: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['navigate', 'wait', 'openNewTab', 'switchTab', 'closeTab', 'back', 'forward', 'refresh', 'screenshot', 'listTabs', 'getCurrentTab', 'keypress'],
              description: 'The deterministic browser action to perform. Note: click and type actions have been moved to browser_ai_action node type.'
            },
            url: {
              type: 'string',
              description: 'For navigate/openNewTab: URL to navigate to'
            },
            type: {
              type: 'string',
              enum: ['time', 'selector'],
              description: 'For wait: Type of wait - time in ms or wait for selector'
            },
            value: {
              type: 'string',
              description: 'For wait: Milliseconds to wait or CSS selector to wait for'
            },
            tabName: {
              type: 'string',
              description: 'For switchTab/closeTab: Name of the tab'
            },
            name: {
              type: 'string',
              description: 'For openNewTab: REQUIRED tab name (tabs cannot be tracked without names). For screenshot: file name.'
            },
            key: {
              type: 'string',
              description: 'For keypress: Key to press (e.g., "Enter", "Escape", "Tab")'
            },
            fullPage: {
              type: 'boolean',
              description: 'For screenshot: Whether to capture full page (default: false)'
            },
            store_variable: {
              type: 'boolean',
              description: 'Store this node\'s result as a reusable variable (default: false). When true, the result can be referenced using {{alias.property}} syntax in subsequent nodes.'
            }
          },
          required: ['action'],
          additionalProperties: false
        },
        description: {
          type: 'string',
          description: 'Human-readable description of what this node does'
        },
        alias: {
          type: 'string',
          description: 'Required unique identifier for the node. Must be unique across the workflow. Format: snake_case (lowercase letters, numbers, underscores).',
          pattern: '^[a-z][a-z0-9_]*$'
        }
      },
      required: ['type', 'config', 'alias'],
      additionalProperties: false
    },
    // browser_query - requires method and rules
    {
      type: 'object',
      properties: {
        type: { const: 'browser_query' },
        config: {
          type: 'object',
          properties: {
            method: {
              type: 'string',
              enum: ['validate'],
              description: 'The query method - browser_query only supports validate. Note: extract and observe methods have been moved to browser_ai_query node type.'
            },
            rules: {
              type: 'array',
              description: 'Array of validation rules',
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
              description: 'What to do if validation fails (default: stop_workflow)'
            },
            store_variable: {
              type: 'boolean',
              description: 'Store this node\'s result as a reusable variable (default: false). When true, the result can be referenced using {{alias.property}} syntax in subsequent nodes.'
            }
          },
          required: ['method', 'rules'],
          additionalProperties: false
        },
        description: {
          type: 'string',
          description: 'Human-readable description of what this node does'
        },
        alias: {
          type: 'string',
          description: 'Required unique identifier for the node. Must be unique across the workflow. Format: snake_case (lowercase letters, numbers, underscores).',
          pattern: '^[a-z][a-z0-9_]*$'
        }
      },
      required: ['type', 'config', 'alias'],
      additionalProperties: false
    },
    // iterate - Sequential loop execution with automatic variable scoping
    {
      type: 'object',
      properties: {
        type: { const: 'iterate' },
        config: {
          type: 'object',
          properties: {
            over: {
              type: 'string',
              description: 'Reference to array to iterate over. Use {{alias.property}} syntax for stored variables (e.g., "{{extract_emails.emails}}"). Direct state paths also supported for backward compatibility (e.g., "state.items").'
            },
            variable: {
              type: 'string',
              description: 'Name for the current item variable. Creates: ${variable} (current item), ${variable}Index (0-based index), ${variable}Total (array length).',
              pattern: '^[a-zA-Z][a-zA-Z0-9_]*$'
            },
            body: {
              type: 'array',
              items: { type: 'number' },
              description: 'Node positions to execute for each iteration (e.g., [15, 16, 17]).'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of items to process. Useful for testing or limiting large datasets. Processes all items if not specified.',
              minimum: 1
            },
            continueOnError: {
              type: 'boolean',
              description: 'Whether to continue iterating if an error occurs in one iteration (default: true). When false, stops at first error.'
            },
            index: {
              type: 'string',
              description: 'Custom name for the index variable. Defaults to "${variable}Index". Must be different from the main variable name.',
              pattern: '^[a-zA-Z][a-zA-Z0-9_]*$'
            },
            store_variable: {
              type: 'boolean',
              description: 'Store iteration results as a reusable variable (default: false). Returns {results: [], errors: [], processed: number, total: number}. Reference with {{alias.results}}, {{alias.processed}}, etc.'
            }
          },
          required: ['over', 'variable'],
          additionalProperties: false
        },
        description: {
          type: 'string',
          description: 'Human-readable description of what this node does'
        },
        alias: {
          type: 'string',
          description: 'Required unique identifier for the node. Must be unique across the workflow. Format: snake_case (lowercase letters, numbers, underscores).',
          pattern: '^[a-z][a-z0-9_]*$'
        }
      },
      required: ['type', 'config', 'alias'],
      additionalProperties: false
    },
    // group - requires nodeRange
    {
      type: 'object',
      properties: {
        type: { const: 'group' },
        config: {
          type: 'object',
          properties: {
            nodeRange: {
              type: 'string',
              description: 'Range of nodes to group (e.g., "3-7" or "3,5,7-9")'
            },
            groupId: {
              type: 'string',
              description: 'Unique identifier for the group'
            },
            params: {
              type: 'object',
              description: 'Parameters to pass to the group',
              additionalProperties: true
            },
            store_variable: {
              type: 'boolean',
              description: 'Store this node\'s result as a reusable variable (default: false). When true, the result can be referenced using {{alias.property}} syntax in subsequent nodes.'
            }
          },
          required: ['nodeRange'],
          additionalProperties: false
        },
        description: {
          type: 'string',
          description: 'Human-readable description of what this node does'
        },
        alias: {
          type: 'string',
          description: 'Required unique identifier for the node. Must be unique across the workflow. Format: snake_case (lowercase letters, numbers, underscores).',
          pattern: '^[a-z][a-z0-9_]*$'
        }
      },
      required: ['type', 'config', 'alias'],
      additionalProperties: false
    },
    // context - requires operation
    {
      type: 'object',
      properties: {
        type: { const: 'context' },
        config: {
          type: 'object',
          properties: {
            operation: {
              type: 'string',
              enum: ['set', 'clear', 'clear_all'],
              description: 'The context operation to perform'
            },
            variables: {
              type: 'object',
              description: 'Variables to set, clear, or modify',
              additionalProperties: true
            },
            store_variable: {
              type: 'boolean',
              description: 'Store this node\'s result as a reusable variable (default: false). When true, the result can be referenced using {{alias.property}} syntax in subsequent nodes.'
            }
          },
          required: ['operation'],
          additionalProperties: false
        },
        description: {
          type: 'string',
          description: 'Human-readable description of what this node does'
        },
        alias: {
          type: 'string',
          description: 'Required unique identifier for the node. Must be unique across the workflow. Format: snake_case (lowercase letters, numbers, underscores).',
          pattern: '^[a-z][a-z0-9_]*$'
        }
      },
      required: ['type', 'config', 'alias'],
      additionalProperties: false
    },
    // cognition - AI-powered reasoning and analysis
    // Purpose: Process data through natural language instructions and return structured results
    // When to use: For classification, decision-making, data transformation, or any reasoning task
    // Common patterns:
    //   - Text generation: {type: "string"}
    //   - Yes/no decisions: {type: "boolean"}  
    //   - Structured data: {type: "object", properties: {...}}
    //   - Lists: {type: "array", items: {...}}
    {
      type: 'object',
      properties: {
        type: { const: 'cognition' },
        config: {
          type: 'object',
          properties: {
            instruction: {
              type: 'string',
              description: 'Natural language instruction for the AI. Can include {{variable}} references.'
            },
            schema: {
              type: 'object',
              description: 'Required JSON Schema defining the output format. Must include at least a "type" property. Common examples: {type: "string"}, {type: "boolean"}, {type: "object", properties: {...}}, {type: "array", items: {...}}',
              additionalProperties: true
            },
            store_variable: {
              type: 'boolean',
              description: 'Store this node\'s result as a reusable variable (default: false). When true, the result can be referenced using {{alias.property}} syntax in subsequent nodes.'
            }
          },
          required: ['instruction', 'schema'],
          additionalProperties: false
        },
        description: {
          type: 'string',
          description: 'Human-readable description of what this node does'
        },
        alias: {
          type: 'string',
          description: 'Required unique identifier for the node. Must be unique across the workflow. Format: snake_case (lowercase letters, numbers, underscores).',
          pattern: '^[a-z][a-z0-9_]*$'
        }
      },
      required: ['type', 'config', 'alias'],
      additionalProperties: false
    },
    // route - Clean conditional branching with expression evaluation
    {
      type: 'object',
      properties: {
        type: { const: 'route' },
        config: {
          type: 'array',
          description: 'Array of branches evaluated in order. First matching condition wins.',
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Name of this branch (e.g., "urgent", "normal", "default")'
              },
              condition: {
                type: 'string',
                description: 'Boolean expression to evaluate. Supports logical operators (&&, ||, !), comparisons, and ternary. Use "true" for default/fallback branch.'
              },
              branch: {
                anyOf: [
                  { type: 'number', description: 'Single node position to execute' },
                  { 
                    type: 'array', 
                    items: { type: 'number' },
                    description: 'Array of node positions to execute in sequence'
                  }
                ],
                description: 'Node position(s) to execute if condition is true'
              }
            },
            required: ['name', 'condition', 'branch'],
            additionalProperties: false
          },
          minItems: 1
        },
        description: {
          type: 'string',
          description: 'Human-readable description of what this node does'
        },
        alias: {
          type: 'string',
          description: 'Required unique identifier for the node. Must be unique across the workflow. Format: snake_case (lowercase letters, numbers, underscores).',
          pattern: '^[a-z][a-z0-9_]*$'
        }
      },
      required: ['type', 'config', 'alias'],
      additionalProperties: false
    },
    // General schema for other node types with minimal requirements
    {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['transform', 'handle'],
          description: 'The type of node'
        },
        config: {
          type: 'object',
          description: 'Configuration specific to the node type. Config object cannot be empty ({}) - platform will reject it.',
          additionalProperties: true
        },
        description: {
          type: 'string',
          description: 'Human-readable description of what this node does'
        },
        alias: {
          type: 'string',
          description: 'Required unique identifier for the node. Must be unique across the workflow. Format: snake_case (lowercase letters, numbers, underscores).',
          pattern: '^[a-z][a-z0-9_]*$'
        }
      },
      required: ['type', 'config', 'alias'],
      additionalProperties: false
    }
  ];

  return [
    {
      type: 'function',
      function: {
        name: 'add_or_replace_nodes',
        description: 'Add nodes to the workflow or replace existing nodes. Use target="end" to append, a number to insert at position, or a node alias/id to replace. Every node MUST have a unique alias and non-empty config object.',
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
              items: {
                anyOf: nodeSchemas
              }
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