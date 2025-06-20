const { useState, useEffect } = React;

function App() {
  const [connected, setConnected] = useState(false);
  const [workflows, setWorkflows] = useState([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [executing, setExecuting] = useState(false);
  const [logs, setLogs] = useState([]);
  const [state, setState] = useState({});
  const [executionMode, setExecutionMode] = useState('full'); // full, phase, node
  const [selectedItems, setSelectedItems] = useState([]);

  // Connect to backend
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
      
      // Set execution options based on mode
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Workflow Runner</h1>
              <p className="text-sm text-gray-500 mt-1">Unified Architecture</p>
            </div>
            <div className="flex items-center gap-2">
              <div className={`px-3 py-1 rounded-full text-sm ${
                connected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {connected ? '● Connected' : '○ Disconnected'}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Sidebar - Workflow Selection */}
        <div className="w-64 bg-white border-r p-4 overflow-y-auto">
          <h2 className="font-semibold text-gray-700 mb-3">Workflows</h2>
          <div className="space-y-2">
            {workflows.map(w => (
              <button
                key={w.id}
                onClick={() => loadWorkflow(w.id)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  selectedWorkflow?.id === w.id
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="font-medium">{w.name}</div>
                <div className="text-xs text-gray-500">{w.id}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {selectedWorkflow ? (
            <>
              {/* Workflow Details */}
              <div className="bg-white border-b p-6">
                <h2 className="text-xl font-semibold mb-2">{selectedWorkflow.name}</h2>
                <p className="text-gray-600 mb-4">{selectedWorkflow.description}</p>
                
                {/* Execution Mode Selector */}
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-sm font-medium text-gray-700">Run:</span>
                  <div className="flex gap-2">
                    {['full', 'phase', 'node'].map(mode => (
                      <button
                        key={mode}
                        onClick={() => {
                          setExecutionMode(mode);
                          setSelectedItems([]);
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          executionMode === mode
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {mode === 'full' ? 'Full Workflow' : mode === 'phase' ? 'Phases' : 'Nodes'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Phase/Node Selection */}
                {executionMode !== 'full' && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">
                      Select {executionMode === 'phase' ? 'Phases' : 'Nodes'}:
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {executionMode === 'phase' && selectedWorkflow.phases && 
                        Object.entries(selectedWorkflow.phases).map(([key, phase]) => (
                          <button
                            key={key}
                            onClick={() => toggleItemSelection(key)}
                            className={`px-3 py-1 rounded-full text-sm transition-colors ${
                              selectedItems.includes(key)
                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {phase.name || key}
                          </button>
                        ))
                      }
                      {executionMode === 'node' && selectedWorkflow.nodes &&
                        Object.entries(selectedWorkflow.nodes).map(([key, node]) => (
                          <button
                            key={key}
                            onClick={() => toggleItemSelection(key)}
                            className={`px-3 py-1 rounded-full text-sm transition-colors ${
                              selectedItems.includes(key)
                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {key}
                          </button>
                        ))
                      }
                    </div>
                  </div>
                )}

                {/* Execute Button */}
                <button
                  onClick={executeWorkflow}
                  disabled={executing || !connected || (executionMode !== 'full' && selectedItems.length === 0)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {executing ? 'Running...' : 'Execute'}
                </button>
              </div>

              {/* Logs and State */}
              <div className="flex-1 flex">
                {/* Logs Panel */}
                <div className="flex-1 bg-gray-900 p-4 overflow-y-auto">
                  <h3 className="text-white font-mono text-sm mb-2">Logs</h3>
                  <div className="font-mono text-xs space-y-1">
                    {logs.map((log, i) => (
                      <div key={i} className={`${
                        log.type === 'error' ? 'text-red-400' :
                        log.type === 'success' ? 'text-green-400' :
                        'text-gray-300'
                      }`}>
                        <span className="text-gray-500">[{log.timestamp}]</span> {log.message}
                      </div>
                    ))}
                  </div>
                </div>

                {/* State Panel */}
                <div className="w-96 bg-gray-800 p-4 overflow-y-auto border-l border-gray-700">
                  <h3 className="text-white font-mono text-sm mb-2">State</h3>
                  <pre className="text-gray-300 text-xs">
                    {JSON.stringify(state, null, 2)}
                  </pre>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Select a workflow to begin
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Render the app (React 18)
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));