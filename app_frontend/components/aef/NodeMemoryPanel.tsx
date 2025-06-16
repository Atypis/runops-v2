import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, 
  ChevronDown, 
  ChevronRight,
  Clock,
  Database,
  Zap,
  CheckCircle,
  AlertCircle,
  Eye,
  Code,
  Globe,
  MousePointer,
  FileText,
  Activity
} from 'lucide-react';
import { MemoryArtifact } from '@/lib/memory/types';
import MemoryPhaseView from './MemoryPhaseView';
import MemoryDetailModal from './MemoryDetailModal';
import { useMemoryData } from '@/lib/hooks/useMemoryData';
import eventBus from '@/lib/utils/eventBus';

interface NodeMemoryPanelProps {
  nodeId: string;
  nodeName: string;
  executionId?: string;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}

type MemoryDisplayState = 'collapsed' | 'summary' | 'detail';

const NodeMemoryPanel: React.FC<NodeMemoryPanelProps> = ({
  nodeId,
  nodeName,
  executionId,
  isExpanded,
  onToggleExpanded
}) => {
  const [displayState, setDisplayState] = useState<MemoryDisplayState>('collapsed');
  const [selectedPhase, setSelectedPhase] = useState<'inputs' | 'processing' | 'outputs' | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Internal flag toggled when we hear that this node actually executed
  const [shouldFetch, setShouldFetch] = useState(false);

  // Fetch memory data using our custom hook – only when (a) panel expanded, (b) already displaying data, or (c) node executed
  const shouldFetchMemory = isExpanded || displayState !== 'collapsed' || shouldFetch;
  const effectiveExecutionId = shouldFetchMemory ? executionId : undefined;
  const { memoryArtifact, isLoading, error, refetch, isWaitingForMemory } = useMemoryData(effectiveExecutionId, nodeId);

  // Debug logging to track execution ID issues
  useEffect(() => {
    console.log(`🔍 [NodeMemoryPanel] Debug info for ${nodeId}:`, {
      executionId,
      nodeId,
      hasMemoryArtifact: !!memoryArtifact,
      isLoading,
      error: error?.message
    });
  }, [executionId, nodeId, memoryArtifact, isLoading, error]);

  // Listen for the nodeExecuted event so we can start fetching memory as soon as backend finishes
  useEffect(() => {
    const handler = (payload?: { executionId?: string; nodeId?: string }) => {
      if (!payload) return;
      if (payload.executionId === executionId && payload.nodeId === nodeId) {
        console.log(`📥 [NodeMemoryPanel] nodeExecuted event received for ${nodeId}. Triggering memory fetch.`);
        setShouldFetch(true);
        refetch();
      }
    };

    eventBus.on('nodeExecuted', handler);
    return () => {
      eventBus.off('nodeExecuted', handler);
    };
  }, [executionId, nodeId]);

  // Auto-expand if there are errors in memory
  useEffect(() => {
    if (memoryArtifact?.outputs?.executionMetadata?.status === 'error' && displayState === 'collapsed') {
      setDisplayState('summary');
      onToggleExpanded();
    }
  }, [memoryArtifact, displayState, onToggleExpanded]);

  // Auto-expand when memory finally appears (good first-time UX)
  useEffect(() => {
    if (memoryArtifact && displayState === 'collapsed' && isWaitingForMemory) {
      console.log(`🎉 [NodeMemoryPanel] Memory data appeared for ${nodeId}, auto-expanding panel`);
      setDisplayState('summary');
      onToggleExpanded();
    }
  }, [memoryArtifact, displayState, isWaitingForMemory, nodeId, onToggleExpanded]);

  // Handle state transitions
  const handleToggleExpanded = () => {
    if (displayState === 'collapsed') {
      setDisplayState('summary');
      onToggleExpanded();
    } else if (displayState === 'summary') {
      setDisplayState('collapsed');
      onToggleExpanded();
    }
  };

  const handleViewDetails = (phase?: 'inputs' | 'processing' | 'outputs') => {
    setSelectedPhase(phase || null);
    setShowDetailModal(true);
  };

  // Calculate memory summary metrics
  const getMemorySummary = () => {
    if (!memoryArtifact) return null;

    const { inputs, processing, outputs } = memoryArtifact;
    
    return {
      status: outputs.executionMetadata.status,
      duration: outputs.executionMetadata.duration,
      domSize: inputs.environment.domSnapshot ? Math.round(inputs.environment.domSnapshot.length / 1024) : 0,
      llmMessages: processing.llmInteractions?.length || 0,
      browserActions: processing.actions?.length || 0,
      errorsCount: processing.errors?.length || 0,
      hasScreenshots: processing.browserEvents?.some((e: any) => e.type === 'screenshot') || false,
      dataExtracted: outputs.extractedData ? Object.keys(outputs.extractedData).length : 0,
      nextContextSize: outputs.stateChanges ? Math.round(JSON.stringify(outputs.stateChanges).length / 1024) : 0
    };
  };

  const summary = getMemorySummary();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'error': return <AlertCircle className="w-3 h-3 text-red-500" />;
      case 'partial': return <AlertCircle className="w-3 h-3 text-orange-500" />;
      case 'pending': return <Activity className="w-3 h-3 text-blue-500 animate-pulse" />;
      default: return <Clock className="w-3 h-3 text-gray-400" />;
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatBytes = (kb: number) => {
    if (kb < 1) return '< 1KB';
    if (kb < 1024) return `${kb}KB`;
    return `${(kb / 1024).toFixed(1)}MB`;
  };

  // Render collapsed state - single line summary
  const renderCollapsed = () => {
    if (!summary) {
      return (
        <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
          <Brain className="w-3 h-3" />
          <span>Memory</span>
          {(isLoading || isWaitingForMemory) && (
            <div className="w-3 h-3 border border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          )}
          {isWaitingForMemory && (
            <span className="text-blue-600 animate-pulse">waiting for memory...</span>
          )}
          {!executionId && <span className="text-gray-400">(no execution)</span>}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs font-mono hover:bg-slate-100 transition-colors cursor-pointer">
        <div className="flex items-center gap-1">
          <Brain className="w-3 h-3 text-slate-600" />
          <span className="text-slate-700 font-medium">Memory</span>
        </div>
        
        <div className="flex items-center gap-2">
          {getStatusIcon(summary.status)}
          <span className="text-slate-600">[{summary.duration ? formatDuration(summary.duration) : 'pending'}]</span>
        </div>

        {summary.domSize > 0 && (
          <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
            <Globe className="w-3 h-3" />
            <span>{formatBytes(summary.domSize)}</span>
          </div>
        )}

        {summary.llmMessages > 0 && (
          <div className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
            <Zap className="w-3 h-3" />
            <span>{summary.llmMessages}msg</span>
          </div>
        )}

        {summary.browserActions > 0 && (
          <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded">
            <MousePointer className="w-3 h-3" />
            <span>{summary.browserActions}act</span>
          </div>
        )}

        {summary.errorsCount > 0 && (
          <div className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded">
            <AlertCircle className="w-3 h-3" />
            <span>{summary.errorsCount}err</span>
          </div>
        )}

        {isLoading && (
          <div className="w-3 h-3 border border-slate-300 border-t-blue-500 rounded-full animate-spin" />
        )}
      </div>
    );
  };

  // Render summary state - 3-column layout
  const renderSummary = () => {
    if (!memoryArtifact || !summary) {
      return (
        <div className="text-center text-gray-500 py-8">
          <Brain className="w-8 h-8 mx-auto mb-2 opacity-50" />
          {isWaitingForMemory ? (
            <>
              <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-blue-600">Waiting for memory data...</p>
              <p className="text-xs text-gray-400">Memory will appear when this node completes execution</p>
            </>
          ) : (
            <>
              <p className="text-sm">No memory data available</p>
              <p className="text-xs text-gray-400">Memory will appear when this node executes</p>
            </>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Memory Overview Header */}
        <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-md">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-slate-600" />
              <span className="font-medium text-slate-800">Memory Trace</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {formatDuration(summary.duration)}
            </Badge>
            <div className="flex items-center gap-1">
              {getStatusIcon(summary.status)}
              <span className="text-xs text-slate-600 capitalize">{summary.status}</span>
            </div>
          </div>
          
          <Button
            onClick={() => handleViewDetails()}
            variant="outline"
            size="sm"
            className="text-xs h-6 px-2"
          >
            <Eye className="w-3 h-3 mr-1" />
            Full Details
          </Button>
        </div>

        {/* Three-Column Phase Layout */}
        <div className="grid grid-cols-3 gap-4">
          <MemoryPhaseView
            phase="inputs"
            data={memoryArtifact.inputs}
            summary={{
              domSize: summary.domSize,
              variableCount: Object.keys(memoryArtifact.inputs.nodeVariables || {}).length,
              credentialCount: Object.keys(memoryArtifact.inputs.credentials || {}).length,
              url: memoryArtifact.inputs.environment.currentUrl
            }}
            onViewDetails={() => handleViewDetails('inputs')}
          />
          
          <MemoryPhaseView
            phase="processing"
            data={memoryArtifact.processing}
            summary={{
              llmMessages: summary.llmMessages,
              browserActions: summary.browserActions,
              errorsCount: summary.errorsCount,
              duration: summary.duration
            }}
            onViewDetails={() => handleViewDetails('processing')}
          />
          
          <MemoryPhaseView
            phase="outputs"
            data={memoryArtifact.outputs}
            summary={{
              status: summary.status,
              dataExtracted: summary.dataExtracted,
              nextContextSize: summary.nextContextSize,
              hasScreenshots: summary.hasScreenshots
            }}
            onViewDetails={() => handleViewDetails('outputs')}
          />
        </div>

        {/* Quick Error Preview */}
        {summary.errorsCount > 0 && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="font-medium text-red-800">Execution Errors ({summary.errorsCount})</span>
            </div>
            <div className="space-y-1">
              {memoryArtifact.processing.errors?.slice(0, 2).map((error: any, index: number) => (
                <div key={index} className="text-xs text-red-700 font-mono bg-red-100 p-2 rounded">
                  <div className="font-medium">{error.type}</div>
                  <div className="truncate">{error.message}</div>
                </div>
              ))}
              {memoryArtifact.processing.errors && memoryArtifact.processing.errors.length > 2 && (
                <div className="text-xs text-red-600">
                  +{memoryArtifact.processing.errors.length - 2} more errors
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mt-2 border-l-2 border-slate-200 pl-4">
      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleToggleExpanded}
        className="flex items-center gap-2 text-xs text-slate-600 hover:text-slate-800 p-1 h-auto mb-2"
      >
        {displayState === 'summary' ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {displayState === 'collapsed' ? renderCollapsed() : (
          <div className="flex items-center gap-2">
            <Brain className="w-3 h-3" />
            <span>Memory Debug</span>
            {summary && (
              <>
                {getStatusIcon(summary.status)}
                <span>({summary.llmMessages} msgs, {summary.browserActions} actions)</span>
              </>
            )}
          </div>
        )}
      </Button>

      {/* Expanded Content */}
      {displayState === 'summary' && (
        <div className="bg-white rounded border border-slate-200 p-4">
          {renderSummary()}
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && memoryArtifact && (
        <MemoryDetailModal
          memoryArtifact={memoryArtifact}
          nodeName={nodeName}
          selectedPhase={selectedPhase}
          onClose={() => setShowDetailModal(false)}
          onPhaseChange={setSelectedPhase}
        />
      )}

      {/* Error State */}
      {error && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
          Failed to load memory data: {error.message}
          <Button
            onClick={refetch}
            variant="ghost"
            size="sm"
            className="ml-2 h-5 px-2 text-red-600"
          >
            Retry
          </Button>
        </div>
      )}
    </div>
  );
};

export default NodeMemoryPanel; 