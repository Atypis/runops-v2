import React from 'react';
import { Button } from '@/components/ui/button';
import { Play, X, Trash2, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SelectionToolbarProps {
  selectedCount: number;
  isExecuting: boolean;
  onRunSelected: () => void;
  onClearSelection: () => void;
  onExitSelection: () => void;
  failedNodeId?: string | null;
}

export const SelectionToolbar: React.FC<SelectionToolbarProps> = ({
  selectedCount,
  isExecuting,
  onRunSelected,
  onClearSelection,
  onExitSelection,
  failedNodeId
}) => {
  if (selectedCount === 0 && !isExecuting) {
    return (
      <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg p-3 z-50">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">No nodes selected</span>
          <Button
            variant="outline"
            size="sm"
            onClick={onExitSelection}
            className="text-gray-600 hover:text-gray-800"
          >
            <X className="w-4 h-4 mr-1" />
            Exit Selection
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg p-4 z-50 min-w-[280px]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            {selectedCount} selected
          </Badge>
          {failedNodeId && (
            <Badge variant="destructive">
              Stopped at failure
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onExitSelection}
          className="text-gray-500 hover:text-gray-700 p-1"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="flex gap-2">
        <Button
          onClick={onRunSelected}
          disabled={selectedCount === 0 || isExecuting}
          size="sm"
          className="flex-1 bg-blue-600 hover:bg-blue-700"
        >
          {isExecuting ? (
            <>
              <Clock className="w-4 h-4 mr-2 animate-spin" />
              Executing...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Run Selected
            </>
          )}
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={onClearSelection}
          disabled={isExecuting}
          className="text-gray-600 hover:text-gray-800"
        >
          <Trash2 className="w-4 h-4 mr-1" />
          Clear
        </Button>
      </div>
      
      {failedNodeId && (
        <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
          Execution stopped due to failure in node: {failedNodeId}
        </div>
      )}
      
      <div className="mt-2 text-xs text-gray-500">
        Nodes will execute in workflow order
      </div>
    </div>
  );
}; 