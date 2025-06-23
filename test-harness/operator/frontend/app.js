const { useState, useEffect, useRef, useCallback } = React;

const API_BASE = 'http://localhost:3002/api/operator';

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentWorkflow, setCurrentWorkflow] = useState(null);
  const [workflows, setWorkflows] = useState([]);
  const [executionLogs, setExecutionLogs] = useState([]);
  const [workflowNodes, setWorkflowNodes] = useState([]);
  const [showLogs, setShowLogs] = useState(false);
  const messagesEndRef = useRef(null);
  const logsEndRef = useRef(null);

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
  }, []);

  // Load nodes when workflow changes
  useEffect(() => {
    loadWorkflowNodes(currentWorkflow?.id);
  }, [currentWorkflow]);

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
      setWorkflowNodes(data.nodes || []);
    } catch (error) {
      console.error('Failed to load workflow nodes:', error);
      setWorkflowNodes([]);
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

  // NodeCard Component - Handles display of nodes including complex route and iterate nodes
  const NodeCard = ({ node, executeNode, depth = 0 }) => {
    const [expanded, setExpanded] = React.useState(false);
    const [iterationData, setIterationData] = React.useState(null);
    const isRoute = node.type === 'route';
    const isIterate = node.type === 'iterate';
    const hasNestedNodes = isRoute && node.params?.paths;
    const hasIterateBody = isIterate && node.params?.body;
    
    // Load iteration data when expanded
    React.useEffect(() => {
      if (isIterate && expanded && !iterationData && node.result?.results) {
        // If node has been executed, show the actual iteration results
        setIterationData(node.result.results);
      }
    }, [isIterate, expanded, node.result]);
    
    // Helper to render a nested node or array of nodes
    const renderNestedNode = (nodeOrArray, branchName, index) => {
      if (Array.isArray(nodeOrArray)) {
        return (
          <div className="ml-4 mt-2 border-l-2 border-gray-300 pl-4">
            <div className="text-xs font-semibold text-gray-600 mb-2">
              {nodeOrArray.length} steps in branch
            </div>
            {nodeOrArray.map((nestedNode, idx) => (
              <div key={idx} className="mb-2">
                <MiniNodeCard 
                  node={nestedNode} 
                  index={idx} 
                  branchPath={`${branchName}[${idx}]`}
                  parentNodeId={node.id}
                />
              </div>
            ))}
          </div>
        );
      } else if (nodeOrArray && typeof nodeOrArray === 'object') {
        return (
          <div className="ml-4 mt-2 border-l-2 border-gray-300 pl-4">
            <MiniNodeCard 
              node={nodeOrArray} 
              index={index} 
              branchPath={branchName}
              parentNodeId={node.id}
            />
          </div>
        );
      }
      return null;
    };

    return (
      <div className="border rounded-lg p-3 hover:shadow-md transition-shadow" style={{marginLeft: depth * 20}}>
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            <div className="font-medium text-sm flex items-center">
              <span className="text-gray-500 mr-2">#{node.position}</span>
              <span className="text-blue-600">{node.type}</span>
              {(hasNestedNodes || hasIterateBody) && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="ml-2 text-gray-500 hover:text-gray-700"
                >
                  {expanded ? '▼' : '▶'}
                </button>
              )}
            </div>
            <div className="text-xs text-gray-600 mt-1">{node.description}</div>
            
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
                    ({node.result.processed || 0}/{node.result.total || '?'} processed)
                  </span>
                )}
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
              className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
            >
              Run
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
                {renderNestedNode(branchContent, branchName, 0)}
              </div>
            ))}
          </div>
        )}
        
        {/* Expandable section for iterate nodes */}
        {expanded && hasIterateBody && (
          <div className="mt-3 bg-gray-50 rounded p-3">
            <div className="text-xs font-semibold text-gray-700 mb-2">
              Iteration Body:
              {node.params.limit && (
                <span className="ml-2 text-gray-500">
                  (limit: {node.params.limit})
                </span>
              )}
            </div>
            
            {/* Show the body template */}
            <div className="mb-3">
              <div className="text-xs text-gray-600 mb-1">Template:</div>
              {renderNestedNode(node.params.body, 'body', 0)}
            </div>
            
            {/* Show iteration results if available */}
            {iterationData && iterationData.length > 0 && (
              <div className="mt-3 border-t pt-3">
                <div className="text-xs font-semibold text-gray-700 mb-2">
                  Iteration Results:
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {iterationData.map((iterResult, idx) => (
                    <IterationResult 
                      key={idx}
                      index={idx}
                      result={iterResult}
                      variable={node.params.variable}
                      parentNodeId={node.id}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Show params for non-route/non-iterate nodes */}
        {!isRoute && !isIterate && node.params && (
          <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded mt-2 font-mono">
            {JSON.stringify(node.params, null, 2)}
          </div>
        )}
      </div>
    );
  };

  // MiniNodeCard Component - For nested nodes within routes
  const MiniNodeCard = ({ node, index, branchPath, parentNodeId }) => {
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
      </div>
    );
  };

  // IterationResult Component - Shows results from each iteration
  const IterationResult = ({ index, result, variable, parentNodeId }) => {
    const [expanded, setExpanded] = React.useState(false);
    
    return (
      <div className="bg-white border rounded p-2">
        <div 
          className="flex justify-between items-center cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="text-xs font-medium">
            <span className="text-gray-500">Iteration {index}:</span>
            <span className="ml-2 text-blue-600">{variable}[{index}]</span>
            {result.error && <span className="ml-2 text-red-500">❌ Error</span>}
            {!result.error && <span className="ml-2 text-green-500">✓</span>}
          </div>
          <span className="text-gray-400">{expanded ? '▼' : '▶'}</span>
        </div>
        
        {expanded && (
          <div className="mt-2 text-xs">
            {result.error ? (
              <div className="text-red-600 font-mono text-xs">
                Error: {result.error}
              </div>
            ) : (
              <div className="font-mono text-gray-600" style={{fontSize: '10px'}}>
                {JSON.stringify(result, null, 2)}
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
          conversationHistory: messages
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

  const executeNode = async (nodeId) => {
    try {
      const log = {
        timestamp: new Date().toISOString(),
        type: 'info',
        message: `Executing node ${nodeId}...`,
        details: null
      };
      setExecutionLogs(prev => [...prev, log]);

      const response = await fetch(`${API_BASE}/execute-node`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId,
          workflowId: currentWorkflow?.id
        })
      });

      const result = await response.json();
      
      const resultLog = {
        timestamp: new Date().toISOString(),
        type: result.success ? 'success' : 'error',
        message: `Node ${nodeId} execution ${result.success ? 'completed' : 'failed'}`,
        details: result
      };
      setExecutionLogs(prev => [...prev, resultLog]);
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
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Operator</h1>
        <div className="flex items-center space-x-4">
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
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-20">
              <p className="text-lg mb-2">Hi! I'm the Operator.</p>
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
        <div className="w-96 bg-white border-l flex flex-col">
          <div className="p-4 border-b bg-gray-50">
            <h3 className="font-semibold text-lg">Workflow Nodes</h3>
            <p className="text-sm text-gray-600 mt-1">
              {currentWorkflow ? `${workflowNodes.length} nodes` : 'No workflow selected'}
            </p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            {workflowNodes.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                <p className="text-sm">No nodes yet</p>
                <p className="text-xs mt-2">Start chatting to create nodes</p>
              </div>
            ) : (
              <div className="space-y-3">
                {workflowNodes.map((node, index) => (
                  <NodeCard key={node.id} node={node} executeNode={executeNode} />
                ))}
              </div>
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