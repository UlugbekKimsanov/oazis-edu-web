import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, GraduationCap, Search, Users, Video } from 'lucide-react';
import { Composer, ConnectionBanner, MessageList } from '../../components/chat/ChatParts';
import Button from '../../components/ui/Button';
import Flag from '../../components/ui/Flag';
import PageHeader from '../../components/ui/PageHeader';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States';
import api, { WS_ORIGIN } from '../../lib/api';
import { apiErrorMessage } from '../../lib/errors';
import { useChatSocket } from '../../lib/useChatSocket';
import { useAuthStore } from '../../stores/auth-store';
import { confirmDialog, toast } from '../../stores/ui-store';
import type { ChatMessage, Course } from '../../lib/types';

/** Backend: GroupChatWebSocketHandler izohni 300 belgigacha qisqartiradi (sarlavha matni bilan birga). */
const NOTE_MAX = 200;

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Konferensiya boshlanish vaqti — o'quvchi ilovasi bilan kelishilgan format:
 * zonasiz "devordagi soat" (YYYY-MM-DDTHH:mm), har ikki tomonda MAHALLIY vaqt deb o'qiladi.
 * (Xabar yuborilgan vaqt — createdAt — esa UTC; uni parseServerDate o'qiydi.)
 */
function conferenceStart(m: ChatMessage): Date | null {
  if (!m.conferenceStartAt) return null;
  const d = new Date(m.conferenceStartAt);
  return isNaN(d.getTime()) ? null : d;
}

function startLabel(d: Date): string {
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local uchun joriy mahalliy vaqt: "2026-11-23T14:05" */
function localNowInput(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface RoomProps {
  course: Course;
  token: string;
  myId?: number;
  onBack: () => void;
}

/** Bitta kursning guruh chati. Kurs almashganda `key` orqali qayta yaratiladi. */
function GroupRoom({ course, token, myId, onBack }: RoomProps) {
  const url = `${WS_ORIGIN}/ws/course-chat?token=${encodeURIComponent(token)}&courseId=${course.id}`;
  const { messages, status, historyLoaded, send, reconnect } = useChatSocket(url);
  const [showAnnounce, setShowAnnounce] = useState(false);
  const [note, setNote] = useState('');
  const [mode, setMode] = useState<'now' | 'scheduled'>('now');
  const [when, setWhen] = useState('');
  const [whenError, setWhenError] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  // "Boshlanadi" -> "Qo'shilish" o'tishi uchun soat
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // Faol konferensiya — eng oxirgi konferensiya xabari bo'yicha
  const activeConference = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.messageType === 'conference') return m.conferenceActive ? m : null;
    }
    return null;
  }, [messages]);

  const ready = status === 'open';
  const isStarted = (m: ChatMessage) => {
    const start = conferenceStart(m);
    // `now` 30 soniyada bir yangilanadi va server soati biroz oldinda bo'lishi mumkin —
    // "Hozir" e'lon qilingan konferensiya "boshlanadi" bo'lib ko'rinmasligi uchun 1 daqiqa zaxira
    return !start || start.getTime() <= now + 60000;
  };

  const closeAnnounce = () => {
    setShowAnnounce(false);
    setNote('');
    setMode('now');
    setWhen('');
    setWhenError(null);
  };

  const announce = () => {
    let scheduledAt: string | undefined;
    let base = '📹 Video konferensiya hozir boshlandi';
    if (mode === 'scheduled') {
      const start = when ? new Date(when) : null;
      if (!start || isNaN(start.getTime())) {
        setWhenError('Sana va vaqtni tanlang.');
        return;
      }
      if (start.getTime() <= Date.now()) {
        setWhenError("Vaqt o'tib ketgan. Kelajakdagi vaqtni tanlang yoki «Hozir»ni belgilang.");
        return;
      }
      scheduledAt = when;
      base = `📹 Video konferensiya ${startLabel(start)} da boshlanadi`;
    }
    const topic = note.trim();
    if (!send({ action: 'conference_start', note: topic ? `${base} — ${topic}` : base, scheduledAt })) {
      toast.error("Ulanish yo'q. Konferensiya e'lon qilinmadi — qayta urinib ko'ring.");
      return;
    }
    toast.success(mode === 'now' ? 'Konferensiya boshlandi' : "Konferensiya e'lon qilindi");
    closeAnnounce();
  };

  const endConference = async () => {
    const ok = await confirmDialog({
      title: 'Konferensiya tugatilsinmi?',
      message: "O'quvchilar uchun «Qo'shilish» tugmasi yo'qoladi. Qayta ochish uchun yangi konferensiya e'lon qilinadi.",
      confirmText: 'Tugatish',
      danger: true,
    });
    if (!ok) return;
    if (!send({ action: 'conference_end' })) {
      toast.error("Ulanish yo'q. Konferensiya tugatilmadi — qayta urinib ko'ring.");
    }
  };

  const join = (url?: string) => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const renderConference = (msg: ChatMessage) => {
    if (msg.messageType !== 'conference') return null;
    const start = conferenceStart(msg);
    return (
      <div className="flex justify-center">
        <div className="w-full max-w-[80%] rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-center">
          <div className="flex items-center justify-center gap-2 text-sm font-medium text-green-800">
            <Video size={16} className="shrink-0" />
            <span className="break-words">
              {/* Matn boshidagi emoji o'rniga yonidagi ikonka ko'rsatiladi */}
              {msg.text?.replace(/^\u{1F4F9}\s*/u, '') || (msg.conferenceActive ? 'Video konferensiya boshlandi' : 'Video konferensiya tugadi')}
            </span>
          </div>
          {msg.conferenceActive && (
            isStarted(msg) ? (
              <button
                type="button"
                onClick={() => join(msg.conferenceUrl)}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
              >
                <ExternalLink size={14} /> Qo'shilish
              </button>
            ) : (
              start && <div className="mt-2 text-xs text-green-700">{startLabel(start)} da boshlanadi</div>
            )
          )}
        </div>
      </div>
    );
  };

  const activeStart = activeConference ? conferenceStart(activeConference) : null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-3 sm:p-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Kurslar ro'yxatiga qaytish"
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 md:hidden"
        >
          <ArrowLeft size={18} />
        </button>
        <Flag emoji={course.flagEmoji} height={22} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900">{course.name}</p>
          <p className="text-xs text-gray-500">{course.studentCount ?? 0} o'quvchi</p>
        </div>
        {!activeConference && !showAnnounce && (
          <Button size="sm" onClick={() => setShowAnnounce(true)} disabled={!ready}>
            <Video size={14} /> Konferensiya e'lon qilish
          </Button>
        )}
      </div>

      <ConnectionBanner status={status} onRetry={reconnect} />

      {/* E'lon qilish formasi */}
      {!activeConference && showAnnounce && (
        <div className="shrink-0 space-y-3 border-b border-gray-100 bg-gray-50 px-4 py-4">
          <div>
            <label htmlFor="conf-note" className="mb-1 block text-xs font-medium text-gray-600">
              Mavzu yoki izoh (ixtiyoriy)
            </label>
            <input
              id="conf-note"
              type="text"
              value={note}
              maxLength={NOTE_MAX}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Masalan: Grammatika bo'yicha jonli dars"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
            />
          </div>
          <fieldset>
            <legend className="mb-1 block text-xs font-medium text-gray-600">Boshlanish vaqti</legend>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex cursor-pointer items-center gap-1.5 text-sm text-gray-700">
                <input type="radio" name="conf-mode" checked={mode === 'now'} onChange={() => { setMode('now'); setWhenError(null); }} />
                Hozir
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-sm text-gray-700">
                <input type="radio" name="conf-mode" checked={mode === 'scheduled'} onChange={() => setMode('scheduled')} />
                Vaqtni belgilash
              </label>
              {mode === 'scheduled' && (
                <input
                  type="datetime-local"
                  value={when}
                  min={localNowInput()}
                  onChange={(e) => { setWhen(e.target.value); setWhenError(null); }}
                  aria-label="Boshlanish sanasi va vaqti"
                  aria-invalid={!!whenError}
                  className={`rounded-lg border px-3 py-1.5 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 ${
                    whenError ? 'border-red-300' : 'border-gray-200'
                  }`}
                />
              )}
            </div>
            {whenError && <p role="alert" className="mt-1 text-xs text-red-600">{whenError}</p>}
          </fieldset>
          <p className="text-xs text-gray-500">
            Havola (Jitsi Meet) avtomatik yaratiladi va guruhdagi barcha o'quvchilarga ko'rinadi.
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={announce} disabled={!ready}>
              <Video size={14} /> E'lon qilish
            </Button>
            <Button size="sm" variant="secondary" onClick={closeAnnounce}>Bekor qilish</Button>
          </div>
        </div>
      )}

      {/* Faol konferensiya */}
      {activeConference && (
        <div className="flex flex-wrap items-center gap-3 border-b border-green-100 bg-green-50 px-4 py-3">
          <p className="min-w-0 flex-1 break-words text-sm font-medium text-green-800">
            {activeConference.text || '📹 Video konferensiya davom etmoqda'}
          </p>
          {isStarted(activeConference) ? (
            <button
              type="button"
              onClick={() => join(activeConference.conferenceUrl)}
              className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
            >
              <ExternalLink size={14} /> Qo'shilish
            </button>
          ) : (
            activeStart && (
              <span className="rounded-lg bg-green-100 px-3 py-1.5 text-sm font-medium text-green-700">
                {startLabel(activeStart)} da boshlanadi
              </span>
            )
          )}
          <button
            type="button"
            onClick={() => void endConference()}
            disabled={!ready}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isStarted(activeConference) ? 'Tugatish' : 'Bekor qilish'}
          </button>
        </div>
      )}

      <MessageList
        messages={messages}
        myId={myId}
        status={status}
        historyLoaded={historyLoaded}
        showSenderName
        emptyTitle="Guruhda hali xabar yo'q"
        emptyDescription="Birinchi xabarni yozing yoki konferensiya e'lon qiling."
        renderSpecial={renderConference}
      />

      <Composer status={status} onSend={(text) => send({ text })} />
    </>
  );
}

