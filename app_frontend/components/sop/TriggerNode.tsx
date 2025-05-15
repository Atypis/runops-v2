'use client';

import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { SOPTrigger } from '@/lib/types/sop'; // Assuming SOPTrigger is the data type for these nodes
import { Zap } from 'lucide-react'; // Example icon

// The data prop will contain what we passed in transformSopToFlowData, 
// which for triggers includes the SOPTrigger fields and a 'label'.
interface TriggerNodeData extends SOPTrigger {
  label: string; // Retain for tooltip or future use, but may not be displayed directly
}

const TriggerNode: React.FC<NodeProps<TriggerNodeData>> = ({ data, selected }) => {
  return (
    <div 
      className={`flex flex-col items-center group/trigger 
                  ${selected ? 'outline outline-2 outline-offset-2 outline-green-500 rounded-lg' : ''}`}
      title={data.description || data.type}
    >
      {/* Circular Icon Part */}
      <div 
        className={`bg-green-200 rounded-full flex items-center justify-center w-12 h-12 border-2 border-green-400 shrink-0 shadow-sm z-10 group-hover/trigger:shadow-md transition-shadow`}
      >
        <Zap size={20} className="text-green-700" />
      </div>

      {/* Rectangular Text Part Below Icon */}
      {data.label && (
        <div className="mt-[-10px] pt-[18px] pb-2 px-3 bg-white border border-neutral-300 rounded-lg shadow-sm w-52 min-h-[40px] flex items-center justify-center group-hover/trigger:shadow-md transition-shadow">
          <p className="text-xs font-medium text-neutral-700 text-center" title={data.label}>
            {data.label}
          </p>
        </div>
      )}
      
      <Handle 
        type="source" 
        position={Position.Right} 
        className="!bg-green-500 !w-3 !h-3 react-flow__handle-right"
        style={{ top: '50%', transform: 'translateY(-50%)' }} // Center on the overall node height
      />
       {/* Potential target handle if needed in future, though triggers are usually sources 
      <Handle 
        type="target" 
        position={Position.Left} 
        className="!bg-gray-400 !w-3 !h-3 react-flow__handle-left"
        style={{ top: '50%', transform: 'translateY(-50%)' }}
      />
      */}
    </div>
  );
};

export default TriggerNode; 