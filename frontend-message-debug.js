// Debug logging for message disappearing issue
// Add this to your frontend code to trace message state

// 1. Add to the message sending function
console.log('[DEBUG] Before sending message:', {
  currentMessages: messages.length,
  lastMessage: messages[messages.length - 1],
  historyLength: historyLength,
  workflowId: workflowId
});

// 2. Add to the response handler after receiving messages
console.log('[DEBUG] After receiving response:', {
  receivedMessages: response.data.length,
  firstMessage: response.data[0],
  lastMessage: response.data[response.data.length - 1],
  archivedCount: response.data.filter(m => m.isArchived).length,
  activeCount: response.data.filter(m => m.is_active).length
});

// 3. Add to the state update function
console.log('[DEBUG] State update:', {
  oldMessageCount: oldMessages.length,
  newMessageCount: newMessages.length,
  removedCount: oldMessages.length - newMessages.length,
  addedCount: newMessages.length - oldMessages.length
});

// 4. Add to compression detection
if (detectedCompression) {
  console.log('[DEBUG] Compression detected:', {
    compressedMessageId: compressedMessage.id,
    archivedMessageIds: archivedMessages.map(m => m.id),
    totalMessagesBeforeCompression: messagesBeforeCompression.length,
    totalMessagesAfterCompression: messagesAfterCompression.length
  });
}

// 5. Monitor message array changes in real-time
let messageMonitor = setInterval(() => {
  const currentMessages = document.querySelectorAll('[data-message-id]');
  const visibleMessages = Array.from(currentMessages).filter(el => 
    el.offsetParent !== null && 
    window.getComputedStyle(el).display !== 'none'
  );
  
  console.log('[DEBUG] Message visibility check:', {
    totalInDOM: currentMessages.length,
    visibleCount: visibleMessages.length,
    hiddenCount: currentMessages.length - visibleMessages.length,
    messageIds: Array.from(currentMessages).map(el => el.dataset.messageId)
  });
}, 2000);

// 6. Add to the conversation reload function
console.log('[DEBUG] Reloading conversation:', {
  reason: 'message_sent',
  currentMessageCount: messages.length,
  includeInactive: includeInactive,
  limit: limit
});

// 7. WebSocket message handler
socket.on('message', (data) => {
  console.log('[DEBUG] WebSocket message received:', {
    type: data.type,
    messageId: data.id,
    isCompressed: data.metadata?.isCompressed,
    isArchived: data.isArchived,
    is_active: data.is_active
  });
});

// 8. Track state mutations
const originalSetMessages = setMessages;
setMessages = (newMessages) => {
  console.log('[DEBUG] setMessages called:', {
    caller: new Error().stack.split('\n')[2],
    oldCount: messages.length,
    newCount: newMessages.length,
    difference: newMessages.length - messages.length
  });
  originalSetMessages(newMessages);
};