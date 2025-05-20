import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { SOPNode } from '@/lib/types/sop';
import { RotateCw, ChevronUp, ChevronDown, Edit2, Eye, Layers, Clock } from 'lucide-react';

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
  id_path?: string; // Hierarchical ID for visual display
  intent?: string;
  context?: string;
  description?: string;
}

interface LoopNodeProps extends NodeProps {
  data: LoopNodeData;
}

// Display state enum
enum DisplayState {
  Collapsed,
  SemiExpanded,
  FullyExpanded
}

const LoopNode: React.FC<LoopNodeProps> = ({ id, data, selected }) => {
  // References for measuring content area height
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);
  
  // Track ReactFlow's expansion state
  const isFlowExpanded = data.isExpanded !== false;
  
  // Initialize our display state based on ReactFlow's expansion state
  const [displayState, setDisplayState] = useState<DisplayState>(() => {
    if (isFlowExpanded) {
      // If ReactFlow is showing children, we should be fully expanded
      return DisplayState.FullyExpanded;
    } else {
      // Default to semi-expanded if not explicitly collapsed
      return DisplayState.SemiExpanded;
    }
  });
  
  // Update content height when content changes or display state changes
  useEffect(() => {
    const updateContentHeight = () => {
      if (contentRef.current) {
        setContentHeight(contentRef.current.offsetHeight);
      }
    };
    
    updateContentHeight();
    
    // Use ResizeObserver to detect height changes dynamically
    const resizeObserver = new ResizeObserver(updateContentHeight);
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }
    
    return () => {
      if (contentRef.current) {
        resizeObserver.disconnect();
      }
    };
  }, [displayState, data.intent, data.context]);
  
  // Format the label with ID path if available but avoid double brackets
  const formattedLabel = data.id_path 
    ? (!data.id_path.startsWith('[') ? `[${data.id_path}]` : data.id_path) + ` ${data.label}`
    : data.label;
  
  // Other logic for handling child nodes
  const childCount = data.childSopNodeIds?.length || 0;
  const tooltipText = `${data.description || 'Loop'} (${childCount} ${childCount === 1 ? 'item' : 'items'})`;
  
  const isCompound = childCount > 0;
  
  // Estimates for metrics display
  const estimatedTimeMinutes = childCount * 3; // Simple heuristic: 3 min per child
  const complexityLevel = childCount <= 2 ? "Simple" : childCount <= 5 ? "Moderate" : "Complex";
  
  // Handle expansion state cycling 
  const handleExpansionToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Special case: if we're in semi-expanded state but ReactFlow already shows children
    if (displayState === DisplayState.SemiExpanded && isFlowExpanded) {
      // Just go to fully expanded state visually without toggling ReactFlow
      setDisplayState(DisplayState.FullyExpanded);
      return;
    }
    
    // Regular state cycling
    if (displayState === DisplayState.Collapsed) {
      setDisplayState(DisplayState.SemiExpanded);
    } else if (displayState === DisplayState.SemiExpanded) {
      setDisplayState(DisplayState.FullyExpanded);
      // Notify ReactFlow to expand
      if (data.onToggleCollapse && isCompound && !isFlowExpanded) {
        data.onToggleCollapse(id);
      }
    } else {
      setDisplayState(DisplayState.Collapsed);
      // Notify ReactFlow to collapse if needed
      if (data.onToggleCollapse && isCompound && isFlowExpanded) {
        data.onToggleCollapse(id);
      }
    }
  };
  
  // Open detailed editor (for a more comprehensive view)
  const openDetailedEditor = (e: React.MouseEvent) => {
    e.stopPropagation();
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
  };
  
  // Calculate the width and height for the container based on child count and display state
  let useWidth: number;
  let useHeight: number;
  
  // Always calculate the full size needed for children
  useWidth = data.calculatedWidth || (childCount > 0 ? Math.max(450, childCount * 120) : 320);
  
  // Calculate minimum height based on content + children
  // Add reasonable padding (60px) to accommodate the header and some spacing
  const contentBasedMinHeight = contentHeight + (childCount > 0 ? 240 : 60);
  useHeight = data.calculatedHeight || 
    (childCount > 0 ? Math.max(contentBasedMinHeight, childCount * 80) : contentBasedMinHeight);
  
  // Standardized handle styling that matches other nodes
  const getHandleStyle = (position: Position) => {
    // Base handle size and color for loop nodes
    const size = 12;
    const color = '#6366f1'; // Indigo color for loop handles
    
    const baseStyle = {
      background: color,
      width: size,
      height: size,
      border: '2px solid white',
      zIndex: 2, // Just below child node handles
      borderRadius: '50%'
    };
    
    // Position-specific styling
    switch (position) {
      case Position.Top:
        return {
          ...baseStyle,
          top: '0px',
          left: '50%', 
          transform: 'translate(-50%, -50%)', // Center handle on the top edge
        };
      case Position.Bottom:
        return {
          ...baseStyle,
          bottom: '0px',
          left: '50%',
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
  
  // Determine the visual styling based on display state
  const getNodeStyle = () => {
    // Base style
    const baseStyle = {
      width: useWidth,
      minHeight: useHeight,
      border: '2px solid',
      borderColor: '#d1d5f6',
    };
    
    // Style adjustments based on display state
    if (displayState === DisplayState.Collapsed) {
      return {
        ...baseStyle,
        backgroundColor: 'rgba(243, 232, 255, 0.1)',
        boxShadow: '0 2px 6px rgba(99, 102, 241, 0.08)',
        borderImage: 'linear-gradient(to bottom, #8287eb, #d1d5f6) 1'
      };
    } else if (displayState === DisplayState.SemiExpanded) {
      return {
        ...baseStyle,
        backgroundColor: 'rgba(243, 232, 255, 0.2)',
        boxShadow: '0 6px 12px rgba(99, 102, 241, 0.12), 0 2px 4px rgba(99, 102, 241, 0.1)'
      };
    } else {
      // Fully expanded
      return {
        ...baseStyle,
        backgroundColor: 'rgba(243, 232, 255, 0.3)',
        boxShadow: '0 8px 20px rgba(99, 102, 241, 0.15), 0 2px 6px rgba(99, 102, 241, 0.18)'
      };
    }
  };

  // Determine whether we should show the preview section
  const shouldShowPreview = displayState === DisplayState.SemiExpanded && 
                            childCount > 0 && 
                            !isFlowExpanded;
  
  return (
    <div
      className={`
        flex flex-col items-center
        ${selected ? 'outline outline-2 outline-offset-2 outline-purple-500 rounded-lg' : ''}
      `}
      data-node-type="loop"
      data-is-compound={isCompound ? 'true' : 'false'}
      data-display-state={displayState}
      data-child-count={childCount}
      data-flow-expanded={isFlowExpanded ? 'true' : 'false'}
    >
      <div
        className={`
          rounded-xl
          transition-all
          duration-300
          relative
          overflow-hidden
          group/loop
        `}
        style={getNodeStyle()}
        title={tooltipText}
      >
        {/* Folded corner decoration - visual cue for compound nodes */}
        {childCount > 0 && (
          <div 
            className="absolute top-0 right-0 w-8 h-8 bg-purple-50"
            style={{
              clipPath: 'polygon(100% 0, 100% 100%, 0 0)',
              borderLeft: '1px solid #d1d5f6',
              borderBottom: '1px solid #d1d5f6',
              zIndex: 1
            }}
          />
        )}
        
        {/* Content wrapper - header + details */}
        <div ref={contentRef} className="node-content-wrapper" data-node-content="true">
          {/* Loop node header with icon */}
          <div 
            className={`
              flex items-center justify-between px-3 py-2.5
              border-b
              cursor-pointer
              transition-colors
              ${selected ? 'bg-purple-50' : 'bg-white'} 
              group-hover/loop:bg-purple-50
              ${displayState !== DisplayState.Collapsed ? 'border-purple-200' : 'border-transparent'}
            `}
            onClick={handleExpansionToggle}
          >
            <div className="flex items-center space-x-2">
              <div
                className={`
                  w-8 h-8 
                  flex-shrink-0 
                  rounded-full 
                  flex items-center justify-center
                  ${selected ? 'bg-purple-100' : 'bg-purple-50'} 
                  group-hover/loop:bg-purple-100
                  transition-colors
                  border border-purple-300
                `}
              >
                <RotateCw size={15} className="text-purple-700" strokeWidth={2.5} />
              </div>
              
              <h3 
                className="font-medium text-sm text-purple-900 truncate max-w-[160px]"
                title={formattedLabel}
              >
                {formattedLabel}
              </h3>
            </div>
            
            <div className="flex items-center space-x-1">
              {/* Edit button - shows if expanded */}
              {displayState === DisplayState.SemiExpanded && (
                <button
                  onClick={openDetailedEditor}
                  className="p-1 rounded-md hover:bg-purple-100 text-purple-600 transition-colors"
                  title="Edit loop details"
                >
                  <Edit2 size={14} />
                </button>
              )}
              
              {/* Toggle button with state-appropriate icon and tooltip */}
              <button
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-purple-100 text-purple-600 transition-colors"
                title={
                  displayState === DisplayState.Collapsed ? "Show details" : 
                  (displayState === DisplayState.SemiExpanded && !isFlowExpanded) ? "Show child nodes" : 
                  "Collapse"
                }
              >
                {displayState === DisplayState.FullyExpanded || 
                 (displayState === DisplayState.SemiExpanded && isFlowExpanded) ? (
                  <ChevronUp size={16} />
                ) : (
                  <ChevronDown size={16} />
                )}
              </button>
            </div>
          </div>
          
          {/* Intent and Context Section - Only in semi-expanded and fully expanded states */}
          {(displayState === DisplayState.SemiExpanded || displayState === DisplayState.FullyExpanded) && (
            <div className="px-4 py-3 border-b border-purple-100 bg-white">
              {data.intent && (
                <p className="text-sm text-gray-700 mb-2">
                  {data.intent}
                </p>
              )}
              
              {data.context && (
                <p className="text-xs text-gray-600 leading-relaxed">
                  {data.context}
                </p>
              )}
              
              {/* Quick metrics about children - helps provide context */}
              {childCount > 0 && (
                <div className="flex items-center space-x-3 mt-3 text-xs text-purple-600">
                  <div className="flex items-center">
                    <Layers size={12} className="mr-1" />
                    <span>{childCount} {childCount === 1 ? 'step' : 'steps'}</span>
                  </div>
                  
                  <div className="flex items-center">
                    <Clock size={12} className="mr-1" />
                    <span>~{estimatedTimeMinutes} min</span>
                  </div>
                  
                  <div className="flex items-center opacity-80">
                    <span>{complexityLevel}</span>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Preview of child nodes - Only shown when appropriate */}
          {shouldShowPreview && (
            <div className="p-3 bg-purple-50/50 hover:bg-purple-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="text-xs text-purple-800 font-medium">
                  <Eye size={12} className="inline mr-1" /> Preview
                </div>
                
                <button 
                  className="text-xs text-purple-600 hover:text-purple-800 transition-colors"
                  onClick={handleExpansionToggle}
                >
                  View all {childCount} steps &rarr;
                </button>
              </div>
              
              <div className="mt-2 p-2 bg-white border border-purple-100 rounded-md text-xs text-gray-600">
                Child steps flow through this loop ({childCount} total)
              </div>
            </div>
          )}
        </div>
        
        {/* Container for child nodes - Always present for ReactFlow but has dynamic positioning */}
        <div 
          className={`relative w-full transition-opacity duration-300 bg-purple-50/30
                     ${displayState === DisplayState.FullyExpanded || isFlowExpanded ? 'opacity-100' : 'opacity-0'}`} 
          style={{ 
            minHeight: Math.max(useHeight - contentHeight, 200),
            // Create space for content above the child nodes
            marginTop: isFlowExpanded ? contentHeight + 'px' : '0',
            paddingTop: isFlowExpanded && displayState !== DisplayState.FullyExpanded ? '60px' : '20px',
            paddingBottom: '20px',
            paddingLeft: '20px',
            paddingRight: '20px',
            // Control visibility based on states
            display: (isFlowExpanded || displayState === DisplayState.FullyExpanded) ? 'block' : 'none',
            position: 'relative',
            zIndex: 2
          }}
          data-child-container="true"
        >
          {/* ReactFlow renders children in this container */}
        </div>
        
        {/* Indicator for child items when fully expanded and has children */}
        {(displayState === DisplayState.FullyExpanded || isFlowExpanded) && isCompound && (
          <div 
            className="
              absolute bottom-0 left-0 right-0
              text-center text-xs text-purple-600
              pb-1 pt-1
              border-t border-purple-100
              bg-white/80 backdrop-blur-sm
              z-10
            "
          >
            <span className="px-2 rounded-full">
              {childCount} {childCount === 1 ? 'item' : 'items'} shown
            </span>
          </div>
        )}
      </div>
      
      <Handle
        id="top"
        type="target"
        position={Position.Top}
        style={getHandleStyle(Position.Top)}
        isConnectable={true}
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        style={getHandleStyle(Position.Bottom)}
        isConnectable={true}
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        style={getHandleStyle(Position.Right)}
        isConnectable={true}
      />
      <Handle
        id="left"
        type="target"
        position={Position.Left}
        style={getHandleStyle(Position.Left)}
        isConnectable={true}
      />
    </div>
  );
};

export default LoopNode; 