import { createDOMExplorationTools } from './domExplorationTools.js';

export function createToolDefinitions() {
  // Get DOM exploration tools
  const domTools = createDOMExplorationTools();
  
  // Define node schemas with type-specific required fields using anyOf
  const nodeSchemas = [
    // browser_ai_extract - AI-powered text extraction from fuzzy content zones
    {
      type: 'object',
      properties: {
        type: { const: 'browser_ai_extract' },
        config: {
          type: 'object',
          properties: {
            instruction: {
              type: 'string',
              description: 'Natural language instruction describing what text/content to extract from the current page or element. Focus on extracting human-readable content, not DOM structure.'
            },
            schema: {
              type: 'object',
              description: 'Required JSON schema defining the output format. Use {type: "string"} for simple text extraction, or define an object with properties for structured content.',
              additionalProperties: true
            },
            targetElement: {
              type: 'string',
              description: 'Optional CSS selector to scope extraction to a specific element. If not provided, extracts from the entire visible page.'
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
              enum: ['navigate', 'wait', 'openNewTab', 'switchTab', 'closeTab', 'back', 'forward', 'refresh', 'listTabs', 'getCurrentTab', 'keypress', 'loadProfile', 'click', 'type'],
              description: 'The deterministic browser action to perform. Use click/type with CSS selectors for reliable interactions. loadProfile intelligently loads from local or cloud.'
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
              description: 'For openNewTab: REQUIRED tab name (tabs cannot be tracked without names).'
            },
            key: {
              type: 'string',
              description: 'For keypress: Key to press (e.g., "Enter", "Escape", "Tab")'
            },
            profileName: {
              type: 'string',
              description: 'For loadProfile: Name of the browser profile to load. Checks local first, then restores from cloud if needed. Returns {profile: string, source: "local"|"cloud", message: string} on success. For other profile actions: Name of the browser profile.',
              pattern: '^[a-z0-9-]+$'
            },
            selector: {
              type: 'string',
              description: 'For click/type: CSS selector of the element to interact with'
            },
            text: {
              type: 'string',
              description: 'For type: Text to type into the element'
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
              enum: ['validate', 'deterministic_extract'],
              description: 'The query method. validate: Check element presence/absence. deterministic_extract: Extract data from DOM elements without AI (fast, token-free). Note: AI-powered extract/observe methods are in browser_ai_query node type.'
            },
            rules: {
              type: 'array',
              description: 'Array of validation rules (for validate method)',
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
            selector: {
              type: 'string',
              description: 'For deterministic_extract: CSS selector to match elements (e.g., "tr.zA", ".product-card")'
            },
            fields: {
              type: 'object',
              description: 'For deterministic_extract: Field mappings to extract from each element. Use CSS selectors for sub-elements, @attribute for attributes, @attribute~value for contains checks',
              additionalProperties: {
                type: 'string',
                description: 'CSS selector or @attribute notation. Examples: ".title" for text, "@href" for attribute, "@class~active" for class contains'
              }
            },
            limit: {
              type: 'number',
              description: 'For deterministic_extract: Maximum number of elements to extract (default: all)',
              minimum: 1
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
          required: ['method'],
          additionalProperties: false,
          allOf: [
            {
              if: { properties: { method: { const: 'validate' } } },
              then: { required: ['rules'] }
            },
            {
              if: { properties: { method: { const: 'deterministic_extract' } } },
              then: { required: ['selector'] }
            }
          ]
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
    // context - Simplified state management for storing credentials and user input
    {
      type: 'object',
      properties: {
        type: { const: 'context' },
        config: {
          type: 'object',
          properties: {
            variables: {
              type: 'object',
              description: 'Variables to store in workflow state. Each key-value pair is stored flat (e.g., {email: "x@y.com"} is accessed as {{email}}, NOT {{alias.email}}). Overwrites existing values.',
              additionalProperties: true
            }
          },
          required: ['variables'],
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
    {
      type: 'function',
      function: {
        name: 'execute_nodes',
        description: 'Execute specific workflow nodes with optional control flow awareness. Use mode="isolated" to test nodes individually, or mode="flow" to respect route decisions and iteration contexts.',
        parameters: {
          type: 'object',
          properties: {
            nodeSelection: {
              type: 'string',
              description: 'Nodes to execute. Formats: single node "5", range "3-5", multiple "1-3,10,15-17", or "all" for entire workflow',
              pattern: '^(all|\\d+(-\\d+)?(,\\d+(-\\d+)?)*)$'
            },
            mode: {
              type: 'string',
              enum: ['isolated', 'flow'],
              default: 'isolated',
              description: 'Execution mode. isolated: execute all nodes in sequence ignoring control flow (default). flow: respect route decisions and skip nodes in unexecuted branches.'
            },
            resetBrowserFirst: {
              type: 'boolean',
              default: false,
              description: 'Reset browser state before execution. Useful for clean test runs.'
            }
          },
          required: ['nodeSelection'],
          additionalProperties: false
        },
        strict: true
      }
    },
    {
      type: 'function',
      function: {
        name: 'update_workflow_description',
        description: 'Update the high-fidelity workflow description that serves as the authoritative contract. This defines WHAT we are building (requirements), while the plan defines HOW we build it (implementation). Include all business rules, data contracts, edge cases, and success criteria.',
        parameters: {
          type: 'object',
          properties: {
            description: {
              type: 'object',
              description: 'Complete workflow description with all high-fidelity details. Use snake_case for all field names.',
              properties: {
                workflow_name: { type: 'string', description: 'Descriptive name for the workflow' },
                goal: { type: 'string', description: 'Overall objective of the automation' },
                trigger: { type: 'string', description: 'What initiates the workflow (e.g., "Manual", "CRON @daily 07:00")' },
                actors: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Systems and accounts involved (e.g., ["Gmail Account (user@example.com)", "Airtable Base"])'
                },
                happy_path_steps: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Step-by-step happy path flow'
                },
                decision_matrix: {
                  type: 'object',
                  description: 'Branching logic and decision trees',
                  additionalProperties: true
                },
                key_design_decisions: {
                  type: 'object',
                  description: 'Critical design choices with rationale. Format: {decision_name: {decision: "...", rationale: "..."}}',
                  additionalProperties: {
                    type: 'object',
                    properties: {
                      decision: { type: 'string' },
                      rationale: { type: 'string' }
                    }
                  }
                },
                data_contracts: {
                  type: 'object',
                  description: 'Input/output schemas and field requirements',
                  additionalProperties: true
                },
                business_rules: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Business constraints and rules'
                },
                edge_case_policies: {
                  type: 'object',
                  description: 'How to handle various edge cases',
                  additionalProperties: true
                },
                success_criteria: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'What defines successful execution'
                },
                external_resources: {
                  type: 'object',
                  description: 'Links to documentation, examples, etc.',
                  additionalProperties: true
                },
                revision_history: {
                  type: 'array',
                  description: 'Version history (automatically managed)',
                  items: {
                    type: 'object',
                    properties: {
                      version: { type: 'number' },
                      date: { type: 'string' },
                      author: { type: 'string' },
                      changes: { type: 'string' }
                    }
                  }
                }
              },
              additionalProperties: true
            },
            reason: {
              type: 'string',
              description: 'Why the description is being created or updated (for revision history)'
            }
          },
          required: ['description', 'reason'],
          additionalProperties: false
        },
        strict: true
      }
    },
    {
      type: 'function',
      function: {
        name: 'update_plan',
        description: 'Update the current workflow plan with structured phases and tasks. This is the primary tool for Director 2.0 planning methodology.',
        parameters: {
          type: 'object',
          properties: {
            plan: {
              type: 'object',
              description: 'Complete plan object with phases, tasks, and status tracking',
              properties: {
                overall_goal: {
                  type: 'string',
                  description: 'Clear description of the workflow goal'
                },
                current_phase: {
                  type: 'string',
                  description: 'Name of the phase currently being worked on'
                },
                phases: {
                  type: 'array',
                  description: 'Array of workflow phases with tasks',
                  items: {
                    type: 'object',
                    properties: {
                      phase_name: { 
                        type: 'string',
                        description: 'Name of the phase'
                      },
                      status: { 
                        type: 'string',
                        enum: ['pending', 'in_progress', 'completed', 'failed'],
                        description: 'Current status of the phase'
                      },
                      tasks: {
                        type: 'array',
                        description: 'Tasks within this phase',
                        items: {
                          type: 'object',
                          properties: {
                            task_id: { 
                              type: 'number',
                              description: 'Unique identifier for the task'
                            },
                            description: { 
                              type: 'string',
                              description: 'What the task accomplishes'
                            },
                            status: { 
                              type: 'string',
                              enum: ['pending', 'in_progress', 'completed', 'failed'],
                              description: 'Current status of the task'
                            },
                            node_ids: { 
                              type: 'array',
                              items: { type: 'string' },
                              description: 'Associated node IDs/aliases for traceability'
                            },
                            notes: { 
                              type: 'string',
                              description: 'Additional notes or findings'
                            }
                          },
                          required: ['task_id', 'description', 'status'],
                          additionalProperties: false
                        }
                      }
                    },
                    required: ['phase_name', 'status'],
                    additionalProperties: false
                  }
                },
                next_actions: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Immediate next steps to take'
                },
                blockers: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Current blockers preventing progress'
                },
                notes: {
                  type: 'string',
                  description: 'General notes about the plan or discoveries'
                }
              },
              required: ['overall_goal', 'current_phase', 'phases'],
              additionalProperties: false
            },
            reason: {
              type: 'string',
              description: 'Why the plan is being updated (for audit trail)'
            }
          },
          required: ['plan', 'reason'],
          additionalProperties: false
        },
        strict: true
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_workflow_variables',
        description: 'Get workflow variables with flexible querying. Use variableName="all" for complete state dump, nodeId for node-specific variables, or specific variable names. This tool bypasses chunked display to show full content.',
        parameters: {
          type: 'object',
          properties: {
            variableName: {
              type: 'string',
              description: 'Variable name to retrieve, or "all" for complete variable dump. Examples: "extract_emails", "all", "user_credentials"'
            },
            nodeId: {
              type: 'number',
              description: 'Alternative: get all variables from a specific node. Example: nodeId=7 returns all node7.* variables'
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
        name: 'set_variable',
        description: 'Set or update a workflow variable for debugging and testing. Use this to manually override variables, test edge cases, or inject test data. Variables persist across workflow executions.',
        parameters: {
          type: 'object',
          properties: {
            variableName: {
              type: 'string',
              description: 'Variable name to set. Examples: "test_email", "user_data", "mock_response"'
            },
            value: {
              description: 'Variable value. Can be any JSON type: string, number, boolean, object, array, null'
            },
            reason: {
              type: 'string',
              description: 'Why setting this variable (required for audit trail). Example: "Testing empty array scenario"'
            },
            schema: {
              type: 'object',
              description: 'Optional JSON Schema for validation. Example: {type: "object", properties: {email: {type: "string", format: "email"}}}',
              additionalProperties: true
            }
          },
          required: ['variableName', 'value', 'reason'],
          additionalProperties: false
        },
        strict: true
      }
    },
    {
      type: 'function',
      function: {
        name: 'clear_variable',
        description: 'Delete a specific workflow variable. Use this to test missing variable scenarios or clean up after testing.',
        parameters: {
          type: 'object',
          properties: {
            variableName: {
              type: 'string',
              description: 'Variable name to delete. Example: "old_session_data"'
            },
            reason: {
              type: 'string',
              description: 'Why clearing this variable (required for audit trail). Example: "Testing logged out state"'
            }
          },
          required: ['variableName', 'reason'],
          additionalProperties: false
        },
        strict: true
      }
    },
    {
      type: 'function',
      function: {
        name: 'clear_all_variables',
        description: 'Reset entire workflow state by deleting all variables. Use this for clean testing from scratch. Returns count and list of deleted variables.',
        parameters: {
          type: 'object',
          properties: {
            reason: {
              type: 'string',
              description: 'Why clearing all variables (required for audit trail). Example: "Starting fresh test run"'
            }
          },
          required: ['reason'],
          additionalProperties: false
        },
        strict: true
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_current_plan',
        description: 'Get the current workflow plan with phases, tasks, and progress. Returns null if no plan exists.',
        parameters: {
          type: 'object',
          properties: {},
          additionalProperties: false
        },
        strict: true
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_workflow_nodes',
        description: 'Get detailed information about workflow nodes. Can filter by range or node type.',
        parameters: {
          type: 'object',
          properties: {
            range: {
              type: 'string',
              description: 'Node range to retrieve: "all" (default), "recent" (last 10), or specific range like "1-10"',
              default: 'all'
            },
            type: {
              type: 'string',
              description: 'Optional: filter by node type (e.g., "browser_action", "route", "iterate")'
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
        name: 'get_workflow_description',
        description: 'Get the high-fidelity workflow description containing requirements, business rules, and success criteria.',
        parameters: {
          type: 'object',
          properties: {},
          additionalProperties: false
        },
        strict: true
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_browser_state',
        description: 'Get current browser state showing open tabs and active tab.',
        parameters: {
          type: 'object',
          properties: {},
          additionalProperties: false
        },
        strict: true
      }
    },
    {
      type: 'function',
      function: {
        name: 'browser_action',
        description: 'Execute deterministic browser actions for scouting and exploration without creating workflow nodes. Actions execute immediately on the current browser state.',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: [
                // Navigation
                'navigate', 'back', 'forward', 'refresh',
                // Explicit wait
                'wait',
                // Tab management  
                'openTab', 'closeTab', 'switchTab', 'listTabs',
                // State observation
                'getCurrentUrl', 'getTitle',
                // Interaction
                'click', 'type', 'keypress',
                // Profile management
                'listProfiles', 'setProfile', 'snapshotProfile', 'restoreProfile', 'loadProfile'
              ],
              description: 'The browser action to perform. All actions are deterministic (CSS selectors only, no AI).'
            },
            config: {
              type: 'object',
              properties: {
                // Universal
                tabName: { 
                  type: 'string',
                  description: 'Tab to act on (default: current active tab)' 
                },
                timeout: {
                  type: 'number',
                  description: 'Max wait time in ms for elements to appear (default: 10000)'
                },
                
                // Navigation
                url: { 
                  type: 'string',
                  description: 'For navigate/openTab: URL to navigate to' 
                },
                waitUntil: {
                  type: 'string',
                  enum: ['load', 'domcontentloaded', 'networkidle'],
                  description: 'For navigate: When to consider navigation complete (default: domcontentloaded)'
                },
                
                // Wait
                waitType: {
                  type: 'string',
                  enum: ['time', 'selector', 'navigation'],
                  description: 'For wait: Type of wait'
                },
                waitValue: {
                  type: ['string', 'number'],
                  description: 'For wait: Milliseconds (number) or CSS selector (string)'
                },
                
                // Interaction
                selector: {
                  type: 'string',
                  description: 'For click/type: CSS selector of element'
                },
                text: {
                  type: 'string', 
                  description: 'For type: Text to type'
                },
                key: {
                  type: 'string',
                  description: 'For keypress: Key to press (e.g., "Enter", "Escape")'
                },
                
                // Tab management
                name: {
                  type: 'string',
                  description: 'For openTab: Name for the new tab'
                },
                
                // Profile management
                profileName: {
                  type: 'string',
                  description: 'For setProfile/snapshotProfile/restoreProfile/loadProfile: Name of the browser profile. Use null for default (no profile).',
                  pattern: '^[a-z0-9-]+$'
                }
              },
              additionalProperties: false
            },
            reason: {
              type: 'string',
              description: 'Required audit trail explaining why this action is being performed'
            }
          },
          required: ['action', 'reason'],
          additionalProperties: false
        },
        strict: true
      }
    },
    // DOM Exploration Tools - Token-efficient page exploration
    ...domTools
  ];
}