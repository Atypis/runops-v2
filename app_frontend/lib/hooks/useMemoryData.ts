import { useState, useEffect, useRef } from 'react';
import { MemoryArtifact } from '@/lib/memory/types';

interface UseMemoryDataReturn {
  memoryArtifact: MemoryArtifact | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  isWaitingForMemory?: boolean;
}

interface UseExecutionMemoryReturn {
  memoryArtifacts: MemoryArtifact[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Custom hook for fetching memory data for a specific node
 */
export function useMemoryData(executionId?: string, nodeId?: string): UseMemoryDataReturn {
  const [memoryArtifact, setMemoryArtifact] = useState<MemoryArtifact | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isWaitingForMemory, setIsWaitingForMemory] = useState(false);
  
  // Refs to manage intervals and prevent memory leaks
  const retryIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  
  // Constants for retry logic
  const BASE_INTERVAL = 2000; // 2 seconds
  const MAX_RETRY_TIME = 60000; // 60 seconds total timeout
  const MAX_RETRIES = 8; // exponential back-off: 2s,4s,8s,16s,32s (~64s total)

  const clearRetryTimers = () => {
    if (retryIntervalRef.current) {
      clearTimeout(retryIntervalRef.current as unknown as NodeJS.Timeout);
      retryIntervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsWaitingForMemory(false);
    retryCountRef.current = 0;
  };

  const fetchMemoryData = async (isRetryAttempt = false) => {
    if (!executionId || !nodeId) {
      setMemoryArtifact(null);
      clearRetryTimers();
      return;
    }

    if (!isRetryAttempt) {
      setIsLoading(true);
    }
    setError(null);

    try {
      // Properly encode URL parameters to handle special characters
      const encodedExecutionId = encodeURIComponent(executionId);
      const encodedNodeId = encodeURIComponent(nodeId);
      
      console.log(`🔍 [useMemoryData] Fetching memory for ${nodeId} (execution: ${executionId})`);
      console.log(`🔍 [useMemoryData] Encoded URL: /api/aef/memory/${encodedExecutionId}/${encodedNodeId}`);
      
      const response = await fetch(`/api/aef/memory/${encodedExecutionId}/${encodedNodeId}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        if (response.status === 204 || response.status === 404) {
          // No memory data yet
          setMemoryArtifact(null);
          
          // If this is the first attempt (not a retry), start retry polling
          if (!isRetryAttempt && !retryIntervalRef.current) {
            console.log(`🔄 [useMemoryData] Starting retry polling for ${nodeId} (execution: ${executionId})`);
            setIsWaitingForMemory(true);
            retryCountRef.current = 0;
            
            const scheduleRetry = () => {
              retryIntervalRef.current = setTimeout(() => {
                retryCountRef.current++;
                console.log(`🔄 [useMemoryData] Retry attempt ${retryCountRef.current}/${MAX_RETRIES} for ${nodeId}`);

                if (retryCountRef.current >= MAX_RETRIES) {
                  console.log(`⏰ [useMemoryData] Max retries reached for ${nodeId}, stopping polling`);
                  clearRetryTimers();
                  return;
                }

                fetchMemoryData(true);
                // Schedule next retry with doubled delay
                scheduleRetry();
              }, BASE_INTERVAL * Math.pow(2, retryCountRef.current));
            };

            scheduleRetry();
            
            // Set overall timeout
            timeoutRef.current = setTimeout(() => {
              console.log(`⏰ [useMemoryData] Timeout reached for ${nodeId}, stopping polling`);
              clearRetryTimers();
            }, MAX_RETRY_TIME);
          }
          
          return;
        }
        throw new Error(`Failed to fetch memory data: ${response.status} ${response.statusText}`);
      }

      // Handle 204 No Content (empty response) - don't clear retry timers yet!
      if (response.status === 204) {
        setMemoryArtifact(null);
        console.log(`✅ [useMemoryData] No memory data available yet for ${nodeId} (execution: ${executionId})`);
        // Don't clear retry timers - let the polling continue for 204 responses
        return;
      }
      
      // Success with actual data! Clear retry timers and set the data
      clearRetryTimers();
      const data = await response.json();
      setMemoryArtifact(data.memoryArtifact);
      
      console.log(`✅ [useMemoryData] Memory data loaded for ${nodeId} (execution: ${executionId})`);
      
    } catch (err) {
      console.error('Failed to fetch memory data:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      clearRetryTimers();
    } finally {
      if (!isRetryAttempt) {
        setIsLoading(false);
      }
    }
  };

  const refetch = () => {
    clearRetryTimers();
    fetchMemoryData();
  };

  useEffect(() => {
    fetchMemoryData();
    
    // Cleanup on unmount or dependency change
    return () => {
      clearRetryTimers();
    };
  }, [executionId, nodeId]);

  // Set up polling for active executions
  useEffect(() => {
    if (!executionId || !nodeId || !memoryArtifact) return;

    // Check if this is an active execution (pending status)
    const isActive = memoryArtifact.outputs.executionMetadata.status === 'pending';
    
    if (!isActive) return;

    // Poll every 3 seconds for active executions
    const interval = setInterval(() => {
      fetchMemoryData();
    }, 3000);

    return () => clearInterval(interval);
  }, [executionId, nodeId, memoryArtifact?.outputs.executionMetadata.status]);

  return {
    memoryArtifact,
    isLoading,
    error,
    refetch,
    isWaitingForMemory
  };
}

/**
 * Custom hook for fetching all memory artifacts for an execution
 */
export function useExecutionMemory(executionId?: string): UseExecutionMemoryReturn {
  const [memoryArtifacts, setMemoryArtifacts] = useState<MemoryArtifact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchExecutionMemory = async () => {
    if (!executionId) {
      setMemoryArtifacts([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Properly encode URL parameters to handle special characters
      const encodedExecutionId = encodeURIComponent(executionId);
      
      console.log(`🔍 [useExecutionMemory] Fetching execution memory for: ${executionId}`);
      console.log(`🔍 [useExecutionMemory] Encoded URL: /api/aef/memory/${encodedExecutionId}`);
      
      const response = await fetch(`/api/aef/memory/${encodedExecutionId}`, {
        credentials: 'include', // Ensure cookies are sent with the request
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          // No memory data yet
          setMemoryArtifacts([]);
          return;
        }
        throw new Error(`Failed to fetch execution memory: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setMemoryArtifacts(data.memoryArtifacts || []);
    } catch (err) {
      console.error('Failed to fetch execution memory:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  const refetch = () => {
    fetchExecutionMemory();
  };

  useEffect(() => {
    fetchExecutionMemory();
  }, [executionId]);

  // Set up polling for active executions
  useEffect(() => {
    if (!executionId || memoryArtifacts.length === 0) return;

    // Check if any nodes are still active
    const hasActiveNodes = memoryArtifacts.some(
      artifact => artifact.outputs.executionMetadata.status === 'pending'
    );
    
    if (!hasActiveNodes) return;

    // Poll every 3 seconds for active executions
    const interval = setInterval(() => {
      fetchExecutionMemory();
    }, 3000);

    return () => clearInterval(interval);
  }, [executionId, memoryArtifacts]);

  return {
    memoryArtifacts,
    isLoading,
    error,
    refetch
  };
}

/**
 * Memory cache for performance optimization
 */
class MemoryCache {
  private cache = new Map<string, { data: MemoryArtifact; timestamp: number }>();
  private readonly TTL = 30000; // 30 seconds cache

  get(key: string): MemoryArtifact | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    // Check if cache entry is still valid
    if (Date.now() - cached.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  set(key: string, data: MemoryArtifact): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clear(): void {
    this.cache.clear();
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.TTL) {
        this.cache.delete(key);
      }
    }
  }
}

// Global memory cache instance
const memoryCache = new MemoryCache();

// Clean up cache every 5 minutes
setInterval(() => {
  memoryCache.cleanup();
}, 5 * 60 * 1000);

/**
 * Hook that uses caching for better performance
 */
export function useCachedMemoryData(executionId?: string, nodeId?: string): UseMemoryDataReturn {
  const cacheKey = `${executionId}-${nodeId}`;
  const [memoryArtifact, setMemoryArtifact] = useState<MemoryArtifact | null>(
    () => executionId && nodeId ? memoryCache.get(cacheKey) : null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchMemoryData = async () => {
    if (!executionId || !nodeId) {
      setMemoryArtifact(null);
      return;
    }

    // Check cache first
    const cached = memoryCache.get(cacheKey);
    if (cached) {
      setMemoryArtifact(cached);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/aef/memory/${executionId}/${nodeId}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          setMemoryArtifact(null);
          return;
        }
        throw new Error(`Failed to fetch memory data: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const artifact = data.memoryArtifact;
      
      // Cache the result
      memoryCache.set(cacheKey, artifact);
      setMemoryArtifact(artifact);
    } catch (err) {
      console.error('Failed to fetch memory data:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  const refetch = () => {
    // Clear cache and refetch
    memoryCache.clear();
    fetchMemoryData();
  };

  useEffect(() => {
    fetchMemoryData();
  }, [executionId, nodeId]);

  return {
    memoryArtifact,
    isLoading,
    error,
    refetch
  };
} 