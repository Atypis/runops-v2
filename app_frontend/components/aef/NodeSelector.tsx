import React, { useState, useEffect } from 'react';
import { AEFDocument } from '@/lib/types/aef';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
// Using HTML input checkbox instead of UI component
import { Play, Square, CheckCircle, AlertCircle, Clock, ChevronRight } from 'lucide-react';

interface NodeSelectorProps {
  aefDocument: AEFDocument;
  onExecuteSelectedNodes: (nodeIds: string[]) => Promise<void>;
  isExecuting?: boolean;
  executionResults?: Map<string, { success: boolean; message: string; nextNodeId?: string }>;
}

interface WorkflowNode {
  id: string;
  type: string;
  label: string;
  intent?: string;
  context?: string;
  parentId?: string;
  children?: string[];
  canExecuteAsGroup?: boolean;
  credentialsRequired?: Record<string, string[]>;
  actions?: any[];
}

const NodeSelector: React.FC<NodeSelectorProps> = ({
  aefDocument,
  onExecuteSelectedNodes,
  isExecuting = false,
  executionResults = new Map()
}) => {
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Get nodes from the document
  const nodes: WorkflowNode[] = aefDocument.public?.nodes || [];

  // Group nodes by type and hierarchy
  const rootNodes = nodes.filter(node => !node.parentId);
  const childNodes = nodes.filter(node => node.parentId);

  const getNodesByParent = (parentId: string): WorkflowNode[] => {
    return childNodes.filter(node => node.parentId === parentId);
  };

  const getNodeTypeIcon = (type: string): string => {
    switch (type) {
      case 'compound_task': return '📦';
      case 'atomic_task': return '⚡';
      case 'decision': return '🔀';
      case 'assert': return '✅';
      case 'error_handler': return '🚨';
      case 'data_transform': return '🔄';
      case 'generator': return '🤖';
      case 'explore': return '🔍';
      case 'iterative_loop': return '🔁';
      default: return '📋';
    }
  };

  const getNodeTypeColor = (type: string): string => {
    switch (type) {
      case 'compound_task': return 'bg-blue-100 text-blue-800';
      case 'atomic_task': return 'bg-green-100 text-green-800';
      case 'decision': return 'bg-yellow-100 text-yellow-800';
      case 'assert': return 'bg-purple-100 text-purple-800';
      case 'error_handler': return 'bg-red-100 text-red-800';
      case 'data_transform': return 'bg-indigo-100 text-indigo-800';
      case 'generator': return 'bg-pink-100 text-pink-800';
      case 'explore': return 'bg-orange-100 text-orange-800';
      case 'iterative_loop': return 'bg-cyan-100 text-cyan-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getExecutionStatus = (nodeId: string) => {
    const result = executionResults.get(nodeId);
    if (!result) return null;
    
    return result.success ? (
      <CheckCircle className="w-4 h-4 text-green-500" />
    ) : (
      <AlertCircle className="w-4 h-4 text-red-500" />
    );
  };

  const handleNodeToggle = (nodeId: string) => {
    const newSelected = new Set(selectedNodes);
    if (newSelected.has(nodeId)) {
      newSelected.delete(nodeId);
    } else {
      newSelected.add(nodeId);
    }
    setSelectedNodes(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedNodes.size === nodes.length) {
      setSelectedNodes(new Set());
    } else {
      setSelectedNodes(new Set(nodes.map(n => n.id)));
    }
  };

  const handleExecuteSelected = async () => {
    if (selectedNodes.size === 0) return;
    
    const nodeIds = Array.from(selectedNodes);
    await onExecuteSelectedNodes(nodeIds);
  };

  const toggleExpanded = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const renderNode = (node: WorkflowNode, level: number = 0) => {
    const isSelected = selectedNodes.has(node.id);
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const executionStatus = getExecutionStatus(node.id);
    const childNodes = getNodesByParent(node.id);

    return (
      <div key={node.id} className={`${level > 0 ? 'ml-6 border-l border-gray-200 pl-4' : ''}`}>
        <div className={`
          p-3 rounded-lg border transition-all duration-200 mb-2
          ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
          ${isExecuting ? 'opacity-60' : 'cursor-pointer'}
        `}>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => handleNodeToggle(node.id)}
              disabled={isExecuting}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            
            {hasChildren && (
              <button
                onClick={() => toggleExpanded(node.id)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ChevronRight 
                  className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                />
              </button>
            )}
            
            <div className="flex items-center gap-2 flex-1">
              <span className="text-lg">{getNodeTypeIcon(node.type)}</span>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-gray-900">{node.label}</h4>
                  <Badge className={`text-xs ${getNodeTypeColor(node.type)}`}>
                    {node.type}
                  </Badge>
                  {executionStatus}
                </div>
                
                {node.intent && (
                  <p className="text-sm text-gray-600 line-clamp-2">{node.intent}</p>
                )}
                
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  {node.actions && (
                    <span>{node.actions.length} action{node.actions.length !== 1 ? 's' : ''}</span>
                  )}
                  {node.credentialsRequired && (
                    <span>🔐 Requires credentials</span>
                  )}
                  {hasChildren && (
                    <span>{childNodes.length} child{childNodes.length !== 1 ? 'ren' : ''}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Render child nodes if expanded */}
        {isExpanded && hasChildren && (
          <div className="ml-4">
            {childNodes.map(childNode => renderNode(childNode, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Node Selection</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              disabled={isExecuting}
            >
              {selectedNodes.size === nodes.length ? 'Deselect All' : 'Select All'}
            </Button>
            <Button
              onClick={handleExecuteSelected}
              disabled={selectedNodes.size === 0 || isExecuting}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isExecuting ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Execute Selected ({selectedNodes.size})
                </>
              )}
            </Button>
          </div>
        </div>
        
        {selectedNodes.size > 0 && (
          <div className="text-sm text-gray-600 mt-2">
            Selected nodes will be executed consecutively in the order they appear in the workflow.
          </div>
        )}
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto">
        <div className="space-y-2">
          {rootNodes.map(node => renderNode(node))}
        </div>
        
        {nodes.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Square className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No workflow nodes available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NodeSelector; 