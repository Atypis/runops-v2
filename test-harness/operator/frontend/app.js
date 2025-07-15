const { useState, useEffect, useRef, useCallback } = React;

const API_BASE = '/api/director';

// Reasoning component for chat messages
function ReasoningComponent({ reasoning }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Show the component if there's reasoning text, thinking is active, or if reasoning object exists
  if (!reasoning) {
    return null;
  }
  
  return (
    <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 text-left text-sm font-medium text-blue-800 hover:bg-blue-100 transition-colors flex items-center justify-between"
      >
        <span className="flex items-center">
          <span className="mr-2">🧠</span>
          AI Reasoning
          {reasoning.isThinking && (
            <span className="ml-2 text-blue-600">
              <span className="animate-pulse">●</span>
            </span>
          )}
        </span>
        <span className="text-blue-600">
          {isExpanded ? '▼' : '▶'}
        </span>
      </button>
      
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-blue-200">
          <div className="text-sm text-gray-700 whitespace-pre-wrap font-mono bg-white p-2 rounded border mt-2">
            {reasoning.text || (reasoning.isThinking ? 'AI is thinking...' : 'No reasoning available')}
          </div>
        </div>
      )}
    </div>
  );
}

// Token usage component for Director messages
function TokenUsageComponent({ tokenUsage }) {
  if (!tokenUsage || (!tokenUsage.input_tokens && !tokenUsage.output_tokens)) {
    return null;
  }
  
  const totalTokens = tokenUsage.input_tokens + tokenUsage.output_tokens;
  const formatNumber = (num) => {
    if (num > 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };
  
  // Red highlight if input tokens exceed 150k
  const isHighTokens = tokenUsage.input_tokens > 150000;
  
  return (
    <div style={{ 
      marginTop: '8px', 
      fontSize: '11px', 
      color: '#6b7280', 
      borderTop: '1px solid #d1d5db', 
      paddingTop: '6px' 
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between' 
      }}>
        <span style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ marginRight: '4px' }}>📊</span>
          <span>Token Usage:</span>
        </span>
        <span style={{ 
          fontFamily: 'monospace', 
          fontSize: '10px',
          color: isHighTokens ? '#dc2626' : '#6b7280',
          fontWeight: isHighTokens ? 'bold' : 'normal'
        }}>
          {formatNumber(tokenUsage.input_tokens)} in • {formatNumber(tokenUsage.output_tokens)} out • {formatNumber(totalTokens)} total
        </span>
      </div>
    </div>
  );
}

