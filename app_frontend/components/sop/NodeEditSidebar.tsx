'use client';

import React, { useState } from 'react';
import { Node as FlowNode } from 'reactflow';
import { SOPNode } from '@/lib/types/sop';
import { X, Save, ChevronDown, ChevronUp } from 'lucide-react';

interface NodeEditSidebarProps {
  selectedNode: FlowNode<SOPNode> | null;
  isAdvancedMode: boolean;
  onClose: () => void;
  onSave: (nodeId: string, updatedData: Partial<SOPNode>) => void;
}

const NodeEditSidebar: React.FC<NodeEditSidebarProps> = ({ 
  selectedNode, 
  isAdvancedMode,
  onClose,
  onSave 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<Partial<SOPNode>>({});
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    advanced: false
  });

  // Reset state when selected node changes
  React.useEffect(() => {
    if (selectedNode) {
      setEditedData({});
      setIsEditing(false);
      setExpandedSections({ basic: true, advanced: isAdvancedMode });
    }
  }, [selectedNode, isAdvancedMode]);

  if (!selectedNode) {
    return null;
  }

  const nodeData = selectedNode.data;
  
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
    setEditedData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const toggleSection = (section: 'basic' | 'advanced') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Get the display value (edited or original)
  const getValue = (field: keyof SOPNode) => {
    return field in editedData ? editedData[field] : nodeData[field];
  };

  // Convert field name to readable label
  const getFieldLabel = (field: string) => {
    return field
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-white shadow-lg z-50 overflow-y-auto border-l border-neutral-200">
      {/* Header */}
      <div className="p-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50">
        <h3 className="font-semibold text-lg">{nodeData.type?.charAt(0).toUpperCase() + nodeData.type?.slice(1) || 'Node'} Details</h3>
        <button 
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-200 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Node Identifier */}
        <div className="mb-4 pb-3 border-b border-neutral-100">
          <div className="text-xs text-neutral-500 mb-1">ID</div>
          <div className="font-mono text-sm text-neutral-700">{selectedNode.id}</div>
          {nodeData.id_path && (
            <>
              <div className="text-xs text-neutral-500 mt-2 mb-1">Path</div>
              <div className="font-mono text-sm text-neutral-700">{nodeData.id_path}</div>
            </>
          )}
        </div>

        {/* Basic Section */}
        <div className="mb-3">
          <div 
            className="flex items-center justify-between py-2 cursor-pointer" 
            onClick={() => toggleSection('basic')}
          >
            <h4 className="font-medium text-neutral-800">Basic Information</h4>
            {expandedSections.basic ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
          
          {expandedSections.basic && (
            <div className="pl-2 space-y-4 mt-2">
              {/* Label */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Label
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    className="w-full p-2 border border-neutral-300 rounded-md text-sm"
                    value={getValue('label') as string || ''}
                    onChange={(e) => handleInputChange('label', e.target.value)}
                  />
                ) : (
                  <div className="p-2 bg-neutral-50 rounded-md text-sm min-h-[40px] border border-transparent">
                    {nodeData.label || '(No label)'}
                  </div>
                )}
              </div>
              
              {/* Context/Description */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Context
                </label>
                {isEditing ? (
                  <textarea
                    className="w-full p-2 border border-neutral-300 rounded-md text-sm min-h-[80px]"
                    value={getValue('context') as string || ''}
                    onChange={(e) => handleInputChange('context', e.target.value)}
                  />
                ) : (
                  <div className="p-2 bg-neutral-50 rounded-md text-sm min-h-[60px] border border-transparent">
                    {nodeData.context || '(No context provided)'}
                  </div>
                )}
              </div>

              {/* Intent */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Intent
                </label>
                {isEditing ? (
                  <textarea
                    className="w-full p-2 border border-neutral-300 rounded-md text-sm min-h-[60px]"
                    value={getValue('intent') as string || ''}
                    onChange={(e) => handleInputChange('intent', e.target.value)}
                  />
                ) : (
                  <div className="p-2 bg-neutral-50 rounded-md text-sm min-h-[60px] border border-transparent">
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
              className="flex items-center justify-between py-2 cursor-pointer" 
              onClick={() => toggleSection('advanced')}
            >
              <h4 className="font-medium text-neutral-800">Advanced Details</h4>
              {expandedSections.advanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
            
            {expandedSections.advanced && (
              <div className="pl-2 space-y-4 mt-2">
                {/* Node Type */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Node Type
                  </label>
                  {isEditing ? (
                    <select
                      className="w-full p-2 border border-neutral-300 rounded-md text-sm"
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
                    <div className="p-2 bg-neutral-50 rounded-md text-sm min-h-[40px] border border-transparent">
                      {nodeData.type || '(Unknown)'}
                    </div>
                  )}
                </div>
                
                {/* Loop-specific fields */}
                {(nodeData.type === 'loop' || getValue('type') === 'loop') && (
                  <>
                    {/* Iterator */}
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Iterator
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          className="w-full p-2 border border-neutral-300 rounded-md text-sm"
                          value={getValue('iterator') as string || ''}
                          onChange={(e) => handleInputChange('iterator', e.target.value)}
                        />
                      ) : (
                        <div className="p-2 bg-neutral-50 rounded-md text-sm min-h-[40px] border border-transparent">
                          {nodeData.iterator || '(No iterator defined)'}
                        </div>
                      )}
                    </div>
                    
                    {/* Exit Condition */}
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Exit Condition
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          className="w-full p-2 border border-neutral-300 rounded-md text-sm"
                          value={getValue('exit_condition') as string || ''}
                          onChange={(e) => handleInputChange('exit_condition', e.target.value)}
                        />
                      ) : (
                        <div className="p-2 bg-neutral-50 rounded-md text-sm min-h-[40px] border border-transparent">
                          {nodeData.exit_condition || '(No exit condition defined)'}
                        </div>
                      )}
                    </div>
                  </>
                )}
                
                {/* Relationships */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Related Nodes
                  </label>
                  <div className="p-2 bg-neutral-50 rounded-md text-sm min-h-[40px] border border-transparent">
                    {nodeData.parentId && (
                      <div className="mb-1">
                        <span className="text-xs font-medium text-neutral-500">Parent:</span> {nodeData.parentId}
                      </div>
                    )}
                    
                    {nodeData.children && nodeData.children.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-neutral-500">Children:</span>
                        <ul className="list-disc list-inside mt-1 ml-2">
                          {nodeData.children.map(childId => (
                            <li key={childId} className="text-xs">{childId}</li>
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

        {/* Actions */}
        <div className="mt-6 flex justify-end space-x-2">
          {isEditing ? (
            <>
              <button
                onClick={handleCancel}
                className="px-3 py-2 text-sm bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors flex items-center"
              >
                <Save size={16} className="mr-1" /> Save
              </button>
            </>
          ) : (
            <button
              onClick={handleEdit}
              className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
            >
              Edit Node
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NodeEditSidebar; 