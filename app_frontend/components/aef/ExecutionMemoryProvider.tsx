import React, { createContext, useContext } from 'react';
import { useExecutionMemory } from '@/lib/hooks/useMemoryData';
import { MemoryArtifact } from '@/lib/memory/types';

interface ExecutionMemoryContextValue {
  memoryMap: Map<string, MemoryArtifact>;
  isLoading: boolean;
  refetch: () => void;
}

const ExecutionMemoryContext = createContext<ExecutionMemoryContextValue | undefined>(undefined);

export const useExecutionMemoryContext = () => {
  const ctx = useContext(ExecutionMemoryContext);
  if (!ctx) {
    throw new Error('useExecutionMemoryContext must be used inside <ExecutionMemoryProvider>');
  }
  return ctx;
};

interface ProviderProps {
  executionId?: string;
  children: React.ReactNode;
}

export const ExecutionMemoryProvider: React.FC<ProviderProps> = ({ executionId, children }) => {
  const { memoryArtifacts, isLoading, refetch } = useExecutionMemory(executionId);

  // Build a map for quick lookup
  const memoryMap = React.useMemo(() => {
    const map = new Map<string, MemoryArtifact>();
    memoryArtifacts.forEach(artifact => {
      map.set(artifact.nodeId, artifact);
    });
    return map;
  }, [memoryArtifacts]);

  return (
    <ExecutionMemoryContext.Provider value={{ memoryMap, isLoading, refetch }}>
      {children}
    </ExecutionMemoryContext.Provider>
  );
}; 