import { useState, useEffect, useRef } from 'react';

interface ReasoningUpdate {
  type: 'reasoning_start' | 'reasoning_delta' | 'reasoning_complete';
  text?: string;
  nodeId?: string;
  stage?: string;
  timestamp?: number;
}

interface UseReasoningStreamReturn {
  reasoningText: string;
  isThinking: boolean;
  isConnected: boolean;
  subscribe: () => void;
  unsubscribe: () => void;
  clearReasoning: () => void;
}

export function useReasoningStream(executionId: string): UseReasoningStreamReturn {
  const [reasoningText, setReasoningText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket(`ws://localhost:3004/ws?executionId=${executionId}`);
      
      ws.onopen = () => {
        console.log(`[ReasoningStream] Connected for execution ${executionId}`);
        setIsConnected(true);
        
        // Auto-subscribe on connection
        if (isSubscribed) {
          ws.send(JSON.stringify({
            type: 'reasoning_subscribe',
            timestamp: Date.now()
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'reasoning_update' && message.data) {
            const update: ReasoningUpdate = message.data;
            
            switch (update.type) {
              case 'reasoning_start':
                console.log('[ReasoningStream] Reasoning started');
                setIsThinking(true);
                setReasoningText('');
                break;
                
              case 'reasoning_delta':
                if (update.text) {
                  console.log('[ReasoningStream] Reasoning delta:', update.text);
                  setReasoningText(prev => prev + update.text);
                }
                break;
                
              case 'reasoning_complete':
                console.log('[ReasoningStream] Reasoning completed');
                setIsThinking(false);
                break;
            }
          } else if (message.type === 'reasoning_subscribed') {
            console.log('[ReasoningStream] Subscribed to reasoning updates');
          } else if (message.type === 'reasoning_unsubscribed') {
            console.log('[ReasoningStream] Unsubscribed from reasoning updates');
          }
        } catch (error) {
          console.error('[ReasoningStream] Error parsing message:', error);
        }
      };

      ws.onclose = () => {
        console.log('[ReasoningStream] Connection closed');
        setIsConnected(false);
        
        // Auto-reconnect after 2 seconds
        if (isSubscribed) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[ReasoningStream] Attempting to reconnect...');
            connect();
          }, 2000);
        }
      };

      ws.onerror = (error) => {
        console.error('[ReasoningStream] WebSocket error:', error);
        setIsConnected(false);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[ReasoningStream] Failed to connect:', error);
    }
  };

  const subscribe = () => {
    setIsSubscribed(true);
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'reasoning_subscribe',
        timestamp: Date.now()
      }));
    } else {
      connect();
    }
  };

  const unsubscribe = () => {
    setIsSubscribed(false);
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'reasoning_unsubscribe',
        timestamp: Date.now()
      }));
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  const clearReasoning = () => {
    setReasoningText('');
    setIsThinking(false);
  };

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      unsubscribe();
      
      if (wsRef.current) {
        wsRef.current.close();
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return {
    reasoningText,
    isThinking,
    isConnected,
    subscribe,
    unsubscribe,
    clearReasoning
  };
}