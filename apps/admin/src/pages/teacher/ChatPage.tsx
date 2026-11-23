import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Search } from 'lucide-react';
import { Composer, ConnectionBanner, MessageList } from '../../components/chat/ChatParts';
import PageHeader from '../../components/ui/PageHeader';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States';
import api, { WS_ORIGIN } from '../../lib/api';
import { apiErrorMessage } from '../../lib/errors';
import { relativeTime } from '../../lib/format';
import { useChatSocket } from '../../lib/useChatSocket';
import { useAuthStore } from '../../stores/auth-store';
import type { ChatMessage, ChatRoom } from '../../lib/types';

/** Ro'yxat shuncha vaqtda bir yangilanadi — boshqa o'quvchilardan kelgan xabarlar ko'rinsin. */
const ROOMS_REFRESH_MS = 30000;

const roomKey = (r: { courseId: number; studentId: number }) => `${r.courseId}-${r.studentId}`;

function previewOf(msg: ChatMessage): string {
  if (msg.text?.trim()) return msg.text.trim();
  if (msg.mediaUrl) return msg.mediaType === 'image' ? '📷 Rasm' : '📎 Fayl';
  return '';
}

/** Avval javob kutayotganlar, so'ng eng yangi yozishmalar, oxirida hali yozishmaganlar (backend bilan bir xil). */
function sortRooms(rooms: ChatRoom[]): ChatRoom[] {
  return [...rooms].sort((a, b) => {
    if (!!a.awaitingReply !== !!b.awaitingReply) return a.awaitingReply ? -1 : 1;
    const ta = a.lastTime ?? '';
    const tb = b.lastTime ?? '';
    if (ta !== tb) return ta > tb ? -1 : 1;
    return a.studentName.localeCompare(b.studentName, 'uz');
  });
}

interface ConversationProps {
  room: ChatRoom;
  token: string;
  myId?: number;
  onBack: () => void;
  onActivity: (room: ChatRoom, last: ChatMessage) => void;
}

/** Bitta o'quvchi bilan yozishma. Xona almashganda `key` orqali qayta yaratiladi. */
function Conversation({ room, token, myId, onBack, onActivity }: ConversationProps) {
  const url = `${WS_ORIGIN}/ws/chat?token=${encodeURIComponent(token)}&courseId=${room.courseId}&studentId=${room.studentId}`;
  const { messages, status, historyLoaded, send, reconnect } = useChatSocket(url);

  // Ro'yxatdagi "oxirgi xabar" va "javob kutilmoqda" belgisi jonli yangilanib tursin
  const last = messages.length > 0 ? messages[messages.length - 1] : null;
  useEffect(() => {
    if (last) onActivity(room, last);
  }, [last, room, onActivity]);

  return (
    <>
      <div className="flex items-center gap-3 border-b border-gray-100 p-3 sm:p-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Chatlar ro'yxatiga qaytish"
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 md:hidden"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100">
          <span className="text-xs font-bold text-blue-600">{room.studentName?.[0]?.toUpperCase() || '?'}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900">{room.studentName}</p>
          <p className="truncate text-xs text-gray-500">
            {room.courseName}
            {room.enrolled === false && ' · kursga yozilmagan'}
          </p>
        </div>
      </div>

      <ConnectionBanner status={status} onRetry={reconnect} />

      <MessageList
        messages={messages}
        myId={myId}
        status={status}
        historyLoaded={historyLoaded}
        emptyTitle="Hali xabar yo'q"
        emptyDescription="O'quvchiga birinchi bo'lib yozishingiz mumkin."
      />

      <Composer status={status} onSend={(text) => send({ text })} />
    </>
  );
}

