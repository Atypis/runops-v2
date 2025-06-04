'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MockLogEntry } from '@/lib/mock-aef-data';
import { Button } from '@/components/ui/button';
import { ScrollText, Download, Filter, Trash2, AlertCircle, CheckCircle2, Info, Clock } from 'lucide-react';

interface ExecutionLogProps {
  executionId?: string;
  mockLogs?: MockLogEntry[];
}

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'success';
  category: 'system' | 'step' | 'browser' | 'checkpoint';
  message: string;
  details?: string;
  stepId?: string;
  stepName?: string;
}

const ExecutionLog: React.FC<ExecutionLogProps> = ({
  executionId,
  mockLogs
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Use mock logs when available
  useEffect(() => {
    if (mockLogs) {
      setLogs(mockLogs);
    } else if (executionId) {
      // Add some initial logs
      const initialLogs: LogEntry[] = [
        {
          id: '1',
          timestamp: new Date(Date.now() - 30000),
          level: 'info',
          category: 'system',
          message: 'Execution started',
          details: `Execution ID: ${executionId}`
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 25000),
          level: 'info',
          category: 'browser',
          message: 'Browser session initialized',
          details: 'Chrome browser launched successfully'
        },
        {
          id: '3',
          timestamp: new Date(Date.now() - 20000),
          level: 'info',
          category: 'step',
          message: 'Starting step execution',
          stepId: 'step-1',
          stepName: 'Navigate to Gmail'
        }
      ];
      setLogs(initialLogs);

      // Simulate real-time log updates
      const interval = setInterval(() => {
        const newLog: LogEntry = {
          id: Date.now().toString(),
          timestamp: new Date(),
          level: Math.random() > 0.8 ? 'warning' : 'info',
          category: ['system', 'step', 'browser', 'checkpoint'][Math.floor(Math.random() * 4)] as any,
          message: [
            'Browser action completed',
            'Checkpoint approval received',
            'Step transition in progress',
            'Screenshot captured',
            'Page loaded successfully'
          ][Math.floor(Math.random() * 5)]
        };
        
        setLogs(prev => [...prev, newLog]);
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [executionId, mockLogs]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const getLevelIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return 'border-l-red-500 bg-red-50';
      case 'warning':
        return 'border-l-yellow-500 bg-yellow-50';
      case 'success':
        return 'border-l-green-500 bg-green-50';
      default:
        return 'border-l-blue-500 bg-blue-50';
    }
  };

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    return log.level === filter;
  });

  const handleClearLogs = () => {
    setLogs([]);
  };

  const handleDownloadLogs = () => {
    const logText = logs.map(log => 
      `[${log.timestamp.toISOString()}] ${log.level.toUpperCase()} - ${log.category}: ${log.message}${log.details ? ` | ${log.details}` : ''}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `execution-log-${executionId || 'unknown'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="execution-log h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center">
              <ScrollText className="w-4 h-4 mr-2" />
              Execution Log
            </h3>
            <div className="text-xs text-gray-500">
              {filteredLogs.length} entries
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Filter buttons */}
            <div className="flex border border-gray-200 rounded">
              {(['all', 'error', 'warning', 'info'] as const).map((filterType) => (
                <button
                  key={filterType}
                  onClick={() => setFilter(filterType)}
                  className={`px-2 py-1 text-xs font-medium capitalize ${
                    filter === filterType
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {filterType}
                </button>
              ))}
            </div>
            
            {/* Auto-scroll toggle */}
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`p-1 rounded text-xs ${
                autoScroll ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
              title="Auto-scroll to bottom"
            >
              ↓
            </button>
            
            {/* Action buttons */}
            <Button
              onClick={handleDownloadLogs}
              variant="outline"
              size="sm"
              disabled={logs.length === 0}
            >
              <Download className="w-3 h-3" />
            </Button>
            
            <Button
              onClick={handleClearLogs}
              variant="outline"
              size="sm"
              disabled={logs.length === 0}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Log Content */}
      <div 
        ref={logContainerRef}
        className="flex-1 overflow-y-auto text-sm"
        onScroll={(e) => {
          const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
          const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5;
          setAutoScroll(isAtBottom);
        }}
      >
        {filteredLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            {executionId ? (
              <div className="text-center">
                <Clock className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p>Waiting for execution activity...</p>
              </div>
            ) : (
              <div className="text-center">
                <ScrollText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p>No active execution</p>
                <p className="text-xs mt-1">Logs will appear here during workflow execution</p>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredLogs.map((log, index) => (
              <div 
                key={log.id}
                className={`p-3 border-l-2 ${getLevelColor(log.level)} hover:bg-gray-50`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    {getLevelIcon(log.level)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-medium text-gray-900">
                          {log.message}
                        </span>
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded uppercase">
                          {log.category}
                        </span>
                      </div>
                      
                      {log.stepName && (
                        <div className="text-xs text-gray-600 mb-1">
                          Step: {log.stepName}
                        </div>
                      )}
                      
                      {log.details && (
                        <div className="text-xs text-gray-600 break-words">
                          {log.details}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500 ml-4 flex-shrink-0">
                    {log.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Footer */}
      {executionId && (
        <div className="p-2 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div>Session: {executionId.slice(-8)}</div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Live updates</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutionLog; 