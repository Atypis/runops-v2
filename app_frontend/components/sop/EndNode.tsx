'use client';

import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { SOPNode } from '@/lib/types/sop';
import { Flag, XSquare } from 'lucide-react';

interface EndNodeData {
  label: string;
  id_path?: string; // Hierarchical ID for visual display
  title?: string;
  parentNode?: string;
  [key: string]: any; // Other fields from SOPNode
}

const EndNode: React.FC<NodeProps<EndNodeData>> = ({ data, selected, isConnectable }) => {
  // Format the label with ID path if available but avoid double brackets
  const formattedLabel = data.id_path 
    ? (!data.id_path.startsWith('[') ? `[${data.id_path}]` : data.id_path) + ` ${data.label}`
    : data.label;
  
  const displayText = formattedLabel || data.title || data.intent || "End Process";
  const hasParent = !!data.parentNode || !!data.parentId;
  
  // Make the node smaller when it's a child
  const width = hasParent ? 120 : 208;
  
  return (
    <div 
      className={`flex flex-col items-center group/endnode 
                  ${selected ? 'outline outline-2 outline-offset-2 outline-red-500 rounded-lg' : ''}`}
      title={displayText}
      style={{
        width: width + 'px',
        transform: hasParent ? 'scale(0.8)' : 'scale(1)',
        transformOrigin: 'center center'
      }}
    >
      {/* Circular Icon Part */}
      <div 
        className={`bg-red-200 rounded-full flex items-center justify-center w-12 h-12 border-2 border-red-400 shrink-0 shadow-sm z-10 group-hover/endnode:shadow-md transition-shadow`}
      >
        <XSquare size={18} className="text-red-600" />
      </div>

      {/* Rectangular Text Part Below Icon */}
      {displayText && (
        <div className="mt-[-10px] pt-[18px] pb-2 px-3 bg-white border border-neutral-300 rounded-lg shadow-sm min-h-[40px] flex items-center justify-center group-hover/endnode:shadow-md transition-shadow"
             style={{ width: hasParent ? '100%' : '208px' }}>
          <p className="text-xs font-medium text-neutral-700 text-center" title={displayText}>
            {displayText}
          </p>
        </div>
      )}
      
      <Handle 
        id="top"
        type="target" 
        position={Position.Top}
        className="!bg-red-500 !w-3 !h-3 react-flow__handle-top"
        style={{ 
          top: '-5px',
          zIndex: 1,
          border: '2px solid white' 
        }}
        isConnectable={isConnectable}
      />
      
      {/* Add side handles for the end node */}
      <Handle 
        id="left"
        type="target" 
        position={Position.Left}
        className="!bg-red-500 !w-3 !h-3 react-flow__handle-left"
        style={{ 
          top: '50%', 
          left: '-5px', 
          transform: 'translateY(-50%)',
          zIndex: 1,
          border: '2px solid white'
        }}
        isConnectable={isConnectable}
      />
      <Handle 
        id="right"
        type="target" 
        position={Position.Right}
        className="!bg-red-500 !w-3 !h-3 react-flow__handle-right"
        style={{ 
          top: '50%', 
          right: '-5px', 
          transform: 'translateY(-50%)',
          zIndex: 1,
          border: '2px solid white'
        }}
        isConnectable={isConnectable}
      />
    </div>
  );
};

export default EndNode; 