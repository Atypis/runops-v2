'use client';

import React, { useState, useCallback } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { ChevronUp, Edit2, ListTodo } from 'lucide-react';

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
  
  // Check if this node is a parent container
  const isContainer = !!data.isContainer;
  const childCount = data.childCount || 0;
  
  // Check if this node has a parent
  const hasParent = !!data.parentNode || !!data.parentId;
  const isChild = data.isChildNode === true;
  
  // Format the label with ID path if available but avoid double brackets
  const formattedLabel = data.id_path 
    ? (!data.id_path.startsWith('[') ? `[${data.id_path}]` : data.id_path) + ` ${data.label}`
    : data.label;
  
  // Node dimensions - explicitly set to ensure consistent layout
  const nodeWidth = hasParent ? 220 : (isContainer ? data.calculatedWidth || 450 : 240);
  const nodeHeight = isContainer ? data.calculatedHeight || 300 : 'auto';

  // Use intent or description for primary content display
  const intentText = data.intent || data.description || '';
  // Use context as secondary content when available
  const contextText = data.context || '';
  
  // Has expandable content
  const hasExpandableContent = !!contextText;
  
  // NEW: Calculate nesting depth by counting the dots in id_path
  const getNestingDepth = (): number => {
    if (!data.id_path) return 0;
    const dotCount = (data.id_path.match(/\./g) || []).length;
    return dotCount;
  };
  
  // NEW: Get color shades based on nesting depth
  const getDepthColors = () => {
    const depth = getNestingDepth();
    
    // Base color for steps is blue/cyan
    switch (depth) {
      case 0: return { border: '#a5d8ff', bg: 'rgba(240, 249, 255, 0.8)', headerBg: 'rgb(224, 242, 254)' };
      case 1: return { border: '#7cc2ff', bg: 'rgba(235, 246, 255, 0.85)', headerBg: 'rgb(219, 239, 251)' };
      case 2: return { border: '#59acff', bg: 'rgba(230, 243, 255, 0.9)', headerBg: 'rgb(214, 236, 249)' };
      case 3: return { border: '#3b96ff', bg: 'rgba(225, 240, 255, 0.95)', headerBg: 'rgb(209, 233, 247)' };
      default: return { border: '#1c80ff', bg: 'rgba(220, 237, 255, 1)', headerBg: 'rgb(204, 230, 245)' };
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
      backgroundColor: '#0ea5e9',
      color: 'white',
      fontWeight: 'bold',
      fontSize: '10px',
      width: '16px',
      height: '16px',
      borderRadius: '50%',
      marginRight: '4px'
    };
  };
  
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

  // Use nesting colors instead of fixed colors
  const nodeStyle = {
    backgroundColor: getDepthColors().bg,
    borderColor: getDepthColors().border,
    // Keep other style properties
  };

  return (
    <div 
      style={{
        background: isChild ? 'rgba(255, 248, 248, 0.97)' : '#ffffff',
        border: isChild ? '1px solid #ef4444' : isContainer ? '2px solid #0ea5e9' : '1px solid #e2e8f0',
        borderRadius: isChild ? '8px' : '6px',
        padding: isChild ? '12px' : '14px',
        width: nodeWidth,
        height: nodeHeight,
        boxSizing: 'border-box',
        fontSize: '12px',
        boxShadow: isChild 
          ? '0 2px 6px rgba(239, 68, 68, 0.15)' 
          : isContainer ? '0 4px 8px rgba(14, 165, 233, 0.15)' : '0 2px 5px rgba(0, 0, 0, 0.08)',
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer', // Indicate it's clickable
        transform: isExpanded ? 'scale(1.02)' : 'scale(1)', // Subtle scaling when expanded
      }}
      className={`
        relative
        group
        ${selected ? 'node-selected' : ''}
      `}
      data-node-type="step" 
      data-is-child={isChild ? 'true' : 'false'}
      data-is-container={isContainer ? 'true' : 'false'}
      data-is-expanded={isExpanded ? 'true' : 'false'}
      data-nesting-depth={getNestingDepth()}
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

      {/* Header section with clear padding for container nodes */}
      <div style={{ 
        position: 'relative',
        padding: isContainer ? '0 0 20px 0' : '0',
        marginBottom: isContainer ? '15px' : '0',
        borderBottom: isContainer ? '1px dashed rgba(14, 165, 233, 0.3)' : 'none',
      }}>
        {/* Node Title */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          marginBottom: '4px'
        }}>
          <strong style={{ 
            fontSize: isChild ? '12px' : '13px', 
            color: isChild ? '#991b1b' : isContainer ? '#0369a1' : '#333',
            fontWeight: 600,
            lineHeight: 1.2,
            marginRight: '4px',
            flex: 1,
            transition: 'color 0.2s',
          }}>
            {/* Add depth indicator */}
            {getNestingDepth() > 0 && (
              <span style={getDepthIndicatorStyle()}>{getNestingDepth()}</span>
            )}
            {formattedLabel}
          </strong>
          
          {/* Edit button - only shows when expanded */}
          {isExpanded && hasExpandableContent && (
            <button 
              onClick={openDetailedEditor}
              style={{
                background: isChild ? 'rgba(239, 68, 68, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                border: isChild ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(0, 0, 0, 0.1)',
                cursor: 'pointer',
                padding: '3px',
                width: '22px',
                height: '22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                color: isChild ? '#991b1b' : '#555',
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
            fontSize: isChild ? '10px' : '11px', 
            color: isChild ? '#666' : '#555',
            lineHeight: 1.3,
            maxHeight: isExpanded ? 'none' : (isChild ? '2.6em' : '2.6em'), 
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
                background: isChild ? 'rgba(239, 68, 68, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                margin: '2px 0 6px 0',
              }} />
              
              <div style={{ 
                fontSize: isChild ? '9px' : '10px', 
                color: isChild ? '#666' : '#555',
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
        
        {/* Child container indication for parent nodes */}
        {isContainer && childCount > 0 && (
          <div style={{
            marginTop: '8px',
            padding: '4px 8px',
            background: 'rgba(14, 165, 233, 0.08)',
            borderRadius: '4px',
            fontSize: '11px',
            color: '#0369a1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '1px dashed rgba(14, 165, 233, 0.3)'
          }}>
            <span>
              <ListTodo size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
              Contains {childCount} steps
            </span>
          </div>
        )}
      </div>
      
      {/* Container for child nodes - only visible for container nodes */}
      {isContainer && (
        <div style={{
          position: 'absolute',
          top: '100px', // Below header
          left: '10px',
          right: '10px',
          bottom: '10px',
          background: 'rgba(14, 165, 233, 0.04)',
          borderRadius: '6px',
          border: '1px dashed rgba(14, 165, 233, 0.2)',
          zIndex: 0
        }} />
      )}
      
      {/* Collapse button - only visible when expanded */}
      {isExpanded && (
        <div 
          style={{
            position: 'absolute',
            bottom: '-10px',
            left: '50%',
            transform: 'translateX(-50%)',
            cursor: 'pointer',
            zIndex: 6,
            background: isChild ? 'rgba(239, 68, 68, 0.08)' : 'rgba(0, 0, 0, 0.05)',
            borderRadius: '8px',
            padding: '2px 4px',
            border: isChild ? '1px solid rgba(239, 68, 68, 0.15)' : '1px solid rgba(0, 0, 0, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.8,
          }}
          onClick={toggleExpand}
          title="Collapse"
        >
          <ChevronUp size={12} style={{ strokeWidth: 2.5, color: isChild ? '#991b1b' : '#555' }} />
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
            background: isChild ? 'rgba(239, 68, 68, 0.3)' : 'rgba(0, 0, 0, 0.15)',
            opacity: 0.6,
            transition: 'opacity 0.2s',
          }}
          title="Click to expand"
        />
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