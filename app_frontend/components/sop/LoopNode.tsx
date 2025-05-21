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
  parentId?: string; // If this node is a child of another compound node
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
  SemiExpanded,
  FullyExpanded
}

// Add CSS animations component that will be rendered client-side
const AnimationStyles = () => {
  React.useEffect(() => {
    // Only run in browser
    if (typeof document === 'undefined') return;
    
    // Check if we've already added these styles
    if (document.head.querySelector('style[data-loop-node-animations]')) return;
    
    // Create and add styles
    const styleEl = document.createElement('style');
    styleEl.setAttribute('data-loop-node-animations', 'true');
    styleEl.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      .scale-in {
        transform-origin: center center;
        animation: scaleIn 0.3s ease-out forwards;
      }
      
      .scale-normal {
        transform-origin: center center;
        animation: scaleNormal 0.3s ease-out forwards;
      }
      
      @keyframes scaleIn {
        from { transform: scale(1.02); }
        to { transform: scale(1); }
      }
      
      @keyframes scaleNormal {
        from { transform: scale(0.98); }
        to { transform: scale(1); }
      }
    `;
    
    document.head.appendChild(styleEl);
    
    // Cleanup function to remove styles when component unmounts
    return () => {
      const existingStyle = document.head.querySelector('style[data-loop-node-animations]');
      if (existingStyle) {
        document.head.removeChild(existingStyle);
      }
    };
  }, []);
  
  return null; // This component doesn't render anything
};

const LoopNode: React.FC<LoopNodeProps> = ({ id, data, selected }) => {
  // References for measuring content area height
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  
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
  
  // Effect to keep display state in sync with ReactFlow's expansion state
  useEffect(() => {
    if (isFlowExpanded && displayState !== DisplayState.FullyExpanded) {
      setDisplayState(DisplayState.FullyExpanded);
    } else if (!isFlowExpanded && displayState === DisplayState.FullyExpanded) {
      setDisplayState(DisplayState.SemiExpanded);
    }
  }, [isFlowExpanded, displayState]);
  
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
  
  // Handle expansion state toggling with direct click (no selection needed)
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent ReactFlow's default selection behavior
    
    // Always toggle between fully expanded and semi-expanded
    const newDisplayState = displayState === DisplayState.FullyExpanded 
      ? DisplayState.SemiExpanded 
      : DisplayState.FullyExpanded;
    
    setDisplayState(newDisplayState);
    
    // Notify ReactFlow about the collapse/expand state for child nodes layout
    if (data.onToggleCollapse && isCompound) {
      // If we're going to semi-expanded, collapse in ReactFlow
      // If we're going to fully expanded, expand in ReactFlow
      const shouldBeExpanded = newDisplayState === DisplayState.FullyExpanded;
      
      // Only trigger if there's a state change
      if (shouldBeExpanded !== isFlowExpanded) {
        data.onToggleCollapse(id);
      }
    }
  };
  
  // Open detailed editor (for a more comprehensive view)
  const openDetailedEditor = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering parent click handlers
    
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
  
  // Calculate the width and height for the container based on display state
  let useWidth: number;
  let useHeight: number;
  
  // Use smaller size for preview card, larger size for expanded content
  const previewWidth = 320; // Fixed width for preview card
  const previewHeight = Math.max(contentHeight + 30, 150); // Height based on content for preview
  
  if (displayState === DisplayState.SemiExpanded) {
    // Use preview card dimensions
    useWidth = previewWidth;
    useHeight = previewHeight;
  } else {
    // Use full expanded dimensions for children
    useWidth = data.calculatedWidth || (childCount > 0 ? Math.max(450, childCount * 120) : 320);
    // Calculate minimum height based on content + children
    const contentBasedMinHeight = contentHeight + (childCount > 0 ? 240 : 60);
    useHeight = data.calculatedHeight || 
      (childCount > 0 ? Math.max(contentBasedMinHeight, childCount * 80) : contentBasedMinHeight);
  }
  
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
  
  // NEW: Calculate nesting depth by counting the dots in id_path
  const getNestingDepth = (): number => {
    if (!data.id_path) return 0;
    const dotCount = (data.id_path.match(/\./g) || []).length;
    return dotCount;
  };
  
  // NEW: Get color shades based on nesting depth
  const getDepthColors = () => {
    const depth = getNestingDepth();
    
    // Base color is purple/indigo
    switch (depth) {
      case 0: return { border: '#d1d5f6', bg: 'rgba(243, 232, 255, 0.2)', headerBg: 'rgb(243, 232, 255)' };
      case 1: return { border: '#c7a5ff', bg: 'rgba(237, 220, 255, 0.25)', headerBg: 'rgb(237, 220, 255)' };
      case 2: return { border: '#b388ff', bg: 'rgba(230, 208, 255, 0.3)', headerBg: 'rgb(230, 208, 255)' };
      case 3: return { border: '#9966ff', bg: 'rgba(224, 195, 255, 0.35)', headerBg: 'rgb(224, 195, 255)' };
      default: return { border: '#7c45ff', bg: 'rgba(218, 183, 255, 0.4)', headerBg: 'rgb(218, 183, 255)' };
    }
  };
  
  // Determine the visual styling based on display state
  const getNodeStyle = () => {
    // Get colors based on nesting depth
    const depthColors = getDepthColors();
    
    // Base style
    const baseStyle = {
      width: useWidth,
      height: useHeight,
      minHeight: useHeight,
      maxHeight: displayState === DisplayState.SemiExpanded ? previewHeight : undefined,
      border: '2px solid',
      borderColor: depthColors.border,
      transition: 'all 0.4s cubic-bezier(0.25, 1, 0.5, 1)'
    };
    
    // Style adjustments based on display state
    if (displayState === DisplayState.SemiExpanded) {
      return {
        ...baseStyle,
        backgroundColor: depthColors.bg,
        boxShadow: isHovered 
          ? '0 8px 16px rgba(99, 102, 241, 0.18), 0 3px 6px rgba(99, 102, 241, 0.15)'
          : '0 6px 12px rgba(99, 102, 241, 0.12), 0 2px 4px rgba(99, 102, 241, 0.1)'
      };
    } else {
      // Fully expanded
      return {
        ...baseStyle,
        backgroundColor: depthColors.bg,
        boxShadow: '0 8px 20px rgba(99, 102, 241, 0.15), 0 3px 8px rgba(99, 102, 241, 0.18)',
        // Ensure loop node is large enough for children
        width: data.calculatedWidth || useWidth,
        height: data.calculatedHeight || useHeight,
      };
    }
  };

  // NEW: Get header style based on nesting depth
  const getHeaderStyle = () => {
    const depthColors = getDepthColors();
    
    if (selected) {
      return {
        backgroundColor: depthColors.headerBg,
        borderColor: displayState !== DisplayState.SemiExpanded ? depthColors.border : 'transparent'
      };
    }
    
    return {
      backgroundColor: isHovered ? depthColors.headerBg : 'white',
      borderColor: displayState !== DisplayState.SemiExpanded ? depthColors.border : 'transparent'
    };
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
      backgroundColor: '#8b5cf6',
      color: 'white',
      fontWeight: 'bold',
      fontSize: '10px',
      width: '16px',
      height: '16px',
      borderRadius: '50%',
      marginRight: '4px'
    };
  };

  // Determine whether we should show the preview section
  const shouldShowPreview = displayState === DisplayState.SemiExpanded && childCount > 0;
  
  return (
    <>
      <AnimationStyles />
      <div
        className="flex flex-col items-center"
        data-node-type="loop"
        data-is-compound={isCompound ? 'true' : 'false'}
        data-display-state={displayState}
        data-child-count={childCount}
        data-flow-expanded={isFlowExpanded ? 'true' : 'false'}
        data-nesting-depth={getNestingDepth()}
        style={{
          // Ensure the node takes up the full space if it has explicit dimensions
          width: data.calculatedWidth ? data.calculatedWidth : 'auto',
          height: data.calculatedHeight ? data.calculatedHeight : 'auto',
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={(e) => e.stopPropagation()} // Prevent ReactFlow selection
      >
        <div
          className={`
            rounded-xl
            transition-all
            duration-300
            relative
            overflow-hidden
            group/loop
            ${displayState === DisplayState.SemiExpanded ? 'scale-in' : 'scale-normal'}
          `}
          style={getNodeStyle()}
          title={tooltipText}
        >
          {/* Folded corner decoration - visual cue for compound nodes */}
          {childCount > 0 && (
            <div 
              className="absolute top-0 right-0 w-8 h-8"
              style={{
                background: getDepthColors().headerBg,
                clipPath: 'polygon(100% 0, 100% 100%, 0 0)',
                borderLeft: `1px solid ${getDepthColors().border}`,
                borderBottom: `1px solid ${getDepthColors().border}`,
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
                group-hover/loop:bg-purple-50
              `}
              style={getHeaderStyle()}
              onClick={handleToggle}
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
                  className="font-medium text-sm text-purple-900 truncate max-w-[160px] flex items-center"
                  title={formattedLabel}
                >
                  {/* NEW: Depth indicator */}
                  {getNestingDepth() > 0 && (
                    <span style={getDepthIndicatorStyle()}>{getNestingDepth()}</span>
                  )}
                  {formattedLabel}
                </h3>
              </div>
              
              <div className="flex items-center space-x-1">
                {/* Edit button - shows on hover in semi-expanded, always in fully expanded */}
                {((displayState === DisplayState.SemiExpanded && isHovered) || 
                  displayState === DisplayState.FullyExpanded) && (
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
                  title={displayState === DisplayState.SemiExpanded ? "Show child nodes" : "Collapse"}
                  onClick={handleToggle}
                >
                  {displayState === DisplayState.FullyExpanded ? (
                    <ChevronUp size={16} />
                  ) : (
                    <ChevronDown size={16} />
                  )}
                </button>
              </div>
            </div>
            
            {/* Intent and Context Section - Always show in both states */}
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
            
            {/* Preview of child nodes - Only shown when in semi-expanded state */}
            {shouldShowPreview && (
              <div className="p-3 bg-purple-50/50 hover:bg-purple-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-purple-800 font-medium">
                    <Eye size={12} className="inline mr-1" /> Preview
                  </div>
                  
                  <button 
                    className="text-xs text-purple-600 hover:text-purple-800 transition-colors"
                    onClick={handleToggle}
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
          
          {/* Container for child nodes - Only visible when fully expanded */}
          {displayState === DisplayState.FullyExpanded && (
            <div 
              className="relative w-full" 
              style={{ 
                minHeight: Math.max(useHeight - contentHeight, 200),
                height: data.calculatedHeight ? data.calculatedHeight - contentHeight - 40 : 200,
                paddingTop: '20px',
                paddingBottom: '20px',
                paddingLeft: '20px',
                paddingRight: '20px',
                position: 'relative',
                zIndex: 2,
                opacity: 0,
                animation: 'fadeIn 0.3s ease-in-out forwards',
                animationDelay: '0.1s',
                backgroundColor: `${getDepthColors().bg}`,
                border: '1px dashed rgba(99, 102, 241, 0.3)',
                borderRadius: '8px',
                margin: '0 10px 10px 10px',
              }}
              data-child-container="true"
            >
              {/* ReactFlow renders children in this container */}
            </div>
          )}
          
          {/* Indicator for child items when fully expanded and has children */}
          {displayState === DisplayState.FullyExpanded && isCompound && (
            <div 
              className="
                absolute bottom-0 left-0 right-0
                text-center text-xs text-purple-600
                pb-1 pt-1
                border-t
                bg-white/80 backdrop-blur-sm
                z-10
              "
              style={{ borderColor: getDepthColors().border }}
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
    </>
  );
};

export default LoopNode; 