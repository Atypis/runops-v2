'use client';

import React, { useState, useCallback } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { ChevronUp, Edit2 } from 'lucide-react';

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
  [key: string]: any; // Allow other properties
}

const StepNode: React.FC<NodeProps<StepNodeData>> = ({ data, id, isConnectable, selected }) => {
  // Local state for expanded/collapsed view
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  // Get ReactFlow instance to access its methods
  const { getNodes } = useReactFlow();
  
  // Check if this node has a parent
  const hasParent = !!data.parentNode || !!data.parentId;
  const isContainer = !!(data.childSopNodeIds && data.childSopNodeIds.length > 0);
  const childrenExpanded = data.isExpanded !== false;
  
  // Format the label with ID path if available but avoid double brackets
  const formattedLabel = data.id_path 
    ? (!data.id_path.startsWith('[') ? `[${data.id_path}]` : data.id_path) + ` ${data.label}`
    : data.label;
  
  // Node dimensions - explicitly set to ensure consistent layout
  const nodeWidth = hasParent ? 220 : 240;

  // Use intent or description for primary content display
  const intentText = data.intent || data.description || '';
  // Use context as secondary content when available
  const contextText = data.context || '';
  
  // Has expandable content
  const hasExpandableContent = !!contextText;
  
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

  // Toggle expanded view (now triggered by clicking the node)
  const toggleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent default ReactFlow node selection
    setIsExpanded(!isExpanded);
  }, [isExpanded]);
  
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
        background: hasParent ? 'rgba(255, 248, 248, 0.97)' : '#ffffff',
        border: hasParent ? '1px solid #ef4444' : '1px solid #e2e8f0',
        borderRadius: hasParent ? '8px' : '6px',
        padding: hasParent ? '12px' : '14px',
        width: nodeWidth,
        minHeight: isContainer ? (data.calculatedHeight || 250) : undefined,
        boxSizing: 'border-box',
        fontSize: '12px',
        boxShadow: hasParent 
          ? '0 2px 6px rgba(239, 68, 68, 0.15)' 
          : '0 2px 5px rgba(0, 0, 0, 0.08)',
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer', // Indicate it's clickable
        transform: isExpanded ? 'scale(1.02)' : 'scale(1)', // Subtle scaling when expanded
      }}
      className={`${hasParent ? 'child-node' : 'regular-node'} ${isExpanded ? 'expanded' : ''}`}
      data-node-type="step" 
      data-is-child={hasParent ? 'true' : 'false'}
      data-is-expanded={isExpanded ? 'true' : 'false'}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={toggleExpand} // Directly toggle on click
    >
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
          alignItems: 'flex-start',
          marginBottom: '4px'
        }}>
          <strong style={{ 
            fontSize: hasParent ? '12px' : '13px', 
            color: hasParent ? '#991b1b' : '#333',
            fontWeight: 600,
            lineHeight: 1.2,
            marginRight: '4px',
            flex: 1,
            transition: 'color 0.2s',
          }}>
            {formattedLabel}
          </strong>
          
          {/* Container collapse toggle */}
          {isContainer && (
            <button
              onClick={(e) => { e.stopPropagation(); data.onToggleCollapse?.(id); }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '4px'
              }}
              title={childrenExpanded ? 'Collapse' : 'Expand'}
            >
              <ChevronUp size={12} style={{ transform: childrenExpanded ? 'none' : 'rotate(180deg)' }} />
            </button>
          )}

          {/* Edit button - only shows when expanded */}
          {isExpanded && hasExpandableContent && (
            <button
              onClick={openDetailedEditor}
              style={{
                background: hasParent ? 'rgba(239, 68, 68, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                border: hasParent ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(0, 0, 0, 0.1)',
                cursor: 'pointer',
                padding: '3px',
                width: '22px',
                height: '22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                color: hasParent ? '#991b1b' : '#555',
                opacity: 0.85,
                transition: 'all 0.2s ease',
                zIndex: 5,
              }}
              onMouseOver={(e) => { e.currentTarget.style.opacity = '1'; }}
              onMouseOut={(e) => { e.currentTarget.style.opacity = '0.85'; }}
              title="Open detailed editor"
            >
              <Edit2 size={14} style={{ strokeWidth: 2 }} />
            </button>
          )}
        </div>
        
        {/* Intent Section (Always visible) */}
        {intentText && (
          <div style={{ 
            fontSize: hasParent ? '10px' : '11px', 
            color: hasParent ? '#666' : '#555',
            lineHeight: 1.3,
            maxHeight: isExpanded ? 'none' : (hasParent ? '2.6em' : '2.6em'), 
            overflow: 'hidden',
            textOverflow: isExpanded ? 'clip' : 'ellipsis',
            display: isExpanded ? 'block' : '-webkit-box',
            WebkitLineClamp: isExpanded ? 'none' : 2,
            WebkitBoxOrient: 'vertical',
            transition: 'all 0.2s ease-in-out',
          }}>
            {intentText}
          </div>
        )}
        
        {/* Context Section (Only visible when expanded) */}
        <div 
          style={{ 
            maxHeight: isExpanded ? '200px' : '0',
            opacity: isExpanded ? 1 : 0,
            overflow: 'hidden',
            transition: 'all 0.3s ease-in-out',
            marginTop: isExpanded ? '8px' : '0',
          }}
        >
          {contextText && (
            <>
              {/* Divider */}
              <div style={{
                height: '1px',
                background: hasParent ? 'rgba(239, 68, 68, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                margin: '2px 0 6px 0',
              }} />
              
              <div style={{ 
                fontSize: hasParent ? '9px' : '10px', 
                color: hasParent ? '#666' : '#555',
                lineHeight: 1.3,
                padding: '2px 0',
                fontStyle: 'normal',
                opacity: 0.85,
              }}>
                {contextText}
              </div>
            </>
          )}
        </div>
        
        {/* Collapse button - only visible when expanded */}
        {isExpanded && (
          <div 
            style={{
              position: 'absolute',
              bottom: '-10px',
              left: '50%',
              transform: 'translateX(-50%)',
              cursor: 'pointer',
              zIndex: 2,
              background: hasParent ? 'rgba(239, 68, 68, 0.08)' : 'rgba(0, 0, 0, 0.05)',
              borderRadius: '8px',
              padding: '2px 4px',
              border: hasParent ? '1px solid rgba(239, 68, 68, 0.15)' : '1px solid rgba(0, 0, 0, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.8,
            }}
            onClick={toggleExpand}
            title="Collapse"
          >
            <ChevronUp size={12} style={{ strokeWidth: 2.5, color: hasParent ? '#991b1b' : '#555' }} />
          </div>
        )}
        
        {/* Visual indicator for expandable content - only shown when not expanded and not hovered */}
        {hasExpandableContent && !isExpanded && !isHovered && (
          <div
            style={{
              position: 'absolute',
              bottom: '-2px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              background: hasParent ? 'rgba(239, 68, 68, 0.3)' : 'rgba(0, 0, 0, 0.15)',
              opacity: 0.6,
              transition: 'opacity 0.2s',
            }}
            title="Click to expand"
          />
        )}
      </div>

      {isContainer && childrenExpanded && (
        <div
          style={{
            minHeight: Math.max((data.calculatedHeight || 250) - 80, 200),
            padding: '20px',
            position: 'relative',
            background: 'rgba(254,226,226,0.3)',
          }}
          data-child-container="true"
        ></div>
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