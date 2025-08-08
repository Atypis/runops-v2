// Simple example workflow for testing
export default {
  id: 'example',
  version: '1.0.0',
  name: 'Example Workflow',
  description: 'A simple workflow to demonstrate the unified architecture',
  
  config: {
    options: {
      searchTerm: {
        type: 'string',
        default: 'playwright',
        description: 'Term to search for'
      }
    }
  },

  // Phases group related nodes
  phases: {
    search: {
      name: 'Search Phase',
      description: 'Navigate and search',
      nodes: ['navigateGoogle', 'searchFor']
    },
    extract: {
      name: 'Extract Phase', 
      description: 'Extract search results',
      nodes: ['waitForResults', 'extractResults']
    }
  },

  // Individual atomic nodes
  nodes: {
    navigateGoogle: {
      type: 'browser_action',
      method: 'goto',
      target: 'https://www.google.com',
      description: 'Navigate to Google'
    },
    searchFor: {
      type: 'browser_action',
      method: 'type',
      target: 'search input field',
      data: '{{config.options.searchTerm}}',
      description: 'Type search term'
    },
    waitForResults: {
      type: 'wait',
      duration: 2000,
      reason: 'Wait for search results'
    },
    extractResults: {
      type: 'browser_query',
      method: 'extract',
      instruction: 'Extract the search result titles and URLs',
      schema: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              url: { type: 'string' }
            }
          }
        }
      },
      description: 'Extract search results'
    }
  },

  // Main workflow flow
  flow: {
    type: 'sequence',
    items: [
      { ref: 'phase:search' },
      { ref: 'phase:extract' },
      {
        type: 'memory',
        operation: 'set',
        data: {
          completedAt: '{{Date.now()}}'
        }
      }
    ]
  }
};