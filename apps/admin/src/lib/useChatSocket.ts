import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from './types';

export type SocketStatus = 'connecting' | 'open' | 'reconnecting' | 'closed';

/** Uzilganda avtomatik qayta ulanishlar soni — keyin foydalanuvchiga tugma ko'rsatiladi. */
const MAX_RETRIES = 5;

/**
 * Chat WebSocket'i: tarix + jonli xabarlar, ulanish holati va avtomatik qayta ulanish.
 *
 * Xona almashganda holat tozalanishi uchun komponentni `key` bilan qayta yarating —
 * hook har bir mount uchun bitta xonaga xizmat qiladi.
 */
export function useChatSocket(url: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<SocketStatus>('connecting');
  // Server tarixni yubordi — shundan keyingina "xabarlar yo'q" deyish mumkin
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let active = true;
    let retries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      const socket = new WebSocket(url);
      wsRef.current = socket;

      socket.onopen = () => {
        if (active) setStatus('open');
      };

      socket.onmessage = (event) => {
        if (!active) return;
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'history') {
            const history = typeof parsed.text === 'string' ? JSON.parse(parsed.text) : parsed.text;
            retries = 0; // server bizni qabul qildi
            setMessages(Array.isArray(history) ? (history as ChatMessage[]) : []);
            setHistoryLoaded(true);
            return;
          }
          const msg = parsed as ChatMessage;
          setMessages((prev) => {
            // Bir xil id qayta kelsa (masalan, konferensiya tugatilganda) — yangilaymiz
            const idx = msg.id != null ? prev.findIndex((m) => m.id === msg.id) : -1;
            if (idx < 0) return [...prev, msg];
            const next = [...prev];
            next[idx] = msg;
            return next;
          });
        } catch {
          /* buzilgan xabar — e'tiborsiz */
        }
      };

      socket.onclose = () => {
        if (!active) return;
        if (wsRef.current === socket) wsRef.current = null;
        if (retries < MAX_RETRIES) {
          retries += 1;
          setStatus('reconnecting');
          timer = setTimeout(connect, Math.min(1000 * 2 ** (retries - 1), 15000));
        } else {
          setStatus('closed');
        }
      };
    };

    connect();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      const socket = wsRef.current;
      wsRef.current = null;
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onclose = null;
        socket.close();
      }
    };
  }, [url, attempt]);

  /** Yuboradi; ulanish ochiq bo'lmasa false qaytaradi (xabar yo'qolmasin). */
  const send = useCallback((payload: Record<string, unknown>): boolean => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(payload));
    return true;
  }, []);

  /** "Qayta ulanish" tugmasi uchun. */
  const reconnect = useCallback(() => {
    setStatus('connecting');
    setAttempt((n) => n + 1);
  }, []);

  return { messages, status, historyLoaded, send, reconnect };
}