export default function GroupChatPage() {
  const { user, token } = useAuthStore();
  const [params, setParams] = useSearchParams();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const r = await api.get('/teacher/courses');
      if (id !== requestId.current) return;
      const data = r.data?.data ?? r.data;
      if (!Array.isArray(data)) throw new Error('unexpected payload');
      setCourses(data as Course[]);
      setLoadError(null);
    } catch (err) {
      if (id !== requestId.current) return;
      setLoadError(apiErrorMessage(err, "Kurslar ro'yxatini yuklab bo'lmadi."));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- birinchi yuklash; setState faqat javob kelgach chaqiriladi
    void load();
  }, [load]);

  const courseParam = Number(params.get('courseId')) || null;
  const selected = useMemo(
    () => (courses && courseParam ? courses.find((c) => c.id === courseParam) ?? null : null),
    [courses, courseParam],
  );
  const select = (course: Course | null) => {
    setParams(course ? { courseId: String(course.id) } : {}, { replace: true });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('uz');
    if (!q) return courses ?? [];
    return (courses ?? []).filter((c) => c.name.toLocaleLowerCase('uz').includes(q));
  }, [courses, search]);

  return (
    <div>
      <PageHeader title="Guruh chat" description="Kurs guruhi bilan yozishma va video konferensiya" />

      <div className="flex h-[calc(100dvh-190px)] min-h-[420px] overflow-hidden rounded-xl border border-gray-200 bg-white">
        {/* Kurslar ro'yxati — tor ekranda chat ochilganda yashiriladi */}
        <div className={`${selected ? 'hidden md:flex' : 'flex'} w-full flex-col border-r border-gray-200 md:w-80`}>
          <div className="border-b border-gray-100 p-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Kurs qidirish..."
                aria-label="Kurslarni qidirish"
                className="w-full rounded-lg border-0 bg-gray-50 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {courses === null && !loadError ? (
              <div className="space-y-3 p-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-6 w-9" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-36" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : courses === null ? (
              <ErrorState message={loadError ?? undefined} onRetry={() => void load()} />
            ) : courses.length === 0 ? (
              <EmptyState
                icon={GraduationCap}
                title="Kurslar yo'q"
                description="Sizga hali kurs biriktirilmagan. Administratorga murojaat qiling."
              />
            ) : filtered.length === 0 ? (
              <EmptyState icon={Search} title="Hech narsa topilmadi" description={`"${search}" bo'yicha kurs yo'q.`} />
            ) : (
              filtered.map((course) => {
                const active = selected?.id === course.id;
                return (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => select(course)}
                    aria-current={active || undefined}
                    className={`w-full border-b border-gray-50 p-3 text-left transition-colors hover:bg-gray-50 ${
                      active ? 'bg-[var(--primary-light)] hover:bg-[var(--primary-light)]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Flag emoji={course.flagEmoji} height={22} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">{course.name}</p>
                        <p className="flex items-center gap-1 truncate text-xs text-gray-500">
                          <Users size={12} /> {course.studentCount ?? 0} o'quvchi
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Guruh yozishmasi */}
        <div className={`${selected ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col`}>
          {selected && token ? (
            <GroupRoom key={selected.id} course={selected} token={token} myId={user?.id} onBack={() => select(null)} />
          ) : (
            <EmptyState
              className="flex-1"
              icon={Users}
              title="Kursni tanlang"
              description="Chapdagi ro'yxatdan kurs guruhini tanlang."
            />
          )}
        </div>
      </div>
    </div>
  );
}
