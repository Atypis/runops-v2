'use client';

import React, { useState, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { ChevronUp, Edit2, Diamond as DiamondIcon } from 'lucide-react';

// Define the interface without extending SOPNode to avoid type conflicts
interface DecisionNodeData {
  id?: string;
  label: string;
  intent?: string;
  context?: string;
  description?: string; // Legacy field
  id_path?: string; // Hierarchical ID for visual display
  [key: string]: any; // Allow other properties
}

const DecisionNode: React.FC<NodeProps<DecisionNodeData>> = ({ data, id, selected, isConnectable }) => {
  // Local state for expanded/collapsed view
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Format the label with ID path if available but avoid double brackets
  const formattedLabel = data.id_path 
    ? (!data.id_path.startsWith('[') ? `[${data.id_path}]` : data.id_path) + ` ${data.label}`
    : data.label;
    
  // Use intent or description for primary content display
  const intentText = data.intent || data.description || '';
  // Use context as secondary content when available
  const contextText = data.context || '';
  
  // Has expandable content
  const hasExpandableContent = !!contextText || !!intentText;
  
  // Toggle expanded view (triggered by clicking the node)
  const toggleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent default ReactFlow node selection
    setIsExpanded(!isExpanded);
  }, [isExpanded]);
  
  // Open detailed editor - properly triggers the full popup editor
  const openDetailedEditor = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering click on the parent node
    
    // Find the node element
    const nodeElement = document.querySelector(`[data-id="${id}"]`);
    if (!nodeElement) return;
    
    // Set the data attribute to indicate immediate editor opening
    nodeElement.setAttribute('data-open-editor', 'true');
    
    // Dispatch a click event to the node to trigger selection and editing
    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    });
    
    // This will go to handleNodeClick in SOPFlowView which will check the data attribute
    nodeElement.dispatchEvent(clickEvent);
    
    // Remove the attribute after the event has been processed
    setTimeout(() => {
      nodeElement.removeAttribute('data-open-editor');
    }, 100);
  }, [id]);

  return (
    <div 
      className={`flex flex-col items-center ${isExpanded ? 'scale-[1.02]' : 'scale-1'} transition-all duration-200`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={toggleExpand}
      style={{ cursor: 'pointer', background: 'transparent' }}
      data-is-expanded={isExpanded ? 'true' : 'false'}
    >
      {/* Integrated Card + Diamond Design */}
      <div 
        className={`w-52 card-with-diamond relative ${isExpanded ? 'shadow-md' : 'shadow-sm'} transition-all duration-200`}
      >
        {/* Diamond Header */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
          <div 
            className={`bg-yellow-200 flex items-center justify-center w-10 h-10 
                       border-2 border-yellow-400 ${isExpanded ? 'shadow-md border-yellow-500' : 'shadow-sm'}
                       transition-all duration-200`}
            style={{
              clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)', // Diamond shape
            }}
          >
            <DiamondIcon size={18} className="text-yellow-700" />
          </div>
        </div>
        
        {/* Card Body with Top Padding for Diamond Space */}
        <div 
          className={`bg-white border border-neutral-300 rounded-lg px-3 pt-7 pb-2
                     ${isExpanded ? 'min-h-[60px] border-yellow-300' : 'min-h-[40px]'}`}
        >
          {/* Title and content wrapper */}
          <div className="flex flex-col">
            <div className="flex justify-between items-start">
              <p className="text-xs font-semibold text-neutral-700" title={formattedLabel}>
                {formattedLabel}
              </p>
              
              {/* Edit button - only shows when expanded */}
              {isExpanded && hasExpandableContent && (
                <button 
                  onClick={openDetailedEditor}
                  className="bg-yellow-50 border border-yellow-200 rounded p-[3px] w-[22px] h-[22px]
                           flex items-center justify-center text-yellow-700 opacity-85 hover:opacity-100
                           transition-all duration-200 z-10"
                  title="Open detailed editor"
                >
                  <Edit2 size={14} strokeWidth={2} />
                </button>
              )}
            </div>
            
            {/* Intent Section (Always visible) */}
            {intentText && (
              <div className={`text-[10px] text-neutral-600 mt-1 line-clamp-2 transition-all duration-200
                             ${isExpanded ? 'line-clamp-none' : ''}`}>
                {intentText}
              </div>
            )}
            
            {/* Context Section (Only visible when expanded) */}
            <div 
              className={`overflow-hidden transition-all duration-300
                        ${isExpanded ? 'max-h-[200px] opacity-100 mt-2' : 'max-h-0 opacity-0'}`}
            >
              {contextText && (
                <>
                  {/* Divider */}
                  <div className="h-px bg-yellow-100 my-1"></div>
                  
                  <div className="text-[9px] text-neutral-600 py-1 opacity-85">
                    {contextText}
                  </div>
                </>
              )}
            </div>
          </div>
          
          {/* Collapse button - only visible when expanded */}
          {isExpanded && (
            <div 
              className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 
                        bg-yellow-50 border border-yellow-200 rounded-md p-[2px] 
                        flex items-center justify-center opacity-80 cursor-pointer z-10"
              onClick={toggleExpand}
              title="Collapse"
            >
              <ChevronUp size={12} strokeWidth={2.5} className="text-yellow-700" />
            </div>
          )}
          
          {/* Visual indicator for expandable content - only shown when not expanded and not hovered */}
          {hasExpandableContent && !isExpanded && !isHovered && (
            <div 
              className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 
                        w-1 h-1 rounded-full bg-yellow-400 opacity-60"
              title="Click to expand"
            />
          )}
        </div>
      </div>
      
      <Handle
        id="top"
        type="target"
        position={Position.Top}
        className="!bg-yellow-500 !w-3 !h-3 react-flow__handle-top"
        style={{ 
          top: '-5px',
          zIndex: 1,
          border: '2px solid white'
        }}
        isConnectable={isConnectable}
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className="!bg-yellow-500 !w-3 !h-3 react-flow__handle-bottom"
        style={{ 
          bottom: '-5px', 
          zIndex: 1,
          border: '2px solid white'
        }}
        isConnectable={isConnectable}
      />
      
      {/* Add side handles for decision nodes */}
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className="!bg-yellow-500 !w-3 !h-3 react-flow__handle-right"
        style={{ 
          top: '50%', 
          right: '-5px', 
          transform: 'translateY(-50%)',
          zIndex: 1,
          border: '2px solid white'
        }}
        isConnectable={isConnectable}
      />
      <Handle
        id="left"
        type="target"
        position={Position.Left}
        className="!bg-yellow-500 !w-3 !h-3 react-flow__handle-left"
        style={{ 
          top: '50%', 
          left: '-5px', 
          transform: 'translateY(-50%)',
          zIndex: 1,
          border: '2px solid white'
        }}
        isConnectable={isConnectable}
      />
    </div>
  );
};

export default DecisionNode; 