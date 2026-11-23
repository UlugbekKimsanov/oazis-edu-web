import { useEffect, useRef, useState } from 'react';
import { Loader2, MessageSquare, Paperclip, RefreshCw, Send, WifiOff } from 'lucide-react';
import { fileUrl } from '../../lib/api';
import { formatDate, parseServerDate } from '../../lib/format';
import type { ChatMessage } from '../../lib/types';
import type { SocketStatus } from '../../lib/useChatSocket';
import { EmptyState, LoadingState } from '../ui/States';

// Shaxsiy va guruh chat sahifalari uchun umumiy qismlar.

/** Backend: ChatWebSocketHandler.MAX_TEXT_LENGTH */
const MAX_TEXT_LENGTH = 4000;

const pad = (n: number) => String(n).padStart(2, '0');

function timeOf(iso?: string): string {
  const d = parseServerDate(iso);
  return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '';
}

/** Kun ajratgichi kaliti va matni: "Bugun", "Kecha" yoki sana. */
function dayOf(iso?: string): { key: string; label: string } | null {
  const d = parseServerDate(iso);
  if (!d) return null;
  const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const today = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((start(today) - start(d)) / 86400000);
  const label = diffDays === 0 ? 'Bugun' : diffDays === 1 ? 'Kecha' : formatDate(iso);
  return { key, label };
}

/** Ulanish uzilganda chat ustida ko'rinadigan ogohlantirish. */
export function ConnectionBanner({ status, onRetry }: { status: SocketStatus; onRetry: () => void }) {
  if (status === 'open' || status === 'connecting') return null;
  if (status === 'reconnecting') {
    return (
      <div role="status" className="flex items-center gap-2 border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-800">
        <Loader2 size={14} className="animate-spin" />
        Aloqa uzildi. Qayta ulanilmoqda...
      </div>
    );
  }
  return (
    <div role="alert" className="flex flex-wrap items-center gap-2 border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
      <WifiOff size={14} />
      <span className="flex-1">Chatga ulanib bo'lmadi. Internetni tekshiring.</span>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-1 font-medium hover:bg-red-50"
      >
        <RefreshCw size={12} /> Qayta ulanish
      </button>
    </div>
  );
}

interface MessageListProps {
  messages: ChatMessage[];
  myId?: number;
  status: SocketStatus;
  historyLoaded: boolean;
  /** Guruh chatida xabar ustida yozuvchining ismi ko'rsatiladi */
  showSenderName?: boolean;
  emptyTitle: string;
  emptyDescription?: string;
  /** Maxsus xabarlar (masalan, konferensiya kartasi). null qaytsa — oddiy pufak. */
  renderSpecial?: (msg: ChatMessage) => React.ReactNode | null;
}

export function MessageList({
  messages, myId, status, historyLoaded, showSenderName, emptyTitle, emptyDescription, renderSpecial,
}: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const count = messages.length;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [count]);

  if (!historyLoaded) {
    if (status === 'closed') return <div className="min-h-0 flex-1" />;
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <LoadingState label="Xabarlar yuklanmoqda..." />
      </div>
    );
  }
  if (count === 0) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <EmptyState icon={MessageSquare} title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
      {messages.map((msg, idx) => {
        const day = dayOf(msg.createdAt);
        const prevDay = idx > 0 ? dayOf(messages[idx - 1].createdAt) : null;
        const showDay = !!day && day.key !== prevDay?.key;
        const key = msg.id ?? `i${idx}`;
        const special = renderSpecial?.(msg);
        const isMe = msg.senderId === myId;
        const otherTeacher = !isMe && msg.senderRole === 'teacher';
        // Guruhda — yozuvchining ismi; shaxsiy chatda — faqat boshqa ustoz yozgan bo'lsa belgi
        const senderLabel = isMe
          ? ''
          : showSenderName
            ? msg.senderName || (otherTeacher ? 'Ustoz' : '')
            : otherTeacher ? 'Boshqa ustoz' : '';
        const media = msg.mediaUrl ? fileUrl(msg.mediaUrl) : '';

        return (
          <div key={key} className="space-y-3">
            {showDay && (
              <div className="flex justify-center">
                <span className="rounded-full bg-gray-100 px-3 py-0.5 text-[11px] font-medium text-gray-500">{day?.label}</span>
              </div>
            )}
            {special ?? (
              <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm sm:max-w-[70%] ${
                    isMe ? 'rounded-br-md bg-[var(--primary)] text-white' : 'rounded-bl-md bg-gray-100 text-gray-900'
                  }`}
                >
                  {senderLabel && (
                    <div className="mb-0.5 text-[11px] font-semibold text-[var(--primary)]">
                      {senderLabel}
                      {showSenderName && otherTeacher && <span className="ml-1 font-normal text-gray-500">· ustoz</span>}
                    </div>
                  )}
                  {media && msg.mediaType === 'image' && (
                    <a href={media} target="_blank" rel="noopener noreferrer" className="mb-1 block">
                      <img src={media} alt="Yuborilgan rasm" loading="lazy" className="max-h-64 rounded-lg" />
                    </a>
                  )}
                  {media && msg.mediaType !== 'image' && (
                    <a
                      href={media}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`mb-1 inline-flex items-center gap-1.5 underline ${isMe ? 'text-white' : 'text-[var(--primary)]'}`}
                    >
                      <Paperclip size={14} /> Faylni ochish
                    </a>
                  )}
                  {msg.text && <div className="whitespace-pre-wrap break-words">{msg.text}</div>}
                  <div className={`mt-1 text-right text-[10px] ${isMe ? 'text-white/70' : 'text-gray-400'}`}>{timeOf(msg.createdAt)}</div>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}

interface ComposerProps {
  /** Yuborildi — true; ulanish yo'q — false (matn saqlanib qoladi) */
  onSend: (text: string) => boolean;
  status: SocketStatus;
}

export function Composer({ onSend, status }: ComposerProps) {
  const [text, setText] = useState('');
  const ready = status === 'open';
  const trimmed = text.trim();

  const submit = () => {
    if (!trimmed || !ready) return;
    if (onSend(trimmed)) setText('');
  };

  return (
    <div className="shrink-0 border-t border-gray-100 p-3 sm:p-4">
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter — yuborish, Shift+Enter — yangi qator. IME kiritishida yubormaymiz.
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          maxLength={MAX_TEXT_LENGTH}
          placeholder={ready ? 'Xabar yozing...' : 'Ulanish kutilmoqda...'}
          aria-label="Xabar matni"
          className="max-h-32 min-h-[42px] flex-1 resize-y rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!trimmed || !ready}
          aria-label="Yuborish"
          title={ready ? 'Yuborish (Enter)' : "Ulanish yo'q"}
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-white transition-colors hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
