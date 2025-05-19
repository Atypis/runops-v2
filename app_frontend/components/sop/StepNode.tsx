'use client';

import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

// The data shape will match what's in our SOPNode from the data model
interface StepNodeData {
  id?: string;
  label: string;
  description?: string;
  parentId?: string;
  parentNode?: string; // This is set by ReactFlow
  id_path?: string; // Hierarchical ID for visual display
  [key: string]: any; // Allow other properties
}

const StepNode: React.FC<NodeProps<StepNodeData>> = ({ data, id, isConnectable }) => {
  // Check if this node has a parent
  const hasParent = !!data.parentNode || !!data.parentId;
  
  // Format the label with ID path if available but avoid double brackets
  const formattedLabel = data.id_path 
    ? (!data.id_path.startsWith('[') ? `[${data.id_path}]` : data.id_path) + ` ${data.label}`
    : data.label;
  
  // Node dimensions - explicitly set to ensure consistent layout
  const nodeWidth = hasParent ? 220 : 240;
  
  // Handle styling based on parent status
  const getHandleStyle = (position: Position) => {
    // Base handle size and color
    const size = hasParent ? 8 : 10;
    const color = hasParent ? '#ef4444' : '#555';
    
    const baseStyle = {
      background: color,
      width: size,
      height: size,
      border: '2px solid white',
      zIndex: 3, // Increased z-index for better stacking
      borderRadius: '50%'
    };
    
    // Position-specific styling
    // Handles are now centered on the node's border
    switch (position) {
      case Position.Top:
        return {
          ...baseStyle,
          top: '0px',
          left: '50%', // Ensure horizontal centering too
          transform: 'translate(-50%, -50%)', // Center handle on the top edge
        };
      case Position.Bottom:
        return {
          ...baseStyle,
          bottom: '0px',
          left: '50%', // Ensure horizontal centering
          transform: 'translate(-50%, 50%)', // Center handle on the bottom edge
        };
      case Position.Left:
        return {
          ...baseStyle,
          left: '0px',
          top: '50%',
          transform: 'translate(-50%, -50%)', // Center handle on the left edge
        };
      case Position.Right:
        return {
          ...baseStyle,
          right: '0px',
          top: '50%',
          transform: 'translate(50%, -50%)', // Center handle on the right edge
        };
      default:
        return baseStyle;
    }
  };

  return (
    <div 
      style={{
        background: hasParent ? 'rgba(255, 248, 248, 0.97)' : '#ffffff',
        border: hasParent ? '1px solid #ef4444' : '1px solid #e2e8f0',
        borderRadius: hasParent ? '8px' : '6px',
        padding: hasParent ? '12px' : '14px',
        width: nodeWidth,
        boxSizing: 'border-box', // Make sure padding doesn't add to width
        fontSize: '12px',
        boxShadow: hasParent 
          ? '0 2px 6px rgba(239, 68, 68, 0.15)' 
          : '0 2px 5px rgba(0, 0, 0, 0.08)',
        transition: 'all 0.2s ease',
        position: 'relative',
      }}
      className={hasParent ? 'child-node' : 'regular-node'}
      data-node-type="step" 
      data-is-child={hasParent ? 'true' : 'false'}
    >
      <Handle
        id="top"
        type="target"
        position={Position.Top}
        style={getHandleStyle(Position.Top)}
        isConnectable={isConnectable}
      />
      <div>
        <strong style={{ 
          fontSize: hasParent ? '12px' : '13px', 
          color: hasParent ? '#991b1b' : '#333',
          display: 'block',
          marginBottom: '5px',
          fontWeight: 600,
          lineHeight: 1.2,
        }}>
          {formattedLabel}
        </strong>
        
        {data.description && (
          <div style={{ 
            fontSize: hasParent ? '10px' : '11px', 
            marginTop: '6px',
            color: hasParent ? '#666' : '#555',
            lineHeight: 1.3,
            maxHeight: hasParent ? '3.9em' : '4.5em', // About 3 lines of text
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
          }}>
            {data.description}
          </div>
        )}
      </div>
      
      <Handle 
        id="bottom"
        type="source" 
        position={Position.Bottom} 
        style={getHandleStyle(Position.Bottom)}
        isConnectable={isConnectable} 
      />
      
      {/* Add side handles for alternative connection points */}
      <Handle 
        id="right"
        type="source" 
        position={Position.Right} 
        style={getHandleStyle(Position.Right)}
        isConnectable={isConnectable} 
      />
      <Handle 
        id="left"
        type="target" 
        position={Position.Left} 
        style={getHandleStyle(Position.Left)}
        isConnectable={isConnectable} 
      />
    </div>
  );
};

export default StepNode; 