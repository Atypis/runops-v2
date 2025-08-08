import { supabase } from '../config/supabase.js';

export class ConversationService {
  /**
   * Save a message to the conversation history
   */
  async saveMessage(workflowId, role, content, metadata = {}, responseId = null) {
    try {
      // Extract relevant metadata
      const messageData = {
        workflow_id: workflowId,
        role,
        content: content || '(No message content - tool calls only)',
        timestamp: new Date().toISOString(),
        is_active: true
      };

      // Add response_id if provided (for assistant messages)
      if (responseId) {
        messageData.response_id = responseId;
      }

      // Store additional metadata as JSONB if present
      if (Object.keys(metadata).length > 0) {
        messageData.metadata = metadata;
      }

      const { data, error } = await supabase
        .from('conversations')
        .insert(messageData)
        .select()
        .single();

      if (error) {
        console.error('Failed to save conversation message:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in saveMessage:', error);
      // Don't throw - we don't want to break the chat flow if persistence fails
      return null;
    }
  }

  /**
   * Save multiple messages in a batch
   */
  async saveMessages(workflowId, messages) {
    try {
      const messagesToSave = messages.map(msg => ({
        workflow_id: workflowId,
        role: msg.role,
        content: msg.content || '(No message content - tool calls only)',
        timestamp: msg.timestamp || new Date().toISOString(),
        metadata: msg.metadata || {}
      }));

      const { data, error } = await supabase
        .from('conversations')
        .insert(messagesToSave)
        .select();

      if (error) {
        console.error('Failed to save conversation messages:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in saveMessages:', error);
      return [];
    }
  }

  /**
   * Deactivate messages after a specific message ID for forking
   */
  async deactivateMessagesAfter(workflowId, messageId) {
    console.log('[DEACTIVATE] Starting deactivation for workflow:', workflowId, 'after message:', messageId);
    
    try {
      // First get the timestamp of the message we're forking from
      console.log('[DEACTIVATE] Looking up message timestamp...');
      const { data: forkMessage, error: fetchError } = await supabase
        .from('conversations')
        .select('timestamp')
        .eq('workflow_id', workflowId)
        .eq('id', messageId)
        .single();

      console.log('[DEACTIVATE] Fork message lookup:', {
        found: !!forkMessage,
        error: fetchError,
        timestamp: forkMessage?.timestamp
      });

      if (fetchError || !forkMessage) {
        console.error('[DEACTIVATE] Error fetching fork message:', fetchError);
        return false;
      }

      // Deactivate all messages after this timestamp
      console.log('[DEACTIVATE] Deactivating messages after timestamp:', forkMessage.timestamp);
      const { error: updateError, count } = await supabase
        .from('conversations')
        .update({ is_active: false })
        .eq('workflow_id', workflowId)
        .gt('timestamp', forkMessage.timestamp)
        .select('id', { count: 'exact' });

      console.log('[DEACTIVATE] Deactivation result:', {
        error: updateError,
        messagesDeactivated: count
      });

      if (updateError) {
        console.error('[DEACTIVATE] Error deactivating messages:', updateError);
        return false;
      }

      console.log('[DEACTIVATE] Successfully deactivated', count, 'messages');
      return true;
    } catch (error) {
      console.error('Error in deactivateMessagesAfter:', error);
      return false;
    }
  }

  /**
   * Load conversation history for a workflow
   */
  async getConversationHistory(workflowId, limit = 100, includeInactive = false) {
    try {
      let query = supabase
        .from('conversations')
        .select('*')
        .eq('workflow_id', workflowId)
        .order('timestamp', { ascending: true })
        .limit(limit);

      // By default, only load active messages
      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to load conversation history:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in getConversationHistory:', error);
      return [];
    }
  }

  /**
   * Get the last N messages for a workflow
   */
  async getRecentMessages(workflowId, count = 10) {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('workflow_id', workflowId)
        .order('timestamp', { ascending: false })
        .limit(count);

      if (error) {
        console.error('Failed to load recent messages:', error);
        throw error;
      }

      // Reverse to get chronological order
      return (data || []).reverse();
    } catch (error) {
      console.error('Error in getRecentMessages:', error);
      return [];
    }
  }

  /**
   * Clear conversation history for a workflow
   */
  async clearConversationHistory(workflowId) {
    try {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('workflow_id', workflowId);

      if (error) {
        console.error('Failed to clear conversation history:', error);
        throw error;
      }

      return { success: true };
    } catch (error) {
      console.error('Error in clearConversationHistory:', error);
      throw error;
    }
  }

  /**
   * Format messages for frontend display
   */
  formatMessagesForDisplay(messages) {
    return messages.map(msg => {
      const formatted = {
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        isArchived: msg.is_archived || false,
        responseId: msg.response_id
      };

      // Include metadata if present
      if (msg.metadata) {
        if (msg.metadata.toolCalls) {
          formatted.toolCalls = msg.metadata.toolCalls;
        }
        if (msg.metadata.reasoning) {
          formatted.reasoning = msg.metadata.reasoning;
        }
        if (msg.metadata.tokenUsage) {
          formatted.tokenUsage = msg.metadata.tokenUsage;
        }
        if (msg.metadata.debug_input) {
          formatted.debug_input = msg.metadata.debug_input;
        }
        if (msg.metadata.isCompressed) {
          formatted.isCompressed = msg.metadata.isCompressed;
        }
        if (msg.metadata.compressionStats) {
          formatted.compressionStats = msg.metadata.compressionStats;
        }
      }

      return formatted;
    });
  }
}