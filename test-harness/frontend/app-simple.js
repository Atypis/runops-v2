// Simple frontend without JSX
const { useState, useEffect, createElement: h } = React;

function App() {
  const [connected, setConnected] = useState(false);
  const [workflows, setWorkflows] = useState([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [executing, setExecuting] = useState(false);
  const [logs, setLogs] = useState([]);
  const [state, setState] = useState({});
  const [executionMode, setExecutionMode] = useState('full');
  const [selectedItems, setSelectedItems] = useState([]);

  useEffect(() => {
    connect();
    loadWorkflows();
  }, []);

  const connect = async () => {
    try {
      const res = await fetch('/connect', { method: 'POST' });
      const data = await res.json();
      setConnected(data.success);
      addLog('✅ Connected to StageHand', 'success');
    } catch (error) {
      addLog('❌ Failed to connect: ' + error.message, 'error');
    }
  };

  const loadWorkflows = async () => {
    try {
      const res = await fetch('/workflows');
      const data = await res.json();
      setWorkflows(data.workflows || []);
    } catch (error) {
      addLog('❌ Failed to load workflows', 'error');
    }
  };

  const loadWorkflow = async (workflowId) => {
    try {
      const res = await fetch(`/workflows/${workflowId}`);
      const data = await res.json();
      setSelectedWorkflow(data);
      setSelectedItems([]);
      addLog(`📋 Loaded workflow: ${data.name}`, 'info');
    } catch (error) {
      addLog('❌ Failed to load workflow details', 'error');
    }
  };

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, type }]);
  };

  const executeWorkflow = async () => {
    if (!selectedWorkflow) return;
    
    setExecuting(true);
    addLog(`🚀 Starting ${executionMode} execution...`, 'info');

    try {
      const options = {};
      
      if (executionMode === 'phase' && selectedItems.length > 0) {
        options.only = selectedItems.map(item => `phase:${item}`);
      } else if (executionMode === 'node' && selectedItems.length > 0) {
        options.only = selectedItems.map(item => `node:${item}`);
      }

      const res = await fetch(`/workflows/${selectedWorkflow.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ options })
      });

      const data = await res.json();
      
      if (data.success) {
        setState(data.state || {});
        addLog('✅ Execution completed!', 'success');
      } else {
        addLog(`❌ Execution failed: ${data.error}`, 'error');
      }
    } catch (error) {
      addLog(`❌ Error: ${error.message}`, 'error');
    } finally {
      setExecuting(false);
    }
  };

  const toggleItemSelection = (itemName) => {
    setSelectedItems(prev => {
      if (prev.includes(itemName)) {
        return prev.filter(i => i !== itemName);
      } else {
        return [...prev, itemName];
      }
    });
  };

  // Render the UI
  return h('div', { style: { fontFamily: 'system-ui', margin: 0, padding: 0 } },
    // Header
    h('div', { style: { background: '#1f2937', color: 'white', padding: '1rem' } },
      h('h1', { style: { margin: 0, fontSize: '1.5rem' } }, 'Workflow Runner'),
      h('p', { style: { margin: 0, fontSize: '0.875rem', opacity: 0.8 } }, 'Unified Architecture'),
      h('div', { style: { position: 'absolute', top: '1rem', right: '1rem' } },
        h('span', { 
          style: { 
            padding: '0.5rem 1rem', 
            borderRadius: '9999px',
            background: connected ? '#10b981' : '#ef4444',
            color: 'white',
            fontSize: '0.875rem'
          } 
        }, connected ? '● Connected' : '○ Disconnected')
      )
    ),

    h('div', { style: { display: 'flex', height: 'calc(100vh - 73px)' } },
      // Sidebar
      h('div', { style: { width: '300px', background: '#f3f4f6', padding: '1rem', overflowY: 'auto' } },
        h('h2', { style: { margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: 600 } }, 'Workflows'),
        ...workflows.map(w => 
          h('button', {
            key: w.id,
            onClick: () => loadWorkflow(w.id),
            style: {
              display: 'block',
              width: '100%',
              padding: '0.75rem',
              marginBottom: '0.5rem',
              background: selectedWorkflow?.id === w.id ? '#3b82f6' : 'white',
              color: selectedWorkflow?.id === w.id ? 'white' : 'black',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
              textAlign: 'left',
              cursor: 'pointer'
            }
          },
            h('div', { style: { fontWeight: 500 } }, w.name),
            h('div', { style: { fontSize: '0.75rem', opacity: 0.7 } }, w.id)
          )
        )
      ),

      // Main content
      h('div', { style: { flex: 1, display: 'flex', flexDirection: 'column' } },
        selectedWorkflow ? [
          // Workflow details
          h('div', { style: { background: 'white', padding: '1.5rem', borderBottom: '1px solid #e5e7eb' } },
            h('h2', { style: { margin: '0 0 0.5rem 0', fontSize: '1.25rem' } }, selectedWorkflow.name),
            h('p', { style: { margin: '0 0 1rem 0', color: '#6b7280' } }, selectedWorkflow.description),
            
            // Mode selector
            h('div', { style: { marginBottom: '1rem' } },
              h('span', { style: { marginRight: '1rem', fontWeight: 500 } }, 'Run:'),
              ...['full', 'phase', 'node'].map(mode =>
                h('button', {
                  key: mode,
                  onClick: () => { setExecutionMode(mode); setSelectedItems([]); },
                  style: {
                    padding: '0.5rem 1rem',
                    marginRight: '0.5rem',
                    background: executionMode === mode ? '#3b82f6' : '#e5e7eb',
                    color: executionMode === mode ? 'white' : 'black',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: 'pointer'
                  }
                }, mode === 'full' ? 'Full Workflow' : mode === 'phase' ? 'Phases' : 'Nodes')
              )
            ),

            // Item selection
            executionMode !== 'full' && h('div', { style: { marginBottom: '1rem' } },
              h('div', { style: { marginBottom: '0.5rem', fontWeight: 500 } }, 
                `Select ${executionMode === 'phase' ? 'Phases' : 'Nodes'}:`
              ),
              h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' } },
                ...(executionMode === 'phase' && selectedWorkflow.phases ? 
                  Object.entries(selectedWorkflow.phases).map(([key, phase]) =>
                    h('button', {
                      key,
                      onClick: () => toggleItemSelection(key),
                      style: {
                        padding: '0.25rem 0.75rem',
                        background: selectedItems.includes(key) ? '#dbeafe' : '#f3f4f6',
                        color: selectedItems.includes(key) ? '#1e40af' : '#374151',
                        border: selectedItems.includes(key) ? '1px solid #60a5fa' : '1px solid #e5e7eb',
                        borderRadius: '9999px',
                        fontSize: '0.875rem',
                        cursor: 'pointer'
                      }
                    }, phase.name || key)
                  ) : []
                ),
                ...(executionMode === 'node' && selectedWorkflow.nodes ?
                  Object.entries(selectedWorkflow.nodes).map(([key, node]) =>
                    h('button', {
                      key,
                      onClick: () => toggleItemSelection(key),
                      style: {
                        padding: '0.25rem 0.75rem',
                        background: selectedItems.includes(key) ? '#dbeafe' : '#f3f4f6',
                        color: selectedItems.includes(key) ? '#1e40af' : '#374151',
                        border: selectedItems.includes(key) ? '1px solid #60a5fa' : '1px solid #e5e7eb',
                        borderRadius: '9999px',
                        fontSize: '0.875rem',
                        cursor: 'pointer'
                      }
                    }, key)
                  ) : []
                )
              )
            ),

            // Execute button
            h('button', {
              onClick: executeWorkflow,
              disabled: executing || !connected || (executionMode !== 'full' && selectedItems.length === 0),
              style: {
                padding: '0.5rem 1.5rem',
                background: executing || !connected ? '#9ca3af' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                fontWeight: 500,
                cursor: executing || !connected ? 'not-allowed' : 'pointer'
              }
            }, executing ? 'Running...' : 'Execute')
          ),

          // Logs and State panels
          h('div', { style: { flex: 1, display: 'flex' } },
            // Logs
            h('div', { style: { flex: 1, background: '#1f2937', color: 'white', padding: '1rem', overflowY: 'auto' } },
              h('h3', { style: { margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontFamily: 'monospace' } }, 'Logs'),
              ...logs.map((log, i) =>
                h('div', {
                  key: i,
                  style: {
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    marginBottom: '0.25rem',
                    color: log.type === 'error' ? '#ef4444' : log.type === 'success' ? '#10b981' : '#e5e7eb'
                  }
                },
                  h('span', { style: { color: '#6b7280' } }, `[${log.timestamp}] `),
                  log.message
                )
              )
            ),

            // State
            h('div', { style: { width: '400px', background: '#374151', color: 'white', padding: '1rem', overflowY: 'auto' } },
              h('h3', { style: { margin: '0 0 0.5rem 0', fontSize: '0.875rem', fontFamily: 'monospace' } }, 'State'),
              h('pre', { style: { margin: 0, fontSize: '0.75rem', fontFamily: 'monospace', color: '#e5e7eb' } },
                JSON.stringify(state, null, 2)
              )
            )
          )
        ] : h('div', { 
          style: { 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#6b7280'
          } 
        }, 'Select a workflow to begin')
      )
    )
  );
}

// Render
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));