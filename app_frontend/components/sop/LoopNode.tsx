import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

interface LoopNodeData {
  label: string;
  title: string;
  isCollapsible?: boolean;
  isExpanded?: boolean;
  onToggleCollapse?: (id: string) => void;
  id?: string; // Node ID, passed by ReactFlow, useful for onToggleCollapse
  calculatedWidth?: number; // Added to access Dagre-calculated width
  calculatedHeight?: number; // Added to access Dagre-calculated height
  childSopNodeIds?: string[]; // IDs of direct child nodes
  parentNodeId?: string; // If this node is a child of another compound node
  // Add any other specific props your loop node might need from appNode.data
}

const LoopNode: React.FC<NodeProps<LoopNodeData>> = ({ data, isConnectable, id }) => {
  // Calculate the width/height to use for this node based on expanded state
  // For expanded compound parents, use the large calculated dimensions
  const childCount = data.childSopNodeIds?.length || 0;
  
  // Ensure enough space for a grid of children with appropriate rows/columns
  // Use calculatedWidth if provided, otherwise calculate based on child count
  const calculatedMinWidth = data.calculatedWidth || 0;
  
  // Base minimum width on child count with a generous minimum
  let childCountBasedWidth = 450;
  if (childCount > 12) {
    childCountBasedWidth = 900; // Very large for many children
  } else if (childCount > 8) {
    childCountBasedWidth = 750; // Large for many children
  } else if (childCount > 4) {
    childCountBasedWidth = 600; // Medium for several children
  }
  
  const minWidth = Math.max(childCountBasedWidth, calculatedMinWidth);
  
  // Height calculation - ensure we have enough vertical space
  // Calculate rows based on a reasonable number of columns
  const colsEstimate = childCount > 12 ? 4 : (childCount > 8 ? 3 : 2);
  const rowsEstimate = Math.ceil(childCount / colsEstimate);
  const calculatedMinHeight = data.calculatedHeight || 0;
  const childCountBasedHeight = Math.max(250, rowsEstimate * 120 + 120);
  const minHeight = Math.max(childCountBasedHeight, calculatedMinHeight);
  
  // Use the calculated dimensions if expanded, otherwise use compact size
  const useWidth = data.isExpanded ? minWidth : 240;
  const useHeight = data.isExpanded ? minHeight : 80;

  console.log(`LoopNode ${id} rendering with width=${useWidth}, height=${useHeight}, childCount=${childCount}, calculatedWidth=${data.calculatedWidth}, calculatedHeight=${data.calculatedHeight}`);

  return (
    <div 
      style={{
        border: '2px solid #7c3aed', // Purple border for loops
        borderRadius: '12px', // Increased from 8px for softer appearance
        background: 'rgba(124, 58, 237, 0.05)',
        width: useWidth,
        height: useHeight,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        boxShadow: '0 4px 8px rgba(0,0,0,0.08)', // Added soft shadow
      }}
      className="loop-node"
    >
      <Handle 
        type="target" 
        position={Position.Top} 
        style={{ background: '#555' }}
        isConnectable={isConnectable} 
      />
      
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '12px 18px', // Increased padding
        borderBottom: '1px dashed #c084fc',
        background: 'rgba(124, 58, 237, 0.08)', // Slightly stronger background for header
        borderTopLeftRadius: '10px',
        borderTopRightRadius: '10px',
      }}>
        <strong style={{ 
          fontSize: '1.1em', 
          color: '#5b21b6',
          fontWeight: 600, // Semibold
          textShadow: '0 1px 1px rgba(255,255,255,0.7)' // Subtle text shadow for readability
        }}>
          Loop: {data.label || data.title}
        </strong>
        {data.isCollapsible && data.onToggleCollapse && data.id && (
          <button 
            onClick={(e) => {
              e.stopPropagation(); // Prevent node selection when clicking button
              data.onToggleCollapse!(data.id!);
            }}
            style={{
              background: '#e9d5ff',
              color: '#5b21b6',
              border: '1px solid #c084fc',
              borderRadius: '6px', // Increased from 4px
              padding: '3px 10px', // Increased padding
              cursor: 'pointer',
              fontSize: '0.9em',
              fontWeight: 500, // Medium weight
              transition: 'all 0.2s ease', // Smooth transition for hover effects
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)', // Subtle button shadow
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#dbc4fc';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#e9d5ff';
            }}
          >
            {data.isExpanded ? 'Collapse' : 'Expand'}
          </button>
        )}
      </div>
      
      {/* The content area that will hold child nodes */}
      <div style={{
        flexGrow: 1,
        padding: '15px', // Increased from 10px
        position: 'relative', // Important for absolute positioning of children
        width: '100%', // Ensure it takes the full width
        height: 'calc(100% - 50px)', // Subtract header height
        // Add a subtle background pattern to visualize the container area
        background: 'rgba(124, 58, 237, 0.02)',
        backgroundImage: data.isExpanded ? 'radial-gradient(circle, rgba(124, 58, 237, 0.03) 1px, transparent 1px)' : 'none',
        backgroundSize: '20px 20px',
        // Add a subtle inner border to indicate boundaries
        boxShadow: data.isExpanded ? 'inset 0 0 0 1px rgba(124, 58, 237, 0.1)' : 'none',
        borderRadius: '6px',
        overflow: 'visible', // Allow children to exceed the bounds for node handles
      }} className="loop-content">
        {/* Child nodes get inserted here by ReactFlow when they have this node's ID as parentNode */}
        {data.isExpanded && data.childSopNodeIds && data.childSopNodeIds.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '-5px',
            left: '15px',
            fontSize: '0.8em',
            color: '#5b21b6',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            padding: '2px 8px',
            borderRadius: '4px',
            border: '1px solid rgba(124, 58, 237, 0.2)',
          }}>
            {data.childSopNodeIds.length} steps
          </div>
        )}
      </div>
      
      {/* Always show child count */}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        right: '14px',
        fontSize: '0.85em',
        color: '#666',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        padding: '3px 8px',
        borderRadius: '6px',
        border: '1px solid rgba(124, 58, 237, 0.2)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)', // Subtle shadow
      }}>
        {childCount} {childCount === 1 ? 'child step' : 'child steps'}
      </div>
      
      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ background: '#555' }}
        isConnectable={isConnectable} 
      />
    </div>
  );
};

export default LoopNode; 