import React, { useState, useEffect, useRef } from 'react';
import { SOPNode } from '@/lib/types/sop';
import { ChevronDown, ChevronRight, GripVertical, Edit3, Check, X, Trash2 } from 'lucide-react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Transition } from '@headlessui/react';

interface StepCardDisplayProps {
  node: SOPNode;
  level: number;
  stepNumber?: number;
  isLastChild?: boolean;
  onUpdateNode: (nodeId: string, updatedProperties: Partial<SOPNode>) => void;
  onDeleteNode: (nodeId: string) => void;
  // onToggleCollapse?: (nodeId: string) => void; // Optional handler for state lift if needed
  // isCollapsed?: boolean; // Optional controlled collapse state
}

const StepCardDisplay: React.FC<StepCardDisplayProps> = ({
  node,
  level,
  stepNumber,
  isLastChild = false,
  onUpdateNode,
  onDeleteNode,
}) => {
  const [isInternallyCollapsed, setIsInternallyCollapsed] = useState(true);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [currentLabel, setCurrentLabel] = useState(node.label);
  const [currentDescription, setCurrentDescription] = useState(node.context || node.intent || '');
  const [showSavedTick, setShowSavedTick] = useState(false);

  const labelInputRef = useRef<HTMLInputElement>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: node.id,
    data: {
      id: node.id,
      parentId: node.parentId,
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const isCollapsed = isInternallyCollapsed;
  const hasChildren = node.childNodes && node.childNodes.length > 0;

  useEffect(() => {
    setCurrentLabel(node.label);
    setCurrentDescription(node.context || node.intent || '');
  }, [node.label, node.context, node.intent]);

  useEffect(() => {
    if (isEditingLabel && labelInputRef.current) {
      labelInputRef.current.focus();
      labelInputRef.current.select();
    }
  }, [isEditingLabel]);

  useEffect(() => {
    if (isEditingDescription && descriptionTextareaRef.current) {
      descriptionTextareaRef.current.focus();
      descriptionTextareaRef.current.select();
    }
  }, [isEditingDescription]);

  const handleToggle = () => {
    setIsInternallyCollapsed(!isInternallyCollapsed);
  };

  const handleSave = (field: 'label' | 'description') => {
    let updatedProperties: Partial<SOPNode> = {};
    if (field === 'label') {
      updatedProperties = { label: currentLabel };
      setIsEditingLabel(false);
    } else if (field === 'description') {
      updatedProperties = { context: currentDescription }; // Assuming we save to context
      setIsEditingDescription(false);
    }
    onUpdateNode(node.id, updatedProperties);
    setShowSavedTick(true);
    setTimeout(() => setShowSavedTick(false), 2000);
  };

  const handleCancelEdit = (field: 'label' | 'description') => {
    if (field === 'label') {
      setCurrentLabel(node.label);
      setIsEditingLabel(false);
    } else if (field === 'description') {
      setCurrentDescription(node.context || node.intent || '');
      setIsEditingDescription(false);
    }
  }

  const handleDelete = () => {
    const message = node.childNodes && node.childNodes.length > 0
      ? `Are you sure you want to delete "${node.label}" and its ${node.childNodes.length} child step(s)?`
      : `Are you sure you want to delete "${node.label}"?`;
    if (window.confirm(message)) {
      onDeleteNode(node.id);
    }
  };

  const indentStyle = { paddingLeft: `${level * 24}px` };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className="group/stepCard relative"
    >
      {/* Clean, minimal card design */}
      <div className={`
        ${level === 0 ? 'bg-white border border-neutral-200 rounded-lg' : 'bg-neutral-50/50 border border-neutral-100 rounded-md'} 
        ${level === 0 ? 'shadow-sm hover:shadow-md' : 'shadow-none hover:shadow-sm'} 
        transition-all duration-200 ease-out
        ${level === 0 ? 'mb-2' : 'mb-1'}
        ${level > 0 ? 'ml-8' : ''}
      `}>
        
        {/* Main content area */}
        <div className={`flex items-start ${level === 0 ? 'p-5' : 'p-3'}`}>
          
          {/* Step number indicator for top level - minimal and refined */}
          {level === 0 && stepNumber && (
            <div className="flex-shrink-0 mr-4 flex items-center">
              <div className="text-sm font-light text-neutral-400 min-w-[20px] text-center">
                {stepNumber}
              </div>
              <div className="w-px h-4 bg-neutral-200 ml-3"></div>
            </div>
          )}
          
          {/* Drag handle - minimal and contextual */}
          <div 
            {...attributes} 
            {...listeners}
            className="flex-shrink-0 mr-3 opacity-0 group-hover/stepCard:opacity-60 hover:!opacity-100 transition-opacity cursor-grab p-1 rounded"
            title="Drag to reorder"
          >
            <GripVertical size={14} className="text-neutral-400" />
          </div>

          {/* Collapse button for parent steps */}
          {hasChildren && (
            <button 
              onClick={handleToggle} 
              className="flex-shrink-0 mr-3 p-1 hover:bg-neutral-100 rounded transition-colors"
            >
              {isCollapsed ? (
                <ChevronRight size={16} className="text-neutral-500" />
              ) : (
                <ChevronDown size={16} className="text-neutral-500" />
              )}
            </button>
          )}
          {!hasChildren && <div className="w-5 mr-3"></div>}

          {/* Main content */}
          <div className="flex-grow min-w-0">
            
            {/* Title Section */}
            {!isEditingLabel ? (
              <div className="flex items-center group/label mb-1.5">
                <h3 className={`
                  ${level === 0 ? 'text-base font-semibold text-neutral-900' : 'text-sm font-medium text-neutral-800'}
                  ${hasChildren ? 'cursor-pointer' : ''} 
                  flex items-center leading-tight
                `} onClick={hasChildren ? handleToggle : undefined}>
                  {currentLabel || 'Unnamed Step'}
                  {hasChildren && isCollapsed && (
                    <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {node.childNodes?.length} substeps
                    </span>
                  )}
                </h3>
                
                {/* Action buttons - clean and minimal */}
                <div className="ml-auto flex items-center opacity-0 group-hover/stepCard:opacity-100 transition-opacity">
                  <button 
                    onClick={() => setIsEditingLabel(true)} 
                    className="p-1 hover:bg-neutral-100 rounded text-neutral-500 hover:text-neutral-700 mr-1"
                    title="Edit title"
                  >
                    <Edit3 size={13} />
                  </button>
                  <button 
                    onClick={handleDelete} 
                    className="p-1 hover:bg-red-50 rounded text-neutral-400 hover:text-red-600"
                    title="Delete step"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-1.5">
                <input 
                  ref={labelInputRef}
                  type="text" 
                  value={currentLabel}
                  onChange={(e) => setCurrentLabel(e.target.value)}
                  onKeyDown={(e) => { 
                    if (e.key === 'Enter') handleSave('label'); 
                    if (e.key === 'Escape') handleCancelEdit('label'); 
                  }}
                  className="flex-grow px-3 py-1.5 border border-neutral-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button 
                  onClick={() => handleSave('label')} 
                  className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                >
                  <Check size={14}/>
                </button>
                <button 
                  onClick={() => handleCancelEdit('label')} 
                  className="p-1.5 text-neutral-500 hover:bg-neutral-50 rounded"
                >
                  <X size={14}/>
                </button>
              </div>
            )}

            {/* Description Section */}
            {!isEditingDescription ? (
              <div className="group/description">
                <p className={`
                  ${level === 0 ? 'text-neutral-600' : 'text-neutral-500'} 
                  ${level === 0 ? 'text-sm' : 'text-xs'} 
                  leading-relaxed whitespace-pre-wrap
                `}>
                  {currentDescription || (
                    <span className="italic text-neutral-400">
                      Click to add description...
                    </span>
                  )}
                </p>
                <button 
                  onClick={() => setIsEditingDescription(true)} 
                  className="mt-1 text-xs text-neutral-400 hover:text-blue-600 opacity-0 group-hover/description:opacity-100 transition-opacity"
                >
                  Edit description
                </button>
              </div>
            ) : (
              <div>
                <textarea 
                  ref={descriptionTextareaRef}
                  value={currentDescription}
                  onChange={(e) => setCurrentDescription(e.target.value)}
                  onKeyDown={(e) => { 
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave('description'); 
                    if (e.key === 'Escape') handleCancelEdit('description');
                  }}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[60px] resize-none"
                  placeholder="Describe this step..."
                  rows={3}
                />
                <div className="flex items-center gap-2 mt-2">
                  <button 
                    onClick={() => handleSave('description')} 
                    className="px-3 py-1 text-xs bg-blue-600 text-white hover:bg-blue-700 rounded font-medium"
                  >
                    Save
                  </button>
                  <button 
                    onClick={() => handleCancelEdit('description')} 
                    className="px-3 py-1 text-xs text-neutral-500 hover:bg-neutral-50 rounded"
                  >
                    Cancel
                  </button>
                  <span className="text-xs text-neutral-400">⌘+Enter to save</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Success indicator */}
      {showSavedTick && (
        <div className="absolute top-2 right-2 p-1.5 bg-green-100 text-green-700 rounded-full animate-pulse">
          <Check size={14} />
        </div>
      )}

      {/* Child nodes with cleaner nesting */}
      {hasChildren && (
        <Transition
          show={!isInternallyCollapsed}
          enter="transition-all ease-out duration-200"
          enterFrom="opacity-0 scale-95"
          enterTo="opacity-100 scale-100"
          leave="transition-all ease-in duration-150"
          leaveFrom="opacity-100 scale-100"
          leaveTo="opacity-0 scale-95"
        >
          <div className="mt-2 relative">
            {/* Subtle connection line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-neutral-200"></div>
            
            <SortableContext 
              items={node.childNodes?.map(child => child.id) || []} 
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1">
                {node.childNodes?.map((childNode, index) => (
                  <StepCardDisplay
                    key={childNode.id}
                    node={childNode}
                    level={level + 1}
                    isLastChild={index === (node.childNodes?.length || 0) - 1}
                    onUpdateNode={onUpdateNode}
                    onDeleteNode={onDeleteNode}
                  />
                ))}
              </div>
            </SortableContext>
          </div>
        </Transition>
      )}
    </div>
  );
};

export default StepCardDisplay; 