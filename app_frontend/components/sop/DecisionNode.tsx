'use client';

import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { SOPNode } from '@/lib/types/sop';
import { Diamond as DiamondIcon } from 'lucide-react';

interface DecisionNodeData extends SOPNode {
  label: string;
}

const DecisionNode: React.FC<NodeProps<DecisionNodeData>> = ({ data, selected }) => {
  const iconContainerSize = 48;
  const iconSize = 20;
  const strokeWidth = 2;

  return (
    <div 
      className={`flex flex-col items-center group/decisionnode 
                  ${selected ? 'outline outline-2 outline-offset-2 outline-yellow-500 rounded-lg' : ''}`}
      title={data.label || data.intent}
    >
      {/* SVG Diamond Icon Part Container - no rounded-full or explicit shadow here */}
      <div className="relative w-12 h-12 shrink-0 z-10">
        <svg 
          width={iconContainerSize} 
          height={iconContainerSize} 
          viewBox={`0 0 ${iconContainerSize} ${iconContainerSize}`} 
          className="absolute inset-0"
        >
          <path 
            d={`M${iconContainerSize / 2} ${strokeWidth / 2} L${iconContainerSize - strokeWidth / 2} ${iconContainerSize / 2} L${iconContainerSize / 2} ${iconContainerSize - strokeWidth / 2} L${strokeWidth / 2} ${iconContainerSize / 2} Z`} 
            className="fill-yellow-200 stroke-yellow-400"
            strokeWidth={strokeWidth}
          />
        </svg>
        {/* Lucide Icon centered on top */}
        <div className="absolute inset-0 flex items-center justify-center">
          <DiamondIcon size={iconSize} className="text-yellow-700" />
        </div>
      </div>

      {/* Rectangular Text Part Below Icon */}
      {data.label && (
        <div className="mt-[-20px] pt-[28px] pb-2 px-3 bg-white border border-neutral-300 rounded-lg shadow-sm w-52 min-h-[40px] flex items-center justify-center group-hover/decisionnode:shadow-md transition-shadow">
          <p className="text-xs font-medium text-neutral-700 text-center" title={data.label}>
            {data.label}
          </p>
        </div>
      )}
      
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-yellow-500 !w-3 !h-3 react-flow__handle-top"
        style={{ top: '2px' }} 
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-yellow-500 !w-3 !h-3 react-flow__handle-bottom"
      />
    </div>
  );
};

export default DecisionNode; 