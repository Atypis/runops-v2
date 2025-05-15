'use client';

import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { SOPNode } from '@/lib/types/sop';
import { Flag } from 'lucide-react';

interface EndNodeData extends SOPNode {
  label: string;
  title?: string;
}

const EndNode: React.FC<NodeProps<EndNodeData>> = ({ data, selected }) => {
  const displayText = data.label || data.title || data.intent || "End";
  return (
    <div 
      className={`flex flex-col items-center group/endnode 
                  ${selected ? 'outline outline-2 outline-offset-2 outline-red-500 rounded-lg' : ''}`}
      title={displayText}
    >
      {/* Circular Icon Part */}
      <div 
        className={`bg-red-200 rounded-full flex items-center justify-center w-12 h-12 border-2 border-red-400 shrink-0 shadow-sm z-10 group-hover/endnode:shadow-md transition-shadow`}
      >
        <Flag size={20} className="text-red-700" />
      </div>

      {/* Rectangular Text Part Below Icon */}
      {displayText && (
        <div className="mt-[-10px] pt-[18px] pb-2 px-3 bg-white border border-neutral-300 rounded-lg shadow-sm w-52 min-h-[40px] flex items-center justify-center group-hover/endnode:shadow-md transition-shadow">
          <p className="text-xs font-medium text-neutral-700 text-center" title={displayText}>
            {displayText}
          </p>
        </div>
      )}
      
      <Handle 
        type="target" 
        position={Position.Left} 
        className="!bg-red-500 !w-3 !h-3 react-flow__handle-left"
        style={{ top: '50%', transform: 'translateY(-50%)' }} // Center on the overall node height
      />
    </div>
  );
};

export default EndNode; 