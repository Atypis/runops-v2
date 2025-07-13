export function createToolDefinitions() {
  return [
    {
      type: 'function',
      function: {
        name: 'create_workflow_sequence',
        description: 'Create multiple connected nodes at once for a workflow sequence',
        parameters: {
          type: 'object',
          properties: {
            nodes: {
              type: 'array',
              description: 'Array of nodes to create in sequence',
              items: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    enum: ['browser_action', 'browser_query', 'transform', 'cognition', 'sequence', 'iterate', 'route', 'handle', 'memory', 'context', 'group']
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
              }
            }
          },
          required: ['nodes']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'create_node',
        description: 'Create a new node in the workflow',
        parameters: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['browser_action', 'browser_query', 'transform', 'cognition', 'sequence', 'iterate', 'route', 'handle', 'memory', 'context', 'group'],
              description: 'The type of node to create'
            },
            config: {
              type: 'object',
              description: 'Configuration specific to the node type. For iterate nodes: requires "over" (array path) and "variable" (item name)'
            },
            description: {
              type: 'string',
              description: 'Human-readable description of what this node does'
            },
            alias: {
              type: 'string',
              description: 'Required unique identifier for the node (snake_case format, e.g. extract_emails, validate_login)',
              pattern: '^[a-z][a-z0-9_]*$'
            }
          },
          required: ['type', 'config', 'alias']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'insert_node_at',
        description: 'Insert a new node at a specific position, shifting existing nodes',
        parameters: {
          type: 'object',
          properties: {
            position: {
              type: 'number',
              description: 'The position where the node should be inserted'
            },
            node: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['browser_action', 'browser_query', 'transform', 'cognition', 'sequence', 'iterate', 'route', 'handle', 'memory', 'context', 'group']
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
            }
          },
          required: ['position', 'node']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'update_node',
        description: 'Update an existing node in the workflow',
        parameters: {
          type: 'object',
          properties: {
            nodeId: {
              type: 'string',
              description: 'ID of the node to update'
            },
            updates: {
              type: 'object',
              description: 'Object containing fields to update. Valid fields: type, config (maps to params), description, status, result, position'
            }
          },
          required: ['nodeId', 'updates']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'update_nodes',
        description: 'Update multiple nodes in the workflow in a single operation',
        parameters: {
          type: 'object',
          properties: {
            updates: {
              type: 'array',
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
              },
              description: 'Array of update objects, each with nodeId and updates'
            }
          },
          required: ['updates']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'delete_node',
        description: 'Delete a node from the workflow',
        parameters: {
          type: 'object',
          properties: {
            nodeId: {
              type: 'string',
              description: 'ID of the node to delete'
            }
          },
          required: ['nodeId']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'delete_nodes',
        description: 'Delete multiple nodes with smart dependency handling and position management',
        parameters: {
          type: 'object',
          properties: {
            nodeIds: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Array of node IDs to delete'
            },
            handleDependencies: {
              type: 'boolean',
              description: 'Update nodes that reference deleted nodes (default: true)',
              default: true
            },
            deleteChildren: {
              type: 'boolean',
              description: 'Also delete child nodes of deleted control flow nodes (default: false)',
              default: false
            },
            dryRun: {
              type: 'boolean',
              description: 'Preview what would be deleted without actually deleting (default: false)',
              default: false
            }
          },
          required: ['nodeIds']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'connect_nodes',
        description: 'Connect two nodes together',
        parameters: {
          type: 'object',
          properties: {
            sourceNodeId: {
              type: 'string',
              description: 'ID of the source node'
            },
            targetNodeId: {
              type: 'string',
              description: 'ID of the target node'
            },
            connectionType: {
              type: 'string',
              enum: ['default', 'success', 'error', 'condition'],
              description: 'Type of connection'
            }
          },
          required: ['sourceNodeId', 'targetNodeId']
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
        name: 'test_node',
        description: 'Test a single node to see its output',
        parameters: {
          type: 'object',
          properties: {
            nodeId: {
              type: 'string',
              description: 'ID of the node to test'
            }
          },
          required: ['nodeId']
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
        name: 'define_group',
        description: 'Define a reusable group of nodes that can be executed as a unit',
        parameters: {
          type: 'object',
          properties: {
            groupId: {
              type: 'string',
              description: 'Unique identifier for this group (e.g., "login_flow", "search_pattern")'
            },
            name: {
              type: 'string',
              description: 'Human-readable name for the group'
            },
            description: {
              type: 'string',
              description: 'Description of what this group does'
            },
            parameters: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Array of parameter names that can be passed to this group'
            },
            nodes: {
              type: 'array',
              description: 'Array of node configurations that make up this group',
              items: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string'
                  },
                  config: {
                    type: 'object'
                  },
                  description: {
                    type: 'string'
                  }
                }
              }
            }
          },
          required: ['groupId', 'name', 'nodes']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'use_group',
        description: 'Use a previously defined group in the workflow',
        parameters: {
          type: 'object',
          properties: {
            groupId: {
              type: 'string',
              description: 'ID of the group to use'
            },
            params: {
              type: 'object',
              description: 'Parameters to pass to the group'
            },
            description: {
              type: 'string',
              description: 'Description for this instance of the group'
            }
          },
          required: ['groupId']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'list_groups',
        description: 'List all available groups in the current workflow',
        parameters: {
          type: 'object',
          properties: {}
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
        name: 'get_workflow_variable',
        description: 'Get full variable content (bypasses chunked display). Use this tool when you need to see the complete content of a variable that appears truncated in the WORKFLOW VARIABLES section.',
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
    }
  ];
}