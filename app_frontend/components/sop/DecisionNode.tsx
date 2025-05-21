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

  // NEW: Calculate nesting depth by counting the dots in id_path
  const getNestingDepth = (): number => {
    if (!data.id_path) return 0;
    const dotCount = (data.id_path.match(/\./g) || []).length;
    return dotCount;
  };
  
  // NEW: Get color shades based on nesting depth
  const getDepthColors = () => {
    const depth = getNestingDepth();
    
    // Base color for decisions is yellow/amber
    switch (depth) {
      case 0: return { border: '#fcd34d', bg: 'rgba(254, 249, 195, 0.8)', headerBg: 'rgb(254, 240, 138)' };
      case 1: return { border: '#fbbf24', bg: 'rgba(254, 243, 199, 0.85)', headerBg: 'rgb(253, 230, 138)' };
      case 2: return { border: '#f59e0b', bg: 'rgba(255, 237, 203, 0.9)', headerBg: 'rgb(252, 220, 138)' };
      case 3: return { border: '#d97706', bg: 'rgba(255, 233, 207, 0.95)', headerBg: 'rgb(251, 211, 138)' };
      default: return { border: '#b45309', bg: 'rgba(255, 229, 211, 1)', headerBg: 'rgb(250, 202, 138)' };
    }
  };

  // NEW: Get depth indicator style
  const getDepthIndicatorStyle = () => {
    const depth = getNestingDepth();
    
    // No indicator for top level
    if (depth === 0) return undefined;
    
    return {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#d97706',
      color: 'white',
      fontWeight: 'bold',
      fontSize: '10px',
      width: '16px',
      height: '16px',
      borderRadius: '50%',
      marginRight: '4px'
    };
  };

  return (
    <div 
      className={`
        relative
        group
        ${selected ? 'node-selected' : ''}
      `}
      data-node-type="decision"
      data-nesting-depth={getNestingDepth()}
      style={{ transform: 'rotate(45deg)', width: '140px', height: '140px' }}
    >
      <div 
        className="absolute inset-0"
        style={{
          border: '2px solid',
          borderColor: getDepthColors().border,
          backgroundColor: getDepthColors().bg,
          borderRadius: '4px'
        }}
      ></div>
      
      {/* Content wrapper rotated back */}
      <div 
        className="absolute inset-0 flex items-center justify-center" 
        style={{ transform: 'rotate(-45deg)' }}
      >
        <div className="text-center px-2">
          <div className="flex items-center justify-center">
            {/* NEW: Depth indicator */}
            {getNestingDepth() > 0 && (
              <span style={getDepthIndicatorStyle()}>{getNestingDepth()}</span>
            )}
            <span className="font-medium text-sm text-amber-800">
              {formattedLabel}
            </span>
          </div>
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