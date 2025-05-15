/* eslint-disable no-restricted-globals */

// Simple test worker
console.log('TEST WORKER: Started');

self.onmessage = function(event) {
  console.log('TEST WORKER: Received message:', event.data);
  
  // Echo back the message with a confirmation
  self.postMessage({
    received: event.data,
    confirmation: 'Message received by test worker'
  });
};

// Log that we've set up the handler
console.log('TEST WORKER: Message handler registered'); 