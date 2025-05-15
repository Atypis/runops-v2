import React, { useState, useEffect, useRef } from 'react';
import { SOPNode } from '@/lib/types/sop';
import { ChevronDown, ChevronRight, GripVertical, Edit3, Check, X, Trash2 } from 'lucide-react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Transition } from '@headlessui/react';

interface StepCardDisplayProps {
  node: SOPNode;
  level: number;
  isLastChild?: boolean;
  onUpdateNode: (nodeId: string, updatedProperties: Partial<SOPNode>) => void;
  onDeleteNode: (nodeId: string) => void;
  // onToggleCollapse?: (nodeId: string) => void; // Optional handler for state lift if needed
  // isCollapsed?: boolean; // Optional controlled collapse state
}

const StepCardDisplay: React.FC<StepCardDisplayProps> = ({
  node,
  level,
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
      className={`mb-2 group/stepCard relative ${level > 0 ? 'pl-6' : ''}`}
    >
      <div
        className={`bg-neutral-surface-1 border border-border rounded-card-radius shadow-card-default hover:shadow-card-hover transition-shadow duration-150 flex items-center p-3 pr-4`}
      >
        <div 
          {...attributes} 
          {...listeners}
          title="Drag to reorder step"
          className={`opacity-50 hover:opacity-100 group-hover/stepCard:opacity-100 transition-opacity cursor-grab p-1 touch-none z-10 rounded-md hover:bg-neutral-surface-2 ${level > 0 ? 'mr-2' : ''}`}
        >
          <GripVertical size={18} className="text-muted-foreground" />
        </div>

        <div className={`flex items-start flex-grow min-w-0 ${level === 0 && hasChildren ? 'ml-0' : (level === 0 && !hasChildren ? 'ml-0' : '' )}`}>
          {hasChildren && (
            <button onClick={handleToggle} className="mr-2 p-1 hover:bg-neutral-surface-2 rounded-sm self-center">
              {isInternallyCollapsed ? (
                <ChevronRight size={18} className="text-muted-foreground transition-transform duration-150 ease-out" />
              ) : (
                <ChevronDown size={18} className="text-muted-foreground transition-transform duration-150 ease-out" />
              )}
            </button>
          )}
          {!hasChildren && level === 0 && (
            <div className="w-8 mr-2"></div>
          )}
          {!hasChildren && level > 0 && <div className="w-8 mr-2"></div>}

          <div className="flex-grow min-w-0">
            {!isEditingLabel ? (
              <div className="flex items-center group/label">
                <h4 className={`font-medium text-foreground ${hasChildren ? 'cursor-pointer' : ''} flex items-center`} onClick={hasChildren ? handleToggle : undefined}>
                  {currentLabel || 'Unnamed Step'}
                  {hasChildren && isCollapsed && (
                    <span className="ml-2 text-xs bg-neutral-surface-3 text-muted-foreground px-2 py-0.5 rounded-pill-radius font-normal">
                      {node.childNodes?.length} atomic steps
                    </span>
                  )}
                </h4>
                <button onClick={() => setIsEditingLabel(true)} className="ml-2 p-1 opacity-0 group-hover/label:opacity-100 hover:text-primary">
                  <Edit3 size={14} />
                </button>
                <button 
                  onClick={handleDelete} 
                  className="ml-1 p-1 opacity-0 group-hover/stepCard:opacity-100 text-destructive hover:bg-red-100 rounded-sm"
                  title="Delete step"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 mb-1">
                <input 
                  ref={labelInputRef}
                  type="text" 
                  value={currentLabel}
                  onChange={(e) => setCurrentLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSave('label'); if (e.key === 'Escape') handleCancelEdit('label'); }}
                  className="flex-grow p-1 border border-input rounded-sm text-sm bg-background focus:ring-1 focus:ring-ring"
                />
                <button onClick={() => handleSave('label')} className="p-1 text-green-600 hover:bg-green-100 rounded-sm"><Check size={16}/></button>
                <button onClick={() => handleCancelEdit('label')} className="p-1 text-destructive hover:bg-red-100 rounded-sm"><X size={16}/></button>
              </div>
            )}

            {!isEditingDescription ? (
              <div className="group/description mt-1">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {currentDescription || 'No description.'}
                </p>
                <button onClick={() => setIsEditingDescription(true)} className="-ml-1 p-1 opacity-0 group-hover/description:opacity-100 hover:text-primary text-xs">
                  <Edit3 size={12} />
                </button>
              </div>
            ) : (
              <div className="mt-1">
                <textarea 
                  ref={descriptionTextareaRef}
                  value={currentDescription}
                  onChange={(e) => setCurrentDescription(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave('description'); if (e.key === 'Escape') handleCancelEdit('description');}}
                  className="w-full p-1 border border-input rounded-sm text-sm bg-background focus:ring-1 focus:ring-ring min-h-[60px]"
                  rows={3}
                />
                <div className="flex items-center gap-1 mt-1">
                  <button onClick={() => handleSave('description')} className="p-1 text-xs bg-primary text-primary-foreground hover:bg-primary/90 rounded-sm">Save (Cmd+Enter)</button>
                  <button onClick={() => handleCancelEdit('description')} className="p-1 text-xs text-muted-foreground hover:bg-neutral-surface-2 rounded-sm">Cancel (Esc)</button>
                </div>
              </div>
            )}
          </div>
        </div>
        {showSavedTick && (
            <div className="absolute top-2 right-2 p-1 bg-green-100 text-green-700 rounded-full animate-ping-once-fade-out">
                 <Check size={16} />
            </div>
        )}
      </div>

      {hasChildren && (
        <Transition
          show={!isInternallyCollapsed}
          enter="transition-[max-height] ease-out duration-150"
          enterFrom="max-h-0"
          enterTo="max-h-[1000px]"
          leave="transition-[max-height,opacity] ease-in duration-[300ms]"
          leaveFrom="opacity-100 max-h-[1000px]"
          leaveTo="opacity-0 max-h-0"
        >
          <div className={`mt-2 border-l-2 border-neutral-surface-3 ml-4 pl-4 overflow-hidden ${isLastChild && level > 0 ? '' : ''}`}>
            <SortableContext 
              items={node.childNodes?.map(child => child.id) || []} 
              strategy={verticalListSortingStrategy}
            >
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
            </SortableContext>
          </div>
        </Transition>
      )}
    </div>
  );
};

export default StepCardDisplay; 