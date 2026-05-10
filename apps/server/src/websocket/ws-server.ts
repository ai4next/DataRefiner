import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { eventBus } from '../lib/event-bus.js';
import { logger } from '../lib/logger.js';

const clients = new Map<string, Set<WebSocket>>();

export function initWsServer(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', 'http://localhost');
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
      ws.close(4000, 'Missing sessionId');
      return;
    }

    if (!clients.has(sessionId)) {
      clients.set(sessionId, new Set());
    }
    clients.get(sessionId)!.add(ws);

    logger.info({ sessionId }, 'WebSocket client connected');

    ws.on('close', () => {
      clients.get(sessionId)?.delete(ws);
      if (clients.get(sessionId)?.size === 0) {
        clients.delete(sessionId);
      }
    });

    ws.on('error', (err) => {
      logger.error({ err, sessionId }, 'WebSocket error');
    });
  });

  // Forward EventBus events to WebSocket clients
  eventBus.on('ws:*', (event) => {
    const sessionClients = clients.get(event.sessionId);
    if (!sessionClients) return;
    const message = JSON.stringify(event);
    for (const ws of sessionClients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  });

  logger.info('WebSocket server initialized');
  return wss;
}