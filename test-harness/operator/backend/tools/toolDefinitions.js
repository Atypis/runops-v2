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
                  }
                },
                required: ['type', 'config']
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
              description: 'Configuration specific to the node type'
            },
            description: {
              type: 'string',
              description: 'Human-readable description of what this node does'
            }
          },
          required: ['type', 'config']
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
        description: 'Delete multiple nodes from the workflow in a single operation',
        parameters: {
          type: 'object',
          properties: {
            nodeIds: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Array of node IDs to delete'
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
    }
  ];
}