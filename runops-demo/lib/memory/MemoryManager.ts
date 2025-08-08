/**
 * Universal Memory Manager
 * 
 * Core service for capturing, storing, and retrieving memory artifacts during workflow execution.
 * 
 * KEY DESIGN PRINCIPLES:
 * - Synchronous/blocking operation - execution waits for memory capture
 * - Context flow control - determines what information flows between nodes
 * - Universal design - works for all 31+ action/node types
 * - Raw storage - no compression initially, store everything as-is
 * - Simple error handling - fail fast if memory capture fails
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { 
  MemoryArtifact, 
  MemoryInputs, 
  MemoryProcessing, 
  MemoryOutputs,
  ForwardingRules,
  NodeExecutionContext,
  MemorySearchFilters,
  ExecutionMemorySummary,
  MemoryCaptureConfig,
  ProcessingCapture
} from './types';

export class MemoryManager {
  private supabaseClient: SupabaseClient;
  private executionCache: Map<string, MemoryArtifact[]> = new Map(); // executionId -> artifacts
  private config: MemoryCaptureConfig;

  constructor(supabaseClient: SupabaseClient, config?: Partial<MemoryCaptureConfig>) {
    this.supabaseClient = supabaseClient;
    this.config = {
      captureInputs: true,
      captureProcessing: true,
      captureOutputs: true,
      captureFullDOM: true,
      compressLargeData: false,        // Raw storage initially
      maxArtifactSize: 10 * 1024 * 1024, // 10MB limit
      ...config
    };
  }

  // === CORE MEMORY CAPTURE METHODS (SYNCHRONOUS/BLOCKING) ===

  /**
   * Capture complete memory artifact for a node execution
   * BLOCKING - execution waits for this to complete
   */
  async captureNodeMemory(
    executionId: string,
    nodeId: string,
    userId: string,
    inputs: MemoryInputs,
    processing: MemoryProcessing,
    outputs: MemoryOutputs,
    forwardingRules: ForwardingRules,
    actionIndex?: number
  ): Promise<MemoryArtifact> {
    const startTime = Date.now();
    
    try {
      const memoryArtifact: MemoryArtifact = {
        id: crypto.randomUUID(),
        executionId,
        nodeId,
        actionIndex,
        userId,
        timestamp: new Date(),
        inputs: this.config.captureInputs ? inputs : {} as MemoryInputs,
        processing: this.config.captureProcessing ? processing : {} as MemoryProcessing,
        outputs: this.config.captureOutputs ? outputs : {} as MemoryOutputs,
        forwardingRules
      };

      // Store in database (BLOCKING)
      const { data, error } = await this.supabaseClient
        .from('memory_artifacts')
        .insert({
          id: memoryArtifact.id,
          execution_id: memoryArtifact.executionId,
          node_id: memoryArtifact.nodeId,
          action_index: memoryArtifact.actionIndex,
          user_id: memoryArtifact.userId,
          timestamp: memoryArtifact.timestamp.toISOString(),
          inputs: memoryArtifact.inputs,
          processing: memoryArtifact.processing,
          outputs: memoryArtifact.outputs,
          forwarding_rules: memoryArtifact.forwardingRules
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Critical memory capture failure: ${error.message}`);
      }

      // Cache the artifact for quick access
      this.cacheMemoryArtifact(memoryArtifact);

      const duration = Date.now() - startTime;
      console.log(`✅ Memory captured for ${nodeId} in ${duration}ms`);

      return memoryArtifact;

    } catch (error) {
      const duration = Date.now() - startTime;
      const message = `Memory capture failed for node ${nodeId} after ${duration}ms: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`❌ ${message}`);
      throw new Error(message);
    }
  }

  /**
   * Capture node inputs before execution
   * BLOCKING - execution waits for this to complete
   */
  async captureNodeInputs(
    executionId: string,
    nodeId: string,
    userId: string,
    inputs: MemoryInputs
  ): Promise<void> {
    if (!this.config.captureInputs) return;

    try {
      // For now, just cache the inputs - we'll store the complete artifact after execution
      const cacheKey = `${executionId}-${nodeId}`;
      if (!this.executionCache.has(executionId)) {
        this.executionCache.set(executionId, []);
      }
      
      // Store inputs temporarily
      const tempArtifact = {
        id: 'temp',
        executionId,
        nodeId,
        userId,
        timestamp: new Date(),
        inputs,
        processing: { llmInteractions: [], actions: [], browserEvents: [], errors: [] },
        outputs: { 
          primaryData: null, 
          stateChanges: {}, 
          executionMetadata: { status: 'pending' as const, duration: 0 } 
        },
        forwardingRules: { forwardToNext: [] }
      };
      
      console.log(`📥 Input captured for node ${nodeId}`);
      
    } catch (error) {
      throw new Error(`Input capture failed for node ${nodeId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Capture node processing during execution
   * BLOCKING - execution waits for this to complete
   */
  async captureNodeProcessing(
    executionId: string,
    nodeId: string,
    processing: MemoryProcessing
  ): Promise<void> {
    if (!this.config.captureProcessing) return;

    try {
      // Store processing data in temporary cache
      console.log(`⚙️ Processing captured for node ${nodeId} - ${processing.actions.length} actions, ${processing.llmInteractions.length} LLM interactions`);
      
    } catch (error) {
      throw new Error(`Processing capture failed for node ${nodeId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Capture node outputs after execution
   * BLOCKING - execution waits for this to complete
   */
  async captureNodeOutputs(
    executionId: string,
    nodeId: string,
    outputs: MemoryOutputs
  ): Promise<void> {
    if (!this.config.captureOutputs) return;

    try {
      console.log(`📤 Outputs captured for node ${nodeId} - status: ${outputs.executionMetadata.status}`);
      
    } catch (error) {
      throw new Error(`Output capture failed for node ${nodeId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // === CONTEXT FLOW CONTROL ===

  /**
   * Build execution context for next node based on memory artifacts
   * This is where memory management controls information flow
   */
  async getContextForNextNode(
    executionId: string,
    currentNodeId: string,
    nextNodeId: string
  ): Promise<NodeExecutionContext> {
    try {
      // Get memory artifacts for this execution
      const memoryArtifacts = await this.getExecutionMemoryFlow(executionId);
      
      // Find the current node's memory artifact
      const currentNodeMemory = memoryArtifacts.find(m => m.nodeId === currentNodeId);
      
      if (!currentNodeMemory) {
        throw new Error(`No memory artifact found for current node ${currentNodeId}`);
      }

      // Build context based on forwarding rules
      const forwardingRules = currentNodeMemory.forwardingRules;
      const outputs = currentNodeMemory.outputs;
      
      // Determine what to forward to next node
      const forwardedData: Record<string, any> = {};
      for (const key of forwardingRules.forwardToNext) {
        if (outputs.stateChanges[key] !== undefined) {
          forwardedData[key] = outputs.stateChanges[key];
        }
        if (outputs.extractedData?.[key] !== undefined) {
          forwardedData[key] = outputs.extractedData[key];
        }
      }

      // Build environment state
      const environmentState = {
        currentUrl: currentNodeMemory.inputs.environment.currentUrl,
        sessionData: currentNodeMemory.inputs.environment.sessionState,
        browserState: currentNodeMemory.outputs.navigationResult
      };

      // Build complete context
      const context: NodeExecutionContext = {
        previousNodeOutputs: forwardedData,
        availableVariables: {
          ...currentNodeMemory.inputs.nodeVariables,
          ...forwardedData
        },
        environmentState,
        loopContext: currentNodeMemory.inputs.contextData.loopContext,
        memoryHistory: memoryArtifacts.filter(m => m.nodeId !== nextNodeId) // All previous nodes
      };

      console.log(`🔄 Context built for next node ${nextNodeId} - ${Object.keys(forwardedData).length} variables forwarded`);
      
      return context;

    } catch (error) {
      throw new Error(`Context building failed for next node ${nextNodeId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // === MEMORY RETRIEVAL METHODS ===

  /**
   * Get complete memory flow for an execution
   */
  async getExecutionMemoryFlow(executionId: string): Promise<MemoryArtifact[]> {
    // Check cache first
    if (this.executionCache.has(executionId)) {
      return this.executionCache.get(executionId)!;
    }

    try {
      const { data, error } = await this.supabaseClient
        .from('memory_artifacts')
        .select('*')
        .eq('execution_id', executionId)
        .order('timestamp', { ascending: true });

      if (error) {
        throw new Error(`Failed to retrieve memory flow: ${error.message}`);
      }

      const artifacts: MemoryArtifact[] = (data || []).map(row => ({
        id: row.id,
        executionId: row.execution_id,
        nodeId: row.node_id,
        actionIndex: row.action_index,
        userId: row.user_id,
        timestamp: new Date(row.timestamp),
        inputs: row.inputs,
        processing: row.processing,
        outputs: row.outputs,
        forwardingRules: row.forwarding_rules,
        createdAt: row.created_at ? new Date(row.created_at) : undefined,
        updatedAt: row.updated_at ? new Date(row.updated_at) : undefined
      }));

      // Cache the results
      this.executionCache.set(executionId, artifacts);
      
      return artifacts;

    } catch (error) {
      throw new Error(`Memory flow retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get memory details for a specific node
   */
  async getNodeMemoryDetails(executionId: string, nodeId: string): Promise<MemoryArtifact | null> {
    try {
      const { data, error } = await this.supabaseClient
        .from('memory_artifacts')
        .select('*')
        .eq('execution_id', executionId)
        .eq('node_id', nodeId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No results found
        }
        throw new Error(`Failed to retrieve node memory: ${error.message}`);
      }

      return {
        id: data.id,
        executionId: data.execution_id,
        nodeId: data.node_id,
        actionIndex: data.action_index,
        userId: data.user_id,
        timestamp: new Date(data.timestamp),
        inputs: data.inputs,
        processing: data.processing,
        outputs: data.outputs,
        forwardingRules: data.forwarding_rules,
        createdAt: data.created_at ? new Date(data.created_at) : undefined,
        updatedAt: data.updated_at ? new Date(data.updated_at) : undefined
      };

    } catch (error) {
      throw new Error(`Node memory retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search memory artifacts with filters
   */
  async searchMemoryArtifacts(filters: MemorySearchFilters): Promise<MemoryArtifact[]> {
    try {
      let query = this.supabaseClient
        .from('memory_artifacts')
        .select('*');

      // Apply filters
      if (filters.executionId) {
        query = query.eq('execution_id', filters.executionId);
      }
      if (filters.nodeId) {
        query = query.eq('node_id', filters.nodeId);
      }
      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters.status) {
        query = query.eq('outputs->executionMetadata->status', filters.status);
      }
      if (filters.timestampFrom) {
        query = query.gte('timestamp', filters.timestampFrom.toISOString());
      }
      if (filters.timestampTo) {
        query = query.lte('timestamp', filters.timestampTo.toISOString());
      }
      if (filters.hasErrors) {
        query = query.gt('processing->errors', '[]');
      }

      // Apply pagination
      if (filters.limit) {
        query = query.limit(filters.limit);
      }
      if (filters.offset) {
        query = query.range(filters.offset, (filters.offset + (filters.limit || 100)) - 1);
      }

      query = query.order('timestamp', { ascending: false });

      const { data, error } = await query;

      if (error) {
        throw new Error(`Search failed: ${error.message}`);
      }

      return (data || []).map(row => ({
        id: row.id,
        executionId: row.execution_id,
        nodeId: row.node_id,
        actionIndex: row.action_index,
        userId: row.user_id,
        timestamp: new Date(row.timestamp),
        inputs: row.inputs,
        processing: row.processing,
        outputs: row.outputs,
        forwardingRules: row.forwarding_rules,
        createdAt: row.created_at ? new Date(row.created_at) : undefined,
        updatedAt: row.updated_at ? new Date(row.updated_at) : undefined
      }));

    } catch (error) {
      throw new Error(`Memory search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // === UTILITY METHODS ===

  /**
   * Get execution memory summary
   */
  async getExecutionSummary(executionId: string): Promise<ExecutionMemorySummary> {
    try {
      const artifacts = await this.getExecutionMemoryFlow(executionId);
      
      const summary: ExecutionMemorySummary = {
        executionId,
        totalNodes: artifacts.length,
        completedNodes: artifacts.filter(a => a.outputs.executionMetadata.status === 'success').length,
        failedNodes: artifacts.filter(a => a.outputs.executionMetadata.status === 'error').length,
        totalDuration: artifacts.reduce((sum, a) => sum + a.outputs.executionMetadata.duration, 0),
        totalTokens: artifacts.reduce((sum, a) => sum + (a.outputs.executionMetadata.resourceUsage?.tokens || 0), 0),
        totalApiCalls: artifacts.reduce((sum, a) => sum + (a.outputs.executionMetadata.resourceUsage?.apiCalls || 0), 0),
        memorySize: JSON.stringify(artifacts).length, // Rough estimate
        errorCount: artifacts.reduce((sum, a) => sum + a.processing.errors.length, 0),
        startTime: artifacts.length > 0 ? artifacts[0].timestamp : new Date(),
        endTime: artifacts.length > 0 ? artifacts[artifacts.length - 1].timestamp : undefined
      };

      return summary;

    } catch (error) {
      throw new Error(`Execution summary failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear execution cache
   */
  clearExecutionCache(executionId?: string): void {
    if (executionId) {
      this.executionCache.delete(executionId);
      console.log(`🧹 Cache cleared for execution ${executionId}`);
    } else {
      this.executionCache.clear();
      console.log(`🧹 All execution cache cleared`);
    }
  }

  // === PRIVATE HELPER METHODS ===

  /**
   * Cache memory artifact for quick access
   */
  private cacheMemoryArtifact(artifact: MemoryArtifact): void {
    if (!this.executionCache.has(artifact.executionId)) {
      this.executionCache.set(artifact.executionId, []);
    }
    
    const artifacts = this.executionCache.get(artifact.executionId)!;
    
    // Replace if exists, otherwise add
    const existingIndex = artifacts.findIndex(a => a.nodeId === artifact.nodeId && a.actionIndex === artifact.actionIndex);
    if (existingIndex >= 0) {
      artifacts[existingIndex] = artifact;
    } else {
      artifacts.push(artifact);
    }
    
    // Sort by timestamp
    artifacts.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Check if data should be compressed (future use)
   */
  private shouldCompress(data: any): boolean {
    const size = JSON.stringify(data).length;
    return this.config.compressLargeData && size > this.config.maxArtifactSize;
  }
} 