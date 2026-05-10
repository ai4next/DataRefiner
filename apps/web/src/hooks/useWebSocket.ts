import { useEffect, useRef, useCallback } from 'react';

export function useWebSocket(sessionId: string | null, onEvent: (event: any) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (!sessionId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = `${protocol}//${host}/ws?sessionId=${sessionId}`;

    const ws = new WebSocket(url);
    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        onEvent(event);
      } catch { /* ignore parse errors */ }
    };
    ws.onopen = () => {
      retriesRef.current = 0; // reset retry count on successful connection
    };
    ws.onclose = () => {
      // Exponential backoff reconnection: 1s, 2s, 4s, 8s... max 30s
      const delay = Math.min(1000 * Math.pow(2, retriesRef.current), 30000);
      retriesRef.current++;
      timerRef.current = setTimeout(connect, delay);
    };
    ws.onerror = () => {
      ws.close(); // onclose will trigger reconnection
    };
    wsRef.current = ws;
  }, [sessionId, onEvent]);

  useEffect(() => {
    retriesRef.current = 0;
    connect();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return wsRef;
}