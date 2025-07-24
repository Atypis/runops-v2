# Message Disappearing Debug Guide

Add these console.log statements to trace the issue:

## 1. In the sendMessage function (around line 5383 based on your logs):
```javascript
// Right before sending
console.log('[MESSAGE DEBUG] Pre-send state:', {
  messageCount: messages.length,
  lastMessageId: messages[messages.length - 1]?.id,
  historyLength: historyLength,
  timestamp: new Date().toISOString()
});
```

## 2. In the conversation reload function (around line 5472):
```javascript
console.log('[MESSAGE DEBUG] Reloading conversation:', {
  reason: 'Getting message IDs',
  currentMessages: messages.length,
  timestamp: new Date().toISOString()
});

// After the reload completes
console.log('[MESSAGE DEBUG] Reload complete:', {
  loadedMessages: response.data.length,
  activeMessages: response.data.filter(m => m.is_active).length,
  archivedMessages: response.data.filter(m => m.isArchived).length,
  messagesWithContent: response.data.filter(m => m.content).length
});
```

## 3. In the message state setter:
```javascript
// Wherever setMessages or similar is called
const updateMessages = (newMessages) => {
  console.log('[MESSAGE DEBUG] Updating messages:', {
    oldCount: messages.length,
    newCount: newMessages.length,
    dropped: messages.length - newMessages.length,
    caller: new Error().stack.split('\n')[2] // Shows where this was called from
  });
  
  // Log if messages are being filtered out
  if (newMessages.length < messages.length) {
    const oldIds = new Set(messages.map(m => m.id));
    const newIds = new Set(newMessages.map(m => m.id));
    const droppedIds = [...oldIds].filter(id => !newIds.has(id));
    console.log('[MESSAGE DEBUG] Dropped message IDs:', droppedIds);
  }
  
  setMessages(newMessages);
};
```

## 4. Add a global message watcher:
```javascript
// Add this to your app initialization
window.messageWatcher = setInterval(() => {
  const messageElements = document.querySelectorAll('[class*="message"]');
  const visibleMessages = Array.from(messageElements).filter(el => {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
  
  if (window.lastMessageCount !== undefined && window.lastMessageCount !== visibleMessages.length) {
    console.log('[MESSAGE DEBUG] Message count changed!', {
      from: window.lastMessageCount,
      to: visibleMessages.length,
      timestamp: new Date().toISOString()
    });
  }
  window.lastMessageCount = visibleMessages.length;
}, 1000);
```

## 5. Check for filtering logic:
Look for any code that filters messages like:
```javascript
// This could be hiding messages
messages.filter(m => !m.isArchived)
messages.filter(m => m.is_active && !m.isArchived)
messages.slice(0, someLimit) // Could be cutting off messages
```

## What to Look For:
1. **Double reload** - Why is conversation reloaded twice?
2. **Message count drops** - When exactly do messages disappear?
3. **Filter conditions** - Is something filtering out valid messages?
4. **State overwrites** - Is an old state overwriting the new one?

Run with these logs and share what you find when messages disappear!