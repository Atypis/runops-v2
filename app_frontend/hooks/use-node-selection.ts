import { useState, useCallback } from 'react';

export interface UseNodeSelectionReturn {
  selectedNodes: Set<string>;
  selectionMode: boolean;
  toggleSelectionMode: () => void;
  toggleNode: (nodeId: string) => void;
  selectAll: (nodeIds: string[]) => void;
  clearSelection: () => void;
  exitSelection: () => void;
  isSelected: (nodeId: string) => boolean;
  selectedCount: number;
  getSelectedArray: () => string[];
}

export function useNodeSelection(): UseNodeSelectionReturn {
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode(prev => {
      if (prev) {
        // Exiting selection mode - clear selection
        setSelectedNodes(new Set());
      }
      return !prev;
    });
  }, []);

  const toggleNode = useCallback((nodeId: string) => {
    setSelectedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback((nodeIds: string[]) => {
    setSelectedNodes(new Set(nodeIds));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedNodes(new Set());
  }, []);

  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedNodes(new Set());
  }, []);

  const isSelected = useCallback((nodeId: string) => {
    return selectedNodes.has(nodeId);
  }, [selectedNodes]);

  const getSelectedArray = useCallback(() => {
    return Array.from(selectedNodes);
  }, [selectedNodes]);

  return {
    selectedNodes,
    selectionMode,
    toggleSelectionMode,
    toggleNode,
    selectAll,
    clearSelection,
    exitSelection,
    isSelected,
    selectedCount: selectedNodes.size,
    getSelectedArray
  };
} 