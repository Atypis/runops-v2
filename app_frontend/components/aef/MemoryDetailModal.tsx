import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  X, 
  ArrowRight, 
  Zap, 
  Brain, 
  Globe, 
  MousePointer, 
  Copy, 
  Download, 
  Search,
  ChevronDown,
  ChevronRight,
  Clock,
  AlertCircle,
  CheckCircle,
  Code,
  Eye,
  Camera,
  Database,
  FileText
} from 'lucide-react';
import { MemoryArtifact } from '@/lib/memory/types';

interface MemoryDetailModalProps {
  memoryArtifact: MemoryArtifact;
  nodeName: string;
  selectedPhase?: 'inputs' | 'processing' | 'outputs' | null;
  onClose: () => void;
  onPhaseChange: (phase: 'inputs' | 'processing' | 'outputs' | null) => void;
}

const MemoryDetailModal: React.FC<MemoryDetailModalProps> = ({
  memoryArtifact,
  nodeName,
  selectedPhase,
  onClose,
  onPhaseChange
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['dom-snapshot', 'llm-conversations']));
  const [searchTerm, setSearchTerm] = useState('');

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const downloadData = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatTimestamp = (timestamp: Date | string) => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  const truncateText = (text: string, maxLength: number = 500) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const highlightSearchTerm = (text: string) => {
    if (!searchTerm) return text;
    const regex = new RegExp(`(${searchTerm})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
  };

  const renderTabButton = (phase: 'inputs' | 'processing' | 'outputs', label: string, icon: React.ReactNode) => (
    <Button
      onClick={() => onPhaseChange(phase)}
      variant={selectedPhase === phase ? 'default' : 'outline'}
      size="sm"
      className={`flex items-center gap-2 ${
        selectedPhase === phase 
          ? 'bg-slate-700 text-white' 
          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:border-slate-400'
      }`}
    >
      {icon}
      {label}
    </Button>
  );

  const renderCollapsibleSection = (
    id: string,
    title: string,
    icon: React.ReactNode,
    content: React.ReactNode,
    badge?: string
  ) => {
    const isExpanded = expandedSections.has(id);
    
    return (
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <Button
          onClick={() => toggleSection(id)}
          variant="ghost"
          className="w-full flex items-center justify-between p-4 hover:bg-slate-50"
        >
          <div className="flex items-center gap-3">
            {icon}
            <span className="font-medium text-slate-800">{title}</span>
            {badge && <Badge variant="outline" className="text-xs">{badge}</Badge>}
          </div>
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </Button>
        
        {isExpanded && (
          <div className="border-t border-slate-200 p-4 bg-slate-50">
            {content}
          </div>
        )}
      </div>
    );
  };

  const renderInputsTab = () => (
    <div className="space-y-4">
      {/* DOM Snapshot */}
      {memoryArtifact.inputs?.environment?.domSnapshot && renderCollapsibleSection(
        'dom-snapshot',
        'DOM Snapshot',
        <Globe className="w-5 h-5 text-blue-600" />,
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600">
              Size: {Math.round(memoryArtifact.inputs.environment.domSnapshot.length / 1024)}KB
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => copyToClipboard(memoryArtifact.inputs.environment.domSnapshot!)}
                variant="outline"
                size="sm"
                className="text-xs h-6 px-2 text-slate-700 border-slate-300 hover:bg-slate-50 hover:border-slate-400"
              >
                <Copy className="w-3 h-3 mr-1" />
                Copy
              </Button>
              <Button
                onClick={() => downloadData(memoryArtifact.inputs.environment.domSnapshot, `dom-${memoryArtifact.nodeId}.html`)}
                variant="outline"
                size="sm"
                className="text-xs h-6 px-2 text-slate-700 border-slate-300 hover:bg-slate-50 hover:border-slate-400"
              >
                <Download className="w-3 h-3 mr-1" />
                Download
              </Button>
            </div>
          </div>
          <pre className="bg-white border border-slate-200 rounded p-3 text-xs overflow-auto max-h-96 font-mono">
            {truncateText(memoryArtifact.inputs.environment.domSnapshot)}
          </pre>
        </div>,
        `${Math.round(memoryArtifact.inputs.environment.domSnapshot.length / 1024)}KB`
      )}

      {/* Variables */}
      {Object.keys(memoryArtifact.inputs.nodeVariables || {}).length > 0 && renderCollapsibleSection(
        'variables',
        'Node Variables',
        <Database className="w-5 h-5 text-purple-600" />,
        <div className="space-y-2">
          {Object.entries(memoryArtifact.inputs.nodeVariables || {}).map(([key, value]) => (
            <div key={key} className="bg-white border border-slate-200 rounded p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-sm text-purple-700">{key}</span>
                <Button
                  onClick={() => copyToClipboard(JSON.stringify(value, null, 2))}
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <pre className="text-xs text-slate-600 overflow-auto max-h-24">
                {JSON.stringify(value, null, 2)}
              </pre>
            </div>
          ))}
        </div>,
        `${Object.keys(memoryArtifact.inputs.nodeVariables || {}).length} vars`
      )}

      {/* Environment State */}
      {memoryArtifact.inputs?.environment?.currentUrl && renderCollapsibleSection(
        'environment',
        'Environment State',
        <Globe className="w-5 h-5 text-green-600" />,
        <div className="space-y-3">
          <div>
            <span className="text-sm font-medium text-slate-700">Current URL:</span>
            <div className="mt-1 p-2 bg-white border border-slate-200 rounded font-mono text-sm break-all">
              {memoryArtifact.inputs.environment.currentUrl}
            </div>
          </div>
          {memoryArtifact.inputs?.environment?.sessionState && (
            <div>
              <span className="text-sm font-medium text-slate-700">Session State:</span>
              <pre className="mt-1 p-2 bg-white border border-slate-200 rounded text-xs overflow-auto max-h-48">
                {JSON.stringify(memoryArtifact.inputs.environment.sessionState, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderProcessingTab = () => (
    <div className="space-y-4">
      {/* LLM Conversations */}
      {memoryArtifact.processing.llmInteractions && memoryArtifact.processing.llmInteractions.length > 0 && renderCollapsibleSection(
        'llm-conversations',
        'LLM Conversations',
        <Brain className="w-5 h-5 text-purple-600" />,
        <div className="space-y-3">
          {memoryArtifact.processing.llmInteractions.map((interaction, index) => (
            <div key={index} className={`p-3 rounded-lg border ${
              interaction.role === 'user' 
                ? 'bg-blue-50 border-blue-200' 
                : interaction.role === 'assistant'
                ? 'bg-green-50 border-green-200'
                : 'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {interaction.role}
                  </Badge>
                  <span className="text-xs text-slate-600">
                    {formatTimestamp(interaction.timestamp)}
                  </span>
                  {interaction.tokens && (
                    <Badge variant="outline" className="text-xs">
                      {interaction.tokens} tokens
                    </Badge>
                  )}
                </div>
                <Button
                  onClick={() => copyToClipboard(interaction.content)}
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <div className="text-sm whitespace-pre-wrap font-mono bg-white p-2 rounded border">
                {truncateText(interaction.content, 1000)}
              </div>
            </div>
          ))}
        </div>,
        `${memoryArtifact.processing.llmInteractions.length} messages`
      )}

      {/* Browser Actions */}
      {memoryArtifact.processing.actions && memoryArtifact.processing.actions.length > 0 && renderCollapsibleSection(
        'browser-actions',
        'Browser Actions',
        <MousePointer className="w-5 h-5 text-orange-600" />,
        <div className="space-y-3">
          {memoryArtifact.processing.actions.map((action, index) => (
            <div key={index} className="bg-white border border-slate-200 rounded p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-mono">
                    {action.type}
                  </Badge>
                  <span className="text-xs text-slate-600">
                    {formatTimestamp(action.timestamp)}
                  </span>
                  {action.duration && (
                    <Badge variant="outline" className="text-xs">
                      {action.duration}ms
                    </Badge>
                  )}
                </div>
                <Button
                  onClick={() => copyToClipboard(JSON.stringify(action, null, 2))}
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <div className="text-sm text-slate-700 mb-2 italic">
                "{action.instruction}"
              </div>
              {action.target && (
                <div className="text-xs text-slate-600">
                  <span className="font-medium">Target:</span>
                  <pre className="mt-1 p-1 bg-slate-50 rounded font-mono">
                    {JSON.stringify(action.target, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>,
        `${memoryArtifact.processing.actions.length} actions`
      )}

      {/* Errors */}
      {memoryArtifact.processing.errors && memoryArtifact.processing.errors.length > 0 && renderCollapsibleSection(
        'errors',
        'Execution Errors',
        <AlertCircle className="w-5 h-5 text-red-600" />,
        <div className="space-y-3">
          {memoryArtifact.processing.errors.map((error, index) => (
            <div key={index} className="bg-red-50 border border-red-200 rounded p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge variant="destructive" className="text-xs">
                    {error.type}
                  </Badge>
                  <span className="text-xs text-slate-600">
                    {formatTimestamp(error.timestamp)}
                  </span>
                  {error.recovered && (
                    <Badge variant="outline" className="text-xs text-green-600">
                      Recovered
                    </Badge>
                  )}
                </div>
                <Button
                  onClick={() => copyToClipboard(JSON.stringify(error, null, 2))}
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <div className="text-sm text-red-800 font-mono">
                {error.message}
              </div>
              {error.stack && (
                <pre className="mt-2 text-xs text-red-700 bg-red-100 p-2 rounded overflow-auto max-h-32">
                  {truncateText(error.stack, 1000)}
                </pre>
              )}
            </div>
          ))}
        </div>,
        `${memoryArtifact.processing.errors.length} errors`
      )}
    </div>
  );

  const renderOutputsTab = () => (
    <div className="space-y-4">
      {/* Execution Metadata */}
      {renderCollapsibleSection(
        'execution-metadata',
        'Execution Results',
        <CheckCircle className="w-5 h-5 text-green-600" />,
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm font-medium text-slate-700">Status:</span>
              <div className={`mt-1 px-2 py-1 rounded text-sm font-mono ${
                memoryArtifact.outputs.executionMetadata.status === 'success' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {memoryArtifact.outputs.executionMetadata.status}
              </div>
            </div>
            <div>
              <span className="text-sm font-medium text-slate-700">Duration:</span>
              <div className="mt-1 px-2 py-1 bg-slate-100 rounded text-sm font-mono">
                {memoryArtifact.outputs.executionMetadata.duration}ms
              </div>
            </div>
          </div>
          
          {memoryArtifact.outputs.executionMetadata.resourceUsage && (
            <div>
              <span className="text-sm font-medium text-slate-700">Resource Usage:</span>
              <pre className="mt-1 p-2 bg-white border border-slate-200 rounded text-xs">
                {JSON.stringify(memoryArtifact.outputs.executionMetadata.resourceUsage, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Extracted Data */}
      {memoryArtifact.outputs.extractedData && Object.keys(memoryArtifact.outputs.extractedData).length > 0 && renderCollapsibleSection(
        'extracted-data',
        'Extracted Data',
        <Database className="w-5 h-5 text-blue-600" />,
        <div className="space-y-3">
          {Object.entries(memoryArtifact.outputs.extractedData).map(([key, value]) => (
            <div key={key} className="bg-white border border-slate-200 rounded p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-sm text-blue-700">{key}</span>
                <Button
                  onClick={() => copyToClipboard(JSON.stringify(value, null, 2))}
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <pre className="text-xs text-slate-600 overflow-auto max-h-32">
                {JSON.stringify(value, null, 2)}
              </pre>
            </div>
          ))}
        </div>,
        `${Object.keys(memoryArtifact.outputs.extractedData).length} fields`
      )}

      {/* State Changes */}
      {memoryArtifact.outputs.stateChanges && Object.keys(memoryArtifact.outputs.stateChanges).length > 0 && renderCollapsibleSection(
        'state-changes',
        'State Changes',
        <ArrowRight className="w-5 h-5 text-purple-600" />,
        <div className="space-y-3">
          <pre className="bg-white border border-slate-200 rounded p-3 text-xs overflow-auto max-h-64">
            {JSON.stringify(memoryArtifact.outputs.stateChanges, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );

  const renderTabContent = () => {
    switch (selectedPhase) {
      case 'inputs': return renderInputsTab();
      case 'processing': return renderProcessingTab();
      case 'outputs': return renderOutputsTab();
      default: return renderInputsTab(); // Default to inputs if no phase selected
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <Brain className="w-6 h-6 text-slate-600" />
            <div>
              <h2 className="text-xl font-semibold text-slate-800">Memory Inspector</h2>
              <p className="text-sm text-slate-600">{nodeName} • Node ID: {memoryArtifact.nodeId}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search memory..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-2 border border-slate-300 rounded-md text-sm w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <Button onClick={onClose} variant="ghost" size="sm" className="text-slate-700 hover:text-slate-900 hover:bg-slate-100">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 p-6 pb-4 border-b border-slate-200">
          {renderTabButton('inputs', 'Inputs', <ArrowRight className="w-4 h-4 rotate-180" />)}
          {renderTabButton('processing', 'Processing', <Zap className="w-4 h-4" />)}
          {renderTabButton('outputs', 'Outputs', <ArrowRight className="w-4 h-4" />)}
          
          <div className="ml-auto flex items-center gap-2">
            <Button
              onClick={() => downloadData(memoryArtifact, `memory-${memoryArtifact.nodeId}.json`)}
              variant="outline"
              size="sm"
              className="text-slate-700 border-slate-300 hover:bg-slate-50 hover:border-slate-400"
            >
              <Download className="w-4 h-4 mr-2" />
              Download All
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default MemoryDetailModal; 