'use client';

import React, { useState, useCallback } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { ChevronUp, Edit2 } from 'lucide-react';

import { ChevronDown } from 'lucide-react'; // Import ChevronDown

// The data shape will match what's in our SOPNode from the data model
interface StepNodeData {
  id?: string;
  label: string;
  intent?: string;
  context?: string;
  description?: string; // Legacy field, will use intent/context when available
  parentId?: string;
  parentNode?: string; // This is set by ReactFlow
  id_path?: string; // Hierarchical ID for visual display
  childSopNodeIds?: string[]; // IDs of direct child nodes, for container functionality
  isExpanded?: boolean; // For container: ReactFlow controlled expansion state for children
  onToggleCollapse?: (id: string) => void; // For container: callback to toggle child visibility
  calculatedWidth?: number; // For container: from layout algorithm
  calculatedHeight?: number; // For container: from layout algorithm
  [key: string]: any; // Allow other properties
}

const StepNode: React.FC<NodeProps<StepNodeData>> = ({ data, id, isConnectable, selected }) => {
  // Local state for expanded/collapsed view (for node's own content, not children)
  const [isContentExpanded, setIsContentExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  // Get ReactFlow instance to access its methods
  const { getNodes } = useReactFlow();

  // Determine if this node should act as a container
  const isContainer = !!(data.childSopNodeIds && data.childSopNodeIds.length > 0);
  // Child visibility state from props, true by default if not undefined, otherwise check boolean value
  const areChildrenExpanded = data.isExpanded === undefined ? true : data.isExpanded;
  
  // Check if this node has a parent in the SOP hierarchy
  const hasSopParent = !!data.parentId; // Use SOP's parentId, not ReactFlow's parentNode for this logic
  
  // Format the label with ID path if available but avoid double brackets
  const formattedLabel = data.id_path 
    ? (!data.id_path.startsWith('[') ? `[${data.id_path}]` : data.id_path) + ` ${data.label}`
    : data.label;
  
  // Node dimensions - explicitly set to ensure consistent layout
  // If it's a container, allow calculatedWidth to override.
  const nodeWidth = isContainer && data.calculatedWidth ? data.calculatedWidth : (hasSopParent ? 220 : 240);

  // Use intent or description for primary content display
  const intentText = data.intent || data.description || '';
  // Use context as secondary content when available
  const contextText = data.context || '';
  
  // Has expandable content (for the node's own details)
  const hasExpandableContent = !!contextText;
  
  // Handle styling based on parent status or if it's a container
  const getHandleStyle = (position: Position) => {
    const isChildOrContainer = hasSopParent || isContainer;
    // Base handle size and color
    const size = isChildOrContainer ? 8 : 10; // Smaller handles for children or containers
    const color = isChildOrContainer ? '#ef4444' : '#555'; // Red theme for children/containers
    
    const baseStyle = {
      background: color,
      width: size,
      height: size,
      border: '2px solid white',
      zIndex: 3, // Increased z-index for better stacking
      borderRadius: '50%'
    };
    
    // Position-specific styling
    switch (position) {
      case Position.Top:
        return {
          ...baseStyle,
          top: '0px',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        };
      case Position.Bottom:
        return {
          ...baseStyle,
          bottom: '0px',
          left: '50%',
          transform: 'translate(-50%, 50%)',
        };
      case Position.Left:
        return {
          ...baseStyle,
          left: '0px',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        };
      case Position.Right:
        return {
          ...baseStyle,
          right: '0px',
          top: '50%',
          transform: 'translate(50%, -50%)',
        };
      default:
        return baseStyle;
    }
  };

  // Toggle expanded view (for the node's own content)
  const toggleContentExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent default ReactFlow node selection
    if (!isContainer) { // Only allow content expansion if not a container
      setIsContentExpanded(prev => !prev);
    }
    // If it's a container, this click is disabled for content expansion.
  }, [isContainer]);

  // Handler for the container expand/collapse button
  const handleToggleChildrenCollapse = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onToggleCollapse && id) {
      data.onToggleCollapse(id);
    }
  }, [data.onToggleCollapse, id]);
  
  // Open detailed editor - directly opens the popup without intermediate steps
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
      style={{
        background: (hasSopParent || isContainer) ? 'rgba(255, 248, 248, 0.97)' : '#ffffff', // Light red tint for SOP children or containers
        border: (hasSopParent || isContainer) ? '2px solid #fca5a5' : '1px solid #e2e8f0', // Stronger red-theme border
        borderRadius: (hasSopParent || isContainer) ? '10px' : '6px', // Consistent rounding
        padding: '12px', // Standardized padding
        width: nodeWidth,
        minHeight: isContainer && data.calculatedHeight ? data.calculatedHeight : undefined, // Use calculated height for container
        boxSizing: 'border-box',
        fontSize: '12px',
        boxShadow: (hasSopParent || isContainer)
          ? '0 3px 8px rgba(239, 68, 68, 0.2)' // More pronounced shadow for children/containers
          : '0 2px 5px rgba(0, 0, 0, 0.08)',
        transition: 'all 0.2s ease',
        position: 'relative',
        // overflow: 'hidden', // Removed to allow child container to be visible if it overflows
        cursor: isContainer ? 'default' : (hasExpandableContent ? 'pointer' : 'default'), // Pointer only if expandable and not container
        transform: isContentExpanded ? 'scale(1.02)' : 'scale(1)',
      }}
      className={`${hasSopParent ? 'child-node' : ''} ${isContainer ? 'container-node' : 'regular-node'} ${isContentExpanded ? 'content-expanded' : ''} ${areChildrenExpanded ? 'children-expanded' : 'children-collapsed'}`}
      data-node-type="step" 
      data-is-child={hasSopParent ? 'true' : 'false'}
      data-is-container={isContainer ? 'true' : 'false'}
      data-is-content-expanded={isContentExpanded ? 'true' : 'false'}
      data-are-children-expanded={areChildrenExpanded ? 'true' : 'false'}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={isContainer ? (e) => e.stopPropagation() : (hasExpandableContent ? toggleContentExpand : (e) => e.stopPropagation())} // Click toggles content if not container and has expandable content
    >
      {/* Main content of the node (header, intent, etc.) */}
      <div style={{ position: 'relative', zIndex: 1 /* Ensure content is above child container bg if overlapping */ }}>
        <Handle
          id="top"
          type="target"
        position={Position.Top}
        style={getHandleStyle(Position.Top)}
        isConnectable={isConnectable}
      />
      <div style={{ position: 'relative' }}>
        {/* Node Title */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', // Align items center for child count and buttons
          marginBottom: '4px'
        }}>
          {/* Title and Child Count Container */}
          <div style={{ display: 'flex', alignItems: 'baseline', flexGrow: 1, marginRight: '8px', overflow: 'hidden' }}>
            <strong style={{ 
              fontSize: (hasSopParent || isContainer) ? '12px' : '13px', 
              color: (hasSopParent || isContainer) ? '#b91c1c' : '#333', 
              fontWeight: 600,
              lineHeight: 1.2,
              marginRight: isContainer && (data.childSopNodeIds?.length ?? 0) > 0 ? '6px' : '0', // Add margin only if count is present
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              transition: 'color 0.2s',
            }}
            title={formattedLabel} // Show full label on hover
            >
              {formattedLabel}
            </strong>
            {isContainer && (data.childSopNodeIds?.length ?? 0) > 0 && (
              <span style={{
                fontSize: '10px',
                color: (hasSopParent || isContainer) ? '#c05621' : '#718096', 
                fontWeight: 400,
                whiteSpace: 'nowrap', // Prevent count from wrapping
              }}>
                ({data.childSopNodeIds?.length} {data.childSopNodeIds?.length === 1 ? 'item' : 'items'})
              </span>
            )}
          </div>

          {/* Buttons Container (Toggle and Edit) */}
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            {/* Container Toggle Button */}
            {isContainer && (
              <button
                onClick={handleToggleChildrenCollapse}
                title={areChildrenExpanded ? "Collapse Children" : "Expand Children"}
                className="node-collapse-toggle p-1 rounded hover:bg-red-100 focus:outline-none focus:ring-1 focus:ring-red-300"
                style={{
                  cursor: 'pointer',
                  color: '#b91c1c' 
                }}
              >
                <ChevronUp size={16} style={{ transform: areChildrenExpanded ? 'none' : 'rotate(180deg)', transition: 'transform 0.2s' }} />
              </button>
            )}
            
            {/* Edit button - shows when content is expanded (non-containers) or when hovered (containers) */}
            {((isContentExpanded && hasExpandableContent && !isContainer) || (isContainer && isHovered)) && (
              <button 
                onClick={openDetailedEditor}
                title="Edit Step Details"
                style={{
                  background: (hasSopParent || isContainer) ? 'rgba(254, 226, 226, 0.5)' : 'rgba(0, 0, 0, 0.05)', 
                  border: (hasSopParent || isContainer) ? '1px solid rgba(252, 165, 165, 0.5)' : '1px solid rgba(0, 0, 0, 0.1)', 
                  color: (hasSopParent || isContainer) ? '#991b1b' : '#555', 
                  marginLeft: isContainer ? '5px' : '0', // Add left margin only if container toggle is present
                  cursor: 'pointer',
                  padding: '3px',
                  width: '22px',
                  height: '22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  opacity: 0.85,
                  transition: 'all 0.2s ease',
                  zIndex: 5,
                }}
                onMouseOver={(e) => { e.currentTarget.style.opacity = '1'; }}
                onMouseOut={(e) => { e.currentTarget.style.opacity = '0.85'; }}
              >
                <Edit2 size={14} style={{ strokeWidth: 2 }} />
              </button>
            )}
          </div>
        </div>
        
        {/* Intent Section (Always visible) */}
        {intentText && (
          <div style={{ 
            fontSize: (hasSopParent || isContainer) ? '10px' : '11px', 
            color: (hasSopParent || isContainer) ? '#7f1d1d' : '#555', // Slightly darker red for intent
            lineHeight: 1.3,
            maxHeight: isContentExpanded ? 'none' : ((hasSopParent || isContainer) ? '2.6em' : '2.6em'), // Max 2 lines if not expanded
            overflow: 'hidden',
            textOverflow: isContentExpanded ? 'clip' : 'ellipsis',
            display: isContentExpanded ? 'block' : '-webkit-box',
            WebkitLineClamp: isContentExpanded ? 'none' : 2,
            WebkitBoxOrient: 'vertical',
            transition: 'all 0.2s ease-in-out',
            marginTop: '4px', // Space below header
          }}>
            {intentText}
          </div>
        )}
        
        {/* Context Section (Only visible when content is expanded, and not a container) */}
        {!isContainer && isContentExpanded && contextText && (
          <div 
            style={{ 
              maxHeight: isContentExpanded ? '200px' : '0', // Expandable area for context
              opacity: isContentExpanded ? 1 : 0,
              overflow: 'hidden',
              transition: 'all 0.3s ease-in-out',
              marginTop: isContentExpanded ? '8px' : '0',
            }}
          >
            {/* Divider */}
            <div style={{
              height: '1px',
              background: (hasSopParent || isContainer) ? 'rgba(252, 165, 165, 0.3)' : 'rgba(0, 0, 0, 0.05)', // Lighter red divider
              margin: '6px 0',
            }} />
            
            <div style={{ 
              fontSize: (hasSopParent || isContainer) ? '9px' : '10px', 
              color: (hasSopParent || isContainer) ? '#7f1d1d' : '#555',
              lineHeight: 1.3,
              padding: '2px 0',
              fontStyle: 'normal',
              opacity: 0.85,
            }}>
              {contextText}
            </div>
          </div>
        )}
        
        {/* Collapse button for content (Only for non-containers with expandable content) */}
        {!isContainer && hasExpandableContent && isContentExpanded && (
          <div 
            style={{
              position: 'absolute',
              bottom: '-12px', // Position it cleanly below the main content box
              left: '50%',
              transform: 'translateX(-50%)',
              cursor: 'pointer',
              zIndex: 2, // Ensure it's clickable
              background: (hasSopParent || isContainer) ? 'rgba(254, 226, 226, 0.8)' : 'rgba(243, 244, 246, 0.8)', // Semi-transparent background
              borderRadius: '6px',
              padding: '1px 3px',
              border: (hasSopParent || isContainer) ? '1px solid rgba(252, 165, 165, 0.7)' : '1px solid rgba(229, 231, 235, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isHovered ? 1 : 0.8, // Show more clearly on hover
              transition: 'opacity 0.2s',
            }}
            onClick={toggleContentExpand}
            title="Collapse Content"
          >
            <ChevronUp size={12} style={{ strokeWidth: 2.5, color: (hasSopParent || isContainer) ? '#991b1b' : '#555' }} />
          </div>
        )}
        
        {/* Visual indicator for expandable content (Only for non-containers with expandable content, when not expanded and not hovered) */}
        {!isContainer && hasExpandableContent && !isContentExpanded && !isHovered && (
          <div 
            style={{
              position: 'absolute',
              bottom: '-2px', 
              left: '50%',
              transform: 'translateX(-50%)',
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              background: (hasSopParent || isContainer) ? 'rgba(252, 165, 165, 0.5)' : 'rgba(0, 0, 0, 0.15)', // Red-themed dot
              opacity: 0.7,
              transition: 'opacity 0.2s',
            }}
            title="Click to expand content"
          />
        )}
      </div> {/* End of main content div */}

      {/* Child Node Container */}
      {isContainer && areChildrenExpanded && (
        <div
          className="relative w-full" // Tailwind classes for width and relative positioning
          style={{
            background: 'rgba(254, 242, 242, 0.5)', // Lighter red tint for child area, slightly more opaque
            minHeight: data.calculatedHeight ? Math.max(data.calculatedHeight - (data.intent ? 80 : 60), 100) : '150px', // Dynamically adjust based on header height, ensure minimum
            padding: '20px',
            marginTop: '10px', // Space between parent content and child container
            borderRadius: '6px', 
            borderTop: '1px solid rgba(252, 165, 165, 0.5)', // Separator line with red tint
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.03)', // Subtle inner shadow for depth
          }}
          data-child-container="true"
        >
          {/* ReactFlow renders children here. Ensure this div allows children to be rendered into it. */}
        </div>
      )}
      
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