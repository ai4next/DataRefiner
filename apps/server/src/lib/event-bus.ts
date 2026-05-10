import { EventEmitter } from 'events';
import type { WsEvent } from '@datarefiner/shared';

class EventBus extends EventEmitter {
  emitWs(sessionId: string, event: Omit<WsEvent, 'sessionId'>): void {
    const wsEvent: WsEvent = { sessionId, ...event };
    this.emit(`ws:${sessionId}`, wsEvent);
    this.emit('ws:*', wsEvent);
  }
}

export const eventBus = new EventBus();