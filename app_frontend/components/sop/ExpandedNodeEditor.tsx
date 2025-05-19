'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Node as FlowNode, useReactFlow, useStoreApi } from 'reactflow';
import { SOPNode } from '@/lib/types/sop';
import { X, Save, Edit2, ChevronDown, ChevronUp, Maximize2, Minimize2, GripVertical } from 'lucide-react';
import { createPortal } from 'react-dom';

// Define the type for the size state
type SizeState = {
  width: number;
  height: number; // Height will always be numeric after initial measurement
  top: number;
  left: number;
};

type ResizeDirection =
  | 'n' | 's' | 'e' | 'w' // edges: north, south, east, west
  | 'ne' | 'nw' | 'se' | 'sw'; // corners: northeast, northwest, etc.

interface ExpandedNodeEditorProps {
  selectedNode: FlowNode<SOPNode> | null;
  isAdvancedMode: boolean;
  onClose: () => void;
  onSave: (nodeId: string, updatedData: Partial<SOPNode>) => void;
}

const ExpandedNodeEditor: React.FC<ExpandedNodeEditorProps> = ({
  selectedNode,
  isAdvancedMode,
  onClose,
  onSave,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<Partial<SOPNode>>({});
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    advanced: false,
  });
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const { getNodes, getViewport } = useReactFlow();
  const store = useStoreApi();
  const editorRef = useRef<HTMLDivElement>(null);
  const [nodeBounds, setNodeBounds] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isExpanded, setIsExpanded] = useState(false);

  // State for size and resizing
  const [size, setSize] = useState<SizeState>({
    width: 320, // Initial default width
    height: 300, // Initial default height (will be updated)
    top: 0,
    left: 0,
  });
  const [isResizing, setIsResizing] = useState<ResizeDirection | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [startSize, setStartSize] = useState<SizeState>({ ...size });

  // Effect to update nodeBounds when selectedNode or view changes
  useEffect(() => {
    if (!selectedNode) return;
    const { x, y, zoom } = getViewport();
    const nodePos = selectedNode.position;
    const flowEl = store.getState().domNode;

    if (!flowEl) return;
    const flowRect = flowEl.getBoundingClientRect();
    const nodeWidth = selectedNode.type === 'loop' ? 450 : selectedNode.type === 'decision' ? 208 : 240;
    const nodeHeight = selectedNode.type === 'loop' ? 250 : selectedNode.type === 'decision' ? 104 : 80;
    const viewportX = (nodePos.x * zoom) + x + flowRect.left;
    const viewportY = (nodePos.y * zoom) + y + flowRect.top;

    setNodeBounds({ x: viewportX, y: viewportY, width: nodeWidth * zoom, height: nodeHeight * zoom });
  }, [selectedNode, getViewport, store]);

  // Effect to reset and prepare editor when selectedNode changes
  useEffect(() => {
    if (selectedNode) {
      setEditedData({});
      setIsEditing(false);
      setExpandedSections({ basic: true, advanced: isAdvancedMode });
      setShowMoreInfo(false);
      // Reset size to initial defaults, position will be calculated once expanded and measured
      setSize(prev => ({ ...prev, width: 320, height: 350 })); // Default height
      setIsExpanded(false); // Start animation
      const timer = setTimeout(() => {
        setIsExpanded(true);
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setIsExpanded(false); // Ensure it's closed if no node selected
    }
  }, [selectedNode, isAdvancedMode]);

  // Effect for positioning and sizing after expansion and measurement
  useEffect(() => {
    if (isExpanded && selectedNode && editorRef.current && nodeBounds.width > 0) {
      const currentWidth = editorRef.current.offsetWidth;
      const currentHeight = editorRef.current.offsetHeight;

      const { top, left } = calculatePopoverPosition(
        nodeBounds.x,
        nodeBounds.y,
        nodeBounds.width,
        nodeBounds.height,
        currentWidth,
        currentHeight
      );
      // Set size and position based on measurement
      setSize({ width: currentWidth, height: currentHeight, top, left });
    }
  }, [isExpanded, selectedNode, nodeBounds]); // Dependencies

  // Handle starting dragging
  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(true);
    setStartPos({ x: e.clientX, y: e.clientY });
    setStartSize({...size});
    
    // Event listeners are managed by the useEffect based on isDragging state
  }, [size]);

  // Handle dragging operation during mouse movement
  const handleDrag = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - startPos.x;
    const deltaY = e.clientY - startPos.y;
    
    // Calculate new position
    let newTop = startSize.top + deltaY;
    let newLeft = startSize.left + deltaX;
    
    // Constrain to viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Keep at least 20px of the editor visible on each edge
    newTop = Math.max(10, Math.min(viewportHeight - 100, newTop));
    newLeft = Math.max(10, Math.min(viewportWidth - 100, newLeft));
    
    // Update position with a subtle scale effect when dragging
    setSize({
      ...startSize,
      top: newTop,
      left: newLeft,
    });
  }, [isDragging, startPos.x, startPos.y, startSize]);

  const stopDrag = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add effect for drag handling
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDrag);
      document.addEventListener('mouseup', stopDrag);
      return () => {
        document.removeEventListener('mousemove', handleDrag);
        document.removeEventListener('mouseup', stopDrag);
      };
    }
  }, [isDragging, handleDrag, stopDrag]);

  // Handle starting resize from any direction
  const startResize = useCallback((direction: ResizeDirection) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editorRef.current) return;

    // Capture the current actual size and position from the DOM element
    const currentEditorWidth = editorRef.current.offsetWidth;
    const currentEditorHeight = editorRef.current.offsetHeight;
    
    setIsResizing(direction);
    setStartPos({ x: e.clientX, y: e.clientY });
    setStartSize({
        width: currentEditorWidth,
        height: currentEditorHeight,
        top: size.top, // Current top from state
        left: size.left // Current left from state
    });
    
    // Event listeners are now managed by the useEffect based on isResizing state
  }, [size.top, size.left]);

  // Handle resize operation during mouse movement
  const handleResize = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const deltaX = e.clientX - startPos.x;
    const deltaY = e.clientY - startPos.y;
    const newPosSize = { ...startSize }; // Start with a copy of original size & pos

    // Minimum dimensions
    const minWidth = 280;
    const minHeight = 200;

    if (isResizing.includes('n')) {
      const newHeight = Math.max(minHeight, startSize.height - deltaY);
      newPosSize.top = startSize.top + (startSize.height - newHeight);
      newPosSize.height = newHeight;
    }
    if (isResizing.includes('s')) {
      newPosSize.height = Math.max(minHeight, startSize.height + deltaY);
    }
    if (isResizing.includes('w')) {
      const newWidth = Math.max(minWidth, startSize.width - deltaX);
      newPosSize.left = startSize.left + (startSize.width - newWidth);
      newPosSize.width = newWidth;
    }
    if (isResizing.includes('e')) {
      newPosSize.width = Math.max(minWidth, startSize.width + deltaX);
    }
    setSize(newPosSize);
  }, [isResizing, startPos.x, startPos.y, startSize]);

  const stopResize = useCallback(() => {
    setIsResizing(null);
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
  }, []);

  // Fix circular dependency with separate useEffect
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResize);
      document.addEventListener('mouseup', stopResize);
      return () => {
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', stopResize);
      };
    }
  }, [isResizing, handleResize, stopResize]);

  // Cleanup on unmount - only if still needed
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleResize);
      document.removeEventListener('mouseup', stopResize);
      document.removeEventListener('mousemove', handleDrag);
      document.removeEventListener('mouseup', stopDrag);
    };
  }, [handleResize, stopResize, handleDrag, stopDrag]);

  if (!selectedNode) {
    return null;
  }

  // Safely access nodeData properties with fallbacks
  const nodeData = selectedNode.data || {};
  const nodeType = selectedNode.type || 'unknown';
  const nodeLabel = nodeData.label || 'Unnamed Node';
  const nodePath = nodeData.id_path || '';

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    if (selectedNode) {
      onSave(selectedNode.id, editedData);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditedData({});
    setIsEditing(false);
  };

  const handleInputChange = (field: keyof SOPNode, value: string) => {
    setEditedData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const toggleSection = (section: 'basic' | 'advanced') => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const toggleMoreInfo = () => {
    setShowMoreInfo(prev => !prev);
    // When toggling more info, allow height to adjust automatically
    setSize(prev => ({ ...prev, height: 'auto' as any })); // temp 'auto'
    // After next render cycle, measure and set numeric height
    requestAnimationFrame(() => {
        if(editorRef.current) {
            setSize(prev => ({...prev, height: editorRef.current!.offsetHeight}));
        }
    });
  };

  // Get the display value (edited or original)
  const getValue = (field: keyof SOPNode) => {
    return field in editedData ? editedData[field] : nodeData[field];
  };

  // Get button color based on node type
  const getButtonColor = () => {
    switch (nodeType) {
      case 'trigger':
        return 'bg-amber-500 hover:bg-amber-600';
      case 'decision':
        return 'bg-yellow-500 hover:bg-yellow-600';
      case 'loop':
        return 'bg-purple-500 hover:bg-purple-600';
      case 'end':
        return 'bg-blue-500 hover:bg-blue-600';
      default:
        return 'bg-neutral-500 hover:bg-neutral-600';
    }
  };

  // Get shadow glow based on node type
  const getShadowGlow = () => {
    switch (nodeType) {
      case 'trigger':
        return 'rgba(251, 191, 36, 0.1)'; // amber
      case 'decision':
        return 'rgba(234, 179, 8, 0.1)';  // yellow
      case 'loop':
        return 'rgba(147, 51, 234, 0.1)'; // purple
      case 'end':
        return 'rgba(59, 130, 246, 0.1)'; // blue
      default:
        return 'rgba(107, 114, 128, 0.1)'; // neutral
    }
  };

  // Background color based on node type
  const getNodeColor = () => {
    switch (nodeType) {
      case 'trigger':
        return 'bg-amber-50 border-amber-300';
      case 'decision':
        return 'bg-yellow-50 border-yellow-300';
      case 'loop':
        return 'bg-purple-50 border-purple-300';
      case 'end':
        return 'bg-blue-50 border-blue-300';
      default:
        return 'bg-neutral-50 border-neutral-300';
    }
  };

  // Get additional inner border color based on node type
  const getInnerBorderColor = () => {
    switch (nodeType) {
      case 'trigger':
        return 'border-amber-200';
      case 'decision':
        return 'border-yellow-200';
      case 'loop':
        return 'border-purple-200';
      case 'end':
        return 'border-blue-200';
      default:
        return 'border-neutral-200';
    }
  };

  // Icon based on node type
  const getNodeIcon = () => {
    switch (nodeType) {
      case 'trigger':
        return <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center"><span className="text-amber-700 text-xs font-bold">T</span></div>;
      case 'decision':
        return <div className="w-6 h-6 text-yellow-700"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 12L12 22L22 12L12 2Z" /></svg></div>;
      case 'loop':
        return <div className="w-6 h-6 text-purple-700"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 11C20 15.4183 16.4183 19 12 19C7.58172 19 4 15.4183 4 11C4 6.58172 7.58172 3 12 3C16.4183 3 20 6.58172 20 11Z" /><path d="M20 11H18" /><path d="M6 11H4" /><path d="M12 5V3" /><path d="M12 19V17" /><path d="M16 7L18 5" /><path d="M8 15L6 17" /><path d="M16 15L18 17" /><path d="M8 7L6 5" /></svg></div>;
      case 'end':
        return <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center"><span className="text-blue-700 text-xs font-bold">E</span></div>;
      default:
        return <div className="w-6 h-6 text-gray-700"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /></svg></div>;
    }
  };

  // Calculate the best position for the popover
  const calculatePopoverPosition = (
    nodeX: number,
    nodeY: number,
    nodeW: number,
    nodeH: number,
    editorW: number,
    editorH: number
  ) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let calcLeft = nodeX + nodeW + 15; // Preferred: right of the node
    let arrPos = 'left';

    if (calcLeft + editorW + 10 > viewportWidth) { // If too close to right edge
      calcLeft = nodeX - editorW - 15; // Position to the left
      arrPos = 'right';
      if (calcLeft < 10) { // If also too close to left edge
        calcLeft = Math.max(10, nodeX + nodeW / 2 - editorW / 2);
         // If centering, arrow might be from top/bottom if space is very constrained
        if (viewportHeight > editorH + 20) arrPos = 'top';
      }
    }
    if (calcLeft < 10) { // Final check if it's too far left after adjustments
        calcLeft = 10;
    }


    let calcTop = nodeY + (nodeH / 2) - (editorH / 2); // Vertically centered with node

    if (calcTop + editorH + 10 > viewportHeight) { // If extends below viewport
      calcTop = Math.max(10, viewportHeight - editorH - 10);
    }
    if (calcTop < 10) { // If extends above viewport
      calcTop = 10;
    }
    return { top: calcTop, left: calcLeft, arrowPosition: arrPos };
  };

  // Title based on node type
  const nodeTitle = nodeType.charAt(0).toUpperCase() + nodeType.slice(1);

  // Formatted label with path
  const formattedLabel = nodePath
    ? (!nodePath.startsWith('[') ? `[${nodePath}]` : nodePath) + ` ${nodeLabel}`
    : nodeLabel;

  // Check if we're in a browser environment
  if (typeof document === 'undefined') {
    return null;
  }

  // Get arrow position - recalculate if size changes, or use a memoized value
  const { arrowPosition } = calculatePopoverPosition(nodeBounds.x, nodeBounds.y, nodeBounds.width, nodeBounds.height, size.width, size.height);

  // Get cursor style based on resize direction
  const getCursorStyle = (direction: ResizeDirection) => {
    switch (direction) {
      case 'n': return 'cursor-ns-resize';
      case 's': return 'cursor-ns-resize';
      case 'e': return 'cursor-ew-resize';
      case 'w': return 'cursor-ew-resize';
      case 'ne': return 'cursor-nesw-resize';
      case 'nw': return 'cursor-nwse-resize';
      case 'se': return 'cursor-nwse-resize';
      case 'sw': return 'cursor-nesw-resize';
      default: return 'cursor-default';
    }
  };

  const resizeHandleSize = 8; // px, for corner grab area
  const resizeHandleOffset = - (resizeHandleSize / 2); // To center handles on border

  const resizeHandleStyle = (direction: ResizeDirection) => ({
    // Make handles invisible but still interactive
    background: 'transparent', 
    pointerEvents: 'auto' as React.CSSProperties['pointerEvents'],
    zIndex: 10001,
    position: 'absolute' as const,
    ...(direction === 'n' && { top: -6, left: '50%', transform: 'translateX(-50%)', width: 32, height: 12, cursor: 'ns-resize' }),
    ...(direction === 's' && { bottom: -6, left: '50%', transform: 'translateX(-50%)', width: 32, height: 12, cursor: 'ns-resize' }),
    ...(direction === 'w' && { left: -6, top: '50%', transform: 'translateY(-50%)', width: 12, height: 32, cursor: 'ew-resize' }),
    ...(direction === 'e' && { right: -6, top: '50%', transform: 'translateY(-50%)', width: 12, height: 32, cursor: 'ew-resize' }),
    ...(direction === 'nw' && { top: -6, left: -6, width: 16, height: 16, cursor: 'nwse-resize' }),
    ...(direction === 'ne' && { top: -6, right: -6, width: 16, height: 16, cursor: 'nesw-resize' }),
    ...(direction === 'sw' && { bottom: -6, left: -6, width: 16, height: 16, cursor: 'nesw-resize' }),
    ...(direction === 'se' && { bottom: -6, right: -6, width: 16, height: 16, cursor: 'nwse-resize' }),
  });

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden pointer-events-none">
      {/* Node Editor Popover */}
      <div
        ref={editorRef}
        className={`absolute flex flex-col overflow-hidden rounded-xl transition-all duration-300 ease-in-out ${getNodeColor()} pointer-events-auto border backdrop-blur-[2px]`}
        style={{
          left: size.left,
          top: size.top,
          width: size.width,
          height: size.height,
          opacity: isExpanded ? 1 : 0,
          pointerEvents: 'auto',
          zIndex: 10000,
          transformOrigin: arrowPosition === 'left' ? 'left center' :
                          arrowPosition === 'right' ? 'right center' : 'center top',
          boxShadow: `0 10px 25px -5px rgba(0, 0, 0, 0.08), 
                      0 8px 10px -6px rgba(0, 0, 0, 0.05), 
                      0 0 0 1px rgba(0, 0, 0, 0.02),
                      0 0 15px ${getShadowGlow()}`,
          transition: isDragging 
            ? 'transform 0.05s ease-out, box-shadow 0.2s ease-in-out' 
            : 'box-shadow 0.2s ease-in-out, transform 0.2s ease-out, opacity 0.3s ease-in-out',
          transform: isDragging ? 'scale(1.01)' : 'scale(1)'
        }}
      >
        {/* Inner border for refined look */}
        <div className={`absolute inset-[3px] rounded-lg border ${getInnerBorderColor()} pointer-events-none opacity-70`}></div>
      
        {/* Arrow pointing to the node */}
        <div
          className="absolute w-3 h-3 rotate-45 border-t border-l" // Only top and left for arrow shape
          style={{
            left: arrowPosition === 'left' ? -6.5 : // Adjusted for 1px border
                 arrowPosition === 'right' ? 'auto' : 'calc(50% - 6px)',
            right: arrowPosition === 'right' ? -6.5 : 'auto',
            top: arrowPosition === 'top' ? -6.5 : 'calc(50% - 6px)',
            bottom: arrowPosition === 'bottom' ? -6.5: 'auto',
            background: (getNodeColor().split(' ')[0]).replace('bg-', 'var(--tw-bg-opacity); background-color: ') || 'rgb(249 250 251)', // Match editor background
            borderColor: getNodeColor().split(' ')[1].replace('border-', 'var(--tw-border-opacity); border-color: ') || 'rgb(209 213 219)', // Match editor border
            borderRightStyle: arrowPosition === 'left' || arrowPosition === 'top' ? 'none' : 'solid',
            borderBottomStyle: arrowPosition === 'left' || arrowPosition === 'top' ? 'none' : 'solid',
            borderLeftStyle: arrowPosition === 'right' || arrowPosition === 'bottom' ? 'none' : 'solid',
            borderTopStyle: arrowPosition === 'right' || arrowPosition === 'bottom' ? 'none' : 'solid',
            zIndex: -1, // Behind the editor
            boxShadow: '-1px -1px 1px rgba(0, 0, 0, 0.05)'
          }}
        />

        {/* Resize handles */}
        {/* Top */}
        <div style={resizeHandleStyle('n')} onMouseDown={startResize('n')} />
        {/* Bottom */}
        <div style={resizeHandleStyle('s')} onMouseDown={startResize('s')} />
        {/* Left */}
        <div style={resizeHandleStyle('w')} onMouseDown={startResize('w')} />
        {/* Right */}
        <div style={resizeHandleStyle('e')} onMouseDown={startResize('e')} />
        {/* Top-left corner */}
        <div style={resizeHandleStyle('nw')} onMouseDown={startResize('nw')} />
        {/* Top-right corner */}
        <div style={resizeHandleStyle('ne')} onMouseDown={startResize('ne')} />
        {/* Bottom-left corner */}
        <div style={resizeHandleStyle('sw')} onMouseDown={startResize('sw')} />
        {/* Bottom-right corner (visual indicator) */}
        <div style={resizeHandleStyle('se')} onMouseDown={startResize('se')} />

        {/* Header - Now with dragging functionality */}
        <div 
          className="flex items-center justify-between p-3 border-b shrink-0 cursor-move relative z-10 bg-white/30"
          onMouseDown={startDrag}
        >
          <div className="flex items-start space-x-2 mr-2 max-w-[70%]">
            <div className="mt-0.5 shrink-0 flex items-center gap-2">
              <div title="Drag to move" className="hover:bg-white/40 p-0.5 rounded transition-colors">
                <GripVertical size={16} className="text-neutral-400" />
              </div>
              {getNodeIcon()}
            </div>
            <div>
              <h3 className="font-semibold leading-tight line-clamp-2">
                <span className="text-neutral-600">{nodeTitle}: </span>
                <span>{formattedLabel}</span>
              </h3>
            </div>
          </div>
          <div className="flex items-center space-x-1 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleMoreInfo();
              }}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/80 transition-colors text-neutral-600 cursor-pointer"
              title={showMoreInfo ? "Show less" : "Show more"}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {showMoreInfo ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/80 transition-colors cursor-pointer"
              title="Close"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto grow relative z-10 bg-white/50">
          {/* Node Identifier - always visible */}
          <div className="mb-3 pb-2 border-b border-neutral-200/50">
            <div className="text-xs text-neutral-500 mb-1">ID</div>
            <div className="font-mono text-sm text-neutral-700 break-all">{selectedNode.id}</div>
            {nodePath && (
              <>
                <div className="text-xs text-neutral-500 mt-2 mb-1">Path</div>
                <div className="font-mono text-sm text-neutral-700 break-all">{nodePath}</div>
              </>
            )}
          </div>

          {/* Main content - compact or expanded based on showMoreInfo */}
          {!showMoreInfo ? (
            // Compact View (Default)
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-0.5">Label</label>
                {isEditing ? (
                  <input
                    type="text"
                    className="w-full p-1.5 border border-neutral-300 rounded-md text-sm"
                    value={getValue('label') as string || ''}
                    onChange={(e) => handleInputChange('label', e.target.value)}
                  />
                ) : (
                  <div className="p-1.5 bg-white/80 rounded-md text-sm min-h-[34px] border border-transparent">
                    {nodeData.label || '(No label)'}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-0.5">Context</label>
                {isEditing ? (
                  <textarea
                    className="w-full p-1.5 border border-neutral-300 rounded-md text-sm min-h-[50px]"
                    rows={2}
                    value={getValue('context') as string || ''}
                    onChange={(e) => handleInputChange('context', e.target.value)}
                  />
                ) : (
                  <div className="p-1.5 bg-white/80 rounded-md text-sm min-h-[34px] border border-transparent whitespace-pre-wrap break-words">
                    {nodeData.context || '(No context provided)'}
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Expanded View with all details
            <div className="space-y-3">
              {/* Basic Section */}
              <div className="mb-3">
                <div
                  className="flex items-center justify-between py-1.5 cursor-pointer"
                  onClick={() => toggleSection('basic')}
                >
                  <h4 className="font-medium text-neutral-800">Basic Information</h4>
                  {expandedSections.basic ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>

                {expandedSections.basic && (
                  <div className="pl-2 space-y-3 mt-1.5">
                    {/* Label */}
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-0.5">Label</label>
                      {isEditing ? (
                        <input
                          type="text"
                          className="w-full p-1.5 border border-neutral-300 rounded-md text-sm"
                          value={getValue('label') as string || ''}
                          onChange={(e) => handleInputChange('label', e.target.value)}
                        />
                      ) : (
                        <div className="p-1.5 bg-white/80 rounded-md text-sm min-h-[34px] border border-transparent">
                          {nodeData.label || '(No label)'}
                        </div>
                      )}
                    </div>

                    {/* Context/Description */}
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-0.5">Context</label>
                      {isEditing ? (
                        <textarea
                          className="w-full p-1.5 border border-neutral-300 rounded-md text-sm min-h-[70px]"
                           rows={3}
                          value={getValue('context') as string || ''}
                          onChange={(e) => handleInputChange('context', e.target.value)}
                        />
                      ) : (
                        <div className="p-1.5 bg-white/80 rounded-md text-sm min-h-[50px] border border-transparent whitespace-pre-wrap break-words">
                          {nodeData.context || '(No context provided)'}
                        </div>
                      )}
                    </div>

                    {/* Intent */}
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-0.5">Intent</label>
                      {isEditing ? (
                        <textarea
                          className="w-full p-1.5 border border-neutral-300 rounded-md text-sm min-h-[50px]"
                          rows={2}
                          value={getValue('intent') as string || ''}
                          onChange={(e) => handleInputChange('intent', e.target.value)}
                        />
                      ) : (
                        <div className="p-1.5 bg-white/80 rounded-md text-sm min-h-[34px] border border-transparent whitespace-pre-wrap break-words">
                          {nodeData.intent || '(No intent provided)'}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Advanced Section */}
              {isAdvancedMode && (
                <div className="mb-3">
                  <div
                    className="flex items-center justify-between py-1.5 cursor-pointer"
                    onClick={() => toggleSection('advanced')}
                  >
                    <h4 className="font-medium text-neutral-800">Advanced Details</h4>
                    {expandedSections.advanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>

                  {expandedSections.advanced && (
                    <div className="pl-2 space-y-3 mt-1.5">
                      {/* Node Type */}
                      <div>
                        <label className="block text-xs font-medium text-neutral-700 mb-0.5">Node Type</label>
                        {isEditing ? (
                          <select
                            className="w-full p-1.5 border border-neutral-300 rounded-md text-sm"
                            value={getValue('type') as string || ''}
                            onChange={(e) => handleInputChange('type', e.target.value)}
                          >
                            <option value="task">Task</option>
                            <option value="decision">Decision</option>
                            <option value="loop">Loop</option>
                            <option value="trigger">Trigger</option>
                            <option value="end">End</option>
                          </select>
                        ) : (
                          <div className="p-1.5 bg-white/80 rounded-md text-sm min-h-[34px] border border-transparent">
                            {nodeData.type || '(Unknown)'}
                          </div>
                        )}
                      </div>

                      {/* Loop-specific fields */}
                      {(nodeData.type === 'loop' || getValue('type') === 'loop') && (
                        <>
                          {/* Iterator */}
                          <div>
                            <label className="block text-xs font-medium text-neutral-700 mb-0.5">Iterator</label>
                            {isEditing ? (
                              <input
                                type="text"
                                className="w-full p-1.5 border border-neutral-300 rounded-md text-sm"
                                value={getValue('iterator') as string || ''}
                                onChange={(e) => handleInputChange('iterator', e.target.value)}
                              />
                            ) : (
                              <div className="p-1.5 bg-white/80 rounded-md text-sm min-h-[34px] border border-transparent">
                                {nodeData.iterator || '(No iterator defined)'}
                              </div>
                            )}
                          </div>

                          {/* Exit Condition */}
                          <div>
                            <label className="block text-xs font-medium text-neutral-700 mb-0.5">Exit Condition</label>
                            {isEditing ? (
                              <input
                                type="text"
                                className="w-full p-1.5 border border-neutral-300 rounded-md text-sm"
                                value={getValue('exit_condition') as string || ''}
                                onChange={(e) => handleInputChange('exit_condition', e.target.value)}
                              />
                            ) : (
                              <div className="p-1.5 bg-white/80 rounded-md text-sm min-h-[34px] border border-transparent">
                                {nodeData.exit_condition || '(No exit condition defined)'}
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      {/* Relationships */}
                      <div>
                        <label className="block text-xs font-medium text-neutral-700 mb-0.5">Related Nodes</label>
                        <div className="p-1.5 bg-white/80 rounded-md text-sm min-h-[34px] border border-transparent">
                          {nodeData.parentId && (
                            <div className="mb-0.5">
                              <span className="text-xs font-medium text-neutral-500">Parent:</span> {nodeData.parentId}
                            </div>
                          )}

                          {nodeData.children && nodeData.children.length > 0 && (
                            <div>
                              <span className="text-xs font-medium text-neutral-500">Children:</span>
                              <ul className="list-disc list-inside mt-0.5 ml-2">
                                {nodeData.children.map((childId) => (
                                  <li key={childId} className="text-xs">
                                    {childId}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {!nodeData.parentId && (!nodeData.children || nodeData.children.length === 0) && (
                            <span className="text-neutral-500 text-xs">(No relationships)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-auto p-3 border-t flex justify-end space-x-2 shrink-0 relative z-10 bg-white/30">
          {isEditing ? (
            <>
              <button
                onClick={handleCancel}
                className="px-3 py-1.5 text-sm bg-white hover:bg-neutral-100 border border-neutral-300 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className={`px-3 py-1.5 text-sm ${getButtonColor()} text-white rounded-md transition-colors flex items-center`}
              >
                <Save size={14} className="mr-1" /> Save
              </button>
            </>
          ) : (
            <button
              onClick={handleEdit}
              className={`px-3 py-1.5 text-sm ${getButtonColor()} text-white rounded-md transition-colors flex items-center`}
            >
              <Edit2 size={14} className="mr-1" /> Edit Node
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ExpandedNodeEditor; 