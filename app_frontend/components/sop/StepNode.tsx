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
  
  // For debugging
  console.log(`Rendering StepNode: ${id}, parentId: ${data.parentId}, parentNode: ${data.parentNode || 'none'}`);
  
  // Format the label with ID path if available but avoid double brackets
  const formattedLabel = data.id_path 
    ? (!data.id_path.startsWith('[') ? `[${data.id_path}]` : data.id_path) + ` ${data.label}`
    : data.label;
  
  return (
    <div 
      style={{
        background: hasParent ? 'rgba(255, 248, 248, 0.97)' : '#ffffff',
        border: hasParent ? '1px solid #ef4444' : '1px solid #e2e8f0',
        borderRadius: hasParent ? '8px' : '6px',
        padding: hasParent ? '12px' : '14px',
        width: hasParent ? 220 : 240, // Adjusted based on new layout dimensions
        fontSize: '12px',
        boxShadow: hasParent 
          ? '0 2px 6px rgba(239, 68, 68, 0.15)' 
          : '0 2px 5px rgba(0, 0, 0, 0.08)',
        transition: 'all 0.2s ease',
        position: 'relative',
      }}
      className={hasParent ? 'child-node' : 'regular-node'}
    >
      <Handle
        id="top"
        type="target"
        position={Position.Top}
        style={{ 
          background: hasParent ? '#ef4444' : '#555',
          width: hasParent ? '8px' : '10px',
          height: hasParent ? '8px' : '10px',
          top: '-5px',
          zIndex: 1,
          border: '2px solid white'
        }}
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
        
        {/* Debug info - only in development */}
        {process.env.NODE_ENV === 'development' && (
          <div style={{ 
            fontSize: '9px', 
            marginTop: '5px', 
            color: hasParent ? '#dc2626' : '#888',
            border: '1px dotted #ddd',
            padding: '2px 4px',
            background: 'rgba(255,255,255,0.8)',
            borderRadius: '3px',
          }}>
            {hasParent ? `Parent: ${data.parentNode || data.parentId}` : 'No parent'}
            <br/>
            ID: {id}
            {data.id_path && <><br/>Path: {data.id_path}</>}
          </div>
        )}
      </div>
      
      <Handle 
        id="bottom"
        type="source" 
        position={Position.Bottom} 
        style={{ 
          background: hasParent ? '#ef4444' : '#555',
          width: hasParent ? '8px' : '10px',
          height: hasParent ? '8px' : '10px',
          bottom: '-5px',
          zIndex: 1,
          border: '2px solid white'
        }}
        isConnectable={isConnectable} 
      />
      
      {/* Add side handles for alternative connection points with proper transform */}
      <Handle 
        id="right"
        type="source" 
        position={Position.Right} 
        style={{ 
          background: hasParent ? '#ef4444' : '#555',
          width: hasParent ? '8px' : '10px',
          height: hasParent ? '8px' : '10px',
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
        style={{ 
          background: hasParent ? '#ef4444' : '#555',
          width: hasParent ? '8px' : '10px',
          height: hasParent ? '8px' : '10px',
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

export default StepNode; 