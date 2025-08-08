import { createDOMExplorationTools } from './domExplorationTools.js';

export function createToolDefinitions() {
  const domTools = createDOMExplorationTools();
  
  return [
    {
      type: 'function',
      function: {
        name: 'create_node',
        description: 'Create one or more nodes in the workflow. For a single node, pass type/config/alias directly. For multiple nodes, pass a nodes array.',
        parameters: {
          type: 'object',
          properties: {
            // Single node properties
            type: {
              type: 'string',
              enum: ['browser_action', 'browser_ai_action', 'browser_query', 'browser_ai_query', 'transform', 'cognition', 'agent', 'iterate', 'route', 'handle', 'context', 'group'],
              description: 'The type of node to create (for single node)'
            },
            config: {
              type: 'object',
              description: 'Configuration specific to the node type (for single node)',
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
                nth: {
                  oneOf: [
                    { type: 'number' },
                    { type: 'string' }
                  ],
                  description: 'For browser_action (click/type): Zero-based index of element to select when multiple elements match the selector. Supports negative indices (-1 = last element), keywords ("first", "last"), and variable references ("{{index}}"). Without nth, the first matching element is used.'
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
                  enum: ['validate', 'extract', 'observe', 'assess', 'count'],
                  description: 'For browser_query/browser_ai_query: The query method. browser_query supports "validate" and "count"'
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
                    required: ['type', 'selector']
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
              description: 'Human-readable description of what this node does (for single node)'
            },
            alias: {
              type: 'string',
              description: 'Required unique identifier for the node (snake_case format, for single node)',
              pattern: '^[a-z][a-z0-9_]*$'
            },
            // Multiple nodes property
            nodes: {
              type: 'array',
              description: 'Array of nodes to create (for multiple nodes)',
              items: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    enum: ['browser_action', 'browser_ai_action', 'browser_query', 'browser_ai_query', 'transform', 'cognition', 'agent', 'iterate', 'route', 'handle', 'context', 'group']
                  },
                  config: {
                    type: 'object',
                    // Same properties as single node config
                    properties: {
                      // Common property
                      store_variable: {
                        type: 'boolean',
                        description: 'Store this node\'s result as a reusable variable (default: false)'
                      },
                      
                      // browser_action properties (deterministic)
                      action: {
                        type: 'string',
                        enum: ['navigate', 'wait', 'openNewTab', 'switchTab', 'closeTab', 'back', 'forward', 'refresh', 'screenshot', 'listTabs', 'getCurrentTab', 'keypress'],
                        description: 'For browser_action and browser_ai_action: The action to perform'
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
                    type: 'string'
                  },
                  alias: {
                    type: 'string',
                    pattern: '^[a-z][a-z0-9_]*$'
                  }
                },
                required: ['type', 'config', 'alias']
              }
            }
          },
          // Either single node params OR nodes array, not both
          additionalProperties: false
        },
        strict: true
      }
    },
    {
      type: 'function',
      function: {
        name: 'insert_node_at',
        description: 'Insert one or more nodes at a specific position, shifting existing nodes. For a single node, use node property. For multiple nodes, use nodes array.',
        parameters: {
          type: 'object',
          properties: {
            position: {
              type: 'number',
              description: 'The position where the node(s) should be inserted'
            },
            // Single node property
            node: {
              type: 'object',
              description: 'Single node to insert',
              properties: {
                type: {
                  type: 'string',
                  enum: ['browser_action', 'browser_ai_action', 'browser_query', 'browser_ai_query', 'transform', 'cognition', 'agent', 'iterate', 'route', 'handle', 'context', 'group']
                },
                config: {
                  type: 'object'
                },
                description: {
                  type: 'string'
                },
                alias: {
                  type: 'string',
                  description: 'Required unique identifier for the node (snake_case format)',
                  pattern: '^[a-z][a-z0-9_]*$'
                }
              },
              required: ['type', 'config', 'alias']
            },
            // Multiple nodes property
            nodes: {
              type: 'array',
              description: 'Array of nodes to insert consecutively starting at position',
              items: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    enum: ['browser_action', 'browser_ai_action', 'browser_query', 'browser_ai_query', 'transform', 'cognition', 'agent', 'iterate', 'route', 'handle', 'context', 'group']
                  },
                  config: {
                    type: 'object',
                    // Same properties as single node config
                    properties: {
                      // Common property
                      store_variable: {
                        type: 'boolean',
                        description: 'Store this node\'s result as a reusable variable (default: false)'
                      },
                      
                      // browser_action properties (deterministic)
                      action: {
                        type: 'string',
                        enum: ['navigate', 'wait', 'openNewTab', 'switchTab', 'closeTab', 'back', 'forward', 'refresh', 'screenshot', 'listTabs', 'getCurrentTab', 'keypress'],
                        description: 'For browser_action and browser_ai_action: The action to perform'
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
                    type: 'string'
                  },
                  alias: {
                    type: 'string',
                    pattern: '^[a-z][a-z0-9_]*$'
                  }
                },
                required: ['type', 'config', 'alias']
              }
            }
          },
          required: ['position']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'update_node',
        description: 'Update one or more nodes in the workflow. For a single node, pass nodeId and updates directly. For multiple nodes, pass only an updates array.',
        parameters: {
          type: 'object',
          properties: {
            // Single node properties
            nodeId: {
              type: 'string',
              description: 'ID of the node to update (for single node update)'
            },
            // Updates - either object for single node or array for multiple
            updates: {
              type: ['object', 'array'],
              description: 'For single node: object with fields to update. For multiple nodes: array of {nodeId, updates} objects. Valid fields: type, config (maps to params), description, status, result, position',
              items: {
                type: 'object',
                properties: {
                  nodeId: {
                    type: 'string',
                    description: 'ID of the node to update'
                  },
                  updates: {
                    type: 'object',
                    description: 'Object containing fields to update'
                  }
                },
                required: ['nodeId', 'updates']
              }
            }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'delete_node',
        description: 'Delete one or more nodes from the workflow. For a single node, pass nodeId. For multiple nodes, pass nodeIds array.',
        parameters: {
          type: 'object',
          properties: {
            // Single node property
            nodeId: {
              type: 'string',
              description: 'ID of the node to delete (for single node deletion)'
            },
            // Multiple nodes property
            nodeIds: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Array of node IDs to delete (for multiple node deletion)'
            },
            // Options for multiple deletion
            handleDependencies: {
              type: 'boolean',
              description: 'Whether to handle dependent nodes (default: true)',
              default: true
            },
            deleteChildren: {
              type: 'boolean',
              description: 'Whether to delete child nodes (default: false)',
              default: false
            },
            dryRun: {
              type: 'boolean',
              description: 'Preview what would be deleted without actually deleting (default: false)',
              default: false
            }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'execute_workflow',
        description: 'Execute the entire workflow',
        parameters: {
          type: 'object',
          properties: {}
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'execute_nodes',
        description: 'Execute specific workflow nodes by position selection. This allows Director to test and validate nodes incrementally.',
        parameters: {
          type: 'object',
          properties: {
            nodeSelection: {
              type: 'string',
              description: 'Node positions to execute. Examples: "5" (single node), "3-5" (range), "1-3,10,15-17" (multiple ranges), "all" (all nodes)'
            },
            resetBrowserFirst: {
              type: 'boolean',
              description: 'Whether to reset browser session before execution for clean testing',
              default: false
            }
          },
          required: ['nodeSelection']
        }
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
                        description: 'Name of this phase'
                      },
                      status: {
                        type: 'string',
                        enum: ['pending', 'in_progress', 'completed', 'failed'],
                        description: 'Current status of this phase'
                      },
                      tasks: {
                        type: 'array',
                        description: 'Tasks within this phase',
                        items: {
                          type: 'object',
                          properties: {
                            task_id: {
                              type: 'number',
                              description: 'Unique identifier for this task'
                            },
                            description: {
                              type: 'string',
                              description: 'What this task involves'
                            },
                            status: {
                              type: 'string',
                              enum: ['pending', 'in_progress', 'completed', 'failed'],
                              description: 'Current status of this task'
                            },
                            node_ids: {
                              type: 'array',
                              items: { type: 'string' },
                              description: 'Node IDs associated with this task (optional)'
                            },
                            notes: {
                              type: 'string',
                              description: 'Additional notes about this task (optional)'
                            }
                          },
                          required: ['task_id', 'description', 'status']
                        }
                      }
                    },
                    required: ['phase_name', 'status']
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
              required: ['overall_goal', 'current_phase', 'phases']
            },
            reason: {
              type: 'string',
              description: 'Why the plan is being updated (for audit trail)'
            }
          },
          required: ['plan', 'reason']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_workflow_variables',
        description: 'Get workflow variables (bypasses chunked display). Use this tool when you need to see the complete content of variables.',
        parameters: {
          type: 'object',
          properties: {
            variableName: {
              type: 'string',
              description: 'Variable name (e.g., "node7.emails", "gmail_creds") or "all" for complete variable dump'
            },
            nodeId: {
              type: 'number',
              description: 'Alternative: get all variables from specific node (e.g., 7 for all node7.* variables)'
            }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'set_variable',
        description: 'Set or update a variable for debugging and testing. Use this tool to manually override variables or set test data.',
        parameters: {
          type: 'object',
          properties: {
            variableName: {
              type: 'string',
              description: 'Variable name (e.g., "test_email", "gmail_creds")'
            },
            value: {
              description: 'Variable value (any JSON type: string, number, boolean, object, array)'
            },
            reason: {
              type: 'string',
              description: 'Why setting this variable (for debugging logs)'
            },
            schema: {
              type: 'object',
              description: 'Optional JSON schema for validation (e.g., {"type": "object", "properties": {...}})'
            }
          },
          required: ['variableName', 'value', 'reason']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'clear_variable',
        description: 'Delete a specific variable for testing. Use this tool to reset variables when debugging workflow behavior.',
        parameters: {
          type: 'object',
          properties: {
            variableName: {
              type: 'string',
              description: 'Variable name to clear (e.g., "node7.emails", "test_data")'
            },
            reason: {
              type: 'string',
              description: 'Why clearing this variable (for debugging logs)'
            }
          },
          required: ['variableName', 'reason']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'clear_all_variables',
        description: 'Reset entire workflow variable state. Use this tool to get a completely fresh workflow state for clean testing.',
        parameters: {
          type: 'object',
          properties: {
            reason: {
              type: 'string',
              description: 'Why clearing all variables (for debugging logs)'
            }
          },
          required: ['reason']
        }
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
              description: 'Complete workflow description with all high-fidelity details. Should include: workflow_name, goal, trigger, actors, happy_path_steps, decision_matrix, data_contracts, business_rules, edge_case_policies, success_criteria, external_resources, and revision_history.'
            },
            reason: {
              type: 'string',
              description: 'Why the description is being created or updated (for revision history)'
            }
          },
          required: ['description', 'reason']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'inspect_tab',
        description: 'Inspect the content of a browser tab to understand page state, verify navigation, and discover selectors. Use this tool to give the Director "eyes" to see what\'s on the page.',
        parameters: {
          type: 'object',
          properties: {
            tabName: {
              type: 'string',
              description: 'Name of the tab to inspect (e.g., "Main Tab", "Debug Tab")'
            },
            inspectionType: {
              type: 'string',
              enum: ['dom_snapshot', 'lightweight_exploration'],
              description: 'Type of inspection: "dom_snapshot" for full enhanced POV with selectors, "lightweight_exploration" for LLM-analyzed summary'
            },
            instruction: {
              type: 'string',
              description: 'For lightweight_exploration: what to look for (e.g., "What login elements are visible? Are we in 2FA?")'
            }
          },
          required: ['tabName', 'inspectionType']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'expand_dom_selector',
        description: 'Get detailed DOM selector information for a specific element from an inspected tab. Use this for surgical investigation of specific elements without flooding context.',
        parameters: {
          type: 'object',
          properties: {
            tabName: {
              type: 'string',
              description: 'Name of the tab containing the element (e.g., "main")'
            },
            elementId: {
              type: 'string',
              description: 'Element ID from inspect_tab output (e.g., "1115" from "[1115] link: Support")'
            }
          },
          required: ['tabName', 'elementId']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'send_scout',
        description: 'Deploy a Scout to explore the current page and report back with findings. Token-efficient alternative to inspect_tab for natural language exploration. The Scout uses reasoning to thoroughly investigate the page through multiple tool calls.',
        parameters: {
          type: 'object',
          properties: {
            instruction: {
              type: 'string',
              description: 'Natural language instruction for what to explore/find (e.g., "Find all login form elements and their selectors", "Identify the main navigation menu structure")'
            },
            tabName: {
              type: 'string',
              description: 'Tab to scout (defaults to active tab)'
            }
          },
          required: ['instruction']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'debug_navigate',
        description: 'Navigate to a URL for debugging/exploration without creating a workflow node. Use this for testing and reconnaissance.',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL to navigate to'
            },
            tabName: {
              type: 'string',
              description: 'Tab to navigate in (defaults to "main")'
            },
            reason: {
              type: 'string',
              description: 'Why navigating (for audit trail)'
            }
          },
          required: ['url', 'reason']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'debug_click',
        description: 'Click an element for debugging/exploration without creating a workflow node. Use this for testing selectors and interactions.',
        parameters: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS selector, text: prefix for text matching, or natural language'
            },
            tabName: {
              type: 'string',
              description: 'Tab to click in (defaults to "main")'
            },
            reason: {
              type: 'string',
              description: 'Why clicking (for audit trail)'
            }
          },
          required: ['selector', 'reason']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'debug_type',
        description: 'Type text into an element for debugging/exploration without creating a workflow node. Use this for testing form inputs.',
        parameters: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS selector of the input element'
            },
            text: {
              type: 'string',
              description: 'Text to type'
            },
            tabName: {
              type: 'string',
              description: 'Tab to type in (defaults to "main")'
            },
            reason: {
              type: 'string',
              description: 'Why typing (for audit trail)'
            }
          },
          required: ['selector', 'text', 'reason']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'debug_wait',
        description: 'Wait for an element or time for debugging/exploration without creating a workflow node. Use this to ensure page loads.',
        parameters: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['time', 'selector'],
              description: 'Wait for time (ms) or element selector'
            },
            value: {
              type: 'string',
              description: 'Milliseconds to wait or selector to wait for'
            },
            tabName: {
              type: 'string',
              description: 'Tab to wait in (defaults to "main")'
            },
            reason: {
              type: 'string',
              description: 'Why waiting (for audit trail)'
            }
          },
          required: ['type', 'value', 'reason']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'debug_open_tab',
        description: 'Open a new tab for debugging/exploration without creating a workflow node.',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL to open in new tab'
            },
            tabName: {
              type: 'string',
              description: 'Name for the new tab'
            },
            reason: {
              type: 'string',
              description: 'Why opening new tab (for audit trail)'
            }
          },
          required: ['url', 'tabName', 'reason']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'debug_close_tab',
        description: 'Close a tab for debugging/exploration without creating a workflow node.',
        parameters: {
          type: 'object',
          properties: {
            tabName: {
              type: 'string',
              description: 'Name of the tab to close'
            },
            reason: {
              type: 'string',
              description: 'Why closing tab (for audit trail)'
            }
          },
          required: ['tabName', 'reason']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'debug_switch_tab',
        description: 'Switch to a different tab for debugging/exploration without creating a workflow node.',
        parameters: {
          type: 'object',
          properties: {
            tabName: {
              type: 'string',
              description: 'Name of the tab to switch to'
            },
            reason: {
              type: 'string',
              description: 'Why switching tabs (for audit trail)'
            }
          },
          required: ['tabName', 'reason']
        }
      }
    },
    // Clean Context 2.0 - Context Retrieval Tools
    {
      type: 'function',
      function: {
        name: 'get_current_plan',
        description: 'Get the current workflow plan with phases, tasks, and progress. Use this to understand your planning state and next actions.',
        parameters: {
          type: 'object',
          properties: {}
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_workflow_nodes',
        description: 'Get detailed information about workflow nodes. Use this to understand what has been built and the current state of nodes.',
        parameters: {
          type: 'object',
          properties: {
            range: {
              type: 'string',
              description: 'Node range to retrieve. Examples: "1-10", "all", "recent" (last 10)',
              default: 'all'
            },
            type: {
              type: 'string',
              description: 'Filter by node type (e.g., "browser_action", "transform", "iterate")'
            }
          }
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_workflow_description',
        description: 'Get the full workflow requirements and business rules. Use this to understand what the workflow is supposed to accomplish.',
        parameters: {
          type: 'object',
          properties: {}
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_browser_state',
        description: 'Get current browser tabs and state. Use this to understand what tabs are open and their current URLs.',
        parameters: {
          type: 'object',
          properties: {}
        }
      }
    },
    // DOM Exploration Tools
    ...domTools
  ];
}