export default function ChatPage() {
  const { user, token } = useAuthStore();
  const [params, setParams] = useSearchParams();
  const [rooms, setRooms] = useState<ChatRoom[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const r = await api.get('/teacher/chat/rooms');
      if (id !== requestId.current) return; // eskirgan javob
      const data = r.data?.data ?? r.data;
      if (!Array.isArray(data)) throw new Error('unexpected payload');
      setRooms(sortRooms(data as ChatRoom[]));
      setLoadError(null);
    } catch (err) {
      if (id !== requestId.current) return;
      setLoadError(apiErrorMessage(err, "Chatlar ro'yxatini yuklab bo'lmadi."));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- birinchi yuklash; setState faqat javob kelgach chaqiriladi
    void load();
    const timer = setInterval(() => void load(), ROOMS_REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  // Tanlangan xona URL'da saqlanadi: sahifa yangilansa ham, bildirishnomadan kirilsa ham ochiladi
  const courseParam = Number(params.get('courseId')) || null;
  const studentParam = Number(params.get('studentId')) || null;
  const selected = useMemo(() => {
    if (!rooms || !courseParam) return null;
    if (studentParam) {
      return rooms.find((r) => r.courseId === courseParam && r.studentId === studentParam) ?? null;
    }
    // Faqat kurs berilgan (bildirishnomadan) — shu kursdagi javob kutayotgan birinchi chat
    return rooms.find((r) => r.courseId === courseParam && r.awaitingReply) ?? null;
  }, [rooms, courseParam, studentParam]);

  // Faqat kurs bilan kirilgan bo'lsa, topilgan xonani URL'ga yozib qo'yamiz — aks holda javob
  // yozilgach ("javob kutilmoqda" o'chgach) tanlov o'zidan-o'zi boshqa o'quvchiga sakrab ketardi.
  const pinCourse = selected && !studentParam ? selected.courseId : null;
  const pinStudent = selected && !studentParam ? selected.studentId : null;
  useEffect(() => {
    if (pinCourse && pinStudent) {
      setParams({ courseId: String(pinCourse), studentId: String(pinStudent) }, { replace: true });
    }
  }, [pinCourse, pinStudent, setParams]);

  const select = (room: ChatRoom | null) => {
    setParams(room ? { courseId: String(room.courseId), studentId: String(room.studentId) } : {}, { replace: true });
  };

  const onActivity = useCallback((room: ChatRoom, last: ChatMessage) => {
    setRooms((current) => {
      if (!current) return current;
      const key = roomKey(room);
      const target = current.find((r) => roomKey(r) === key);
      const awaiting = last.senderRole !== 'teacher';
      if (!target || (target.lastTime === last.createdAt && target.awaitingReply === awaiting)) return current;
      return sortRooms(current.map((r) => (r === target
        ? { ...r, lastMessage: previewOf(last), lastTime: last.createdAt, lastSenderRole: last.senderRole, awaitingReply: awaiting }
        : r)));
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('uz');
    if (!q) return rooms ?? [];
    return (rooms ?? []).filter((r) => `${r.studentName} ${r.courseName}`.toLocaleLowerCase('uz').includes(q));
  }, [rooms, search]);

  const awaitingCount = (rooms ?? []).filter((r) => r.awaitingReply).length;

  return (
    <div>
      <PageHeader
        title="Chat"
        description={
          awaitingCount > 0
            ? `${awaitingCount} ta o'quvchi javobingizni kutmoqda`
            : "O'quvchilar bilan shaxsiy yozishma"
        }
      />

      <div className="flex h-[calc(100dvh-190px)] min-h-[420px] overflow-hidden rounded-xl border border-gray-200 bg-white">
        {/* Xonalar ro'yxati — tor ekranda chat ochilganda yashiriladi */}
        <div className={`${selected ? 'hidden md:flex' : 'flex'} w-full flex-col border-r border-gray-200 md:w-80`}>
          <div className="border-b border-gray-100 p-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="O'quvchi yoki kurs..."
                aria-label="Chatlarni qidirish"
                className="w-full rounded-lg border-0 bg-gray-50 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {rooms === null && !loadError ? (
              <div className="space-y-3 p-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-3 w-44" />
                    </div>
                  </div>
                ))}
              </div>
            ) : rooms === null ? (
              <ErrorState message={loadError ?? undefined} onRetry={() => void load()} />
            ) : rooms.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title="Chatlar yo'q"
                description="Kurslaringizga o'quvchi yozilganda yoki savol yuborganda shu yerda ko'rinadi."
              />
            ) : filtered.length === 0 ? (
              <EmptyState icon={Search} title="Hech narsa topilmadi" description={`"${search}" bo'yicha chat yo'q.`} />
            ) : (
              filtered.map((room) => {
                const active = !!selected && roomKey(selected) === roomKey(room);
                return (
                  <button
                    key={roomKey(room)}
                    type="button"
                    onClick={() => select(room)}
                    aria-current={active || undefined}
                    className={`w-full border-b border-gray-50 p-3 text-left transition-colors hover:bg-gray-50 ${
                      active ? 'bg-[var(--primary-light)] hover:bg-[var(--primary-light)]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100">
                        <span className="text-xs font-bold text-blue-600">{room.studentName?.[0]?.toUpperCase() || '?'}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <p className={`flex-1 truncate text-sm text-gray-900 ${room.awaitingReply ? 'font-semibold' : 'font-medium'}`}>
                            {room.studentName}
                          </p>
                          {room.lastTime && (
                            <span className="shrink-0 text-[11px] text-gray-400">{relativeTime(room.lastTime)}</span>
                          )}
                        </div>
                        <p className="truncate text-xs text-gray-500">{room.courseName}</p>
                        {room.lastMessage && (
                          <p className={`mt-0.5 truncate text-xs ${room.awaitingReply ? 'text-gray-800' : 'text-gray-400'}`}>
                            {room.lastSenderRole === 'teacher' && 'Siz: '}
                            {room.lastMessage}
                          </p>
                        )}
                      </div>
                      {room.awaitingReply && (
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--primary)]" title="Javob kutilmoqda" aria-label="Javob kutilmoqda" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
          {rooms !== null && loadError && (
            <p role="alert" className="border-t border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Ro'yxat yangilanmadi: {loadError}
            </p>
          )}
        </div>

        {/* Yozishma */}
        <div className={`${selected ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col`}>
          {selected && token ? (
            <Conversation
              key={roomKey(selected)}
              room={selected}
              token={token}
              myId={user?.id}
              onBack={() => select(null)}
              onActivity={onActivity}
            />
          ) : (
            <EmptyState
              className="flex-1"
              icon={MessageSquare}
              title="Chatni tanlang"
              description="Chapdagi ro'yxatdan o'quvchini tanlang."
            />
          )}
        </div>
      </div>
    </div>
  );
}
