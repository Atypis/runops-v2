/**
 * TokenCounter Service - Tracks all conversation tokens for real-time monitoring
 * Integrates with OpenAI Responses API and reasoning sessions
 */

export class TokenCounterService {
  constructor() {
    // Token pricing (as of OpenAI o4-mini pricing)
    this.pricing = {
      input_tokens: 0.15 / 1000000,      // $0.15 per 1M tokens
      output_tokens: 0.60 / 1000000,     // $0.60 per 1M tokens  
      reasoning_tokens: 60.0 / 1000000   // $60.00 per 1M tokens (estimated)
    };
    
    // In-memory conversation token tracking
    this.conversationTokens = new Map(); // workflowId -> tokenData
  }

  /**
   * Record tokens from an OpenAI API response
   */
  recordTokenUsage(workflowId, usage, messageType = 'assistant') {
    if (!workflowId || !usage) return;

    const tokenData = this.getConversationTokens(workflowId);
    
    // Add new token usage
    const newUsage = {
      timestamp: new Date().toISOString(),
      messageType,
      input_tokens: usage.input_tokens || 0,
      cached_tokens: usage.cached_tokens || 0,  // NEW: Track cached tokens
      actual_input_tokens: usage.actual_input_tokens || usage.input_tokens || 0,  // NEW: Total input including cached
      output_tokens: usage.output_tokens || 0,
      reasoning_tokens: usage.output_tokens_details?.reasoning_tokens || 0,
      total_tokens: usage.total_tokens || 0,
      cost: this.calculateMessageCost(usage)
    };

    tokenData.messages.push(newUsage);
    
    // Update totals
    tokenData.totals.input_tokens += newUsage.input_tokens;
    tokenData.totals.output_tokens += newUsage.output_tokens;
    tokenData.totals.reasoning_tokens += newUsage.reasoning_tokens;
    tokenData.totals.total_tokens += newUsage.total_tokens;
    tokenData.totals.total_cost += newUsage.cost;
    tokenData.totals.message_count += 1;

    this.conversationTokens.set(workflowId, tokenData);
    
    console.log(`[TOKEN_COUNTER] Recorded usage for ${workflowId}:`, newUsage);
    return newUsage;
  }

  /**
   * Estimate tokens for user messages (since OpenAI doesn't return usage for input-only)
   */
  recordUserMessage(workflowId, messageContent) {
    if (!workflowId || !messageContent) return;

    // Simple token estimation: ~4 characters per token
    const estimatedTokens = Math.ceil(messageContent.length / 4);
    
    const usage = {
      input_tokens: estimatedTokens,
      output_tokens: 0,
      reasoning_tokens: 0,
      total_tokens: estimatedTokens
    };

    return this.recordTokenUsage(workflowId, usage, 'user');
  }

  /**
   * Calculate cost for a message based on token usage
   */
  calculateMessageCost(usage) {
    // Regular input tokens at full price
    const uncachedInputCost = (usage.input_tokens || 0) * this.pricing.input_tokens;
    
    // Cached tokens at 75% discount (25% of normal price)
    const cachedInputCost = (usage.cached_tokens || 0) * this.pricing.input_tokens * 0.25;
    
    const outputCost = (usage.output_tokens || 0) * this.pricing.output_tokens;
    const reasoningCost = (usage.output_tokens_details?.reasoning_tokens || 0) * this.pricing.reasoning_tokens;
    
    return uncachedInputCost + cachedInputCost + outputCost + reasoningCost;
  }

  /**
   * Get conversation token data for a workflow
   */
  getConversationTokens(workflowId) {
    if (!this.conversationTokens.has(workflowId)) {
      this.conversationTokens.set(workflowId, {
        workflowId,
        startedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        totals: {
          input_tokens: 0,
          output_tokens: 0,
          reasoning_tokens: 0,
          total_tokens: 0,
          total_cost: 0,
          message_count: 0
        },
        messages: []
      });
    }

    const data = this.conversationTokens.get(workflowId);
    data.lastUpdated = new Date().toISOString();
    return data;
  }

  /**
   * Get comprehensive token stats for dashboard
   */
  getTokenStats(workflowId) {
    const tokenData = this.getConversationTokens(workflowId);
    
    return {
      ...tokenData,
      breakdown: {
        user_messages: tokenData.messages.filter(m => m.messageType === 'user').length,
        assistant_messages: tokenData.messages.filter(m => m.messageType === 'assistant').length,
        total_reasoning_tokens: tokenData.totals.reasoning_tokens,
        average_reasoning_per_message: tokenData.totals.reasoning_tokens / Math.max(1, tokenData.messages.filter(m => m.messageType === 'assistant').length),
        cost_breakdown: {
          input_cost: tokenData.totals.input_tokens * this.pricing.input_tokens,
          output_cost: tokenData.totals.output_tokens * this.pricing.output_tokens,
          reasoning_cost: tokenData.totals.reasoning_tokens * this.pricing.reasoning_tokens
        }
      },
      warnings: this.getTokenWarnings(tokenData.totals.total_tokens),
      recent_messages: tokenData.messages.slice(-5) // Last 5 messages for debugging
    };
  }

  /**
   * Generate warnings based on token usage
   */
  getTokenWarnings(totalTokens) {
    const warnings = [];
    
    if (totalTokens > 180000) {
      warnings.push({
        level: 'critical',
        message: 'Context compression needed! Over 180K tokens.',
        action: 'compress_context'
      });
    } else if (totalTokens > 160000) {
      warnings.push({
        level: 'warning', 
        message: 'Approaching token limit. Consider compression soon.',
        action: 'prepare_compression'
      });
    } else if (totalTokens > 100000) {
      warnings.push({
        level: 'info',
        message: 'Large context detected. Monitor token growth.',
        action: 'monitor'
      });
    }

    return warnings;
  }

  /**
   * Clear conversation data (useful for testing)
   */
  clearConversation(workflowId) {
    this.conversationTokens.delete(workflowId);
    console.log(`[TOKEN_COUNTER] Cleared conversation data for ${workflowId}`);
  }

  /**
   * Get all active conversations (for admin dashboard)
   */
  getAllConversations() {
    const conversations = [];
    for (const [workflowId, data] of this.conversationTokens.entries()) {
      conversations.push({
        workflowId,
        totalTokens: data.totals.total_tokens,
        totalCost: data.totals.total_cost,
        messageCount: data.totals.message_count,
        lastUpdated: data.lastUpdated
      });
    }
    return conversations.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
  }
}