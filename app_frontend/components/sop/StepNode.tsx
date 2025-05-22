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
  
  // Format the label with ID path if available but avoid double brackets
  const formattedLabel = data.id_path 
    ? (!data.id_path.startsWith('[') ? `[${data.id_path}]` : data.id_path) + ` ${data.label}`
    : data.label;
  
  // Determine if this node is a parent container
  const isParent = data.isParentContainer === true;
  const stepParentHeaderHeight = 60; // Should match SOPFlowView's getHeaderHeights for step parents

  // Node dimensions - explicitly set for parents, otherwise use existing logic
  const nodeWidth = isParent ? data.calculatedWidth : (hasParent ? 220 : 240);
  // For non-parents, height is dynamic. For parents, it's calculated.
  const nodeHeight = isParent ? data.calculatedHeight : undefined; 

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
    <div // Main container div
      style={{
        width: nodeWidth,
        height: nodeHeight, // Applied only if isParent is true, otherwise auto
        background: isParent ? '#e0f2fe' : (hasParent ? 'rgba(255, 248, 248, 0.97)' : '#ffffff'), // Light blue for parent, existing for others
        border: isParent ? '1px solid #7dd3fc' : (hasParent ? '1px solid #ef4444' : '1px solid #e2e8f0'), // Sky blue border for parent
        borderRadius: isParent ? '10px' : (hasParent ? '8px' : '6px'),
        padding: isParent ? '0px' : (hasParent ? '12px' : '14px'), // No padding for parent main div, handled internally
        boxSizing: 'border-box',
        fontSize: '12px',
        boxShadow: isParent 
          ? '0 4px 10px rgba(0, 123, 255, 0.15)' 
          : (hasParent ? '0 2px 6px rgba(239, 68, 68, 0.15)' : '0 2px 5px rgba(0, 0, 0, 0.08)'),
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden', // Important for parent container
        cursor: isParent ? 'default' : 'pointer', // Default cursor for parent, pointer for regular
        transform: !isParent && isExpanded ? 'scale(1.02)' : 'scale(1)',
      }}
      className={`${isParent ? 'parent-step-node' : (hasParent ? 'child-node' : 'regular-node')} ${isExpanded ? 'expanded' : ''}`}
      data-node-type="step"
      data-is-parent-container={isParent ? 'true' : 'false'}
      data-is-child={hasParent ? 'true' : 'false'}
      data-is-expanded={isExpanded ? 'true' : 'false'}
      onMouseEnter={() => !isParent && setIsHovered(true)} // Hover effects only for non-parents
      onMouseLeave={() => !isParent && setIsHovered(false)}
      onClick={isParent ? undefined : toggleExpand} // Click toggles only for non-parents
    >
      {/* Handles are always present */}
      <Handle id="top" type="target" position={Position.Top} style={getHandleStyle(Position.Top)} isConnectable={isConnectable} />
      <Handle id="bottom" type="source" position={Position.Bottom} style={getHandleStyle(Position.Bottom)} isConnectable={isConnectable} />
      <Handle id="right" type="source" position={Position.Right} style={getHandleStyle(Position.Right)} isConnectable={isConnectable} />
      <Handle id="left" type="target" position={Position.Left} style={getHandleStyle(Position.Left)} isConnectable={isConnectable} />

      {isParent ? (
        // PARENT CONTAINER RENDERING
        <>
          {/* Header Section for Parent StepNode */}
          <div 
            style={{ 
              height: stepParentHeaderHeight, 
              padding: '10px 14px', // Inner padding for header content
              boxSizing: 'border-box',
              borderBottom: '1px solid #bae6fd', // Light blue border
              background: '#f0f9ff', // Very light blue background for header
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center', // Center content vertically
            }}
            onClick={toggleExpand} // Header is clickable to expand/collapse its own content
            className="parent-node-header"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
              <strong style={{ fontSize: '14px', color: '#0c4a6e', fontWeight: 600, lineHeight: 1.2, flex: 1 }}>
                {formattedLabel}
              </strong>
              {isExpanded && hasExpandableContent && (
                <button onClick={openDetailedEditor} style={{ background: 'rgba(125, 211, 252, 0.2)', border: '1px solid rgba(56, 189, 248, 0.3)', cursor: 'pointer', padding: '3px', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', color: '#0369a1', opacity: 0.85, transition: 'all 0.2s ease', zIndex: 5 }} onMouseOver={(e) => { e.currentTarget.style.opacity = '1'; }} onMouseOut={(e) => { e.currentTarget.style.opacity = '0.85'; }} title="Open detailed editor">
                  <Edit2 size={14} style={{ strokeWidth: 2 }} />
                </button>
              )}
            </div>

            {intentText && (
              <div style={{ fontSize: '11px', color: '#075985', lineHeight: 1.3, maxHeight: isExpanded ? 'none' : '2.6em', overflow: 'hidden', textOverflow: isExpanded ? 'clip' : 'ellipsis', display: isExpanded ? 'block' : '-webkit-box', WebkitLineClamp: isExpanded ? 'none' : 2, WebkitBoxOrient: 'vertical', transition: 'all 0.2s ease-in-out' }}>
                {intentText}
              </div>
            )}
            {isExpanded && contextText && ( // Context only shown when header content is expanded
              <>
                <div style={{ height: '1px', background: 'rgba(125, 211, 252, 0.2)', margin: '2px 0 6px 0' }} />
                <div style={{ fontSize: '10px', color: '#075985', lineHeight: 1.3, padding: '2px 0', fontStyle: 'normal', opacity: 0.85 }}>
                  {contextText}
                </div>
              </>
            )}
             {/* Child count display */}
            {data.childSopNodeIds && data.childSopNodeIds.length > 0 && (
              <div style={{ fontSize: '10px', color: '#0369a1', marginTop: 'auto', paddingTop: '4px', textAlign: 'right', opacity: 0.8 }}>
                Children: {data.childSopNodeIds.length}
              </div>
            )}
            {isExpanded && ( // Collapse button for header content
              <div style={{ position: 'absolute', bottom: stepParentHeaderHeight - 58, /* Adjust based on actual placement */ left: '50%', transform: 'translateX(-50%)', cursor: 'pointer', zIndex: 2, background: 'rgba(125, 211, 252, 0.15)', borderRadius: '8px', padding: '2px 4px', border: '1px solid rgba(125, 211, 252, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.8 }} onClick={toggleExpand} title="Collapse Header Content">
                <ChevronUp size={12} style={{ strokeWidth: 2.5, color: '#0369a1' }} />
              </div>
            )}
          </div>

          {/* Child Content Area */}
          <div 
            style={{ 
              height: nodeHeight ? (nodeHeight - stepParentHeaderHeight) : 'auto', 
              backgroundColor: '#f0f9ff', // Slightly different background for child area, or could be transparent
              overflow: 'hidden', // Important for ReactFlow child rendering
              position: 'relative', // For absolute positioning of children by ReactFlow
            }}
            className="parent-node-content-area"
          >
            {/* ReactFlow will render child nodes here, this div is mostly a placeholder for styling and dimensions */}
          </div>
        </>
      ) : (
        // NON-PARENT (REGULAR) STEPNODE RENDERING (existing logic)
        // The main div already handles padding for non-parents.
        // The onClick for toggleExpand is on the main div for non-parents.
        <div style={{ position: 'relative' }}> 
          {/* Content of non-parent node */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
            <strong style={{ fontSize: hasParent ? '12px' : '13px', color: hasParent ? '#991b1b' : '#333', fontWeight: 600, lineHeight: 1.2, marginRight: '4px', flex: 1, transition: 'color 0.2s' }}>
              {formattedLabel}
            </strong>
            {isExpanded && hasExpandableContent && (
              <button onClick={openDetailedEditor} style={{ background: hasParent ? 'rgba(239, 68, 68, 0.1)' : 'rgba(0, 0, 0, 0.05)', border: hasParent ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(0, 0, 0, 0.1)', cursor: 'pointer', padding: '3px', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', color: hasParent ? '#991b1b' : '#555', opacity: 0.85, transition: 'all 0.2s ease', zIndex: 5 }} onMouseOver={(e) => { e.currentTarget.style.opacity = '1'; }} onMouseOut={(e) => { e.currentTarget.style.opacity = '0.85'; }} title="Open detailed editor">
                <Edit2 size={14} style={{ strokeWidth: 2 }} />
              </button>
            )}
          </div>
          {intentText && (
            <div style={{ fontSize: hasParent ? '10px' : '11px', color: hasParent ? '#666' : '#555', lineHeight: 1.3, maxHeight: isExpanded ? 'none' : (hasParent ? '2.6em' : '2.6em'), overflow: 'hidden', textOverflow: isExpanded ? 'clip' : 'ellipsis', display: isExpanded ? 'block' : '-webkit-box', WebkitLineClamp: isExpanded ? 'none' : 2, WebkitBoxOrient: 'vertical', transition: 'all 0.2s ease-in-out' }}>
              {intentText}
            </div>
          )}
          <div style={{ maxHeight: isExpanded ? '200px' : '0', opacity: isExpanded ? 1 : 0, overflow: 'hidden', transition: 'all 0.3s ease-in-out', marginTop: isExpanded ? '8px' : '0' }}>
            {contextText && (
              <>
                <div style={{ height: '1px', background: hasParent ? 'rgba(239, 68, 68, 0.1)' : 'rgba(0, 0, 0, 0.05)', margin: '2px 0 6px 0' }} />
                <div style={{ fontSize: hasParent ? '9px' : '10px', color: hasParent ? '#666' : '#555', lineHeight: 1.3, padding: '2px 0', fontStyle: 'normal', opacity: 0.85 }}>
                  {contextText}
                </div>
              </>
            )}
          </div>
          {isExpanded && (
            <div style={{ position: 'absolute', bottom: '-10px', left: '50%', transform: 'translateX(-50%)', cursor: 'pointer', zIndex: 2, background: hasParent ? 'rgba(239, 68, 68, 0.08)' : 'rgba(0, 0, 0, 0.05)', borderRadius: '8px', padding: '2px 4px', border: hasParent ? '1px solid rgba(239, 68, 68, 0.15)' : '1px solid rgba(0, 0, 0, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.8 }} onClick={toggleExpand} title="Collapse">
              <ChevronUp size={12} style={{ strokeWidth: 2.5, color: hasParent ? '#991b1b' : '#555' }} />
            </div>
          )}
          {hasExpandableContent && !isExpanded && !isHovered && (
            <div style={{ position: 'absolute', bottom: '-2px', left: '50%', transform: 'translateX(-50%)', width: '4px', height: '4px', borderRadius: '50%', background: hasParent ? 'rgba(239, 68, 68, 0.3)' : 'rgba(0, 0, 0, 0.15)', opacity: 0.6, transition: 'opacity 0.2s' }} title="Click to expand" />
          )}
        </div>
      )}
    </div>
  );
};

export default StepNode; 