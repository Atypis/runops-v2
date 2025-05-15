'use client';

import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { SOPNode } from '@/lib/types/sop'; // Original SOPNode type
import { Terminal, GitMerge, ChevronDown, ChevronRight } from 'lucide-react'; // Example icons

// Data passed to StepNode includes fields from SOPNode, plus title & description
interface StepNodeData extends SOPNode {
  title: string;
  description?: string;
  isExpanded?: boolean; // Passed from SOPFlowView for parent nodes
  onToggleCollapse?: (nodeId: string) => void; // Passed from SOPFlowView
}

const StepNode: React.FC<NodeProps<StepNodeData>> = ({ data, selected }) => {
  // Debugging for specific node
  if (data.id === 'L1_process_emails') {
    console.log('[StepNode] L1_process_emails data:', data);
    console.log('[StepNode] L1_process_emails childNodes:', data.childNodes);
    console.log('[StepNode] L1_process_emails onToggleCollapse present:', !!data.onToggleCollapse);
  }

  const iconSize = 20; // Standardized icon size
  const isParent = data.childNodes && data.childNodes.length > 0;

  if (data.id === 'L1_process_emails') {
    console.log('[StepNode] L1_process_emails isParent:', isParent);
  }

  // Choose an icon based on SOPNode type
  const NodeIcon = () => {
    switch (data.type) {
      case 'task':
        return <Terminal size={iconSize} className="mr-2 text-sky-600 shrink-0" />;
      case 'loop':
        return <GitMerge size={iconSize} className="mr-2 text-fuchsia-600 shrink-0" />;
      default:
        return <Terminal size={iconSize} className="mr-2 text-gray-500 shrink-0" />;
    }
  };
  
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent node selection/drag when clicking button
    if (data.onToggleCollapse) {
      data.onToggleCollapse(data.id);
    }
  };

  return (
    <div 
      className={`bg-white p-3 rounded-lg border shadow-sm hover:shadow-md transition-shadow w-60 
                  ${selected ? 'border-neutral-500 ring-2 ring-offset-1 ring-neutral-400' : 'border-neutral-300'}`}
      style={{ minHeight: '80px' }} // Ensure a minimum height
    >
      <div className="flex items-start mb-1">
        <NodeIcon />
        <div className="flex-grow min-w-0">
          <div className="flex items-center">
            <div className="font-semibold text-sm text-neutral-800 truncate" title={data.title}>{data.title}</div>
            {isParent && data.onToggleCollapse && (
              <button 
                onClick={handleToggle} 
                className="ml-auto p-1 rounded-sm hover:bg-neutral-200 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                aria-label={data.isExpanded ? 'Collapse' : 'Expand'}
              >
                {data.isExpanded ? (
                  <ChevronDown size={16} className="text-muted-foreground" />
                ) : (
                  <ChevronRight size={16} className="text-muted-foreground" />
                )}
              </button>
            )}
          </div>
          {data.description && (
            <p className="text-xs text-neutral-600 mt-1 line-clamp-2" title={data.description}>
              {data.description}
            </p>
          )}
        </div>
      </div>
      <Handle 
        type="target" 
        position={Position.Left} 
        className="!bg-gray-400 w-2.5 h-2.5"
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        className="!bg-gray-400 w-2.5 h-2.5"
      />
    </div>
  );
};

export default StepNode; 