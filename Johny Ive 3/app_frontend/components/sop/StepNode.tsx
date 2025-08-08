'use client';

import React, { useState, useCallback } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { ChevronUp, Edit2 } from 'lucide-react';
import { CredentialIndicator } from './CredentialIndicator';

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
  // Container-related properties
  childSopNodeIds?: string[]; // Array of child node IDs
  isCollapsible?: boolean; // Whether this node can be collapsed/expanded
  calculatedWidth?: number; // Container width calculated by layout algorithm
  calculatedHeight?: number; // Container height calculated by layout algorithm
  containerWidth?: number; // Number of columns for children
  currentDepth?: number; // Depth in the nesting hierarchy
  maxDepth?: number; // Maximum depth in the entire structure
  // Credential-related properties
  credentialStatus?: 'none' | 'missing' | 'partial' | 'complete';
  requiredCredentials?: string[];
  configuredCredentials?: string[];
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
  
  // NEW: Check if this node is a container (has children)
  const isContainer = !!(data.childSopNodeIds && data.childSopNodeIds.length > 0);
  const childCount = data.childSopNodeIds?.length || 0;
  
  // Format the label with ID path if available but avoid double brackets
  const formattedLabel = data.id_path 
    ? (!data.id_path.startsWith('[') ? `[${data.id_path}]` : data.id_path) + ` ${data.label}`
    : data.label;
  
  // Node dimensions - use calculated dimensions for containers
  const nodeWidth = isContainer 
    ? (data.calculatedWidth || 450) // Use calculated width for containers
    : (hasParent ? 220 : 240); // Use regular width for non-containers
    
  const nodeHeight = isContainer 
    ? (data.calculatedHeight || 250) // Use calculated height for containers
    : 'auto'; // Auto height for regular nodes

  // Add logging for container width calculations
  if (isContainer) {
    console.log(`[STEP-NODE-WIDTH] ${id} (${data.label}):`);
    console.log(`  - Is container: ${isContainer}`);
    console.log(`  - Child count: ${childCount}`);
    console.log(`  - data.calculatedWidth: ${data.calculatedWidth}`);
    console.log(`  - Final nodeWidth: ${nodeWidth}`);
    console.log(`  - data.calculatedHeight: ${data.calculatedHeight}`);
    console.log(`  - Final nodeHeight: ${nodeHeight}`);
    console.log(`  - Has parent: ${hasParent}`);
  }

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
      zIndex: 10, // CRITICAL FIX: Much higher z-index to be above child containers (was 3)
      borderRadius: '50%',
      pointerEvents: 'all' as const, // CRITICAL FIX: Ensure handles are interactive
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)', // Add shadow for better visibility
      position: 'absolute' as const // Ensure absolute positioning
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
        // CRITICAL FIX: Make container backgrounds transparent to show edges
        background: isContainer 
          ? 'transparent' // Was: rgba(139, 92, 246, 0.05-0.08) - now transparent for containers
          : (hasParent ? 'rgba(255, 248, 248, 0.97)' : '#ffffff'), // Keep original colors for non-containers
        border: isContainer 
          ? (hasParent ? '2px dashed rgba(139, 92, 246, 0.4)' : '2px dashed rgba(139, 92, 246, 0.5)') // Changed to dashed for visual grouping
          : (hasParent ? '1px solid #ef4444' : '1px solid #e2e8f0'), // Original borders for non-containers
        borderRadius: hasParent ? '8px' : '6px',
        padding: isContainer ? '16px' : (hasParent ? '12px' : '14px'), // More padding for containers
        width: nodeWidth,
        height: nodeHeight,
        boxSizing: 'border-box',
        fontSize: '12px',
        boxShadow: isContainer
          ? 'none' // Remove shadow for containers to reduce visual clutter 
          : (hasParent 
            ? '0 2px 6px rgba(239, 68, 68, 0.15)' 
            : '0 2px 5px rgba(0, 0, 0, 0.08)'), // Original shadows for non-containers
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden', // Was: isContainer ? 'visible' : 'hidden' - now always hidden like LoopNode
        cursor: 'pointer', // Indicate it's clickable
      }}
      className={`${hasParent ? 'child-node' : 'regular-node'} ${isContainer ? 'container-node' : ''} ${isExpanded ? 'expanded' : ''}`}
      data-node-type="step" 
      data-is-child={hasParent ? 'true' : 'false'}
      data-is-container={isContainer ? 'true' : 'false'}
      data-child-count={isContainer ? childCount.toString() : '0'}
      data-is-expanded={isExpanded ? 'true' : 'false'}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={toggleExpand} // Directly toggle on click
    >
      {/* Credential Status Indicator */}
      {data.credentialStatus && data.credentialStatus !== 'none' && (
        <CredentialIndicator
          status={data.credentialStatus}
          requiredCount={data.requiredCredentials?.length || 0}
          configuredCount={data.configuredCredentials?.length || 0}
          onClick={() => {
            // TODO: Open credential panel
            console.log('Open credential panel for node:', id);
          }}
        />
      )}
      
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
            color: isContainer 
              ? (hasParent ? '#7c3aed' : '#6d28d9') // Purple for containers
              : (hasParent ? '#991b1b' : '#333'), // Original colors for non-containers
            fontWeight: 600,
            lineHeight: 1.2,
            marginRight: '4px',
            flex: 1,
            transition: 'color 0.2s',
          }}>
            {formattedLabel}
            {/* Container indicator */}
            {isContainer && (
              <span style={{
                display: 'inline-block',
                marginLeft: '6px',
                fontSize: '10px',
                color: hasParent ? 'rgba(124, 58, 237, 0.7)' : 'rgba(109, 40, 217, 0.7)',
                backgroundColor: hasParent ? 'rgba(124, 58, 237, 0.1)' : 'rgba(109, 40, 217, 0.1)',
                padding: '1px 4px',
                borderRadius: '3px',
                fontWeight: 500,
              }}>
                📦 {childCount}
              </span>
            )}
          </strong>
          
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
      
      {/* Container area for child nodes - only rendered when this is a container */}
      {isContainer && (
        <div 
          className="relative w-full"
          style={{
            width: '100%',
            minWidth: '100%', // Ensure it takes full width
            minHeight: '120px', // Minimum height for container area
            // CRITICAL FIX: Make background transparent to show edges
            backgroundColor: 'transparent', // Was: rgba(139, 92, 246, 0.01-0.02)
            border: hasParent 
              ? '1px dashed rgba(139, 92, 246, 0.3)' // Changed to dashed for visual grouping
              : '1px dashed rgba(139, 92, 246, 0.4)', // Changed to dashed for visual grouping
            padding: '20px',
            marginTop: '8px',
            marginLeft: '0', // Ensure no margin offset
            marginRight: '0', // Ensure no margin offset
            position: 'relative',
            zIndex: 1, // CRITICAL FIX: Low z-index to be below handles and edges
            // CRITICAL FIX: Add explicit opacity like LoopNode
            opacity: 1, // ADDED: Explicit opacity like LoopNode has
            // Ensure container area spans full width
            boxSizing: 'border-box',
            // Override any inherited width constraints
            maxWidth: 'none',
          }}
          data-child-container="true"
        >
          {/* Container metadata footer */}
          <div style={{
            position: 'absolute',
            bottom: '4px',
            left: '8px',
            fontSize: '9px',
            color: hasParent ? 'rgba(124, 58, 237, 0.6)' : 'rgba(109, 40, 217, 0.6)',
            opacity: 0.7,
          }}>
            {childCount} items • {data.containerWidth || 3}-wide
            {data.currentDepth && ` • Level ${data.currentDepth}`}
          </div>
        </div>
      )}
    </div>
  );
};

export default StepNode; 