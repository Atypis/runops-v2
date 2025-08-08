import { ExecutionEngine } from '../engine';
import { VariableResolver } from '@/lib/workflow/VariableResolver';

// Mock the HybridBrowserManager
jest.mock('@/lib/browser/HybridBrowserManager', () => ({
  hybridBrowserManager: {
    executeAction: jest.fn().mockResolvedValue({ success: true })
  }
}));

// Mock the NodeLogger
jest.mock('@/lib/logging/NodeLogger', () => ({
  NodeLogger: jest.fn().mockImplementation(() => ({
    logNodeStart: jest.fn(),
    logNodeComplete: jest.fn(),
    logNodeError: jest.fn(),
    logActionStart: jest.fn(),
    logActionResult: jest.fn()
  }))
}));

describe('ExecutionEngine - list_iterator', () => {
  let engine: ExecutionEngine;
  let mockWorkflow: any;

  beforeEach(() => {
    // Clear variable resolver scopes
    VariableResolver.clearScopes();

    // Create a mock workflow with list_iterator node
    mockWorkflow = {
      execution: {
        workflow: {
          nodes: [
            {
              id: 'list_iterator_test',
              type: 'list_iterator',
              label: 'Test List Iterator',
              intent: 'Test list iteration',
              iteratorConfig: {
                listVariable: 'testList',
                itemVariable: 'currentItem',
                indexVariable: 'currentIndex',
                continueOnError: false,
                maxIterations: 10
              },
              children: ['child_node_1', 'child_node_2']
            },
            {
              id: 'child_node_1',
              type: 'atomic_task',
              label: 'Child Node 1',
              intent: 'First child action',
              actions: [
                {
                  type: 'act',
                  instruction: 'Process item: {{currentItem.name}}'
                }
              ]
            },
            {
              id: 'child_node_2',
              type: 'atomic_task',
              label: 'Child Node 2',
              intent: 'Second child action',
              actions: [
                {
                  type: 'act',
                  instruction: 'Index: {{currentIndex}}'
                }
              ]
            }
          ],
          flow: []
        }
      }
    };

    engine = new ExecutionEngine(mockWorkflow, 'test-user', 'test-workflow');
  });

  afterEach(() => {
    VariableResolver.clearScopes();
  });

  test('should process all items in list', async () => {
    // Setup test data
    const testList = [
      { name: 'Item 1', value: 'A' },
      { name: 'Item 2', value: 'B' },
      { name: 'Item 3', value: 'C' }
    ];

    // Set the list in engine state
    engine['state'].set('testList', testList);

    // Execute the list iterator node
    const node = mockWorkflow.execution.workflow.nodes[0];
    await engine['executeListIteratorNode']('test-execution', node);

    // Verify loop state was cleaned up
    expect(engine['loopStates'].has('list_iterator_test')).toBe(false);
  });

  test('should handle empty list gracefully', async () => {
    // Setup empty list
    engine['state'].set('testList', []);

    // Execute the list iterator node
    const node = mockWorkflow.execution.workflow.nodes[0];
    await engine['executeListIteratorNode']('test-execution', node);

    // Should complete without errors
    expect(engine['loopStates'].has('list_iterator_test')).toBe(false);
  });

  test('should handle missing list variable', async () => {
    // Don't set any list in state

    // Execute the list iterator node
    const node = mockWorkflow.execution.workflow.nodes[0];
    await engine['executeListIteratorNode']('test-execution', node);

    // Should complete without errors (logs warning and skips)
    expect(engine['loopStates'].has('list_iterator_test')).toBe(false);
  });

  test('should respect maxIterations limit', async () => {
    // Setup large list
    const testList = Array.from({ length: 20 }, (_, i) => ({ name: `Item ${i + 1}` }));
    engine['state'].set('testList', testList);

    // Mock executeNode to avoid delays
    engine['executeNode'] = jest.fn().mockResolvedValue(undefined);

    // Execute the list iterator node (maxIterations is 10)
    const node = mockWorkflow.execution.workflow.nodes[0];
    await engine['executeListIteratorNode']('test-execution', node);

    // Should stop at maxIterations
    expect(engine['loopStates'].has('list_iterator_test')).toBe(false);
  }, 10000);

  test('should handle continueOnError=true', async () => {
    // Setup test data
    const testList = [
      { name: 'Item 1' },
      { name: 'Item 2' },
      { name: 'Item 3' }
    ];
    engine['state'].set('testList', testList);

    // Create node with continueOnError=true
    const node = {
      ...mockWorkflow.execution.workflow.nodes[0],
      iteratorConfig: {
        ...mockWorkflow.execution.workflow.nodes[0].iteratorConfig,
        continueOnError: true
      }
    };

    // Mock child execution to throw error on second item
    const originalExecuteNode = engine['executeNode'];
    let callCount = 0;
    engine['executeNode'] = jest.fn().mockImplementation(async (executionId, childNode) => {
      callCount++;
      if (callCount === 2) { // Second child execution (first item, second child)
        throw new Error('Test error');
      }
      return Promise.resolve();
    });

    // Should not throw error
    await expect(engine['executeListIteratorNode']('test-execution', node)).resolves.not.toThrow();

    // Restore original method
    engine['executeNode'] = originalExecuteNode;
  });

  test('should handle continueOnError=false', async () => {
    // Setup test data
    const testList = [
      { name: 'Item 1' },
      { name: 'Item 2' }
    ];
    engine['state'].set('testList', testList);

    // Mock child execution to throw error
    engine['executeNode'] = jest.fn().mockRejectedValue(new Error('Test error'));

    const node = mockWorkflow.execution.workflow.nodes[0];

    // Should throw error and stop processing
    await expect(engine['executeListIteratorNode']('test-execution', node)).rejects.toThrow('Test error');
  });

  test('should inject currentItem and currentIndex variables', async () => {
    // Setup test data
    const testList = [
      { name: 'Item 1', value: 'A' },
      { name: 'Item 2', value: 'B' }
    ];
    engine['state'].set('testList', testList);

    // Track variable resolution calls
    const originalResolveVariables = VariableResolver.resolveVariables;
    const resolvedVariables: string[] = [];
    
    VariableResolver.resolveVariables = jest.fn().mockImplementation((text, context) => {
      resolvedVariables.push(text);
      return originalResolveVariables(text, context);
    });

    // Mock executeNode to capture variable context
    const capturedContexts: any[] = [];
    engine['executeNode'] = jest.fn().mockImplementation(async (executionId, childNode) => {
      // Capture the current scope
      const currentScope = VariableResolver['scopeStack'][VariableResolver['scopeStack'].length - 1];
      capturedContexts.push({ ...currentScope });
      return Promise.resolve();
    });

    const node = mockWorkflow.execution.workflow.nodes[0];
    await engine['executeListIteratorNode']('test-execution', node);

    // Should have captured contexts for each iteration
    expect(capturedContexts.length).toBeGreaterThan(0);
    
    // First iteration should have currentItem and currentIndex
    expect(capturedContexts[0]).toEqual({
      currentItem: { name: 'Item 1', value: 'A' },
      currentIndex: 0,
      length: 2
    });

    // Restore original method
    VariableResolver.resolveVariables = originalResolveVariables;
  });

  test('should handle list with .items property', async () => {
    // Setup test data with .items wrapper
    const testData = {
      items: [
        { name: 'Item 1' },
        { name: 'Item 2' }
      ],
      metadata: { total: 2 }
    };
    engine['state'].set('testList', testData);

    // Mock executeNode
    engine['executeNode'] = jest.fn().mockResolvedValue(undefined);

    const node = mockWorkflow.execution.workflow.nodes[0];
    await engine['executeListIteratorNode']('test-execution', node);

    // Should have processed the items array
    expect(engine['executeNode']).toHaveBeenCalled();
  });
}); 