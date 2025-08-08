import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Terminal, 
  Eye, 
  Brain, 
  MousePointer, 
  Copy, 
  ChevronDown, 
  ChevronRight,
  Clock,
  AlertCircle,
  CheckCircle,
  Zap,
  Code,
  Globe
} from 'lucide-react';

interface NodeLogEntry {
  timestamp: string;
  type: 'prompt' | 'accessibility_tree' | 'llm_response' | 'action' | 'screenshot' | 'error' | 'success';
  title: string;
  content: string;
  metadata?: {
    actionType?: string;
    duration?: number;
    url?: string;
    selector?: string;
    confidence?: number;
  };
}

interface NodeLogViewerProps {
  nodeId: string;
  nodeName: string;
  executionId?: string;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}

const NodeLogViewer: React.FC<NodeLogViewerProps> = ({
  nodeId,
  nodeName,
  executionId,
  isExpanded,
  onToggleExpanded
}) => {
  const [logs, setLogs] = useState<NodeLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom only if user is already at the bottom
  useEffect(() => {
    if (logContainerRef.current && isExpanded) {
      const container = logContainerRef.current;
      const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 10; // 10px tolerance
      
      // Only auto-scroll if user is already at the bottom
      if (isAtBottom) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [logs, isExpanded]);

  // Fetch logs when expanded
  useEffect(() => {
    if (isExpanded && executionId) {
      fetchNodeLogs();
      // Set up polling for real-time updates
      const interval = setInterval(fetchNodeLogs, 2000);
      return () => clearInterval(interval);
    }
  }, [isExpanded, executionId, nodeId]);

  const fetchNodeLogs = async () => {
    if (!executionId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/aef/logs/${executionId}/${nodeId}`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Failed to fetch node logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLogExpansion = (index: number) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedLogs(newExpanded);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getLogIcon = (type: NodeLogEntry['type']) => {
    switch (type) {
      case 'prompt': return <Brain className="w-4 h-4" />;
      case 'accessibility_tree': return <Eye className="w-4 h-4" />;
      case 'llm_response': return <Zap className="w-4 h-4" />;
      case 'action': return <MousePointer className="w-4 h-4" />;
      case 'screenshot': return <Globe className="w-4 h-4" />;
      case 'error': return <AlertCircle className="w-4 h-4" />;
      case 'success': return <CheckCircle className="w-4 h-4" />;
      default: return <Terminal className="w-4 h-4" />;
    }
  };

  const getLogColor = (type: NodeLogEntry['type']) => {
    switch (type) {
      case 'prompt': return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'accessibility_tree': return 'bg-purple-50 border-purple-200 text-purple-800';
      case 'llm_response': return 'bg-green-50 border-green-200 text-green-800';
      case 'action': return 'bg-orange-50 border-orange-200 text-orange-800';
      case 'screenshot': return 'bg-gray-50 border-gray-200 text-gray-800';
      case 'error': return 'bg-red-50 border-red-200 text-red-800';
      case 'success': return 'bg-emerald-50 border-emerald-200 text-emerald-800';
      default: return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  const truncateContent = (content: string, maxLength: number = 200) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  return (
    <div className="mt-2 border-l-2 border-gray-200 pl-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleExpanded}
        className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-800 p-1 h-auto"
      >
        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <Terminal className="w-3 h-3" />
        Debug Logs ({logs.length})
        {isLoading && <div className="w-3 h-3 border border-gray-300 border-t-blue-500 rounded-full animate-spin" />}
      </Button>

      {isExpanded && (
        <Card className="mt-2 bg-gray-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <Code className="w-4 h-4" />
              {nodeName} - Execution Logs
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div 
              ref={logContainerRef}
              className="max-h-96 overflow-y-auto space-y-2 bg-white rounded border p-3"
            >
              {logs.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <Terminal className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No logs available yet</p>
                  <p className="text-xs text-gray-400">Logs will appear when this node executes</p>
                </div>
              ) : (
                logs.map((log, index) => {
                  const isExpanded = expandedLogs.has(index);
                  const shouldTruncate = log.content.length > 200;
                  
                  return (
                    <div key={index} className={`border rounded-lg p-3 ${getLogColor(log.type)}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {getLogIcon(log.type)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{log.title}</span>
                              <Badge variant="outline" className="text-xs">
                                {formatTimestamp(log.timestamp)}
                              </Badge>
                              {log.metadata?.duration && (
                                <Badge variant="outline" className="text-xs">
                                  <Clock className="w-3 h-3 mr-1" />
                                  {log.metadata.duration}ms
                                </Badge>
                              )}
                            </div>
                            
                            {log.metadata && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {log.metadata.actionType && (
                                  <Badge variant="secondary" className="text-xs">
                                    {log.metadata.actionType}
                                  </Badge>
                                )}
                                {log.metadata.url && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Globe className="w-3 h-3 mr-1" />
                                    {new URL(log.metadata.url).hostname}
                                  </Badge>
                                )}
                                {log.metadata.confidence && (
                                  <Badge variant="secondary" className="text-xs">
                                    {Math.round(log.metadata.confidence * 100)}% confidence
                                  </Badge>
                                )}
                              </div>
                            )}
                            
                            <div className="font-mono text-xs bg-white/50 rounded p-2 border">
                              {shouldTruncate && !isExpanded ? (
                                <div>
                                  <pre className="whitespace-pre-wrap break-words">
                                    {truncateContent(log.content)}
                                  </pre>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleLogExpansion(index)}
                                    className="mt-1 h-auto p-1 text-xs"
                                  >
                                    Show more
                                  </Button>
                                </div>
                              ) : (
                                <div>
                                  <pre className="whitespace-pre-wrap break-words">
                                    {log.content}
                                  </pre>
                                  {shouldTruncate && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => toggleLogExpansion(index)}
                                      className="mt-1 h-auto p-1 text-xs"
                                    >
                                      Show less
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(log.content)}
                          className="h-auto p-1 opacity-60 hover:opacity-100"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NodeLogViewer; 