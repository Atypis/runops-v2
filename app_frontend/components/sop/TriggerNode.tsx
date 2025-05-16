'use client';

import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { SOPTrigger } from '@/lib/types/sop'; // Assuming SOPTrigger is the data type for these nodes
import { Zap } from 'lucide-react'; // Example icon

// The data prop will contain what we passed in transformSopToFlowData, 
// which for triggers includes the SOPTrigger fields and a 'label'.
interface TriggerNodeData {
  label: string;
  type?: string;
  config?: string;
  description?: string;
  id_path?: string; // Hierarchical ID for visual display
  [key: string]: any; // Allow other properties
}

const TriggerNode: React.FC<NodeProps<TriggerNodeData>> = ({ data, selected }) => {
  // Format the label with ID path if available but avoid double brackets
  const formattedLabel = data.id_path 
    ? (!data.id_path.startsWith('[') ? `[${data.id_path}]` : data.id_path) + ` ${data.label}`
    : data.label;
    
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
          <p className="text-xs font-medium text-neutral-700 text-center" title={formattedLabel}>
            {formattedLabel}
          </p>
        </div>
      )}
      
      {/* Config display if available */}
      {data.config && (
        <div className="mt-1 px-3 py-1 bg-green-50 border border-green-100 rounded text-xs text-green-700 font-mono">
          {data.config}
        </div>
      )}
      
      <Handle 
        id="bottom"
        type="source" 
        position={Position.Bottom} 
        className="!bg-green-500 !w-3 !h-3 react-flow__handle-bottom"
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
        className="!bg-green-500 !w-3 !h-3 react-flow__handle-right"
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
        type="source" 
        position={Position.Left} 
        className="!bg-green-500 !w-3 !h-3 react-flow__handle-left"
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

export default TriggerNode; 