import React from 'react';

interface ExecutionLogsProps {
  workflowId: string;
}

const ExecutionLogs: React.FC<ExecutionLogsProps> = ({ workflowId }) => {
  // Mock logs for demo
  const logs = [
    {
      id: '1',
      timestamp: '2024-01-15T10:30:15Z',
      level: 'info' as const,
      message: 'Execution plan generated successfully',
      step_id: 'step_1',
    },
    {
      id: '2',
      timestamp: '2024-01-15T10:30:16Z',
      level: 'info' as const,
      message: 'Starting browser agent initialization',
    },
    {
      id: '3',
      timestamp: '2024-01-15T10:30:18Z',
      level: 'success' as const,
      message: 'Browser agent connected successfully',
    },
    {
      id: '4',
      timestamp: '2024-01-15T10:30:20Z',
      level: 'info' as const,
      message: 'Executing step 1: Open Gmail',
      step_id: 'step_1',
    },
    {
      id: '5',
      timestamp: '2024-01-15T10:30:23Z',
      level: 'success' as const,
      message: 'Successfully navigated to Gmail inbox',
      step_id: 'step_1',
    },
    {
      id: '6',
      timestamp: '2024-01-15T10:30:25Z',
      level: 'warning' as const,
      message: 'Step 3 requires human approval before proceeding',
      step_id: 'step_3',
    },
    {
      id: '7',
      timestamp: '2024-01-15T10:30:27Z',
      level: 'info' as const,
      message: 'Waiting for human approval on decision step',
      step_id: 'step_3',
    },
    {
      id: '8',
      timestamp: '2024-01-15T10:30:30Z',
      level: 'error' as const,
      message: 'Failed to locate email element - retrying with fallback selector',
      step_id: 'step_2',
    },
  ];

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'success': return 'text-success-600 bg-success-50';
      case 'warning': return 'text-warning-600 bg-warning-50';
      case 'error': return 'text-danger-600 bg-danger-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      default: return 'ℹ️';
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Execution Logs</h3>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-success-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-gray-600">Live</span>
        </div>
      </div>

      {/* Log Controls */}
      <div className="flex items-center space-x-4">
        <select className="text-sm border border-gray-300 rounded px-3 py-1">
          <option>All Levels</option>
          <option>Info</option>
          <option>Success</option>
          <option>Warning</option>
          <option>Error</option>
        </select>
        <button className="text-sm text-primary-600 hover:text-primary-700">
          Clear Logs
        </button>
        <button className="text-sm text-primary-600 hover:text-primary-700">
          Export
        </button>
      </div>

      {/* Logs Container */}
      <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto font-mono text-sm">
        <div className="space-y-2">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start space-x-3">
              <span className="text-gray-400 text-xs mt-0.5 w-20 flex-shrink-0">
                {formatTime(log.timestamp)}
              </span>
              <span className="text-xs mt-0.5">
                {getLevelIcon(log.level)}
              </span>
              <div className="flex-1">
                <span className="text-gray-300">
                  {log.message}
                </span>
                {log.step_id && (
                  <span className="text-primary-400 ml-2">
                    [{log.step_id}]
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Log Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-lg font-bold text-gray-900">
            {logs.filter(l => l.level === 'info').length}
          </div>
          <div className="text-xs text-gray-500">Info</div>
        </div>
        
        <div className="text-center p-3 bg-success-50 rounded-lg">
          <div className="text-lg font-bold text-success-600">
            {logs.filter(l => l.level === 'success').length}
          </div>
          <div className="text-xs text-gray-500">Success</div>
        </div>
        
        <div className="text-center p-3 bg-warning-50 rounded-lg">
          <div className="text-lg font-bold text-warning-600">
            {logs.filter(l => l.level === 'warning').length}
          </div>
          <div className="text-xs text-gray-500">Warning</div>
        </div>
        
        <div className="text-center p-3 bg-danger-50 rounded-lg">
          <div className="text-lg font-bold text-danger-600">
            {logs.filter(l => l.level === 'error').length}
          </div>
          <div className="text-xs text-gray-500">Error</div>
        </div>
      </div>
    </div>
  );
};

export default ExecutionLogs; 