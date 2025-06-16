import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  Globe, 
  Zap, 
  CheckCircle, 
  AlertCircle, 
  Database, 
  Eye, 
  Variable, 
  Key, 
  MousePointer, 
  Clock,
  FileText,
  ArrowRight,
  Camera
} from 'lucide-react';
import { MemoryInputs, MemoryProcessing, MemoryOutputs } from '@/lib/memory/types';

interface MemoryPhaseViewProps {
  phase: 'inputs' | 'processing' | 'outputs';
  data: MemoryInputs | MemoryProcessing | MemoryOutputs;
  summary: {
    // Inputs summary
    domSize?: number;
    variableCount?: number;
    credentialCount?: number;
    url?: string;
    // Processing summary
    llmMessages?: number;
    browserActions?: number;
    errorsCount?: number;
    duration?: number;
    // Outputs summary
    status?: string;
    dataExtracted?: number;
    nextContextSize?: number;
    hasScreenshots?: boolean;
  };
  onViewDetails: () => void;
}

const MemoryPhaseView: React.FC<MemoryPhaseViewProps> = ({
  phase,
  data,
  summary,
  onViewDetails
}) => {
  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'inputs': return 'border-blue-200 bg-blue-50';
      case 'processing': return 'border-orange-200 bg-orange-50';
      case 'outputs': return 'border-green-200 bg-green-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  const getPhaseTitle = (phase: string) => {
    switch (phase) {
      case 'inputs': return 'INPUTS';
      case 'processing': return 'PROCESSING';
      case 'outputs': return 'OUTPUTS';
      default: return phase.toUpperCase();
    }
  };

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case 'inputs': return <ArrowRight className="w-4 h-4 rotate-180" />;
      case 'processing': return <Zap className="w-4 h-4" />;
      case 'outputs': return <ArrowRight className="w-4 h-4" />;
      default: return <Database className="w-4 h-4" />;
    }
  };

  const formatBytes = (kb: number) => {
    if (kb < 1) return '< 1KB';
    if (kb < 1024) return `${kb}KB`;
    return `${(kb / 1024).toFixed(1)}MB`;
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const renderInputsContent = () => (
    <div className="space-y-2">
      {summary.domSize && summary.domSize > 0 && (
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <Globe className="w-3 h-3 text-blue-600" />
            <span className="text-gray-600">DOM Snapshot</span>
          </div>
          <span className="font-mono text-blue-700">{formatBytes(summary.domSize)}</span>
        </div>
      )}
      
      {summary.variableCount !== undefined && (
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <Variable className="w-3 h-3 text-blue-600" />
            <span className="text-gray-600">Variables</span>
          </div>
          <span className="font-mono text-blue-700">{summary.variableCount}</span>
        </div>
      )}
      
      {summary.credentialCount !== undefined && (
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <Key className="w-3 h-3 text-blue-600" />
            <span className="text-gray-600">Credentials</span>
          </div>
          <span className="font-mono text-blue-700">{summary.credentialCount}</span>
        </div>
      )}
      
      {summary.url && (
        <div className="text-xs">
          <div className="flex items-center gap-1 mb-1">
            <Globe className="w-3 h-3 text-blue-600" />
            <span className="text-gray-600">Current URL</span>
          </div>
          <div className="font-mono text-blue-700 truncate text-xs bg-blue-100 p-1 rounded">
            {summary.url}
          </div>
        </div>
      )}
    </div>
  );

  const renderProcessingContent = () => (
    <div className="space-y-2">
      {summary.llmMessages && summary.llmMessages > 0 && (
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-orange-600" />
            <span className="text-gray-600">LLM Messages</span>
          </div>
          <span className="font-mono text-orange-700">{summary.llmMessages}</span>
        </div>
      )}
      
      {summary.browserActions && summary.browserActions > 0 && (
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <MousePointer className="w-3 h-3 text-orange-600" />
            <span className="text-gray-600">Browser Actions</span>
          </div>
          <span className="font-mono text-orange-700">{summary.browserActions}</span>
        </div>
      )}
      
      {summary.errorsCount !== undefined && (
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-orange-600" />
            <span className="text-gray-600">Errors</span>
          </div>
          <span className={`font-mono ${summary.errorsCount > 0 ? 'text-red-600' : 'text-orange-700'}`}>
            {summary.errorsCount}
          </span>
        </div>
      )}
      
      {summary.duration && (
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-orange-600" />
            <span className="text-gray-600">Duration</span>
          </div>
          <span className="font-mono text-orange-700">{formatDuration(summary.duration)}</span>
        </div>
      )}
    </div>
  );

  const renderOutputsContent = () => (
    <div className="space-y-2">
      {summary.status && (
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            {summary.status === 'success' ? (
              <CheckCircle className="w-3 h-3 text-green-600" />
            ) : (
              <AlertCircle className="w-3 h-3 text-red-600" />
            )}
            <span className="text-gray-600">Status</span>
          </div>
          <span className={`font-mono capitalize ${
            summary.status === 'success' ? 'text-green-700' : 'text-red-700'
          }`}>
            {summary.status}
          </span>
        </div>
      )}
      
      {summary.dataExtracted !== undefined && (
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <Database className="w-3 h-3 text-green-600" />
            <span className="text-gray-600">Data Extracted</span>
          </div>
          <span className="font-mono text-green-700">{summary.dataExtracted} fields</span>
        </div>
      )}
      
      {summary.nextContextSize && summary.nextContextSize > 0 && (
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <ArrowRight className="w-3 h-3 text-green-600" />
            <span className="text-gray-600">Next Context</span>
          </div>
          <span className="font-mono text-green-700">{formatBytes(summary.nextContextSize)}</span>
        </div>
      )}
      
      {summary.hasScreenshots && (
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1">
            <Camera className="w-3 h-3 text-green-600" />
            <span className="text-gray-600">Screenshots</span>
          </div>
          <span className="font-mono text-green-700">Available</span>
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    switch (phase) {
      case 'inputs': return renderInputsContent();
      case 'processing': return renderProcessingContent();
      case 'outputs': return renderOutputsContent();
      default: return null;
    }
  };

  return (
    <div className={`border rounded-lg p-3 ${getPhaseColor(phase)}`}>
      {/* Phase Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {getPhaseIcon(phase)}
          <span className="font-bold text-xs text-gray-700">{getPhaseTitle(phase)}</span>
        </div>
        <Button
          onClick={onViewDetails}
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 text-slate-700 hover:text-slate-900 hover:bg-slate-100"
        >
          <Eye className="w-3 h-3" />
        </Button>
      </div>

      {/* Phase Content */}
      {renderContent()}

      {/* View Details Button */}
      <Button
        onClick={onViewDetails}
        variant="outline"
        size="sm"
        className="w-full mt-3 h-6 text-xs text-slate-700 border-slate-300 hover:bg-slate-50 hover:border-slate-400"
      >
        View Details
      </Button>
    </div>
  );
};

export default MemoryPhaseView; 