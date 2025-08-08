// A super-lightweight publish/subscribe helper that works in the browser.
// Usage:
//   import eventBus from '@/lib/utils/eventBus';
//   eventBus.on('nodeExecuted', handler);
//   eventBus.emit('nodeExecuted', { executionId, nodeId });

export type EventPayload = Record<string, any>;
export type EventHandler<T extends EventPayload = EventPayload> = (payload?: T) => void;

class EventBus {
  private handlers: Record<string, EventHandler[]> = {};

  on(event: string, handler: EventHandler) {
    this.handlers[event] = this.handlers[event] || [];
    this.handlers[event].push(handler);
  }

  off(event: string, handler: EventHandler) {
    if (!this.handlers[event]) return;
    this.handlers[event] = this.handlers[event].filter((h) => h !== handler);
  }

  emit(event: string, payload?: EventPayload) {
    (this.handlers[event] || []).forEach((handler) => handler(payload));
  }
}

const eventBus = new EventBus();
export default eventBus; 