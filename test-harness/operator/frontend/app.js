const { useState, useEffect, useRef, useCallback } = React;

const API_BASE = '/api/director';

function App() {
  // Resizable panel state
  const [workflowPanelWidth, setWorkflowPanelWidth] = useState(500); // Default 500px instead of 384px
  const [isResizing, setIsResizing] = useState(false);
  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentWorkflow, setCurrentWorkflow] = useState(null);
  const [workflows, setWorkflows] = useState([]);
  const [executionLogs, setExecutionLogs] = useState([]);
  const [workflowNodes, setWorkflowNodes] = useState([]);
  const [showLogs, setShowLogs] = useState(false);
  const [mockMode, setMockMode] = useState(false);
  const [nodeValues, setNodeValues] = useState({}); // Storage key -> value mapping
  const [expandedNodes, setExpandedNodes] = useState(new Set()); // Track expanded iterate nodes
  const messagesEndRef = useRef(null);
  const logsEndRef = useRef(null);
  const nodesPanelRef = useRef(null); // Reference to the nodes panel scroll container

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [executionLogs]);

  // Load workflows on mount
  useEffect(() => {
    loadWorkflows();
    // Load mock operator response if in mock mode
    if (mockMode) {
      loadMockOperatorResponse();
    }
  }, []);

  // Reload mock response when mock mode changes
  useEffect(() => {
    if (mockMode) {
      loadMockOperatorResponse();
    }
  }, [mockMode]);

  // Load nodes when workflow changes
  useEffect(() => {
    loadWorkflowNodes(currentWorkflow?.id);
  }, [currentWorkflow]);

  // Load node values only when needed
  const loadNodeValues = async () => {
    if (!currentWorkflow?.id) return;
    
    try {
      const response = await fetch(`${API_BASE}/node-values/${currentWorkflow.id}`);
      if (response.ok) {
        const values = await response.json();
        setNodeValues(values);
      }
    } catch (error) {
      console.error('Failed to load node values:', error);
    }
  };
  
  // Initial load of node values when workflow changes
  useEffect(() => {
    if (currentWorkflow?.id) {
      loadNodeValues();
    }
  }, [currentWorkflow?.id]);
  
  // Preserve scroll position after state updates
  React.useLayoutEffect(() => {
    if (nodesPanelRef.current && nodesPanelRef.current._lastScrollTop !== undefined) {
      nodesPanelRef.current.scrollTop = nodesPanelRef.current._lastScrollTop;
    }
  });

  // Handle resize events
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!resizingRef.current) return;
      
      const deltaX = startXRef.current - e.clientX;
      const newWidth = Math.max(300, Math.min(800, startWidthRef.current + deltaX));
      setWorkflowPanelWidth(newWidth);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      resizingRef.current = false;
      document.body.style.cursor = '';
    };
    
    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing]);

  const loadWorkflows = async () => {
    try {
      const response = await fetch(`${API_BASE}/workflows`);
      if (!response.ok) {
        throw new Error('Failed to load workflows');
      }
      const data = await response.json();
      setWorkflows(data || []);
    } catch (error) {
      console.error('Failed to load workflows:', error);
      setWorkflows([]);
    }
  };

  const loadWorkflowNodes = async (workflowId) => {
    if (!workflowId) return;
    
    try {
      const response = await fetch(`${API_BASE}/workflows/${workflowId}`);
      if (!response.ok) {
        throw new Error('Failed to load workflow');
      }
      const data = await response.json();
      console.log('[DEBUG] Loaded workflow data:', data);
      console.log('[DEBUG] All nodes:', data.nodes?.map(n => ({ id: n.id, position: n.position, type: n.type })));
      console.log('[DEBUG] Node 28 (iterate):', data.nodes?.find(n => n.position === 28));
      console.log('[DEBUG] Iterate nodes:', data.nodes?.filter(n => n.type === 'iterate'));
      console.log('[DEBUG] Group nodes:', data.nodes?.filter(n => n.type === 'group'));
      
      // Filter to only show top-level nodes (those without parent_position)
      const topLevelNodes = (data.nodes || []).filter(node => 
        !node.params?._parent_position
      );
      console.log('[DEBUG] Top-level nodes count:', topLevelNodes.length);
      console.log('[DEBUG] Top-level group nodes:', topLevelNodes.filter(n => n.type === 'group'));
      setWorkflowNodes(topLevelNodes);
    } catch (error) {
      console.error('Failed to load workflow nodes:', error);
      setWorkflowNodes([]);
    }
  };

  const loadMockOperatorResponse = async () => {
    try {
      // Fetch the mock response JSON directly
      const response = await fetch('/mock-director/response.json');
      if (!response.ok) {
        throw new Error('Failed to load mock response');
      }
      const mockData = await response.json();
      
      // Extract nodes from the mock response
      if (mockData.toolCalls && mockData.toolCalls.length > 0) {
        const toolCall = mockData.toolCalls[0];
        if (toolCall.toolName === 'create_workflow_sequence' && toolCall.result?.nodes) {
          // Convert mock nodes to display format with positions
          // Note: We use index + 1 for position to match 1-based positioning in operator
          const mockNodes = toolCall.result.nodes.map((node, index) => ({
            ...node,
            id: `mock_${index + 1}`,
            position: index + 1,
            status: 'pending',
            params: node.config
          }));
          setWorkflowNodes(mockNodes);
          
          // Also show the message
          if (mockData.message) {
            setMessages([{
              role: 'assistant',
              content: mockData.message,
              toolCalls: mockData.toolCalls
            }]);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load mock operator response:', error);
    }
  };

  const uploadMockNodesToSupabase = async () => {
    try {
      // Create workflow if none exists
      let workflowId = currentWorkflow?.id;
      if (!workflowId) {
        const workflow = await createNewWorkflow();
        workflowId = workflow?.id;
      }

      if (!workflowId) {
        throw new Error('Failed to create workflow');
      }

      // Filter only mock nodes
      const mockNodes = workflowNodes.filter(n => n.id && typeof n.id === 'string' && n.id.startsWith('mock_'));
      
      console.log('Uploading mock nodes:', mockNodes);
      
      const response = await fetch(`${API_BASE}/upload-mock-nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId,
          nodes: mockNodes.map(node => ({
            type: node.type,
            config: node.params || node.config,
            position: node.position,
            description: node.description
          }))
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload failed:', errorText);
        throw new Error(`Failed to upload nodes: ${errorText}`);
      }

      const result = await response.json();
      
      // Replace mock nodes with real nodes from database
      console.log('Current workflowNodes:', workflowNodes);
      console.log('Created nodes from backend:', result.nodes);
      
      // Filter to only show top-level nodes
      const topLevelNodes = result.nodes.filter(node => 
        !node.params?._parent_position
      );
      
      console.log('Top-level nodes:', topLevelNodes);
      console.log('Group nodes in top-level:', topLevelNodes.filter(n => n.type === 'group'));
      setWorkflowNodes(topLevelNodes);
      
      // Log success
      const log = {
        timestamp: new Date().toISOString(),
        type: 'success',
        message: `Uploaded ${result.nodes.length} nodes to Supabase`,
        details: result
      };
      setExecutionLogs(prev => [...prev, log]);
    } catch (error) {
      console.error('Failed to upload mock nodes:', error);
      const errorLog = {
        timestamp: new Date().toISOString(),
        type: 'error',
        message: `Failed to upload mock nodes: ${error.message}`,
        details: { error: error.message }
      };
      setExecutionLogs(prev => [...prev, errorLog]);
    }
  };

  const createNewWorkflow = async () => {
    try {
      const response = await fetch(`${API_BASE}/workflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Workflow ${new Date().toLocaleString()}`,
          description: 'Created via Operator chat'
        })
      });
      const workflow = await response.json();
      setCurrentWorkflow(workflow);
      await loadWorkflows();
      return workflow;
    } catch (error) {
      console.error('Failed to create workflow:', error);
      return null;
    }
  };

  // Helper function to get the color for a node type
  const getNodeTypeColor = (type) => {
    const colors = {
      'context': '#10b981',      // green
      'browser_action': '#3b82f6', // blue
      'browser_query': '#8b5cf6',  // purple
      'route': '#f59e0b',         // amber
      'iterate': '#ef4444',       // red
      'memory': '#06b6d4',        // cyan
      'cognition': '#ec4899',     // pink
      'group': '#14b8a6',         // teal
    };
    return colors[type] || '#6b7280';
  };

  // Helper to calculate indentation and styling based on depth
  const getDepthStyles = (depth, isIterationContext = false) => {
    // Cap indentation at 3 levels for iteration context, 4 for normal
    const maxDepth = isIterationContext ? 3 : 4;
    const effectiveDepth = Math.min(depth, maxDepth);
    
    // Minimal indentation - just enough to show hierarchy
    const indentSize = isIterationContext ? 8 : 16;
    const marginLeft = effectiveDepth * indentSize;
    const marginRight = isIterationContext ? 4 : Math.min(effectiveDepth * 8, 24);
    
    // Visual depth indicators beyond max indentation
    const visualDepth = depth - effectiveDepth;
    const borderWidth = Math.max(4 - visualDepth, 1);
    const opacity = 1; // Keep full opacity, use other cues
    
    return {
      container: {
        marginLeft: `${marginLeft}px`,
        marginRight: `${marginRight}px`,
        marginTop: depth > 0 ? '4px' : '12px',
        marginBottom: '4px',
        position: 'relative',
      },
      card: {
        backgroundColor: depth > maxDepth ? 'rgba(249, 250, 251, 0.8)' : 'white',
        borderLeftWidth: `${borderWidth}px`,
        borderLeftStyle: 'solid',
        boxShadow: depth > 0 ? '0 1px 2px rgba(0, 0, 0, 0.05)' : '0 1px 3px rgba(0, 0, 0, 0.1)',
      },
      connectionLine: null, // Removed connection lines for cleaner look
      verticalLine: null, // Removed vertical lines
      isCompact: depth > maxDepth || isIterationContext,
    };
  };

  // NodeCard Component - Handles display of nodes including complex route and iterate nodes
  const NodeCard = ({ node, executeNode, depth = 0, expandedNodes, setExpandedNodes, loadNodeValues, currentWorkflow, isIterationContext = false }) => {
    console.log(`[DEBUG] Rendering NodeCard for node ${node.position} (${node.type}):`, { 
      id: node.id, 
      result: node.result,
      status: node.status 
    });
    const expanded = expandedNodes?.has(node.id) || false;
    const setExpanded = (value) => {
      if (value) {
        setExpandedNodes(prev => new Set([...prev, node.id]));
      } else {
        setExpandedNodes(prev => {
          const newSet = new Set(prev);
          newSet.delete(node.id);
          return newSet;
        });
      }
    };
    const [iterationData, setIterationData] = React.useState(null);
    const [isLoadingPreview, setIsLoadingPreview] = React.useState(false);
    const isRoute = node.type === 'route';
    const isIterate = node.type === 'iterate';
    const isGroup = node.type === 'group';
    const hasNestedNodes = isRoute && node.params?.paths;
    const hasIterateBody = isIterate && node.params?.body;
    
    // Function to fetch iteration preview
    const fetchIterationPreview = React.useCallback(async () => {
      if (isLoadingPreview) return; // Prevent duplicate fetches
      
      setIsLoadingPreview(true);
      try {
        const response = await fetch(`${API_BASE}/nodes/${node.id}/iteration-preview`);
        if (response.ok) {
          const preview = await response.json();
          console.log(`[ITERATE PREVIEW] Fetched preview for node ${node.id}:`, preview);
          if (preview.items && preview.items.length > 0) {
            setIterationData(preview.items);
          }
        } else {
          console.error('Failed to fetch iteration preview:', await response.text());
        }
      } catch (error) {
        console.error('Error fetching iteration preview:', error);
      } finally {
        setIsLoadingPreview(false);
      }
    }, [node.id, isLoadingPreview]);
    
    // Load iteration data when expanded or node result changes
    React.useEffect(() => {
      if (isIterate && expanded) {
        if (node.result?.items) {
          // New preview format from executeIterate
          console.log(`Loading iteration data for node ${node.id}: ${node.result.items.length} items`);
          setIterationData(node.result.items);
        } else if (node.result?.results) {
          // Old format - actual execution results
          console.log(`Loading iteration results for node ${node.id}: ${node.result.results.length} results`);
          setIterationData(node.result.results);
        } else if (!iterationData) {
          // No result yet and no iteration data - fetch preview data from the new endpoint
          console.log(`No iteration data found for node ${node.id}, fetching preview...`);
          fetchIterationPreview();
        }
      }
    }, [isIterate, expanded, node.result, iterationData, fetchIterationPreview]);
    
    
    // Helper to render a nested node or array of nodes
    const renderNestedNode = (nodeOrArray, branchName, index, depth = 0) => {
      if (Array.isArray(nodeOrArray)) {
        return (
          <div className="ml-4 mt-2 border-l-2 border-gray-300 pl-4">
            <div className="text-xs font-semibold text-gray-600 mb-2">
              {nodeOrArray.length} steps in branch
            </div>
            {nodeOrArray.map((nestedNode, idx) => (
              <div key={idx} className="mb-2">
                {nestedNode.type === 'route' ? (
                  <NestedRouteCard 
                    node={nestedNode} 
                    depth={depth + 1}
                    branchPath={`${branchName}[${idx}]`}
                    parentNodeId={node.id}
                  />
                ) : (
                  <MiniNodeCard 
                    node={nestedNode} 
                    index={idx} 
                    branchPath={`${branchName}[${idx}]`}
                    parentNodeId={node.id}
                  />
                )}
              </div>
            ))}
          </div>
        );
      } else if (nodeOrArray && typeof nodeOrArray === 'object') {
        return (
          <div className="ml-4 mt-2 border-l-2 border-gray-300 pl-4">
            {nodeOrArray.type === 'route' ? (
              <NestedRouteCard 
                node={nodeOrArray} 
                depth={depth + 1}
                branchPath={branchName}
                parentNodeId={node.id}
              />
            ) : (
              <MiniNodeCard 
                node={nodeOrArray} 
                index={index} 
                branchPath={branchName}
                parentNodeId={node.id}
              />
            )}
          </div>
        );
      }
      return null;
    };

    const depthStyles = getDepthStyles(depth, isIterationContext);
    const nodeColor = getNodeTypeColor(node.type);
    const isCompact = depthStyles.isCompact;

    return (
      <div style={depthStyles.container}>
        {/* Connection lines for nested nodes */}
        {depthStyles.connectionLine && <div style={depthStyles.connectionLine} />}
        {depthStyles.verticalLine && <div style={depthStyles.verticalLine} />}
        
        <div 
          className={`rounded-lg transition-all duration-300 ${isCompact ? 'p-2' : 'p-3'} ${depth > 0 ? 'shadow-sm hover:shadow-md' : 'shadow-md hover:shadow-lg'}`}
          style={{
            ...depthStyles.card,
            borderLeftColor: nodeColor,
          }}
        >
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className={`font-medium ${isCompact ? 'text-xs' : 'text-sm'} flex items-center`}>
              <span className="text-gray-400 mr-2 font-mono">#{node.position}</span>
              <span style={{ color: nodeColor }}>{node.type}</span>
              {/* Show action for browser_action nodes */}
              {node.type === 'browser_action' && node.params?.action && (
                <span className="ml-1 text-gray-500">
                  · {node.params.action}
                </span>
              )}
              {/* Depth indicator for deep nesting - but not in iteration context */}
              {depth > 2 && !isIterationContext && (
                <span className="ml-2 text-xs text-gray-400">
                  (L{depth})
                </span>
              )}
              {(hasNestedNodes || hasIterateBody) && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setExpanded(!expanded);
                  }}
                  className="ml-2 text-gray-500 hover:text-gray-700"
                >
                  {expanded ? '▼' : '▶'}
                </button>
              )}
            </div>
            {/* Show description for non-compact nodes on separate line */}
            {!isCompact && (
              <div className="text-xs text-gray-600 mt-1">{node.description}</div>
            )}
            {/* For compact nodes in iterations, show inline after type */}
            {isCompact && isIterationContext && node.description && (
              <div className="text-xs text-gray-500 mt-0.5">
                {node.description}
              </div>
            )}
            
            {/* Special display for route nodes */}
            {isRoute && node.params?.value && (
              <div className="text-xs text-gray-500 mt-1">
                <span className="font-mono bg-gray-100 px-1 rounded">{node.params.value}</span>
                {' → '}
                {Object.keys(node.params.paths || {}).join(' | ')}
              </div>
            )}
            
            {/* Special display for iterate nodes */}
            {isIterate && node.params?.over && (
              <div className="text-xs text-gray-500 mt-1">
                <span className="font-mono bg-gray-100 px-1 rounded">{node.params.over}</span>
                {' as '}
                <span className="font-mono bg-gray-100 px-1 rounded">{node.params.variable}</span>
                {node.result && (
                  <span className="ml-2 text-gray-600">
                    {node.result.iterationCount ? (
                      `(${node.result.iterationCount} items ready)`
                    ) : (
                      `(${node.result.processed || 0}/${node.result.total || '?'} processed)`
                    )}
                  </span>
                )}
              </div>
            )}
            
            {/* Special display for group nodes */}
            {isGroup && node.params?.nodeRange && (
              <div className="mt-2 p-2 bg-teal-50 border border-teal-200 rounded">
                <div className="text-sm font-semibold text-teal-800 mb-1">
                  Group: {node.params.name || 'Unnamed Group'}
                </div>
                <div className="text-xs text-teal-700">
                  Executes nodes: 
                  <span className="font-mono bg-teal-100 px-1 ml-1 rounded text-teal-900">
                    {Array.isArray(node.params.nodeRange) 
                      ? `${node.params.nodeRange[0]}-${node.params.nodeRange[1]}` 
                      : node.params.nodeRange}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {node.status === 'success' && (
              <span className="text-green-500 text-xs">✓</span>
            )}
            {node.status === 'failed' && (
              <span className="text-red-500 text-xs">✗</span>
            )}
            <button
              onClick={() => executeNode(node.id)}
              className={`${isCompact ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-xs'} ${isGroup ? 'bg-teal-600 hover:bg-teal-700' : 'bg-green-600 hover:bg-green-700'} text-white rounded`}
            >
              {isGroup ? 'Run Group' : (isCompact ? '▶' : 'Run')}
            </button>
          </div>
        </div>
        
        {/* Expandable section for route branches */}
        {expanded && hasNestedNodes && (
          <div className="mt-3 bg-gray-50 rounded p-3">
            <div className="text-xs font-semibold text-gray-700 mb-2">Route Branches:</div>
            {Object.entries(node.params.paths).map(([branchName, branchContent]) => (
              <div key={branchName} className="mb-3">
                <div className="flex items-center text-xs font-medium text-gray-600 mb-1">
                  <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    {branchName}
                  </span>
                </div>
                {/* Check if it's the new format (array of positions) or old format (node objects) */}
                {Array.isArray(branchContent) && branchContent.length > 0 && typeof branchContent[0] === 'number' ? (
                  <NestedNodesList 
                    nodePositions={branchContent} 
                    workflowId={currentWorkflow?.id}
                    nodeValues={nodeValues}
                    depth={depth + 1}
                    executeNode={executeNode}
                    expandedNodes={expandedNodes}
                    setExpandedNodes={setExpandedNodes}
                    loadNodeValues={loadNodeValues}
                    currentWorkflow={currentWorkflow}
                    isIterationContext={isIterationContext}
                  />
                ) : (
                  renderNestedNode(branchContent, branchName, 0, depth + 1)
                )}
              </div>
            ))}
          </div>
        )}
        
        {/* Expandable section for iterate nodes */}
        {expanded && hasIterateBody && (
          <div className="mt-3">
            {/* Only show template if no iterations are available */}
            {(!iterationData || iterationData.length === 0) && (
              <div className="bg-gray-50 rounded p-3 mb-3">
                <div className="text-xs font-semibold text-gray-700 mb-2">
                  Iteration Template:
                  {node.params.limit && (
                    <span className="ml-2 text-gray-500">
                      (limit: {node.params.limit})
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-600 mb-3">
                  These nodes will run for each item in the collection
                </div>
                {/* Check if body contains position numbers or node objects */}
                {Array.isArray(node.params.body) && node.params.body.length > 0 && typeof node.params.body[0] === 'number' ? (
                  <NestedNodesList 
                    nodePositions={node.params.body} 
                    workflowId={currentWorkflow?.id}
                    nodeValues={nodeValues}
                    depth={depth + 1}
                    executeNode={executeNode}
                    expandedNodes={expandedNodes}
                    setExpandedNodes={setExpandedNodes}
                    loadNodeValues={loadNodeValues}
                    currentWorkflow={currentWorkflow}
                    isIterationContext={false}
                  />
                ) : (
                  renderNestedNode(node.params.body, 'body', 0, depth + 1)
                )}
              </div>
            )}
            
            {/* Show iterations as the main content */}
            {iterationData && iterationData.length > 0 && (
              <div className="space-y-3">
                <div className="text-sm font-semibold text-gray-700">
                  {iterationData.length} Iterations
                </div>
                {/* Simple vertical list of iteration cards */}
                <SimpleIterationList 
                  iterations={iterationData}
                  node={node}
                  currentWorkflow={currentWorkflow}
                  loadWorkflowNodes={loadWorkflowNodes}
                  nodeValues={nodeValues}
                  loadNodeValues={loadNodeValues}
                  depth={depth}
                  executeNode={executeNode}
                  expandedNodes={expandedNodes}
                  setExpandedNodes={setExpandedNodes}
                />
              </div>
            )}
          </div>
        )}
        
        {/* Show params for non-route/non-iterate/non-group nodes - but not in iteration context */}
        {!isRoute && !isIterate && !isGroup && node.params && !isIterationContext && (
          <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded mt-2 font-mono">
            {JSON.stringify(node.params, null, 2)}
          </div>
        )}
        
        {/* Show node value if available */}
        {(() => {
          // Find value for this node position
          const nodeKey = `node${node.position}`;
          const nodeValue = Object.values(nodeValues).find(v => 
            v.storageKey === nodeKey || v.storageKey?.startsWith(`${nodeKey}@iter:`)
          );
          
          if (nodeValue && nodeValue.value !== undefined) {
            return (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-700">Result:</span>
                  <span className="text-xs text-gray-500 font-mono">{nodeValue.storageKey}</span>
                </div>
                <div className="text-xs font-mono text-gray-700 mt-1">
                  {typeof nodeValue.value === 'boolean' ? (
                    <span className={`font-bold ${nodeValue.value ? 'text-green-600' : 'text-red-600'}`}>
                      {nodeValue.value.toString()}
                    </span>
                  ) : typeof nodeValue.value === 'object' ? (
                    <pre className="whitespace-pre-wrap break-words">
                      {JSON.stringify(nodeValue.value, null, 2)}
                    </pre>
                  ) : (
                    <span>{String(nodeValue.value)}</span>
                  )}
                </div>
              </div>
            );
          }
          return null;
        })()}
      </div>
      </div>
    );
  };

  // NestedRouteCard Component - For route nodes within routes
  const NestedRouteCard = ({ node, depth, branchPath, parentNodeId }) => {
    const [expanded, setExpanded] = React.useState(false);
    
    return (
      <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="font-medium flex items-center">
              <span className="text-gray-400 mr-2">→</span>
              <span className="text-blue-600">route</span>
              <button
                onClick={() => setExpanded(!expanded)}
                className="ml-2 text-gray-500 hover:text-gray-700"
              >
                {expanded ? '▼' : '▶'}
              </button>
            </div>
            <div className="text-gray-600 mt-1">{node.description}</div>
            {node.config?.value && (
              <div className="text-gray-500 mt-1">
                <span className="font-mono bg-gray-100 px-1 rounded">{node.config.value}</span>
                {' → '}
                {Object.keys(node.config.paths || {}).join(' | ')}
              </div>
            )}
          </div>
        </div>
        
        {expanded && node.config?.paths && (
          <div className="mt-2 bg-white rounded p-2">
            <div className="text-xs font-semibold text-gray-700 mb-1">Branches:</div>
            {Object.entries(node.config.paths).map(([branchName, branchContent]) => (
              <div key={branchName} className="mb-2">
                <div className="flex items-center text-xs font-medium text-gray-600 mb-1">
                  <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                    {branchName}
                  </span>
                </div>
                <div className="ml-2">
                  {renderNestedBranch(branchContent, branchName, depth + 1)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Helper function for NestedRouteCard
  const renderNestedBranch = (branchContent, branchName, depth) => {
    if (Array.isArray(branchContent)) {
      return (
        <div className="space-y-1">
          {branchContent.map((node, idx) => (
            <div key={idx}>
              {node.type === 'route' ? (
                <NestedRouteCard 
                  node={node} 
                  depth={depth}
                  branchPath={`${branchName}[${idx}]`}
                  parentNodeId={null}
                />
              ) : (
                <MiniNodeCard 
                  node={node} 
                  index={idx} 
                  branchPath={`${branchName}[${idx}]`}
                  parentNodeId={null}
                />
              )}
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // MiniNodeCard Component - For nested nodes within routes
  const MiniNodeCard = ({ node, index, branchPath, parentNodeId, nodeValues = {} }) => {
    const executeBranchNode = async () => {
      try {
        // Execute this specific node within the branch
        const response = await fetch(`${API_BASE}/execute-branch-node`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parentNodeId,
            branchPath,
            nodeDefinition: node
          })
        });
        
        const result = await response.json();
        console.log('Branch node execution result:', result);
      } catch (error) {
        console.error('Failed to execute branch node:', error);
      }
    };

    return (
      <div className="bg-white border rounded p-2 text-xs hover:shadow-sm transition-shadow">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="font-medium flex items-center">
              <span className="text-gray-400 mr-2">→</span>
              <span className="text-blue-600">{node.type}</span>
              {node.config?.action && (
                <span className="text-gray-500 ml-1">:{node.config.action}</span>
              )}
            </div>
            {node.description && (
              <div className="text-gray-600 mt-1">{node.description}</div>
            )}
          </div>
          <button
            onClick={executeBranchNode}
            className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 ml-2"
            title="Run this step"
          >
            ▶
          </button>
        </div>
        {node.config && (
          <div className="mt-1 text-gray-500 font-mono" style={{fontSize: '10px'}}>
            {JSON.stringify(node.config, null, 2)}
          </div>
        )}
        
        {/* Show node value if available and has position */}
        {node.position && (() => {
          const nodeKey = `node${node.position}`;
          const nodeValue = Object.values(nodeValues).find(v => 
            v.storageKey === nodeKey || v.storageKey?.startsWith(`${nodeKey}@iter:`)
          );
          
          if (nodeValue && nodeValue.value !== undefined) {
            return (
              <div className="mt-1 p-1 bg-blue-50 border border-blue-200 rounded">
                <div className="text-xs font-mono text-gray-700">
                  <span className="text-blue-600">→</span> {
                    typeof nodeValue.value === 'boolean' ? (
                      <span className={`font-bold ${nodeValue.value ? 'text-green-600' : 'text-red-600'}`}>
                        {nodeValue.value.toString()}
                      </span>
                    ) : (
                      <span>{String(nodeValue.value)}</span>
                    )
                  }
                </div>
              </div>
            );
          }
          return null;
        })()}
      </div>
    );
  };

  // NestedNodesList Component - Fetches and displays nested nodes by position
  const NestedNodesList = ({ nodePositions, workflowId, nodeValues, depth = 1, executeNode, expandedNodes, setExpandedNodes, loadNodeValues, currentWorkflow, isIterationContext = false }) => {
    const [nestedNodes, setNestedNodes] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    
    React.useEffect(() => {
      const fetchNestedNodes = async () => {
        if (!workflowId) return;
        
        try {
          // Fetch all nodes for this workflow
          const response = await fetch(`${API_BASE}/workflows/${workflowId}`);
          if (!response.ok) throw new Error('Failed to fetch nodes');
          
          const data = await response.json();
          const allNodes = data.nodes || [];
          
          // Filter to get only the nodes at the specified positions
          const nodes = nodePositions.map(pos => 
            allNodes.find(n => n.position === pos)
          ).filter(Boolean);
          
          setNestedNodes(nodes);
        } catch (error) {
          console.error('Failed to fetch nested nodes:', error);
        } finally {
          setLoading(false);
        }
      };
      
      fetchNestedNodes();
    }, [nodePositions, workflowId]);
    
    if (loading) {
      return <div className="ml-4 text-xs text-gray-500">Loading nested nodes...</div>;
    }
    
    return (
      <div className="space-y-2">
        {nestedNodes.map((node, idx) => (
          <NodeCard 
            key={node.id}
            node={node}
            executeNode={executeNode}
            depth={depth}
            expandedNodes={expandedNodes}
            setExpandedNodes={setExpandedNodes}
            loadNodeValues={loadNodeValues}
            currentWorkflow={currentWorkflow}
            isIterationContext={isIterationContext}
          />
        ))}
      </div>
    );
  };

  // IterationNodesList Component - Shows full nodes within an iteration context
  const IterationNodesList = ({ nodePositions, workflowId, currentWorkflow, iterationIndex, iterationData, variable, parentNodeId, parentNodePosition, nodeValues, loadNodeValues, depth, executeNode, expandedNodes, setExpandedNodes }) => {
    const [nodes, setNodes] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    
    React.useEffect(() => {
      const fetchNodes = async () => {
        if (!workflowId || !nodePositions) return;
        
        try {
          const response = await fetch(`${API_BASE}/workflows/${workflowId}`);
          if (!response.ok) throw new Error('Failed to fetch nodes');
          
          const data = await response.json();
          const allNodes = data.nodes || [];
          
          // Filter to get only the nodes at the specified positions
          const stepNodes = nodePositions.map(pos => 
            allNodes.find(n => n.position === pos)
          ).filter(Boolean);
          
          setNodes(stepNodes);
        } catch (error) {
          console.error('Failed to fetch iteration nodes:', error);
        } finally {
          setLoading(false);
        }
      };
      
      fetchNodes();
    }, [nodePositions, workflowId]);
    
    const executeIterationNode = async (nodeId) => {
      console.log(`Execute node ${nodeId} in iteration ${iterationIndex}`, { iterationData });
      
      try {
        // Execute within iteration context
        const response = await fetch(`${API_BASE}/execute-iteration-step`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nodeId,
            workflowId,
            iterationIndex,
            iterationData,
            variable,
            parentNodeId
          })
        });
        
        if (!response.ok) {
          throw new Error(`Failed to execute node: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('Iteration node execution result:', result);
        
        // Reload node values to show updated results
        if (loadNodeValues) {
          await loadNodeValues();
        }
      } catch (error) {
        console.error('Failed to execute iteration node:', error);
        alert(`Failed to execute node: ${error.message}`);
      }
    };
    
    if (loading) {
      return <div className="text-xs text-gray-500">Loading nodes...</div>;
    }
    
    return (
      <div className="space-y-2">
        {nodes.map((node) => (
          <div key={node.id} className="iteration-node-context">
            <NodeCard 
              node={node}
              executeNode={executeIterationNode}
              depth={depth}
              expandedNodes={expandedNodes}
              setExpandedNodes={setExpandedNodes}
              loadNodeValues={loadNodeValues}
              currentWorkflow={currentWorkflow}
              isIterationContext={true}
            />
          </div>
        ))}
      </div>
    );
  };

  // IterationStepsList Component - Shows executable steps within an iteration
  const IterationStepsList = ({ nodePositions, workflowId, iterationIndex, iterationData, variable, parentNodeId, parentNodePosition, nodeValues, loadNodeValues }) => {
    const [nodes, setNodes] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    
    React.useEffect(() => {
      const fetchNodes = async () => {
        if (!workflowId || !nodePositions) return;
        
        try {
          const response = await fetch(`${API_BASE}/workflows/${workflowId}`);
          if (!response.ok) throw new Error('Failed to fetch nodes');
          
          const data = await response.json();
          const allNodes = data.nodes || [];
          
          // Filter to get only the nodes at the specified positions
          const stepNodes = nodePositions.map(pos => 
            allNodes.find(n => n.position === pos)
          ).filter(Boolean);
          
          setNodes(stepNodes);
        } catch (error) {
          console.error('Failed to fetch iteration step nodes:', error);
        } finally {
          setLoading(false);
        }
      };
      
      fetchNodes();
    }, [nodePositions, workflowId]);
    
    const executeStep = async (nodeId, stepIndex) => {
      console.log(`Execute step ${stepIndex} for iteration ${iterationIndex}`, { nodeId, iterationData });
      
      try {
        // Execute a single step within the iteration context
        const response = await fetch(`${API_BASE}/execute-iteration-step`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nodeId,
            workflowId,
            iterationIndex,
            iterationData,
            variable,
            parentNodeId
          })
        });
        
        if (!response.ok) {
          throw new Error(`Failed to execute step: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('Step execution result:', result);
        
        // Reload node values to show updated results
        if (loadNodeValues) {
          await loadNodeValues();
        }
      } catch (error) {
        console.error('Failed to execute step:', error);
        alert(`Failed to execute step: ${error.message}`);
      }
    };
    
    if (loading) {
      return <div className="ml-4 text-xs text-gray-500">Loading steps...</div>;
    }
    
    return (
      <div className="space-y-2">
        {nodes.map((node, idx) => {
          // Find any stored value for this node in this iteration context
          const iterKey = `node${node.position}@iter:${parentNodePosition}:${iterationIndex}`;
          const nodeValue = nodeValues[iterKey];
          const nodeColor = getNodeTypeColor(node.type);
          
          return (
            <div key={node.id} className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center text-sm">
                    <span className="text-gray-400 font-mono text-xs">#{node.position}</span>
                    <span className="ml-2 font-medium" style={{ color: nodeColor }}>{node.type}</span>
                    {node.params?.action && (
                      <span className="text-gray-500 ml-1 text-xs">• {node.params.action}</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">{node.description}</div>
                  
                  {/* Show specific params for this iteration */}
                  {node.params?.selector && node.params.selector.includes('{{') && (
                    <div className="mt-2 text-xs text-gray-500 font-mono bg-gray-50 p-1 rounded">
                      Selector: {node.params.selector.replace(`{{${variable}.selector}}`, iterationData.selector || '[specific to this email]')}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => executeStep(node.id, idx)}
                  className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 ml-2 flex-shrink-0"
                  title={`Execute ${node.description}`}
                >
                  Run Step
                </button>
              </div>
              
              {/* Show node value if available */}
              {nodeValue && nodeValue.value !== undefined && (
                <div className="mt-1 p-1 bg-blue-50 border border-blue-200 rounded">
                  <div className="text-xs font-mono text-gray-700">
                    <span className="text-blue-600">→</span> {
                      typeof nodeValue.value === 'boolean' ? (
                        <span className={`font-bold ${nodeValue.value ? 'text-green-600' : 'text-red-600'}`}>
                          {nodeValue.value.toString()}
                        </span>
                      ) : typeof nodeValue.value === 'object' ? (
                        <span>{JSON.stringify(nodeValue.value)}</span>
                      ) : (
                        <span>{String(nodeValue.value)}</span>
                      )
                    }
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // SimpleIterationList Component - Shows iterations as expandable cards
  const SimpleIterationList = ({ iterations, node, currentWorkflow, loadWorkflowNodes, nodeValues, loadNodeValues, depth, executeNode, expandedNodes, setExpandedNodes }) => {
    return (
      <div className="space-y-3">
        {iterations.map((iterResult, idx) => {
          const itemData = iterResult?.data || iterResult?.item || iterResult;
          const iterationNodeId = `${node.id}_iter_${idx}`;
          const isExpanded = expandedNodes?.has(iterationNodeId);
          
          return (
            <div 
              key={idx} 
              className="border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow"
              style={{
                marginLeft: `${(depth + 1) * 48}px`,
                marginRight: `${(depth + 1) * 24}px`,
              }}
            >
              {/* Iteration Header */}
              <div 
                className="p-4 cursor-pointer flex justify-between items-start"
                onClick={() => {
                  if (isExpanded) {
                    setExpandedNodes(prev => {
                      const newSet = new Set(prev);
                      newSet.delete(iterationNodeId);
                      return newSet;
                    });
                  } else {
                    setExpandedNodes(prev => new Set([...prev, iterationNodeId]));
                  }
                }}
              >
                <div className="flex-1">
                  <div className="flex items-center">
                    <span className="text-sm font-semibold text-gray-700">
                      Iteration {idx + 1}
                    </span>
                    <span className="ml-2 text-xs text-gray-500">
                      {node.params.variable}[{idx}]
                    </span>
                    <span className="ml-2 text-gray-500">
                      {isExpanded ? '▼' : '▶'}
                    </span>
                  </div>
                  
                  {/* Preview of iteration data */}
                  <div className="mt-1 text-sm text-gray-600">
                    {itemData.subject && (
                      <div>Subject: {itemData.subject}</div>
                    )}
                    {itemData.senderName && (
                      <div>From: {itemData.senderName}</div>
                    )}
                    {itemData.senderEmail && (
                      <div className="text-xs text-gray-500">{itemData.senderEmail}</div>
                    )}
                    {/* Generic preview for non-email data */}
                    {!itemData.subject && !itemData.senderName && (
                      <div className="font-mono text-xs">
                        {JSON.stringify(itemData).substring(0, 100)}...
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Execute button */}
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      const response = await fetch(`${API_BASE}/execute-iteration`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          nodeId: node.id,
                          workflowId: currentWorkflow?.id,
                          iterationIndex: idx,
                          iterationData: itemData
                        })
                      });
                      
                      if (!response.ok) {
                        throw new Error(`Failed to execute iteration: ${response.statusText}`);
                      }
                      
                      const result = await response.json();
                      console.log('Iteration execution result:', result);
                      
                      // Refresh the workflow nodes to show updated results
                      if (currentWorkflow?.id) {
                        loadWorkflowNodes(currentWorkflow.id);
                        loadNodeValues();
                      }
                    } catch (error) {
                      console.error('Failed to execute iteration:', error);
                      alert(`Failed to execute iteration: ${error.message}`);
                    }
                  }}
                  className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                >
                  Run
                </button>
              </div>
              
              {/* Expanded content - show the nodes for this iteration */}
              {isExpanded && (
                <div className="border-t bg-gradient-to-r from-gray-50 to-white p-2">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-semibold text-gray-600">
                      Steps for iteration {idx + 1}:
                    </div>
                    <div className="text-xs text-gray-400">
                      {Array.isArray(node.params.body) ? node.params.body.length : 0} steps
                    </div>
                  </div>
                  
                  {/* Show the iteration steps with their specific context */}
                  {Array.isArray(node.params.body) && node.params.body.length > 0 && typeof node.params.body[0] === 'number' ? (
                    <IterationNodesList 
                      nodePositions={node.params.body}
                      workflowId={currentWorkflow?.id}
                      currentWorkflow={currentWorkflow}
                      iterationIndex={idx}
                      iterationData={itemData}
                      variable={node.params.variable}
                      parentNodeId={node.id}
                      parentNodePosition={node.position}
                      nodeValues={nodeValues}
                      loadNodeValues={loadNodeValues}
                      depth={depth + 2}
                      executeNode={executeNode}
                      expandedNodes={expandedNodes}
                      setExpandedNodes={setExpandedNodes}
                    />
                  ) : (
                    <div className="text-xs text-gray-500">No steps defined</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // IterationStack Component - Shows iterations as a stack of cards
  const IterationStack = ({ iterations, node, currentWorkflow, loadWorkflowNodes, nodeValues, loadNodeValues, depth }) => {
    const [selectedIndex, setSelectedIndex] = React.useState(null);
    const [hoveredIndex, setHoveredIndex] = React.useState(null);
    
    // Calculate stack positions
    const getCardStyle = (idx) => {
      const isSelected = selectedIndex === idx;
      const isHovered = hoveredIndex === idx;
      const offset = isSelected ? 0 : Math.min(idx * 8, 40); // Cap offset at 40px
      const scale = isSelected ? 1 : 0.98 - (idx * 0.01);
      const zIndex = iterations.length - idx;
      
      return {
        position: isSelected ? 'relative' : 'absolute',
        top: isSelected ? 'auto' : `${offset}px`,
        left: isSelected ? 'auto' : `${offset}px`,
        right: isSelected ? 'auto' : `${offset}px`,
        transform: `scale(${scale})`,
        zIndex: isSelected ? 1000 : zIndex,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        opacity: isSelected ? 1 : (isHovered ? 0.95 : 0.9),
        boxShadow: isSelected 
          ? '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      };
    };
    
    return (
      <div className="relative" style={{ minHeight: selectedIndex !== null ? 'auto' : '200px' }}>
        {/* Stack view when no item is selected */}
        {selectedIndex === null && (
          <div className="relative" style={{ height: `${Math.min(iterations.length * 8 + 120, 200)}px` }}>
            {iterations.slice(0, 5).map((iterResult, idx) => {
              const itemData = iterResult?.data || iterResult?.item || iterResult;
              return (
                <div
                  key={idx}
                  style={getCardStyle(idx)}
                  className="bg-white border rounded-lg p-3 hover:shadow-xl"
                  onClick={() => setSelectedIndex(idx)}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <div className="text-xs font-medium text-gray-700">
                    <span className="text-gray-500">#{idx + 1}</span>
                    {itemData.subject && (
                      <span className="ml-2">{itemData.subject.substring(0, 50)}...</span>
                    )}
                    {itemData.senderName && (
                      <span className="ml-2 text-gray-600">from {itemData.senderName}</span>
                    )}
                  </div>
                </div>
              );
            })}
            {iterations.length > 5 && (
              <div className="absolute bottom-0 left-12 right-12 bg-gray-100 rounded-lg p-2 text-center text-xs text-gray-600">
                +{iterations.length - 5} more items
              </div>
            )}
          </div>
        )}
        
        {/* Expanded view when item is selected */}
        {selectedIndex !== null && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-semibold text-gray-700">
                Iteration {selectedIndex + 1} of {iterations.length}
              </h4>
              <button
                onClick={() => setSelectedIndex(null)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                ← Back to stack
              </button>
            </div>
            
            <IterationResult
              index={selectedIndex}
              result={iterations[selectedIndex]}
              variable={node.params.variable}
              parentNodeId={node.id}
              parentNodePosition={node.position}
              iterationData={iterations[selectedIndex]?.data || iterations[selectedIndex]?.item || iterations[selectedIndex]}
              bodyNodes={Array.isArray(node.params.body) ? node.params.body : [node.params.body]}
              currentWorkflow={currentWorkflow}
              loadWorkflowNodes={loadWorkflowNodes}
              nodeValues={nodeValues}
              loadNodeValues={loadNodeValues}
              depth={depth}
            />
          </div>
        )}
        
        {/* Pagination dots */}
        {selectedIndex === null && iterations.length > 1 && (
          <div className="flex justify-center mt-4 space-x-1">
            {iterations.slice(0, Math.min(iterations.length, 10)).map((_, idx) => (
              <div
                key={idx}
                className={`w-2 h-2 rounded-full cursor-pointer transition-all ${
                  hoveredIndex === idx ? 'bg-blue-600 w-4' : 'bg-gray-300'
                }`}
                onClick={() => setSelectedIndex(idx)}
              />
            ))}
            {iterations.length > 10 && (
              <span className="text-xs text-gray-500 ml-2">+{iterations.length - 10}</span>
            )}
          </div>
        )}
      </div>
    );
  };

  // IterationResult Component - Shows results from each iteration
  const IterationResult = ({ index, result, variable, parentNodeId, parentNodePosition, iterationData, bodyNodes, currentWorkflow, loadWorkflowNodes, nodeValues, loadNodeValues, depth = 1 }) => {
    const [expanded, setExpanded] = React.useState(false);
    
    const executeIterationStep = async (stepIndex) => {
      // Execute the entire iteration with this specific data
      console.log(`Execute iteration ${index} with data:`, iterationData);
      
      try {
        const response = await fetch(`${API_BASE}/execute-iteration`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nodeId: parentNodeId,
            workflowId: currentWorkflow?.id,
            iterationIndex: index,
            iterationData: iterationData
          })
        });
        
        if (!response.ok) {
          throw new Error(`Failed to execute iteration: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('Iteration execution result:', result);
        
        // Refresh the workflow nodes to show updated results
        if (currentWorkflow?.id) {
          loadWorkflowNodes(currentWorkflow.id);
        }
      } catch (error) {
        console.error('Failed to execute iteration:', error);
        alert(`Failed to execute iteration: ${error.message}`);
      }
    };
    
    return (
      <div className="bg-white border rounded p-2">
        <div 
          className="flex justify-between items-center cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex-1">
            <div className="text-xs font-medium">
              <span className="text-gray-500">Iteration {index + 1}:</span>
              <span className="ml-2 text-blue-600">{variable}[{index}]</span>
              {iterationData && (
                <span className="ml-2 text-gray-600 italic">
                  {iterationData.subject || iterationData.senderName || JSON.stringify(iterationData).substring(0, 50)}...
                </span>
              )}
              {result && result.error && <span className="ml-2 text-red-500">❌ Error</span>}
              {result && !result.error && <span className="ml-2 text-green-500">✓</span>}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                executeIterationStep(0);
              }}
              className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
              title="Run this iteration"
            >
              Run
            </button>
            <span className="text-gray-400">{expanded ? '▼' : '▶'}</span>
          </div>
        </div>
        
        {expanded && (
          <div className="mt-2">
            {/* Show iteration data */}
            {iterationData && (
              <div className="mb-3 p-2 bg-gray-50 rounded">
                <div className="text-xs font-semibold text-gray-700 mb-1">Iteration Data:</div>
                <div className="font-mono text-gray-600" style={{fontSize: '10px'}}>
                  {JSON.stringify(iterationData, null, 2)}
                </div>
              </div>
            )}
            
            {/* Show body nodes for this iteration */}
            {bodyNodes && bodyNodes.length > 0 && (
              <div className="mb-2">
                <div className="text-xs font-semibold text-gray-700 mb-1">Steps in this iteration:</div>
                {/* Use NestedNodesList if we have position numbers */}
                {typeof bodyNodes[0] === 'number' ? (
                  <IterationStepsList 
                    nodePositions={bodyNodes}
                    workflowId={currentWorkflow?.id}
                    iterationIndex={index}
                    iterationData={iterationData}
                    variable={variable}
                    parentNodeId={parentNodeId}
                    parentNodePosition={parentNodePosition}
                    nodeValues={nodeValues}
                    loadNodeValues={loadNodeValues}
                  />
                ) : (
                  // Old format with inline nodes
                  bodyNodes.map((node, stepIndex) => (
                    <div key={stepIndex} className="ml-2 mb-1 flex items-center justify-between">
                      <div className="text-xs">
                        <span className="text-gray-500">Step {stepIndex + 1}:</span>
                        <span className="ml-1 text-blue-600">{node.type}</span>
                        <span className="ml-1 text-gray-600">{node.description}</span>
                      </div>
                      <span className="text-xs text-gray-400 font-mono">
                        iter[{index}]
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
            
            {/* Show results if available */}
            {result && (
              <div className="mt-3">
                <div className="text-xs font-semibold text-gray-700 mb-1">
                  Iteration Results:
                  <span className="ml-2 text-gray-500 font-normal">
                    (stored with keys like node31@iter:28:{index})
                  </span>
                </div>
                <div className="text-xs">
                  {result.error ? (
                    <div className="text-red-600 font-mono text-xs">
                      Error: {result.error}
                    </div>
                  ) : (
                    <div className="font-mono text-gray-600 bg-gray-50 p-2 rounded" style={{fontSize: '10px'}}>
                      {JSON.stringify(result, null, 2)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Create workflow if none exists
      let workflowId = currentWorkflow?.id;
      if (!workflowId) {
        const workflow = await createNewWorkflow();
        workflowId = workflow?.id;
      }

      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          workflowId,
          conversationHistory: messages,
          mockMode
        })
      });

      const data = await response.json();
      
      // Add operator response
      const assistantMessage = {
        role: 'assistant',
        content: data.message,
        toolCalls: data.toolCalls
      };
      setMessages(prev => [...prev, assistantMessage]);

      // If there were tool calls, add execution logs and refresh nodes
      if (data.toolCalls) {
        data.toolCalls.forEach(toolCall => {
          const log = {
            timestamp: new Date().toISOString(),
            type: 'tool',
            message: `Executed ${toolCall.toolName}`,
            details: toolCall.result || toolCall.error
          };
          setExecutionLogs(prev => [...prev, log]);
        });
        
        // Refresh nodes if any node-related tools were called
        const nodeTools = ['create_node', 'create_workflow_sequence', 'update_node', 'delete_node'];
        if (data.toolCalls.some(tc => nodeTools.includes(tc.toolName))) {
          await loadWorkflowNodes(workflowId);
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const executeNode = async (nodeId, nodeConfig = null) => {
    try {
      // Save scroll position before execution
      const scrollPosition = nodesPanelRef.current?.scrollTop || 0;
      console.log('Saved scroll position:', scrollPosition);
      
      const log = {
        timestamp: new Date().toISOString(),
        type: 'info',
        message: `Executing node ${nodeId}...`,
        details: null
      };
      setExecutionLogs(prev => [...prev, log]);

      // For mock nodes, we need to pass the node configuration
      const isMockNode = nodeId && typeof nodeId === 'string' && nodeId.startsWith('mock_');
      let nodeToExecute = nodeConfig;
      
      if (isMockNode && !nodeConfig) {
        // Find the node configuration from workflowNodes
        const node = workflowNodes.find(n => n.id === nodeId);
        if (node) {
          nodeToExecute = {
            type: node.type,
            config: node.params || node.config,
            position: node.position
          };
        }
      }

      const response = await fetch(`${API_BASE}/execute-node`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId,
          workflowId: currentWorkflow?.id,
          nodeConfig: isMockNode ? nodeToExecute : undefined
        })
      });

      const result = await response.json();
      console.log('[DEBUG] Node execution response:', result);
      
      // Update workflow ID if a new one was created for mock execution
      if (result.workflowId && !currentWorkflow) {
        setCurrentWorkflow({ id: result.workflowId, name: 'Mock Execution' });
      }
      
      const resultLog = {
        timestamp: new Date().toISOString(),
        type: result.success ? 'success' : 'error',
        message: `Node ${nodeId} execution ${result.success ? 'completed' : 'failed'}`,
        details: result
      };
      setExecutionLogs(prev => [...prev, resultLog]);
      
      // Refresh workflow nodes and node values to show updated results
      if (result.success && currentWorkflow?.id) {
        console.log('Refreshing workflow nodes and values after execution...');
        await loadWorkflowNodes(currentWorkflow.id);
        await loadNodeValues(); // Reload node values to show execution results
        
        // Restore scroll position after data is loaded
        setTimeout(() => {
          if (nodesPanelRef.current) {
            nodesPanelRef.current.scrollTop = scrollPosition;
            console.log('Restored scroll position:', scrollPosition);
          }
        }, 100); // Small delay to ensure DOM updates are complete
      }
    } catch (error) {
      console.error('Failed to execute node:', error);
      const errorLog = {
        timestamp: new Date().toISOString(),
        type: 'error',
        message: `Failed to execute node ${nodeId}`,
        details: { error: error.message }
      };
      setExecutionLogs(prev => [...prev, errorLog]);
    }
  };

  const formatToolCall = (toolCall) => {
    const renderRunButton = (nodeId) => (
      <button
        onClick={() => executeNode(nodeId)}
        className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
      >
        Run Node
      </button>
    );

    return (
      <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
        <div className="flex justify-between items-start">
          <div className="font-semibold text-blue-700">{toolCall.toolName}</div>
          {toolCall.result?.id && toolCall.toolName === 'create_node' && (
            renderRunButton(toolCall.result.id)
          )}
        </div>
        
        {/* Handle create_workflow_sequence with multiple nodes */}
        {toolCall.toolName === 'create_workflow_sequence' && toolCall.result?.nodes && (
          <div className="mt-2 space-y-2">
            {toolCall.result.nodes.map((node, index) => (
              <div key={node.id} className="flex justify-between items-center p-2 bg-white rounded">
                <div className="text-xs">
                  <span className="font-medium">{index + 1}. {node.type}</span>
                  <span className="text-gray-600 ml-2">{node.description}</span>
                </div>
                {renderRunButton(node.id)}
              </div>
            ))}
          </div>
        )}
        
        {toolCall.result && (
          <pre className="mt-1 text-xs overflow-x-auto">
            {JSON.stringify(toolCall.result, null, 2)}
          </pre>
        )}
      </div>
    );
  };

  return (
    <div className={`flex flex-col h-screen bg-gray-50 ${isResizing ? 'no-select' : ''}`}>
      {/* Top Bar */}
      <div className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">
          Director
          {mockMode && <span className="ml-2 text-sm font-normal text-purple-600">(Mock Mode)</span>}
        </h1>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setMockMode(!mockMode)}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              mockMode 
                ? 'bg-purple-600 text-white hover:bg-purple-700' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            title={mockMode ? 'Using Claude Code as director' : 'Using OpenAI director'}
          >
            {mockMode ? '🤖 Mock Mode' : '✨ Real Director'}
          </button>
          <select
            value={currentWorkflow?.id || ''}
            onChange={(e) => {
              const workflow = workflows.find(w => w.id === e.target.value);
              setCurrentWorkflow(workflow);
            }}
            className="px-3 py-1 border rounded text-sm"
          >
            <option value="">Select Workflow</option>
            {workflows.map(workflow => (
              <option key={workflow.id} value={workflow.id}>
                {workflow.goal} - {workflow.status}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
          >
            {showLogs ? 'Hide Logs' : 'Show Logs'}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col">

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white">
          {mockMode && (
            <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-700">
              <div className="font-semibold mb-1">🤖 Mock Mode Active</div>
              <div>Claude Code is acting as the director. Responses are read from mock-director/response.json</div>
            </div>
          )}
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-20">
              <p className="text-lg mb-2">Hi! I'm the {mockMode ? 'Mock ' : ''}Director.</p>
              <p>Tell me what workflow you'd like to build, and I'll guide you through it step by step.</p>
              <p className="text-sm mt-4">Example: "I want to copy emails from Gmail to Airtable"</p>
            </div>
          )}
          
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-3xl px-4 py-2 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-800'
                }`}
              >
                <div className="whitespace-pre-wrap">{message.content || '(No message - tool calls only)'}</div>
                {message.toolCalls && message.toolCalls.map((toolCall, i) => (
                  <div key={i}>{formatToolCall(toolCall)}</div>
                ))}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="animate-pulse">●</div>
                  <div className="animate-pulse animation-delay-200">●</div>
                  <div className="animate-pulse animation-delay-400">●</div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

          {/* Input */}
          <div className="bg-white border-t p-4">
          <div className="flex space-x-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Tell me what you want to automate..."
              className="flex-1 p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="2"
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </div>
        </div>

        {/* Nodes Panel */}
        <div 
          className="bg-white border-l flex flex-col relative"
          style={{ width: `${workflowPanelWidth}px` }}
        >
          {/* Resize Handle */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 transition-colors resize-handle"
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizing(true);
              resizingRef.current = true;
              startXRef.current = e.clientX;
              startWidthRef.current = workflowPanelWidth;
            }}
            style={{ transform: 'translateX(-2px)' }}
          >
            <div className="absolute left-0 top-0 bottom-0 w-4 -translate-x-1/2" />
          </div>
          <div className="p-4 border-b bg-gray-50">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-lg">
                  {mockMode ? 'Mock Workflow' : 'Workflow Nodes'}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {mockMode 
                    ? `${workflowNodes.length} nodes from response.json`
                    : currentWorkflow ? `${workflowNodes.length} nodes` : 'No workflow selected'
                  }
                </p>
              </div>
              {mockMode && (
                <button
                  onClick={loadMockOperatorResponse}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  title="Reload mock response"
                >
                  🔄 Refresh
                </button>
              )}
            </div>
          </div>
          
          <div 
            ref={nodesPanelRef} 
            className="flex-1 overflow-y-auto p-4"
            onScroll={(e) => {
              // Store scroll position for recovery
              if (nodesPanelRef.current) {
                nodesPanelRef.current._lastScrollTop = e.target.scrollTop;
              }
            }}
          >
            {workflowNodes.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                <p className="text-sm">No nodes yet</p>
                <p className="text-xs mt-2">Start chatting to create nodes</p>
              </div>
            ) : (
              <>
                {mockMode && workflowNodes.some(n => n.id && typeof n.id === 'string' && n.id.startsWith('mock_')) && (
                  <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="text-sm text-purple-700 mb-2">
                      These nodes are loaded from mock-director/response.json
                    </div>
                    <button
                      onClick={uploadMockNodesToSupabase}
                      className="w-full px-4 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors"
                    >
                      📤 Upload to Supabase
                    </button>
                  </div>
                )}
                <div className="space-y-3">
                  {workflowNodes.map((node, index) => {
                    if (node.type === 'group') {
                      console.log('[RENDER] Rendering group node:', node);
                    }
                    return (
                      <NodeCard 
                        key={node.id} 
                        node={node} 
                        executeNode={executeNode} 
                        depth={0}
                        expandedNodes={expandedNodes} 
                        setExpandedNodes={setExpandedNodes} 
                        loadNodeValues={loadNodeValues}
                        currentWorkflow={currentWorkflow}
                      />
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Logs Panel */}
      {showLogs && (
        <div className="h-48 bg-gray-900 text-gray-100 border-t flex flex-col">
          <div className="px-4 py-2 border-b border-gray-700 flex items-center justify-between">
            <h3 className="font-semibold text-sm">Execution Logs</h3>
            <button
              onClick={() => setExecutionLogs([])}
              className="text-xs text-gray-400 hover:text-white"
            >
              Clear
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
            {executionLogs.map((log, index) => (
              <div key={index} className="mb-2">
                <span className="text-gray-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                <span className={`ml-2 ${
                  log.type === 'error' ? 'text-red-400' :
                  log.type === 'success' ? 'text-green-400' :
                  'text-blue-400'
                }`}>
                  [{log.type}]
                </span>
                <span className="ml-2">{log.message}</span>
                {log.details && (
                  <div className="ml-4 mt-1 text-gray-400">
                    {JSON.stringify(log.details, null, 2)}
                  </div>
                )}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}

// Render the app
ReactDOM.render(<App />, document.getElementById('root'));