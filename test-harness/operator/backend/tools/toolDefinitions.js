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
                    enum: ['browser_action', 'browser_query', 'transform', 'cognition', 'sequence', 'iterate', 'route', 'handle', 'memory']
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
              enum: ['browser_action', 'browser_query', 'transform', 'cognition', 'sequence', 'iterate', 'route', 'handle', 'memory'],
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
        description: 'Update an existing node configuration',
        parameters: {
          type: 'object',
          properties: {
            nodeId: {
              type: 'string',
              description: 'ID of the node to update'
            },
            updates: {
              type: 'object',
              description: 'Fields to update'
            }
          },
          required: ['nodeId', 'updates']
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
    }
  ];
}