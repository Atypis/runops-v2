/**
 * Stagehand Memory Hooks Service
 * 
 * Captures LLM conversations and reasoning for memory artifacts:
 * - Exact prompts sent to LLM
 * - Complete LLM responses
 * - Element selection reasoning
 * - Context flow between actions
 * 
 * This service hooks into the browser automation flow to capture
 * all LLM interactions for surgical debugging capabilities.
 */

import { EventEmitter } from 'events';

export interface LLMConversation {
  timestamp: number;
  executionId: string;
  stepId: string;
  prompt: string;
  response: string;
  reasoning?: string;
  context?: Record<string, any>;
  elementSelection?: {
    selectedElement: string;
    alternatives: string[];
    reasoning: string;
  };
}

export interface StagehandAction {
  timestamp: number;
  executionId: string;
  stepId: string;
  actionType: string;
  instruction: string;
  result?: any;
  error?: string;
  llmConversations: LLMConversation[];
}

export class StagehandMemoryHooks extends EventEmitter {
  private static instance: StagehandMemoryHooks;
  private activeConversations: Map<string, LLMConversation[]> = new Map();
  private actionHistory: Map<string, StagehandAction[]> = new Map();

  constructor() {
    super();
  }

  static getInstance(): StagehandMemoryHooks {
    if (!StagehandMemoryHooks.instance) {
      StagehandMemoryHooks.instance = new StagehandMemoryHooks();
    }
    return StagehandMemoryHooks.instance;
  }

  /**
   * Hook into LLM conversation start
   * Called when a prompt is about to be sent to the LLM
   */
  onPromptSent(executionId: string, stepId: string, prompt: string, context?: Record<string, any>): void {
    console.log(`🤖 [StagehandMemoryHooks] Prompt sent for ${executionId}:${stepId}`);
    
    const conversation: LLMConversation = {
      timestamp: Date.now(),
      executionId,
      stepId,
      prompt,
      response: '', // Will be filled when response comes
      context
    };

    const conversations = this.activeConversations.get(executionId) || [];
    conversations.push(conversation);
    this.activeConversations.set(executionId, conversations);

    // Emit event for external listeners
    this.emit('prompt_sent', { executionId, stepId, prompt, context });
  }

  /**
   * Hook into LLM conversation completion
   * Called when a response is received from the LLM
   */
  onResponseReceived(
    executionId: string, 
    stepId: string, 
    response: string, 
    reasoning?: string,
    elementSelection?: {
      selectedElement: string;
      alternatives: string[];
      reasoning: string;
    }
  ): void {
    console.log(`🤖 [StagehandMemoryHooks] Response received for ${executionId}:${stepId}`);
    
    const conversations = this.activeConversations.get(executionId) || [];
    const conversation = conversations.find(c => c.stepId === stepId);
    
    if (conversation) {
      conversation.response = response;
      conversation.reasoning = reasoning;
      conversation.elementSelection = elementSelection;
    } else {
      // Create new conversation if not found (fallback)
      conversations.push({
        timestamp: Date.now(),
        executionId,
        stepId,
        prompt: '[Prompt not captured]',
        response,
        reasoning,
        elementSelection
      });
    }

    this.activeConversations.set(executionId, conversations);

    // Emit event for external listeners
    this.emit('response_received', { 
      executionId, 
      stepId, 
      response, 
      reasoning, 
      elementSelection 
    });
  }

  /**
   * Hook into action start
   * Called when a Stagehand action begins
   */
  onActionStart(executionId: string, stepId: string, actionType: string, instruction: string): void {
    console.log(`🎬 [StagehandMemoryHooks] Action started: ${actionType} for ${executionId}:${stepId}`);
    
    const action: StagehandAction = {
      timestamp: Date.now(),
      executionId,
      stepId,
      actionType,
      instruction,
      llmConversations: this.activeConversations.get(executionId) || []
    };

    const actions = this.actionHistory.get(executionId) || [];
    actions.push(action);
    this.actionHistory.set(executionId, actions);

    // Clear active conversations for this execution (they're now part of the action)
    this.activeConversations.delete(executionId);

    // Emit event for external listeners
    this.emit('action_start', { executionId, stepId, actionType, instruction });
  }

  /**
   * Hook into action completion
   * Called when a Stagehand action completes successfully
   */
  onActionComplete(executionId: string, stepId: string, result: any): void {
    console.log(`✅ [StagehandMemoryHooks] Action completed for ${executionId}:${stepId}`);
    
    const actions = this.actionHistory.get(executionId) || [];
    const action = actions.find(a => a.stepId === stepId);
    
    if (action) {
      action.result = result;
    }

    // Emit event for external listeners
    this.emit('action_complete', { executionId, stepId, result });
  }

  /**
   * Hook into action error
   * Called when a Stagehand action fails
   */
  onActionError(executionId: string, stepId: string, error: string): void {
    console.log(`❌ [StagehandMemoryHooks] Action failed for ${executionId}:${stepId}: ${error}`);
    
    const actions = this.actionHistory.get(executionId) || [];
    const action = actions.find(a => a.stepId === stepId);
    
    if (action) {
      action.error = error;
    }

    // Emit event for external listeners
    this.emit('action_error', { executionId, stepId, error });
  }

  /**
   * Get all LLM conversations for an execution
   */
  getLLMConversations(executionId: string): LLMConversation[] {
    const actions = this.actionHistory.get(executionId) || [];
    const conversations: LLMConversation[] = [];
    
    for (const action of actions) {
      conversations.push(...action.llmConversations);
    }

    return conversations;
  }

  /**
   * Get all actions for an execution
   */
  getActionHistory(executionId: string): StagehandAction[] {
    return this.actionHistory.get(executionId) || [];
  }

  /**
   * Get the complete execution trace (actions + conversations)
   */
  getExecutionTrace(executionId: string): {
    actions: StagehandAction[];
    conversations: LLMConversation[];
  } {
    const actions = this.getActionHistory(executionId);
    const conversations = this.getLLMConversations(executionId);
    
    return { actions, conversations };
  }

  /**
   * Clear memory for an execution (cleanup)
   */
  clearExecution(executionId: string): void {
    console.log(`🗑️ [StagehandMemoryHooks] Clearing memory for ${executionId}`);
    
    this.activeConversations.delete(executionId);
    this.actionHistory.delete(executionId);
    
    this.emit('execution_cleared', { executionId });
  }

  /**
   * Get current memory usage stats
   */
  getMemoryStats(): {
    activeExecutions: number;
    totalConversations: number;
    totalActions: number;
  } {
    let totalConversations = 0;
    let totalActions = 0;

    for (const conversations of this.activeConversations.values()) {
      totalConversations += conversations.length;
    }

    for (const actions of this.actionHistory.values()) {
      totalActions += actions.length;
      for (const action of actions) {
        totalConversations += action.llmConversations.length;
      }
    }

    return {
      activeExecutions: this.actionHistory.size,
      totalConversations,
      totalActions
    };
  }
}

// Export singleton instance
export const stagehandMemoryHooks = StagehandMemoryHooks.getInstance(); 