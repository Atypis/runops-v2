import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { SOPNode } from '@/lib/types/sop';
import { RotateCw, ChevronUp, ChevronDown } from 'lucide-react';

interface LoopNodeData {
  label: string;
  title: string;
  isCollapsible?: boolean;
  isExpanded?: boolean;
  onToggleCollapse?: (id: string) => void;
  id?: string; // Node ID, passed by ReactFlow, useful for onToggleCollapse
  calculatedWidth?: number; // Added to access Dagre-calculated width
  calculatedHeight?: number; // Added to access Dagre-calculated height
  childSopNodeIds?: string[]; // IDs of direct child nodes
  parentNodeId?: string; // If this node is a child of another compound node
  // Add any other specific props your loop node might need from appNode.data
  id_path?: string; // Hierarchical ID for visual display
  intent?: string;
  context?: string;
  description?: string;
}

interface LoopNodeProps extends NodeProps {
  data: LoopNodeData;
}

const LoopNode: React.FC<LoopNodeProps> = ({ id, data, selected }) => {
  // Format the label with ID path if available but avoid double brackets
  const formattedLabel = data.id_path 
    ? (!data.id_path.startsWith('[') ? `[${data.id_path}]` : data.id_path) + ` ${data.label}`
    : data.label;
  
  // Other logic for handling child nodes
  const childCount = data.childSopNodeIds?.length || 0;
  const tooltipText = `${data.description || 'Loop'} (${childCount} ${childCount === 1 ? 'item' : 'items'})`;
  
  const isCompound = childCount > 0;
  const isExpanded = data.isExpanded !== false; // Default to expanded if not provided
  
  const handleToggleCollapse = () => {
    if (data.onToggleCollapse) {
      data.onToggleCollapse(id);
    }
  };
  
  // Calculate the width and height for the container based on child count
  const useWidth = data.calculatedWidth || (childCount > 0 ? Math.max(450, childCount * 120) : 240);
  const useHeight = data.calculatedHeight || (childCount > 0 ? Math.max(250, childCount * 80) : 120);
  
  return (
    <div
      className={`
        flex flex-col items-center
        ${selected ? 'outline outline-2 outline-offset-2 outline-purple-500 rounded-lg' : ''}
      `}
    >
      <div
        className={`
          p-4
          bg-white
          border-2 border-purple-300
          rounded-xl
          shadow-md
          hover:shadow-lg
          group/loopnode
          transition-shadow
          relative
        `}
        style={{
          width: useWidth,
          minHeight: useHeight,
          background: 'rgba(243, 232, 255, 0.3)', // Very light purple background
          boxShadow: '0 4px 8px rgba(0,0,0,0.08)'
        }}
        title={tooltipText}
      >
        {/* Loop node header with icon */}
        <div className="flex items-center space-x-2 mb-2 pb-2 border-b border-purple-200">
          <div
            className={`
              relative 
              w-8 h-8 
              flex-shrink-0 
              rounded-full 
              flex items-center justify-center
              ${selected ? 'bg-purple-100' : 'bg-purple-50'} 
              group-hover/loopnode:bg-purple-100
              transition-colors
            `}
          >
            <div className="absolute inset-0 rounded-full border border-purple-300"></div>
            <RotateCw size={16} className="text-purple-700" strokeWidth={2.5} />
          </div>
          
          <div className="flex-1 overflow-hidden">
            <h3 
              className="font-medium text-sm text-purple-900 truncate"
              title={formattedLabel}
            >
              {formattedLabel}
            </h3>
            
            {data.context && (
              <p 
                className="text-xs text-gray-600 truncate mt-0.5"
                title={data.context}
              >
                {data.context}
              </p>
            )}
          </div>
          
          {/* Only show expand/collapse if there are children */}
          {isCompound && data.onToggleCollapse && (
            <button
              type="button"
              onClick={handleToggleCollapse}
              className={`
                w-6 h-6 
                flex-shrink-0 
                flex items-center justify-center 
                rounded
                text-gray-500
                hover:bg-gray-100
                hover:text-gray-900
                transition-colors
              `}
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronUp size={14} />
              ) : (
                <ChevronDown size={14} />
              )}
            </button>
          )}
        </div>
        
        {/* Container for child nodes */}
        <div 
          className="relative w-full h-full" 
          style={{ 
            minHeight: isCompound ? (useHeight - 50) : 'auto',
            padding: '8px'
          }}
        >
          {/* This div will be the container for ReactFlow to place child nodes */}
        </div>
        
        {/* Indicator for child items */}
        {isCompound && (
          <div 
            className={`
              absolute bottom-0 left-0 right-0
              text-center text-xs text-purple-600
              pb-1 pt-1
              border-t border-purple-100
            `}
          >
            <span className="px-2 bg-white rounded-full">
              {childCount} {childCount === 1 ? 'item' : 'items'} {isExpanded ? 'shown' : 'hidden'}
            </span>
          </div>
        )}
      </div>
      
      <Handle
        id="top"
        type="target"
        position={Position.Top}
        className="!bg-purple-600 !w-3 !h-3 react-flow__handle-top"
        style={{ 
          top: '-5px',
          zIndex: 1,
          border: '2px solid white'
        }}
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className="!bg-purple-600 !w-3 !h-3 react-flow__handle-bottom"
        style={{ 
          bottom: '-5px',
          zIndex: 1,
          border: '2px solid white'
        }}
      />
      {/* Add side handles for alternative connection points */}
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className="!bg-purple-600 !w-3 !h-3 react-flow__handle-right"
        style={{ 
          top: '50%', 
          right: '-5px', 
          transform: 'translateY(-50%)',
          zIndex: 1,
          border: '2px solid white'
        }}
      />
      <Handle
        id="left"
        type="target"
        position={Position.Left}
        className="!bg-purple-600 !w-3 !h-3 react-flow__handle-left"
        style={{ 
          top: '50%', 
          left: '-5px', 
          transform: 'translateY(-50%)',
          zIndex: 1,
          border: '2px solid white'
        }}
      />
    </div>
  );
};

export default LoopNode; 