// Debug Input Modal for examining OpenAI input
function DebugInputModal({ debugInput, isOpen, onClose }) {
  if (!isOpen || !debugInput) return null;

  const downloadDebugData = () => {
    const dataStr = JSON.stringify(debugInput, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `debug-input-${debugInput.timestamp.replace(/[:.]/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(debugInput, null, 2));
      alert('Debug data copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        width: '90vw',
        height: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
            🔍 OpenAI Input Debug ({debugInput.total_messages} messages, {debugInput.total_chars.toLocaleString()} chars)
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={copyToClipboard}
              style={{
                padding: '6px 12px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              📋 Copy JSON
            </button>
            <button
              onClick={downloadDebugData}
              style={{
                padding: '6px 12px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              💾 Download
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '6px 12px',
                backgroundColor: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px'
        }}>
          {/* Message Breakdown */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold' }}>Message Breakdown:</h4>
            {debugInput.message_breakdown.map((msg, i) => (
              <div key={i} style={{
                padding: '8px',
                marginBottom: '4px',
                backgroundColor: msg.role === 'system' ? '#fef3c7' : msg.role === 'user' ? '#dbeafe' : '#f3f4f6',
                borderRadius: '4px',
                fontSize: '12px',
                fontFamily: 'monospace'
              }}>
                <strong>[{msg.index}] {msg.role}:</strong> {msg.content_length.toLocaleString()} chars
                <br />
                <span style={{ color: '#6b7280' }}>"{msg.content_preview}"</span>
              </div>
            ))}
          </div>

          {/* Full JSON */}
          <div>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold' }}>Full Debug Data:</h4>
            <pre style={{
              backgroundColor: '#f9fafb',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              padding: '12px',
              fontSize: '11px',
              overflow: 'auto',
              maxHeight: '400px',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap'
            }}>
              {JSON.stringify(debugInput, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const [selectedModel, setSelectedModel] = useState(() => {
    const savedModel = localStorage.getItem('director-selected-model');
    return (savedModel && ['o4-mini', 'o3', 'kimi-k2'].includes(savedModel)) ? savedModel : 'o4-mini';
  });
  const [nodeValues, setNodeValues] = useState({}); // Storage key -> value mapping
  const [expandedNodes, setExpandedNodes] = useState(new Set()); // Track expanded iterate nodes
  const [browserSessions, setBrowserSessions] = useState([]);
  const [showSaveSessionDialog, setShowSaveSessionDialog] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [sessionDescription, setSessionDescription] = useState('');
  const [currentPlan, setCurrentPlan] = useState(null);
  const [currentDescription, setCurrentDescription] = useState(null);
  const [showCompressConfirmation, setShowCompressConfirmation] = useState(false);
  const [planExpanded, setPlanExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('description'); // 'description', 'plan', 'variables', 'browser', 'reasoning', 'tokens', 'groups'
  const [variables, setVariables] = useState([]);
  const [reasoningText, setReasoningText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [reasoningConnected, setReasoningConnected] = useState(false);
  const [reasoningVersion, setReasoningVersion] = useState(0); // Force re-renders
  const [currentReasoningMessageIndex, setCurrentReasoningMessageIndex] = useState(null); // Track which message is currently receiving reasoning
  const [selectedNodes, setSelectedNodes] = useState([]); // For node selection
  const [reasoningSessions, setReasoningSessions] = useState([]); // Persistent reasoning sessions
  const [currentSessionId, setCurrentSessionId] = useState(null); // Track current session
  const [tokenStats, setTokenStats] = useState(null); // Token usage statistics
  const [browserState, setBrowserState] = useState(null); // Browser state for Director 2.0
  const [debugModalOpen, setDebugModalOpen] = useState(false); // Debug modal state
  const [debugModalData, setDebugModalData] = useState(null); // Debug modal data
  const [showSuccessMessage, setShowSuccessMessage] = useState(''); // Success message for UI feedback
  const messagesEndRef = useRef(null);
  const logsEndRef = useRef(null);
  const nodesPanelRef = useRef(null); // Reference to the nodes panel scroll container
  const wsRef = useRef(null);
  // Refs to hold current values for WebSocket callbacks (to avoid stale closure issues)
  const currentReasoningMessageIndexRef = useRef(null);
  const currentSessionIdRef = useRef(null);

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
    loadBrowserSessions();
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

  // Load conversation history
  const loadConversationHistory = async (workflowId) => {
    if (!workflowId) {
      setMessages([]);
      return;
    }
    
    // Skip loading if we're currently sending a message
    if (isLoading) {
      console.log('Skipping conversation history load while sending message');
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/workflows/${workflowId}/conversations`);
      if (response.ok) {
        const history = await response.json();
        
        // Preserve any temporary messages that might be in progress
        setMessages(prev => {
          const tempMessages = prev.filter(msg => msg.isTemporary);
          if (tempMessages.length > 0) {
            // If we have temporary messages, append history before them
            const lastNonTemp = prev.findLastIndex(msg => !msg.isTemporary);
            return [...history, ...prev.slice(lastNonTemp + 1)];
          }
          return history;
        });
        
        console.log(`Loaded ${history.length} messages from conversation history`);
      } else {
        console.error('Failed to load conversation history:', response.status);
        setMessages([]);
      }
    } catch (error) {
      console.error('Error loading conversation history:', error);
      setMessages([]);
    }
  };

  // Load nodes, plan, description, and conversation history when workflow changes
  useEffect(() => {
    loadWorkflowNodes(currentWorkflow?.id);
    loadCurrentPlan(currentWorkflow?.id);
    loadCurrentDescription(currentWorkflow?.id);
    loadConversationHistory(currentWorkflow?.id);
  }, [currentWorkflow]);

  // Load node values only when needed
  const loadNodeValues = async () => {
    if (!currentWorkflow?.id) return;
    
    try {
      // Get execution results and variables (browser state via SSE)
      const [nodeResponse, variablesResponse] = await Promise.all([
        fetch(`${API_BASE}/node-values/${currentWorkflow.id}`),
        fetch(`${API_BASE}/workflows/${currentWorkflow.id}/variables`)
      ]);
      
      const values = nodeResponse.ok ? await nodeResponse.json() : {};
      
      // If variables are available, merge them in (variables override execution results)
      if (variablesResponse.ok) {
        const variables = await variablesResponse.json();
        
        // Convert variables array to key-value object and merge with node values
        variables.forEach(({ key, value }) => {
          // Handle nested property updates (e.g., node4.inboxVisible)
          if (key.includes('.') && key.startsWith('node')) {
            const [nodeKey, propertyPath] = key.split('.', 2);
            
            // Update nested property in existing node value
            if (values[nodeKey] && values[nodeKey].value) {
              values[nodeKey].value[propertyPath] = value;
            } else {
              // Create new node value if it doesn't exist
              values[nodeKey] = {
                value: { [propertyPath]: value },
                storageKey: nodeKey,
                fromVariable: true
              };
            }
          } else {
            // Direct key assignment for non-nested variables
            values[key] = value;
          }
        });
      }
      
      setNodeValues(values);
    } catch (error) {
      console.error('Failed to load node values:', error);
    }
  };
  
  // Initial load of data when workflow changes
  useEffect(() => {
    if (currentWorkflow?.id) {
      loadNodeValues();
      loadVariables();
      loadTokenStats();
      loadInitialBrowserState(); // Load initial browser state as fallback
    }
  }, [currentWorkflow?.id]);

  // Load initial browser state (fallback for SSE)
  const loadInitialBrowserState = async () => {
    if (!currentWorkflow?.id) return;
    
    try {
      console.log('[FALLBACK] Loading initial browser state for:', currentWorkflow.id);
      const response = await fetch(`${API_BASE}/workflows/${currentWorkflow.id}/browser-state`);
      if (response.ok) {
        const browserStateData = await response.json();
        setBrowserState(browserStateData);
        console.log('[FALLBACK] Initial browser state loaded:', browserStateData.formattedDisplay?.substring(0, 50) + '...');
      }
    } catch (error) {
      console.error('[FALLBACK] Failed to load initial browser state:', error);
    }
  };

  // Load variables for the Variables tab
  const loadVariables = async () => {
    if (!currentWorkflow?.id) return;
    
    try {
      const variablesResponse = await fetch(`${API_BASE}/workflows/${currentWorkflow.id}/variables`);
      
      if (variablesResponse.ok) {
        const vars = await variablesResponse.json();
        setVariables(vars);
      }
    } catch (error) {
      console.error('Failed to load variables:', error);
    }
  };

  const loadTokenStats = async () => {
    if (!currentWorkflow?.id) return;
    
    try {
      const response = await fetch(`${API_BASE}/workflows/${currentWorkflow.id}/token-stats`);
      if (response.ok) {
        const data = await response.json();
        setTokenStats(data.tokenStats);
      }
    } catch (error) {
      console.error('Failed to load token stats:', error);
    }
  };


  // Real-time browser state updates via Server-Sent Events
  useEffect(() => {
    if (!currentWorkflow?.id) return;
    
    console.log(`[SSE] Connecting to browser state stream for workflow: ${currentWorkflow.id}`);
    
    const eventSource = new EventSource(`${API_BASE}/workflows/${currentWorkflow.id}/browser-state/stream`);
    
    eventSource.onopen = () => {
      console.log('[SSE] Browser state stream connected');
    };
    
    eventSource.onmessage = (event) => {
      try {
        const browserStateData = JSON.parse(event.data);
        console.log('[SSE] Received browser state update:', browserStateData.formattedDisplay?.substring(0, 50) + '...');
        setBrowserState(browserStateData);
      } catch (error) {
        console.error('[SSE] Error parsing browser state update:', error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('[SSE] Browser state stream error:', error);
    };
    
    return () => {
      console.log('[SSE] Closing browser state stream');
      eventSource.close();
    };
  }, [currentWorkflow?.id]);

  // Tool call SSE connection for live updates
  const [liveToolCalls, setLiveToolCalls] = useState({});
  const toolCallEventSourceRef = useRef(null);
  
  useEffect(() => {
    if (!currentWorkflow?.id) return;
    
    console.log(`[SSE] Connecting to tool call stream for workflow: ${currentWorkflow.id}`);
    
    const eventSource = new EventSource(`${API_BASE}/workflows/${currentWorkflow.id}/tool-calls/stream`);
    
    eventSource.onopen = () => {
      console.log('[SSE] Tool call stream connected');
    };
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleToolCallEvent(data);
      } catch (error) {
        console.error('[SSE] Error parsing tool call event:', error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('[SSE] Tool call stream error:', error);
    };
    
    toolCallEventSourceRef.current = eventSource;
    
    return () => {
      console.log('[SSE] Closing tool call stream');
      eventSource.close();
    };
  }, [currentWorkflow?.id]);

  // Handle tool call events
  const handleToolCallEvent = (event) => {
    console.log('[SSE] Tool call event:', event);
    
    switch (event.type) {
      case 'connected':
        console.log('[SSE] Tool call stream connected to workflow:', event.workflowId);
        break;
        
      case 'tool_call_start':
        // Update live tool calls state
        setLiveToolCalls(prev => ({
          ...prev,
          [event.callId]: {
            toolName: event.toolName,
            status: 'running',
            startTime: event.timestamp,
            arguments: event.arguments
          }
        }));
        
        // Update the latest assistant message to show pending tool
        setMessages(prev => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg?.role === 'assistant' && lastMsg?.isTemporary) {
            lastMsg.pendingToolCalls = lastMsg.pendingToolCalls || {};
            lastMsg.pendingToolCalls[event.callId] = {
              toolName: event.toolName,
              status: 'running',
              startTime: event.timestamp
            };
          }
          return updated;
        });
        break;
        
      case 'tool_call_complete':
        // Move from pending to completed
        setMessages(prev => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg?.role === 'assistant') {
            // Remove from pending
            if (lastMsg.pendingToolCalls) {
              delete lastMsg.pendingToolCalls[event.callId];
              if (Object.keys(lastMsg.pendingToolCalls).length === 0) {
                delete lastMsg.pendingToolCalls;
              }
            }
            
            // Add to completed only if not already there from the response
            if (!lastMsg.toolCalls?.some(tc => tc.call_id === event.callId)) {
              lastMsg.toolCalls = lastMsg.toolCalls || [];
              lastMsg.toolCalls.push({
                name: event.toolName,
                result: event.result,
                call_id: event.callId
              });
            }
          }
          return updated;
        });
        
        // Clean up live tool calls
        setLiveToolCalls(prev => {
          const updated = { ...prev };
          delete updated[event.callId];
          return updated;
        });
        break;
        
      case 'tool_call_error':
        // Move from pending to completed with error
        setMessages(prev => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg?.role === 'assistant') {
            // Remove from pending
            if (lastMsg.pendingToolCalls) {
              delete lastMsg.pendingToolCalls[event.callId];
              if (Object.keys(lastMsg.pendingToolCalls).length === 0) {
                delete lastMsg.pendingToolCalls;
              }
            }
            
            // Add error to tool calls
            if (!lastMsg.toolCalls?.some(tc => tc.call_id === event.callId)) {
              lastMsg.toolCalls = lastMsg.toolCalls || [];
              lastMsg.toolCalls.push({
                name: event.toolName,
                error: event.error,
                call_id: event.callId
              });
            }
          }
          return updated;
        });
        
        // Clean up live tool calls
        setLiveToolCalls(prev => {
          const updated = { ...prev };
          delete updated[event.callId];
          return updated;
        });
        break;
    }
  };

  // Reduced polling for variables and token stats (no browser state)
  useEffect(() => {
    if (!currentWorkflow?.id) return;
    
    const interval = setInterval(() => {
      loadNodeValues();
      loadVariables(); // Variables only (browser state via SSE)
      loadCurrentPlan(currentWorkflow?.id);
      loadCurrentDescription(currentWorkflow?.id);
      loadTokenStats(); // Token stats
    }, 10000); // Poll every 10 seconds (less frequent)
    
    return () => clearInterval(interval);
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

  // Load groups when tab is selected or workflow changes
  useEffect(() => {
    console.log('[Frontend useEffect] activeTab:', activeTab, 'currentWorkflow:', currentWorkflow);
  }, [activeTab, currentWorkflow]);

  // WebSocket connection for reasoning stream
  useEffect(() => {
    const connectWebSocket = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        return;
      }

      try {
        const ws = new WebSocket(`ws://localhost:3003`);
        
        ws.onopen = () => {
          console.log('[ReasoningStream] WebSocket connected');
          setReasoningConnected(true);
          
          // Subscribe to reasoning updates for current workflow
          if (currentWorkflow?.id) {
            ws.send(JSON.stringify({
              type: 'reasoning_subscribe',
              executionId: currentWorkflow.id
            }));
          }
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            
            if (message.type === 'reasoning_update' && message.data) {
              const update = message.data;
              
              switch (update.type) {
                case 'reasoning_start':
                  console.log('[ReasoningStream] Reasoning started');
                  setIsThinking(true);
                  setReasoningText('');
                  setReasoningVersion(prev => prev + 1);
                  
                  // Create new reasoning session
                  const sessionId = Date.now();
                  const messageIndex = currentReasoningMessageIndexRef.current;
                  console.log('[ReasoningStream] Creating session with message index from ref:', messageIndex);
                  
                  setCurrentSessionId(sessionId);
                  currentSessionIdRef.current = sessionId;
                  
                  setReasoningSessions(prev => [...prev, {
                    id: sessionId,
                    text: '',
                    isThinking: true,
                    timestamp: new Date(),
                    messageIndex: messageIndex
                  }]);
                  
                  // Update the current message with reasoning capability
                  if (messageIndex !== null) {
                    setMessages(prev => {
                      console.log('[ReasoningStream] Starting reasoning for message index:', messageIndex);
                      const updated = [...prev];
                      if (updated[messageIndex]) {
                        updated[messageIndex] = {
                          ...updated[messageIndex],
                          reasoning: {
                            text: '',
                            isThinking: true
                          }
                        };
                      }
                      return updated;
                    });
                  }
                  break;
                  
                case 'reasoning_delta':
                  if (update.text) {
                    const messageIndex = currentReasoningMessageIndexRef.current;
                    const sessionId = currentSessionIdRef.current;
                    
                    console.log('[ReasoningStream] Reasoning delta:', update.text);
                    console.log('[ReasoningStream] Current reasoning message index (ref):', messageIndex);
                    console.log('[ReasoningStream] Current session ID (ref):', sessionId);
                    
                    // Update global reasoning text (for compatibility)
                    setReasoningText(prev => {
                      const newText = prev + update.text;
                      console.log('[ReasoningStream] New text length:', newText.length);
                      return newText;
                    });
                    setReasoningVersion(prev => prev + 1); // Force re-render
                    
                    // Update the current reasoning session
                    if (sessionId !== null) {
                      setReasoningSessions(prev => {
                        return prev.map(session => {
                          if (session.id === sessionId) {
                            return {
                              ...session,
                              text: session.text + update.text
                            };
                          }
                          return session;
                        });
                      });
                    }
                    
                    // Update the reasoning text in the current message
                    if (messageIndex !== null) {
                      setMessages(prev => {
                        console.log('[ReasoningStream] Updating message at index:', messageIndex);
                        const updated = [...prev];
                        if (updated[messageIndex]) {
                          const oldText = updated[messageIndex].reasoning?.text || '';
                          const newText = oldText + update.text;
                          console.log('[ReasoningStream] Message reasoning update:', oldText.length, '->', newText.length);
                          updated[messageIndex] = {
                            ...updated[messageIndex],
                            reasoning: {
                              text: newText,
                              isThinking: true
                            }
                          };
                          console.log('[ReasoningStream] Updated message:', updated[messageIndex]);
                        } else {
                          console.log('[ReasoningStream] No message found at index:', messageIndex);
                        }
                        return updated;
                      });
                    } else {
                      console.log('[ReasoningStream] No current reasoning message index set');
                    }
                  }
                  break;
                  
                case 'reasoning_complete':
                  console.log('[ReasoningStream] Reasoning completed');
                  const completeMessageIndex = currentReasoningMessageIndexRef.current;
                  const completeSessionId = currentSessionIdRef.current;
                  
                  setIsThinking(false);
                  setReasoningVersion(prev => prev + 1);
                  
                  // Mark the current session as complete
                  if (completeSessionId !== null) {
                    setReasoningSessions(prev => {
                      return prev.map(session => {
                        if (session.id === completeSessionId) {
                          return {
                            ...session,
                            isThinking: false,
                            completedAt: new Date()
                          };
                        }
                        return session;
                      });
                    });
                    setCurrentSessionId(null);
                    currentSessionIdRef.current = null;
                  }
                  
                  // Mark reasoning as complete for the current message
                  if (completeMessageIndex !== null) {
                    setMessages(prev => {
                      console.log('[ReasoningStream] Completing reasoning for message index:', completeMessageIndex);
                      const updated = [...prev];
                      if (updated[completeMessageIndex] && updated[completeMessageIndex].reasoning) {
                        updated[completeMessageIndex].reasoning.isThinking = false;
                        console.log('[ReasoningStream] Message reasoning completed');
                      }
                      return updated;
                    });
                    setCurrentReasoningMessageIndex(null);
                    currentReasoningMessageIndexRef.current = null;
                  }
                  break;
              }
            } else if (message.type === 'reasoning_subscribed') {
              console.log('[ReasoningStream] Subscribed to reasoning updates');
            }
          } catch (error) {
            console.error('[ReasoningStream] Error parsing message:', error);
          }
        };

        ws.onclose = () => {
          console.log('[ReasoningStream] WebSocket disconnected');
          setReasoningConnected(false);
          
          // Auto-reconnect after 2 seconds
          setTimeout(() => {
            console.log('[ReasoningStream] Attempting to reconnect...');
            connectWebSocket();
          }, 2000);
        };

        ws.onerror = (error) => {
          console.error('[ReasoningStream] WebSocket error:', error);
          setReasoningConnected(false);
        };

        wsRef.current = ws;
      } catch (error) {
        console.error('[ReasoningStream] Failed to connect:', error);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [currentWorkflow?.id]);

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

  const loadCurrentPlan = async (workflowId) => {
    if (!workflowId) {
      setCurrentPlan(null);
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/workflows/${workflowId}/plan`);
      if (response.ok) {
        const plan = await response.json();
        if (plan && plan.plan_data) {
          setCurrentPlan(plan);
        } else {
          setCurrentPlan(null);
        }
      } else {
        setCurrentPlan(null);
      }
    } catch (error) {
      console.error('Failed to load current plan:', error);
      setCurrentPlan(null);
    }
  };

  const loadCurrentDescription = async (workflowId) => {
    if (!workflowId) {
      setCurrentDescription(null);
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/workflows/${workflowId}/description`);
      if (response.ok) {
        const description = await response.json();
        if (description && description.description_data) {
          setCurrentDescription(description);
        } else {
          setCurrentDescription(null);
        }
      } else if (response.status === 404) {
        // No description yet - this is normal
        setCurrentDescription(null);
      } else {
        console.error('Failed to load description:', response.status);
        setCurrentDescription(null);
      }
    } catch (error) {
      console.error('Failed to load current description:', error);
      setCurrentDescription(null);
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
              toolCalls: mockData.toolCalls,
              // Add mock token usage for demonstration
              tokenUsage: {
                input_tokens: 245,
                output_tokens: 186
              }
            }]);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load mock operator response:', error);
    }
  };

  // Helper function to add system messages
  const addMessage = (type, content) => {
    const message = {
      role: type === 'error' ? 'error' : 'system',
      content,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, message]);
  };


  // Browser session management functions
  const loadBrowserSessions = async () => {
    try {
      const response = await fetch(`${API_BASE}/browser/sessions`);
      if (!response.ok) {
        throw new Error('Failed to load browser sessions');
      }
      const data = await response.json();
      setBrowserSessions(data || []);
    } catch (error) {
      console.error('Failed to load browser sessions:', error);
      setBrowserSessions([]);
    }
  };

  const restartBrowser = async () => {
    try {
      const response = await fetch(`${API_BASE}/browser/restart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        throw new Error('Failed to restart browser');
      }
      addMessage('system', 'Browser restarted with fresh state');
    } catch (error) {
      console.error('Failed to restart browser:', error);
      addMessage('error', `Failed to restart browser: ${error.message}`);
    }
  };

  const saveBrowserSession = async () => {
    if (!sessionName.trim()) {
      addMessage('error', 'Session name is required');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/browser/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sessionName.trim(),
          description: sessionDescription.trim() || null
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save session');
      }
      
      const session = await response.json();
      addMessage('system', `Browser session "${session.name}" saved successfully`);
      
      // Reset dialog state
      setShowSaveSessionDialog(false);
      setSessionName('');
      setSessionDescription('');
      
      // Reload sessions
      loadBrowserSessions();
    } catch (error) {
      console.error('Failed to save browser session:', error);
      addMessage('error', `Failed to save session: ${error.message}`);
    }
  };

  const loadBrowserSession = async (sessionName) => {
    try {
      const response = await fetch(`${API_BASE}/browser/sessions/${encodeURIComponent(sessionName)}/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error('Failed to load session');
      }
      
      const session = await response.json();
      addMessage('system', `Browser session "${session.name}" loaded successfully`);
      
      // Reload sessions to update last_used_at
      loadBrowserSessions();
    } catch (error) {
      console.error('Failed to load browser session:', error);
      addMessage('error', `Failed to load session: ${error.message}`);
    }
  };

  const deleteBrowserSession = async (sessionName) => {
    if (!confirm(`Are you sure you want to delete the session "${sessionName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/browser/sessions/${encodeURIComponent(sessionName)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete session');
      }
      
      addMessage('system', `Browser session "${sessionName}" deleted`);
      
      // Reload sessions
      loadBrowserSessions();
    } catch (error) {
      console.error('Failed to delete browser session:', error);
      addMessage('error', `Failed to delete session: ${error.message}`);
    }
  };

  const compressContext = async () => {
    setShowCompressConfirmation(false);
    setIsLoading(true);

    try {
      const workflowId = currentWorkflow?.id;
      if (!workflowId) {
        addMessage('error', 'No workflow selected');
        setIsLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE}/compress-context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflowId,
          messageCount: messages.filter(m => m.role === 'user' || m.role === 'assistant').length
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to compress context');
      }

      const result = await response.json();
      
      // Reload conversation history to get updated archived status and compressed message
      await loadConversationHistory(workflowId);
      
      addMessage('system', `Context compressed successfully. Compressed ${result.originalMessageCount} new messages into the summary.`);
    } catch (error) {
      console.error('Failed to compress context:', error);
      addMessage('error', `Failed to compress context: ${error.message}`);
    } finally {
      setIsLoading(false);
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
      'context': '#10b981',         // green
      'browser_action': '#4CAF50',   // green (deterministic)
      'browser_ai_action': '#9C27B0', // purple (AI)
      'browser_query': '#2196F3',     // blue (deterministic)
      'browser_ai_query': '#E91E63',  // pink (AI)
      'route': '#f59e0b',            // amber
      'iterate': '#ef4444',          // red
      'memory': '#06b6d4',           // cyan
      'cognition': '#ec4899',        // pink
      'group': '#14b8a6',            // teal
      'transform': '#FF9800',        // orange
      'agent': '#795548',            // brown
      'handle': '#607D8B',           // blue-grey
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

  // VariablesViewer Component
  const GroupsViewer = ({ workflow, onDeleteGroup, onGoToNode, onRefresh }) => {
    // Get all group nodes from the workflow
    const groupNodes = workflow?.nodes?.filter(node => node.type === 'group') || [];
    
    if (groupNodes.length === 0) {
      return (
        <div className="text-center text-gray-500 py-8">
          <p className="text-sm">No groups in this workflow</p>
          <p className="text-xs mt-1">Select nodes in the workflow and click "Group Selected" to create a group</p>
          <button 
            onClick={onRefresh}
            className="mt-4 text-teal-600 hover:text-teal-700 text-sm font-medium"
          >
            Refresh
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-semibold text-gray-700">Workflow Groups</h3>
          <button 
            onClick={onRefresh}
            className="text-teal-600 hover:text-teal-700 text-sm"
          >
            Refresh
          </button>
        </div>
        
        {groupNodes.map(node => (
          <div key={node.id} className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h4 className="font-semibold text-gray-800">
                  {node.config?.name || node.alias || `Group at position ${node.position}`}
                </h4>
                <p className="text-sm text-gray-600 mt-1">
                  {node.description || `Executes nodes ${node.config?.nodeRange}`}
                </p>
                <div className="mt-2 text-xs text-gray-500">
                  <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                    Nodes: {node.config?.nodeRange}
                  </span>
                  <span className="ml-2">
                    Position: {node.position}
                  </span>
                </div>
                {node.result && (
                  <div className="mt-2 text-xs">
                    <span className={node.result.success ? "text-green-600" : "text-red-600"}>
                      Last run: {node.result.executed}/{node.result.total} nodes
                      {node.result.success ? " ✓" : " ✗"}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => onGoToNode(node.position)}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded"
                >
                  View
                </button>
                <button
                  onClick={() => onDeleteGroup(node.id)}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const VariablesViewer = ({ variables, workflowId }) => {
    if (!variables || variables.length === 0) {
      return (
        <div className="text-center text-gray-500 py-8">
          <p className="text-sm">No variables stored yet</p>
          <p className="text-xs mt-1">Variables will appear here when nodes execute or Director sets them</p>
        </div>
      );
    }

    const formatValue = (value) => {
      if (value === null) return 'null';
      if (value === undefined) return 'undefined';
      if (typeof value === 'boolean') return value.toString();
      if (typeof value === 'string') return `"${value}"`;
      return JSON.stringify(value, null, 2);
    };

    const isNodeVariable = (key) => key.startsWith('node');
    const isCustomVariable = (key) => !key.startsWith('node');

    const nodeVariables = variables.filter(v => isNodeVariable(v.key));
    const customVariables = variables.filter(v => isCustomVariable(v.key));

    return (
      <div className="space-y-4">
        {/* Custom Variables */}
        {customVariables.length > 0 && (
          <div>
            <h5 className="font-medium text-gray-800 mb-2 text-sm">Custom Variables ({customVariables.length})</h5>
            <div className="space-y-2">
              {customVariables.map((variable) => (
                <div key={variable.key} className="bg-gray-50 rounded-lg p-3 border">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-sm font-medium text-blue-700">{variable.key}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(variable.updated_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-sm">
                    <pre className="whitespace-pre-wrap break-words text-gray-800 bg-white p-2 rounded border text-xs font-mono">
                      {formatValue(variable.value)}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Node Variables */}
        {nodeVariables.length > 0 && (
          <div>
            <h5 className="font-medium text-gray-800 mb-2 text-sm">Node Results ({nodeVariables.length})</h5>
            <div className="space-y-2">
              {nodeVariables.map((variable) => (
                <div key={variable.key} className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-sm font-medium text-blue-700">{variable.key}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(variable.updated_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-sm">
                    <pre className="whitespace-pre-wrap break-words text-gray-800 bg-white p-2 rounded border text-xs font-mono">
                      {formatValue(variable.value)}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Stats */}
        <div className="border-t pt-3 mt-4">
          <div className="text-xs text-gray-500 flex justify-between">
            <span>Total: {variables.length} variables</span>
            <span>Updated: {new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
    );
  };

  // TokenViewer Component - Displays real-time token usage and cost statistics
  const TokenViewer = ({ tokenStats }) => {
    if (!tokenStats) {
      return (
        <div className="text-center text-gray-500 py-8">
          <div className="text-2xl mb-2">📊</div>
          <p className="text-sm">No token data yet</p>
          <p className="text-xs mt-1">Token usage will appear here after conversations begin</p>
        </div>
      );
    }

    const { totals, breakdown, warnings, recent_messages } = tokenStats;
    
    const formatNumber = (num) => {
      if (num > 1000000) return `${(num / 1000000).toFixed(1)}M`;
      if (num > 1000) return `${(num / 1000).toFixed(1)}K`;
      return num.toLocaleString();
    };

    const formatCost = (cost) => {
      if (cost < 0.001) return `$${(cost * 1000).toFixed(3)}m`; // Show in millicents
      return `$${cost.toFixed(4)}`;
    };

    return (
      <div className="space-y-4">
        {/* Warnings */}
        {warnings && warnings.length > 0 && (
          <div className="space-y-2">
            {warnings.map((warning, index) => (
              <div key={index} className={`p-3 rounded-lg border ${
                warning.level === 'critical' ? 'bg-red-50 border-red-200 text-red-800' :
                warning.level === 'warning' ? 'bg-orange-50 border-orange-200 text-orange-800' :
                'bg-blue-50 border-blue-200 text-blue-800'
              }`}>
                <div className="flex items-center">
                  <span className="mr-2">
                    {warning.level === 'critical' ? '🚨' : warning.level === 'warning' ? '⚠️' : 'ℹ️'}
                  </span>
                  <span className="text-sm font-medium">{warning.message}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Overview Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-lg font-bold text-blue-800">{formatNumber(totals.total_tokens)}</div>
            <div className="text-xs text-blue-600">Total Tokens</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="text-lg font-bold text-green-800">{formatCost(totals.total_cost)}</div>
            <div className="text-xs text-green-600">Total Cost</div>
          </div>
        </div>

        {/* Token Breakdown */}
        <div className="bg-gray-50 border rounded-lg p-3">
          <h5 className="font-medium text-gray-800 mb-3 text-sm">Token Breakdown</h5>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Input tokens:</span>
              <span className="font-mono text-gray-800">{formatNumber(totals.input_tokens)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Output tokens:</span>
              <span className="font-mono text-gray-800">{formatNumber(totals.output_tokens)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Reasoning tokens:</span>
              <span className="font-mono text-orange-700 font-medium">{formatNumber(totals.reasoning_tokens)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between text-sm font-medium">
              <span className="text-gray-800">Total:</span>
              <span className="font-mono text-gray-900">{formatNumber(totals.total_tokens)}</span>
            </div>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="bg-gray-50 border rounded-lg p-3">
          <h5 className="font-medium text-gray-800 mb-3 text-sm">Cost Breakdown</h5>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Input cost:</span>
              <span className="font-mono text-gray-800">{formatCost(breakdown.cost_breakdown.input_cost)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Output cost:</span>
              <span className="font-mono text-gray-800">{formatCost(breakdown.cost_breakdown.output_cost)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Reasoning cost:</span>
              <span className="font-mono text-orange-700 font-medium">{formatCost(breakdown.cost_breakdown.reasoning_cost)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between text-sm font-medium">
              <span className="text-gray-800">Total:</span>
              <span className="font-mono text-gray-900">{formatCost(totals.total_cost)}</span>
            </div>
          </div>
        </div>

        {/* Conversation Stats */}
        <div className="bg-gray-50 border rounded-lg p-3">
          <h5 className="font-medium text-gray-800 mb-3 text-sm">Conversation Stats</h5>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-lg font-bold text-gray-800">{breakdown.user_messages}</div>
              <div className="text-xs text-gray-600">User Messages</div>
            </div>
            <div>
              <div className="text-lg font-bold text-gray-800">{breakdown.assistant_messages}</div>
              <div className="text-xs text-gray-600">AI Responses</div>
            </div>
            <div>
              <div className="text-lg font-bold text-orange-700">{formatNumber(Math.round(breakdown.average_reasoning_per_message))}</div>
              <div className="text-xs text-gray-600">Avg Reasoning/Msg</div>
            </div>
            <div>
              <div className="text-lg font-bold text-gray-800">{totals.message_count}</div>
              <div className="text-xs text-gray-600">Total Messages</div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        {recent_messages && recent_messages.length > 0 && (
          <div className="bg-gray-50 border rounded-lg p-3">
            <h5 className="font-medium text-gray-800 mb-3 text-sm">Recent Activity</h5>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {recent_messages.map((msg, index) => (
                <div key={index} className="text-xs">
                  <div className="flex justify-between">
                    <span className={`font-medium ${msg.messageType === 'user' ? 'text-blue-600' : 'text-green-600'}`}>
                      {msg.messageType} message
                    </span>
                    <span className="text-gray-500">{formatCost(msg.cost)}</span>
                  </div>
                  <div className="text-gray-600">
                    {formatNumber(msg.total_tokens)} tokens
                    {msg.reasoning_tokens > 0 && (
                      <span className="ml-2 text-orange-600">({formatNumber(msg.reasoning_tokens)} reasoning)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t pt-3 mt-4">
          <div className="text-xs text-gray-500 flex justify-between">
            <span>Updated: {new Date().toLocaleTimeString()}</span>
            <span>{tokenStats.lastUpdated && `Data from ${new Date(tokenStats.lastUpdated).toLocaleTimeString()}`}</span>
          </div>
        </div>
      </div>
    );
  };

  // ReasoningMetricsViewer Component - Displays token usage metrics for reasoning models
  const ReasoningMetricsViewer = ({ workflowId }) => {
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
      if (!workflowId) {
        setMetrics(null);
        setLoading(false);
        return;
      }

      const fetchMetrics = async () => {
        try {
          setLoading(true);
          const response = await fetch(`${API_BASE}/workflows/${workflowId}/reasoning-metrics`);
          if (!response.ok) {
            throw new Error(`Failed to fetch metrics: ${response.statusText}`);
          }
          const data = await response.json();
          setMetrics(data);
          setError(null);
        } catch (err) {
          console.error('Error fetching reasoning metrics:', err);
          setError(err.message);
          setMetrics(null);
        } finally {
          setLoading(false);
        }
      };

      fetchMetrics();
      
      // Refresh metrics every 10 seconds
      const interval = setInterval(fetchMetrics, 10000);
      return () => clearInterval(interval);
    }, [workflowId]);

    if (loading) {
      return (
        <div className="text-center text-gray-500 py-8">
          <div className="animate-pulse">Loading reasoning metrics...</div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center text-red-500 py-8">
          <p className="text-sm">Error loading metrics</p>
          <p className="text-xs mt-1">{error}</p>
        </div>
      );
    }

    if (!metrics || !metrics.summary || metrics.summary.total_conversations === 0) {
      return (
        <div className="text-center text-gray-500 py-8">
          <p className="text-sm">No reasoning metrics yet</p>
          <p className="text-xs mt-1">Metrics will appear when using reasoning models (o4-mini, o3)</p>
        </div>
      );
    }

    const { summary, metrics: metricsList } = metrics;

    return (
      <div className="space-y-4">
        {/* Summary Stats */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border">
          <h5 className="font-medium text-gray-800 mb-3 text-sm">Token Usage Summary</h5>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-white rounded p-2 border">
              <div className="text-gray-600">Total Conversations</div>
              <div className="font-bold text-lg text-blue-600">{summary.total_conversations}</div>
            </div>
            <div className="bg-white rounded p-2 border">
              <div className="text-gray-600">Total Tokens</div>
              <div className="font-bold text-lg text-purple-600">{summary.cumulative_tokens.total.toLocaleString()}</div>
            </div>
            <div className="bg-white rounded p-2 border">
              <div className="text-gray-600">Reasoning Tokens</div>
              <div className="font-bold text-lg text-orange-600">{summary.cumulative_tokens.reasoning.toLocaleString()}</div>
            </div>
            <div className="bg-white rounded p-2 border">
              <div className="text-gray-600">Avg Reasoning %</div>
              <div className="font-bold text-lg text-green-600">{summary.cumulative_tokens.average_reasoning_percentage}%</div>
            </div>
          </div>
        </div>

        {/* Latest Turn Details */}
        {summary.latest_turn && (
          <div className="bg-gray-50 rounded-lg p-3 border">
            <h6 className="font-medium text-gray-800 mb-2 text-sm">Latest Turn (#{summary.latest_turn.turn})</h6>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div className="text-center">
                <div className="text-gray-600">Input</div>
                <div className="font-mono font-bold text-blue-600">{summary.latest_turn.tokens.input.toLocaleString()}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-600">Output</div>
                <div className="font-mono font-bold text-green-600">{summary.latest_turn.tokens.output.toLocaleString()}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-600">Reasoning</div>
                <div className="font-mono font-bold text-orange-600">{summary.latest_turn.tokens.reasoning.toLocaleString()}</div>
              </div>
              <div className="text-center">
                <div className="text-gray-600">% Reasoning</div>
                <div className="font-mono font-bold text-purple-600">{summary.latest_turn.tokens.reasoning_percentage}%</div>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              {new Date(summary.latest_turn.timestamp).toLocaleString()}
            </div>
          </div>
        )}

        {/* Recent Turns History */}
        {metricsList && metricsList.length > 1 && (
          <div>
            <h6 className="font-medium text-gray-800 mb-2 text-sm">Recent Turns ({metricsList.length})</h6>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {metricsList.slice(0, 5).map((metric) => (
                <div key={metric.turn} className="bg-white rounded p-2 border text-xs">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-gray-700">Turn #{metric.turn}</span>
                    <span className="text-gray-500">{new Date(metric.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Total: {metric.tokens.total.toLocaleString()}</span>
                    <span>Reasoning: {metric.tokens.reasoning.toLocaleString()} ({metric.tokens.reasoning_percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Refresh Info */}
        <div className="border-t pt-3 mt-4">
          <div className="text-xs text-gray-500 flex justify-between">
            <span>Auto-refresh: Every 10s</span>
            <span>Updated: {new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </div>
    );
  };

  // DescriptionViewer Component - Displays high-fidelity workflow description
  const DescriptionViewer = ({ description, workflowId }) => {
    if (!description || !description.description_data) {
      return (
        <div className="text-center text-gray-500 py-8">
          <p className="text-sm">No workflow description created yet</p>
          <p className="text-xs mt-1">The Director will create a high-fidelity description before building</p>
        </div>
      );
    }

    const data = description.description_data;
    
    // Add error boundary
    try {
    
    return (
      <div className="space-y-6">
        {/* Description Header */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-200">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="font-bold text-xl text-gray-800">{data.workflow_name || 'Unnamed Workflow'}</h3>
              <p className="text-sm text-gray-600 mt-2">{data.goal}</p>
              {data.trigger && (
                <p className="text-xs text-gray-500 mt-1">
                  <span className="font-medium">Trigger:</span> {data.trigger}
                </p>
              )}
            </div>
            <div className="text-xs text-gray-500">
              v{description.description_version}
            </div>
          </div>
        </div>

        {/* Actors */}
        {data.actors && (
          <div className="bg-white rounded-lg border p-4">
            <h4 className="font-semibold text-gray-800 mb-2">Actors & Integrations</h4>
            <ul className="space-y-1">
              {Array.isArray(data.actors) ? (
                data.actors.map((actor, i) => (
                  <li key={i} className="text-sm text-gray-700 flex items-start">
                    <span className="text-gray-400 mr-2">•</span>
                    {typeof actor === 'object' ? JSON.stringify(actor) : actor}
                  </li>
                ))
              ) : (
                <li className="text-sm text-gray-700 flex items-start">
                  <span className="text-gray-400 mr-2">•</span>
                  {data.actors}
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Happy Path */}
        {data.happy_path_steps && (
          <div className="bg-white rounded-lg border p-4">
            <h4 className="font-semibold text-gray-800 mb-2">Happy Path</h4>
            <ol className="space-y-2">
              {Array.isArray(data.happy_path_steps) ? (
                data.happy_path_steps.map((step, i) => (
                  <li key={i} className="text-sm text-gray-700 leading-relaxed">
                    {typeof step === 'object' ? 
                      (step.description || step.step || JSON.stringify(step)) : 
                      step}
                  </li>
                ))
              ) : (
                <li className="text-sm text-gray-700 leading-relaxed">
                  {data.happy_path_steps}
                </li>
              )}
            </ol>
          </div>
        )}

        {/* Decision Matrix */}
        {data.decision_matrix && Object.keys(data.decision_matrix).length > 0 && (
          <div className="bg-white rounded-lg border p-4">
            <h4 className="font-semibold text-gray-800 mb-2">Decision Matrix</h4>
            {Object.entries(data.decision_matrix).map(([category, rules]) => (
              <div key={category} className="mb-4">
                <h5 className="font-medium text-gray-700 mb-1">{category}</h5>
                <div className="ml-4 space-y-1">
                  {typeof rules === 'string' ? (
                    <p className="text-sm text-gray-700">{rules}</p>
                  ) : typeof rules === 'object' && rules !== null ? (
                    Object.entries(rules).map(([condition, action]) => (
                      <div key={condition} className="text-sm">
                        <span className="font-medium text-gray-600">{condition}:</span>
                        <span className="ml-2 text-gray-700">
                          {typeof action === 'object' ? JSON.stringify(action, null, 2) : action}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">Invalid format</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Data Contracts */}
        {data.data_contracts && Object.keys(data.data_contracts).length > 0 && (
          <div className="bg-white rounded-lg border p-4">
            <h4 className="font-semibold text-gray-800 mb-2">Data Contracts</h4>
            {Object.entries(data.data_contracts).map(([contract, fields]) => (
              <div key={contract} className="mb-3">
                <h5 className="font-medium text-gray-700 mb-1">{contract}</h5>
                <div className="ml-4 text-sm text-gray-600">
                  {typeof fields === 'string' ? (
                    <p>{fields}</p>
                  ) : typeof fields === 'object' && fields !== null ? (
                    <>
                      {fields.required && (
                        <div>
                          <span className="font-medium">Required:</span> {
                            Array.isArray(fields.required) ? fields.required.join(', ') : 
                            typeof fields.required === 'object' ? JSON.stringify(fields.required) :
                            fields.required
                          }
                        </div>
                      )}
                      {fields.optional && (
                        <div>
                          <span className="font-medium">Optional:</span> {
                            Array.isArray(fields.optional) ? fields.optional.join(', ') : 
                            typeof fields.optional === 'object' ? JSON.stringify(fields.optional) :
                            fields.optional
                          }
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-500">Invalid data format</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Business Rules */}
        {data.business_rules && (
          <div className="bg-white rounded-lg border p-4">
            <h4 className="font-semibold text-gray-800 mb-2">Business Rules</h4>
            <ul className="space-y-1">
              {Array.isArray(data.business_rules) ? (
                data.business_rules.map((rule, i) => (
                  <li key={i} className="text-sm text-gray-700 flex items-start">
                    <span className="text-gray-400 mr-2">•</span>
                    {typeof rule === 'object' ? (rule.rule || JSON.stringify(rule)) : rule}
                  </li>
                ))
              ) : (
                <li className="text-sm text-gray-700 flex items-start">
                  <span className="text-gray-400 mr-2">•</span>
                  {data.business_rules}
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Edge Cases */}
        {data.edge_case_policies && (
          <div className="bg-white rounded-lg border p-4">
            <h4 className="font-semibold text-gray-800 mb-2">Edge Case Policies</h4>
            {typeof data.edge_case_policies === 'string' ? (
              <p className="text-sm text-gray-700">{data.edge_case_policies}</p>
            ) : (
              Object.entries(data.edge_case_policies).map(([category, policies]) => (
                <div key={category} className="mb-3">
                  <h5 className="font-medium text-gray-700 mb-1">{category}</h5>
                  <div className="ml-4 space-y-1">
                    {typeof policies === 'string' ? (
                      <p className="text-sm text-gray-700">{policies}</p>
                    ) : (
                      Object.entries(policies).map(([scenario, policy]) => (
                        <div key={scenario} className="text-sm">
                          <span className="font-medium text-gray-600">{scenario}:</span>
                          <span className="ml-2 text-gray-700">
                            {typeof policy === 'object' ? JSON.stringify(policy) : policy}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Success Criteria */}
        {data.success_criteria && (
          <div className="bg-white rounded-lg border p-4">
            <h4 className="font-semibold text-gray-800 mb-2">Success Criteria</h4>
            <ul className="space-y-1">
              {Array.isArray(data.success_criteria) ? (
                data.success_criteria.map((criterion, i) => (
                  <li key={i} className="text-sm text-gray-700 flex items-start">
                    <span className="text-green-500 mr-2">✓</span>
                    {typeof criterion === 'object' ? JSON.stringify(criterion) : criterion}
                  </li>
                ))
              ) : (
                <li className="text-sm text-gray-700 flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  {data.success_criteria}
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Revision History */}
        {data.revision_history && data.revision_history.length > 0 && (
          <div className="bg-gray-50 rounded-lg border p-4">
            <h4 className="font-semibold text-gray-800 mb-2">Revision History</h4>
            <div className="space-y-2">
              {data.revision_history.map((rev, i) => (
                <div key={i} className="text-sm">
                  <span className="font-medium text-gray-600">v{rev.version}</span>
                  <span className="text-gray-500 mx-2">•</span>
                  <span className="text-gray-600">{new Date(rev.date).toLocaleString()}</span>
                  <span className="text-gray-500 mx-2">•</span>
                  <span className="text-gray-700">{typeof rev.changes === 'object' ? JSON.stringify(rev.changes) : rev.changes}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
    } catch (error) {
      console.error('Error rendering description:', error);
      return (
        <div className="text-center text-red-500 py-8">
          <p className="text-sm">Error displaying workflow description</p>
          <p className="text-xs mt-1">{error.message}</p>
        </div>
      );
    }
  };

  // PlanViewer Component - Displays structured plan as interactive to-do list
  const PlanViewer = ({ plan, workflowId }) => {
    if (!plan || !plan.plan_data) {
      return (
        <div className="text-center text-gray-500 py-4">
          <p className="text-sm">No plan available</p>
          <p className="text-xs mt-1">Director will create a plan when you start building</p>
        </div>
      );
    }

    const { plan_data } = plan;
    const { overall_goal, current_phase, phases, next_actions, blockers, notes } = plan_data;

    const getStatusIcon = (status) => {
      switch (status) {
        case 'completed': return '✅';
        case 'in_progress': return '🔄';
        case 'failed': return '❌';
        default: return '⏸️';
      }
    };

    const getStatusColor = (status) => {
      switch (status) {
        case 'completed': return 'text-green-600 bg-green-50';
        case 'in_progress': return 'text-blue-600 bg-blue-50';
        case 'failed': return 'text-red-600 bg-red-50';
        default: return 'text-gray-600 bg-gray-50';
      }
    };

    return (
      <div className="space-y-4">
        {/* Plan Header */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h4 className="font-semibold text-lg text-gray-800">{overall_goal}</h4>
              <p className="text-sm text-gray-600 mt-1">
                Current Phase: <span className="font-medium text-blue-700">{current_phase}</span>
              </p>
            </div>
            <div className="text-xs text-gray-500">
              v{plan.plan_version} • {new Date(plan.updated_at).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Phases */}
        <div className="space-y-3">
          {phases.map((phase, phaseIndex) => (
            <div key={phaseIndex} className="border rounded-lg bg-white">
              <div className="p-3 border-b bg-gray-50 rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{getStatusIcon(phase.status)}</span>
                    <h5 className="font-medium text-gray-800">{phase.phase_name}</h5>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(phase.status)}`}>
                    {phase.status}
                  </span>
                </div>
              </div>
              
              {/* Tasks */}
              {phase.tasks && phase.tasks.length > 0 && (
                <div className="p-3">
                  <div className="space-y-2">
                    {phase.tasks.map((task) => (
                      <div key={task.task_id} className="flex items-start space-x-3 p-2 rounded hover:bg-gray-50">
                        <span className="text-sm mt-0.5">{getStatusIcon(task.status)}</span>
                        <div className="flex-1">
                          <div className="text-sm text-gray-800">{task.description}</div>
                          {task.node_ids && task.node_ids.length > 0 && (
                            <div className="text-xs text-gray-500 mt-1">
                              Nodes: {task.node_ids.join(', ')}
                            </div>
                          )}
                          {task.notes && (
                            <div className="text-xs text-gray-600 mt-1 italic">{task.notes}</div>
                          )}
                        </div>
                        <span className={`px-2 py-1 rounded text-xs ${getStatusColor(task.status)}`}>
                          {task.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Next Actions */}
        {next_actions && next_actions.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <h6 className="font-medium text-yellow-800 mb-2">📋 Next Actions</h6>
            <ul className="space-y-1">
              {next_actions.map((action, index) => (
                <li key={index} className="text-sm text-yellow-700 flex items-start">
                  <span className="text-yellow-500 mr-2">•</span>
                  {action}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Blockers */}
        {blockers && blockers.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <h6 className="font-medium text-red-800 mb-2">🚧 Blockers</h6>
            <ul className="space-y-1">
              {blockers.map((blocker, index) => (
                <li key={index} className="text-sm text-red-700 flex items-start">
                  <span className="text-red-500 mr-2">•</span>
                  {blocker}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Notes */}
        {notes && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <h6 className="font-medium text-gray-800 mb-2">📝 Notes</h6>
            <p className="text-sm text-gray-700">{notes}</p>
          </div>
        )}
      </div>
    );
  };

  // NodeCard Component - Handles display of nodes including complex route and iterate nodes
  const NodeCard = ({ node, executeNode, depth = 0, expandedNodes, setExpandedNodes, loadNodeValues, currentWorkflow, nodeValues, selectedNodes = [], setSelectedNodes, isIterationContext = false }) => {
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
          data-node-position={node.position}
          className={`rounded-lg transition-all duration-300 ${isCompact ? 'p-2' : 'p-3'} ${depth > 0 ? 'shadow-sm hover:shadow-md' : 'shadow-md hover:shadow-lg'} ${
            selectedNodes.some(n => n.id === node.id) ? 'ring-2 ring-purple-500' : ''
          } cursor-pointer`}
          style={{
            ...depthStyles.card,
            borderLeftColor: nodeColor,
          }}
          onClick={(e) => {
            if (setSelectedNodes && !isIterationContext && depth === 0) {
              e.stopPropagation();
              const isSelected = selectedNodes.some(n => n.id === node.id);
              if (e.ctrlKey || e.metaKey) {
                // Multi-select with Ctrl/Cmd
                if (isSelected) {
                  setSelectedNodes(selectedNodes.filter(n => n.id !== node.id));
                } else {
                  setSelectedNodes([...selectedNodes, node]);
                }
              } else if (e.shiftKey && selectedNodes.length > 0) {
                // Range select with Shift
                const lastSelected = selectedNodes[selectedNodes.length - 1];
                const start = Math.min(lastSelected.position, node.position);
                const end = Math.max(lastSelected.position, node.position);
                const rangeNodes = currentWorkflow.nodes.filter(n => n.position >= start && n.position <= end);
                setSelectedNodes(rangeNodes);
              } else {
                // Single select
                setSelectedNodes([node]);
              }
            }
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
              {/* Show action for browser_ai_action nodes */}
              {node.type === 'browser_ai_action' && node.params?.action && (
                <span className="ml-1 text-gray-500">
                  · {node.params.action} (AI)
                </span>
              )}
              {/* Show method for browser_query nodes */}
              {node.type === 'browser_query' && node.params?.method && (
                <span className="ml-1 text-gray-500">
                  · {node.params.method}
                </span>
              )}
              {/* Show method for browser_ai_query nodes */}
              {node.type === 'browser_ai_query' && node.params?.method && (
                <span className="ml-1 text-gray-500">
                  · {node.params.method} (AI)
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
            {isGroup && (node.params?.nodeRange || node.config?.nodeRange) && (
              <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded">
                <div className="text-sm font-semibold text-purple-800 mb-1">
                  Group: {node.params?.name || node.config?.name || 'Unnamed Group'}
                </div>
                <div className="text-xs text-purple-700">
                  Executes nodes: 
                  <span className="font-mono bg-purple-100 px-1 ml-1 rounded text-purple-900">
                    {(() => {
                      const nodeRange = node.params?.nodeRange || node.config?.nodeRange;
                      return Array.isArray(nodeRange) 
                        ? `${nodeRange[0]}-${nodeRange[1]}` 
                        : nodeRange;
                    })()}
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
            nodeValues={nodeValues}
            selectedNodes={selectedNodes}
            setSelectedNodes={setSelectedNodes}
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
              nodeValues={nodeValues}
              selectedNodes={selectedNodes}
              setSelectedNodes={setSelectedNodes}
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

      // Add a temporary assistant message that can receive reasoning
      const tempAssistantMessage = {
        role: 'assistant',
        content: '', // Will be updated when response arrives
        reasoning: {
          text: '',
          isThinking: false
        },
        isTemporary: true
      };
      
      // Set this as the current reasoning message BEFORE adding the message
      const newMessageIndex = messages.length + 1; // +1 because we already added user message
      setCurrentReasoningMessageIndex(newMessageIndex);
      currentReasoningMessageIndexRef.current = newMessageIndex; // Also set the ref
      console.log('[SendMessage] Setting current reasoning message index to:', newMessageIndex);
      
      setMessages(prev => [...prev, tempAssistantMessage]);

      // Filter out debug_input and other large fields from conversation history
      // Also filter out archived messages - only send active messages to Director
      const cleanConversationHistory = messages
        .filter(msg => {
          // Exclude archived messages
          if (msg.isArchived) return false;
          // Exclude the compressed context message itself (it's in Part 7)
          if (msg.isCompressed) return false;
          return true;
        })
        .map(msg => {
        let content = msg.content;
        
        // For assistant messages, include reasoning and tool calls in the content
        if (msg.role === 'assistant') {
          const parts = [];
          
          // Add reasoning if present
          if (msg.reasoning?.text) {
            parts.push('[REASONING]');
            parts.push(msg.reasoning.text);
            parts.push('');
          }
          
          // Add tool calls if present
          if (msg.toolCalls && msg.toolCalls.length > 0) {
            parts.push('[TOOL CALLS]');
            msg.toolCalls.forEach(tc => {
              parts.push(`Tool: ${tc.toolName}`);
              parts.push(`Result: ${JSON.stringify(tc.result, null, 2)}`);
              parts.push('---');
            });
            parts.push('');
          }
          
          // Add the actual response
          parts.push('[RESPONSE]');
          parts.push(content);
          
          content = parts.join('\n');
        }
        
        return {
          role: msg.role,
          content
          // Exclude: toolCalls, reasoning, tokenUsage, debug_input
        };
      });

      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          workflowId,
          conversationHistory: cleanConversationHistory,
          mockMode,
          selectedModel: !mockMode ? selectedModel : undefined
        })
      });
      
      // Log the model being used
      console.log(`[UI] Sending message with model: ${!mockMode ? selectedModel : 'N/A (mock mode)'}`);
      if (!mockMode && selectedModel === 'o3') {
        console.log(`[UI] Note: o3 model uses background mode to handle rate limits`);
      }
      

      const data = await response.json();
      
      // Update the temporary message with actual response
      setMessages(prev => {
        const updated = [...prev];
        const lastMessage = updated[updated.length - 1];
        if (lastMessage && lastMessage.isTemporary) {
          updated[updated.length - 1] = {
            ...lastMessage,
            content: data.message,
            toolCalls: data.toolCalls,
            isTemporary: false,
            model: !mockMode ? selectedModel : 'mock',
            // Include reasoning summary if available (blocking response)
            reasoning: data.reasoning_summary ? {
              text: data.reasoning_summary,
              isThinking: false
            } : null,
            // Store token usage data
            tokenUsage: {
              input_tokens: data.input_tokens || 0,
              output_tokens: data.output_tokens || 0
            },
            // Store debug input for examination
            debug_input: data.debug_input
          };
        }
        return updated;
      });

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
        const nodeTools = ['create_node', 'create_workflow_sequence', 'insert_node_at', 'update_node', 'delete_node'];
        if (data.toolCalls.some(tc => nodeTools.includes(tc.toolName))) {
          await loadWorkflowNodes(workflowId);
        }
        
        // Refresh plan if update_plan was called
        if (data.toolCalls.some(tc => tc.toolName === 'update_plan')) {
          await loadCurrentPlan(workflowId);
        }
        
        // Refresh description if update_workflow_description was called
        if (data.toolCalls.some(tc => tc.toolName === 'update_workflow_description')) {
          await loadCurrentDescription(workflowId);
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Update the temporary message with error content
      setMessages(prev => {
        const updated = [...prev];
        const lastMessage = updated[updated.length - 1];
        if (lastMessage && lastMessage.isTemporary) {
          updated[updated.length - 1] = {
            ...lastMessage,
            content: 'Sorry, I encountered an error. Please try again.',
            isTemporary: false
          };
        } else {
          // Fallback: add new error message if temp message not found
          updated.push({
            role: 'assistant',
            content: 'Sorry, I encountered an error. Please try again.'
          });
        }
        return updated;
      });
    } finally {
      setIsLoading(false);
      setCurrentReasoningMessageIndex(null); // Clear reasoning tracking
      currentReasoningMessageIndexRef.current = null; // Clear ref too
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

  // Format pending tool call with animation
  const formatPendingToolCall = (callId, toolCall) => {
    return (
      <div key={callId} className="mt-2 animate-pulse">
        <div className="bg-gray-100 border border-gray-300 rounded-lg p-3">
          <div className="flex items-center space-x-2">
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            <span className="text-sm font-medium text-gray-700">
              Executing: {toolCall.toolName}
            </span>
          </div>
        </div>
      </div>
    );
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

    // Render page observation in a nice format
    const renderPageObservation = (observation) => {
      if (!observation) return null;
      
      return (
        <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs">
          <div className="flex items-start space-x-2">
            <span className="text-amber-600">🔍</span>
            <div className="flex-1">
              <div className="font-medium text-amber-700 mb-1">Page State:</div>
              <div className="text-gray-700 whitespace-pre-wrap">{observation}</div>
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
        <div className="flex justify-between items-start">
          <div className="font-semibold text-blue-700">{toolCall.toolName}</div>
          {toolCall.result?.id && toolCall.toolName === 'create_node' && (
            renderRunButton(toolCall.result.id)
          )}
        </div>
        
        {/* Handle execute_nodes with execution results and page observations */}
        {toolCall.toolName === 'execute_nodes' && toolCall.result?.execution_results && (
          <div className="mt-2 space-y-2">
            {toolCall.result.execution_results.map((result, index) => (
              <div key={index} className="p-2 bg-white rounded border">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <span className="font-medium text-xs">
                      Node {result.node_position}: 
                    </span>
                    <span className={`text-xs ml-2 ${
                      result.status === 'success' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {result.status === 'success' ? '✓ Success' : '✗ Failed'}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">
                      ({result.execution_time})
                    </span>
                  </div>
                </div>
                
                {/* Show the page observation if available */}
                {result.page_observation && renderPageObservation(result.page_observation)}
                
                {/* Show error details if failed */}
                {result.status === 'error' && result.error_details && (
                  <div className="mt-1 text-xs text-red-600">
                    Error: {result.error_details}
                  </div>
                )}
                
                {/* Show result if available and not too large */}
                {result.result && Object.keys(result.result).length > 0 && (
                  <div className="mt-1 text-xs text-gray-600">
                    <pre className="overflow-x-auto">
                      {JSON.stringify(result.result, null, 2).substring(0, 200)}
                      {JSON.stringify(result.result).length > 200 ? '...' : ''}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
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
        
        {/* Default display for other tools */}
        {toolCall.result && toolCall.toolName !== 'execute_nodes' && (
          <pre className="mt-1 text-xs overflow-x-auto">
            {JSON.stringify(toolCall.result, null, 2)}
          </pre>
        )}
      </div>
    );
  };

  return (
    <div className={`flex flex-col h-screen bg-gray-50 ${isResizing ? 'no-select' : ''}`}>
      {/* Success Message */}
      {showSuccessMessage && (
        <div className="bg-green-100 border-b border-green-400 text-green-700 px-4 py-3 flex items-center justify-between">
          <span className="flex items-center">
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {showSuccessMessage}
          </span>
          <button onClick={() => setShowSuccessMessage('')} className="text-green-700 hover:text-green-800">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}
      
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
          
          {/* Model Toggle - Only show when not in mock mode */}
          {!mockMode && (
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => {
                  setSelectedModel('o4-mini');
                  localStorage.setItem('director-selected-model', 'o4-mini');
                  console.log('[UI] Model switched to: o4-mini');
                }}
                className={`px-3 py-1 text-sm rounded transition-all ${
                  selectedModel === 'o4-mini'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                title="Use o4-mini model (default)"
              >
                o4-mini
              </button>
              <button
                onClick={() => {
                  setSelectedModel('o3');
                  localStorage.setItem('director-selected-model', 'o3');
                  console.log('[UI] Model switched to: o3');
                }}
                className={`px-3 py-1 text-sm rounded transition-all ${
                  selectedModel === 'o3'
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                title="Use o3 model"
              >
                o3
              </button>
              <button
                onClick={() => {
                  setSelectedModel('kimi-k2');
                  localStorage.setItem('director-selected-model', 'kimi-k2');
                  console.log('[UI] Model switched to: kimi-k2');
                }}
                className={`px-3 py-1 text-sm rounded transition-all ${
                  selectedModel === 'kimi-k2'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                title="Use KIMI K2 model (5x cheaper than GPT-4, excellent tool calling)"
              >
                KIMI K2
              </button>
            </div>
          )}
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
          {currentWorkflow?.id && messages.length > 0 && (
            <button
              onClick={async () => {
                if (confirm('Clear all conversation history for this workflow?')) {
                  try {
                    const response = await fetch(`${API_BASE}/workflows/${currentWorkflow.id}/conversations`, {
                      method: 'DELETE'
                    });
                    if (response.ok) {
                      setMessages([]);
                      console.log('Conversation history cleared');
                    }
                  } catch (error) {
                    console.error('Failed to clear conversation history:', error);
                  }
                }
              }}
              className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
              title="Clear conversation history"
            >
              Clear Chat
            </button>
          )}
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
            <div key={index}>
              {/* Show archived messages separator */}
              {index === 0 && message.isArchived && (
                <div className="mx-4 my-4 text-center text-xs text-gray-500">
                  <div className="flex items-center justify-center">
                    <div className="flex-1 border-t border-gray-300"></div>
                    <span className="px-3 bg-white">📚 Archived Messages (Read-Only)</span>
                    <div className="flex-1 border-t border-gray-300"></div>
                  </div>
                </div>
              )}
              {/* Show separator between archived and new messages */}
              {index > 0 && messages[index - 1].isArchived && !message.isArchived && (
                <div className="mx-4 my-4 text-center text-xs text-gray-500">
                  <div className="flex items-center justify-center">
                    <div className="flex-1 border-t border-gray-300"></div>
                    <span className="px-3 bg-white">✨ New Messages</span>
                    <div className="flex-1 border-t border-gray-300"></div>
                  </div>
                </div>
              )}
              {/* Special rendering for compressed context messages */}
              {message.isCompressed ? (
                <div className="mx-4 my-4">
                  <div className="border border-gray-300 rounded-lg bg-gray-50 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <span className="text-lg mr-2">📦</span>
                        <span className="font-semibold text-gray-700">Context Compressed</span>
                      </div>
                      {message.compressionStats && (
                        <span className="text-sm text-gray-500">
                          Reduced {message.compressionStats.originalMessageCount} messages to summary
                        </span>
                      )}
                    </div>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800">
                        ▶ Show Summary
                      </summary>
                      <div className="mt-2 p-3 bg-white rounded border border-gray-200">
                        <div className="text-sm text-gray-700 whitespace-pre-wrap">{message.content}</div>
                      </div>
                    </details>
                    <div className="mt-2 text-xs text-gray-500 text-center">
                      ─── Conversation compressed at {new Date(message.timestamp).toLocaleTimeString()} ───
                    </div>
                  </div>
                </div>
              ) : (
                <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} ${message.isArchived ? 'opacity-50' : ''}`}>
                  <div
                    className={`max-w-3xl px-4 py-2 rounded-lg ${
                      message.role === 'user'
                        ? message.isArchived ? 'bg-blue-400 text-white' : 'bg-blue-600 text-white'
                        : message.role === 'system'
                        ? 'bg-yellow-100 text-gray-800 border border-yellow-300'
                        : message.isArchived ? 'bg-gray-100 text-gray-700' : 'bg-gray-200 text-gray-800'
                    } ${message.isArchived ? 'border border-gray-300' : ''}`}
                  >
                {/* Reasoning component for assistant messages */}
                {message.role === 'assistant' && (message.reasoning || message.isTemporary) && (
                  <ReasoningComponent reasoning={message.reasoning || { text: '', isThinking: false }} />
                )}
                
                {/* Model indicator for assistant messages */}
                {message.role === 'assistant' && message.model && (
                  <div className="text-xs text-gray-500 mb-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100">
                      {message.model === 'o3' ? '🟢' : message.model === 'kimi-k2' ? '🟣' : '🔵'} {message.model}
                    </span>
                  </div>
                )}
                
                <div className="whitespace-pre-wrap">{message.content || '(No message - tool calls only)'}</div>
                
                {/* Display pending tool calls with animation */}
                {message.pendingToolCalls && Object.entries(message.pendingToolCalls).map(([callId, toolCall]) => 
                  formatPendingToolCall(callId, toolCall)
                )}
                
                {/* Display completed tool calls */}
                {message.toolCalls && message.toolCalls.map((toolCall, i) => (
                  <div key={i}>{formatToolCall(toolCall)}</div>
                ))}
                
                {/* Token usage component for assistant messages */}
                {message.role === 'assistant' && message.tokenUsage && (
                  <TokenUsageComponent tokenUsage={message.tokenUsage} />
                )}
                
                {/* Debug input button for assistant messages */}
                {message.role === 'assistant' && message.debug_input && (
                  <button
                    onClick={() => {
                      setDebugModalData(message.debug_input);
                      setDebugModalOpen(true);
                    }}
                    style={{
                      marginTop: '4px',
                      padding: '4px 8px',
                      fontSize: '10px',
                      backgroundColor: '#f3f4f6',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      color: '#374151',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = '#e5e7eb'}
                    onMouseOut={(e) => e.target.style.backgroundColor = '#f3f4f6'}
                  >
                    🔍 Examine Input ({message.debug_input.total_chars.toLocaleString()} chars)
                  </button>
                )}
                  </div>
                </div>
              )}
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

          {/* Compress Context Button */}
          {messages.length > 0 && (
            <div className="bg-gray-50 border-t px-4 py-2">
              <button
                onClick={() => setShowCompressConfirmation(true)}
                disabled={isLoading}
                className="px-4 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 text-sm font-medium flex items-center"
              >
                <span className="mr-2">⚡</span>
                Compress Context
              </button>
            </div>
          )}

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
              <div className="flex-1">
                <h3 className="font-semibold text-lg">
                  {mockMode ? 'Mock Workflow' : 'Workflow'}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {mockMode 
                    ? `${workflowNodes.length} nodes from response.json`
                    : currentWorkflow ? `${workflowNodes.length} nodes` : 'No workflow selected'
                  }
                  {currentWorkflow && workflowNodes.length > 1 && (
                    <span className="text-xs text-gray-500 ml-2">
                      (Click to select • Ctrl/Cmd for multi • Shift for range)
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {selectedNodes.length > 1 && (
                  <button
                    onClick={async () => {
                      const positions = selectedNodes.map(n => n.position).sort((a, b) => a - b);
                      const rangeStart = positions[0];
                      const rangeEnd = positions[positions.length - 1];
                      
                      const groupName = prompt(`Name for group (nodes ${rangeStart}-${rangeEnd}):`);
                      if (!groupName && !confirm('Create unnamed group?')) return;
                      
                      try {
                        const response = await fetch(`${API_BASE}/chat`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            message: `create_node({type: "group", config: {nodeRange: "${rangeStart}-${rangeEnd}", name: ${groupName ? `"${groupName}"` : 'undefined'}}, alias: "${groupName ? groupName.toLowerCase().replace(/\s+/g, '_') : `group_${rangeStart}_${rangeEnd}`}", description: "Groups nodes ${rangeStart} through ${rangeEnd}"})`,
                            workflowId: currentWorkflow.id,
                            conversationHistory: messages
                          })
                        });
                        
                        if (response.ok) {
                          await loadWorkflow(currentWorkflow.id);
                          setSelectedNodes([]);
                          setShowSuccessMessage(`Group created for nodes ${rangeStart}-${rangeEnd}`);
                          setTimeout(() => setShowSuccessMessage(''), 3000);
                        }
                      } catch (error) {
                        console.error('Error creating group:', error);
                        alert('Failed to create group: ' + error.message);
                      }
                    }}
                    className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                  >
                    Group Selected ({selectedNodes.length})
                  </button>
                )}
                <button
                  onClick={restartBrowser}
                  className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                  title="Start fresh browser (no cookies)"
                >
                  Start Fresh
                </button>
                <button
                  onClick={() => setShowSaveSessionDialog(true)}
                  className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                  title="Save current browser session"
                >
                  Save Session
                </button>
                <div className="relative">
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        loadBrowserSession(e.target.value);
                      }
                    }}
                    className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors appearance-none pr-8"
                    title="Load saved browser session"
                  >
                    <option value="">Load Session</option>
                    {browserSessions.map(session => (
                      <option key={session.id} value={session.name}>
                        {session.name} {session.last_used_at && `(${new Date(session.last_used_at).toLocaleDateString()})`}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
                    <svg className="w-3 h-3 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
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
          
          {/* Tabbed Control Panel */}
          {!mockMode && currentWorkflow && (
            <div className="border-b bg-white">
              {/* Tab Headers */}
              <div className="flex border-b bg-gray-50">
                <button
                  onClick={() => setActiveTab('description')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'description'
                      ? 'text-purple-700 border-b-2 border-purple-700 bg-white'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Description
                </button>
                <button
                  onClick={() => setActiveTab('plan')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'plan'
                      ? 'text-blue-700 border-b-2 border-blue-700 bg-white'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Plan
                </button>
                <button
                  onClick={() => setActiveTab('variables')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'variables'
                      ? 'text-blue-700 border-b-2 border-blue-700 bg-white'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Variables
                  {variables.length > 0 && (
                    <span className="ml-1 inline-block bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                      {variables.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('browser')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'browser'
                      ? 'text-blue-700 border-b-2 border-blue-700 bg-white'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Browser State
                  {browserState?.rawState?.tabs?.length > 0 && (
                    <span className="ml-1 inline-block bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">
                      {browserState.rawState.tabs.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('reasoning')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'reasoning'
                      ? 'text-purple-700 border-b-2 border-purple-700 bg-white'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  AI Reasoning
                  {isThinking && (
                    <span className="ml-2 inline-block w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('tokens')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'tokens'
                      ? 'text-green-700 border-b-2 border-green-700 bg-white'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Tokens
                  {tokenStats && tokenStats.totals.total_tokens > 100000 && (
                    <span className="ml-2 inline-block w-2 h-2 bg-orange-500 rounded-full" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('groups')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'groups'
                      ? 'text-teal-700 border-b-2 border-teal-700 bg-white'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  Groups
                  {currentWorkflow?.nodes?.filter(n => n.type === 'group').length > 0 && (
                    <span className="ml-1 inline-block bg-teal-100 text-teal-800 text-xs px-2 py-0.5 rounded-full">
                      {currentWorkflow.nodes.filter(n => n.type === 'group').length}
                    </span>
                  )}
                </button>
              </div>
              
              {/* Tab Content */}
              <div className="p-4 max-h-96 overflow-y-auto">
                {activeTab === 'description' && (
                  <DescriptionViewer description={currentDescription} workflowId={currentWorkflow?.id} />
                )}
                {activeTab === 'plan' && (
                  <PlanViewer plan={currentPlan} workflowId={currentWorkflow?.id} />
                )}
                {activeTab === 'variables' && (
                  <VariablesViewer variables={variables} workflowId={currentWorkflow?.id} />
                )}
                {activeTab === 'browser' && (
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-sm font-medium text-gray-900 mb-3">Director's Browser View</h3>
                      <div className="bg-white rounded border p-3">
                        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                          {browserState?.formattedDisplay || 'BROWSER STATE:\nNo browser session active'}
                        </pre>
                      </div>
                    </div>
                    
                    {browserState?.rawState && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-gray-900 mb-3">Raw Browser State</h3>
                        <div className="bg-white rounded border p-3">
                          <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono overflow-auto max-h-64">
                            {JSON.stringify(browserState.rawState, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {activeTab === 'reasoning' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-gray-700">AI Reasoning Sessions</div>
                        <div className={`w-2 h-2 rounded-full ${reasoningConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-xs text-gray-500">
                          {reasoningConnected ? 'Connected' : 'Disconnected'}
                        </span>
                      </div>
                      {reasoningSessions.length > 0 && (
                        <button
                          onClick={() => setReasoningSessions([])}
                          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                    
                    {reasoningSessions.length > 0 ? (
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {reasoningSessions.map((session, index) => (
                          <div key={session.id} className="bg-gray-50 border rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-xs font-medium text-gray-600">
                                Session {index + 1} • {session.timestamp.toLocaleTimeString()}
                                {session.messageIndex !== null && (
                                  <span className="ml-2 bg-blue-100 text-blue-700 px-1 rounded">
                                    Message #{session.messageIndex + 1}
                                  </span>
                                )}
                              </div>
                              {session.isThinking && (
                                <span className="inline-block w-2 h-2 bg-purple-500 animate-pulse rounded-full" />
                              )}
                            </div>
                            <div className="text-sm font-mono text-gray-800 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
                              {session.text || (session.isThinking ? 'AI is thinking...' : 'No reasoning text')}
                            </div>
                            <div className="text-xs text-gray-400 mt-2">
                              Length: {session.text.length} • {session.isThinking ? 'In Progress' : 'Completed'}
                              {session.completedAt && (
                                <span> • Finished at {session.completedAt.toLocaleTimeString()}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center text-gray-500 py-8">
                        <div className="text-2xl mb-2">🧠</div>
                        <p className="text-sm">No reasoning sessions yet</p>
                        <p className="text-xs mt-1">AI reasoning will appear here when available</p>
                      </div>
                    )}
                  </div>
                )}
                {activeTab === 'tokens' && (
                  <TokenViewer tokenStats={tokenStats} />
                )}
                {activeTab === 'groups' && (
                  <GroupsViewer 
                    workflow={currentWorkflow}
                    onDeleteGroup={async (nodeId) => {
                      if (confirm('Are you sure you want to delete this group node?')) {
                        try {
                          await deleteNode(nodeId);
                          await loadWorkflow(currentWorkflow.id);
                        } catch (error) {
                          console.error('Error deleting group node:', error);
                          alert('Failed to delete group node: ' + error.message);
                        }
                      }
                    }}
                    onGoToNode={(position) => {
                      // Scroll to the node in the workflow view
                      setActiveTab('workflow');
                      setTimeout(() => {
                        const nodeElement = document.querySelector(`[data-node-position="${position}"]`);
                        if (nodeElement) {
                          nodeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          nodeElement.style.boxShadow = '0 0 20px rgba(147, 51, 234, 0.8)';
                          setTimeout(() => {
                            nodeElement.style.boxShadow = '';
                          }, 2000);
                        }
                      }, 100);
                    }}
                    onRefresh={() => loadWorkflow(currentWorkflow.id)}
                  />
                )}
              </div>
            </div>
          )}
          
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
                        nodeValues={nodeValues}
                        selectedNodes={selectedNodes}
                        setSelectedNodes={setSelectedNodes}
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
      
      {/* Compress Context Confirmation Dialog */}
      {showCompressConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <span className="mr-2">⚡</span>
              Compress Conversation History?
            </h3>
            
            <div className="mb-6 text-sm text-gray-700 space-y-2">
              <p>This will:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Compress {messages.filter(m => !m.isArchived && !m.isCompressed && (m.role === 'user' || m.role === 'assistant')).length} new messages since last compression</li>
                <li>Preserve all workflow progress and context</li>
                <li>Keep previous messages visible but archived</li>
                <li>Cannot be undone</li>
              </ul>
              {messages.some(m => m.isCompressed) && (
                <p className="text-xs text-gray-500 mt-2">
                  Previous compression found - will build on existing summary
                </p>
              )}
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCompressConfirmation(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={compressContext}
                className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                Compress
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Save Session Dialog */}
      {showSaveSessionDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Save Browser Session</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Session Name *
              </label>
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Google & Airtable logged in"
                autoFocus
              />
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <textarea
                value={sessionDescription}
                onChange={(e) => setSessionDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="3"
                placeholder="e.g., Logged into Google workspace and Airtable with admin account"
              />
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowSaveSessionDialog(false);
                  setSessionName('');
                  setSessionDescription('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveBrowserSession}
                className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                Save Session
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Session Management Dropdown (for deletion) */}
      {browserSessions.length > 0 && (
        <div className="fixed bottom-4 right-4">
          <details className="relative">
            <summary className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded cursor-pointer hover:bg-gray-200 transition-colors">
              Manage Sessions ({browserSessions.length})
            </summary>
            <div className="absolute bottom-full right-0 mb-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg">
              <div className="p-2">
                <h4 className="text-xs font-semibold text-gray-600 mb-2">Saved Sessions</h4>
                {browserSessions.map(session => (
                  <div key={session.id} className="flex items-center justify-between py-1 px-2 hover:bg-gray-50 rounded">
                    <div className="flex-1">
                      <div className="text-sm font-medium">{session.name}</div>
                      {session.description && (
                        <div className="text-xs text-gray-500">{session.description}</div>
                      )}
                    </div>
                    <button
                      onClick={() => deleteBrowserSession(session.name)}
                      className="ml-2 text-red-600 hover:text-red-800 text-xs"
                      title="Delete session"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </details>
        </div>
      )}
      
      {/* Debug Input Modal */}
      <DebugInputModal 
        debugInput={debugModalData}
        isOpen={debugModalOpen}
        onClose={() => {
          setDebugModalOpen(false);
          setDebugModalData(null);
        }}
      />
    </div>
  );
}

// Render the app
ReactDOM.render(<App />, document.getElementById('root'));