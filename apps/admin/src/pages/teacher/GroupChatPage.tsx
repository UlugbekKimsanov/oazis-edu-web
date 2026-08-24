import { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Video, Users, ExternalLink } from 'lucide-react';
import api, { WS_ORIGIN } from '../../lib/api';
import { useAuthStore } from '../../stores/auth-store';
import type { ChatMessage, Course } from '../../lib/types';

export default function GroupChatPage() {
  const { user, token } = useAuthStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [search, setSearch] = useState('');
  const [showAnnounce, setShowAnnounce] = useState(false);
  const [note0, setNote0] = useState('');
  const [mode, setMode] = useState<'now' | 'scheduled'>('now');
  const [dateStr, setDateStr] = useState('');
  const [hour, setHour] = useState('09');
  const [minute, setMinute] = useState('00');
  const [now, setNow] = useState<number>(() => Date.now());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    api.get('/teacher/courses').then((r) => setCourses(r.data.data ?? r.data ?? [])).catch(() => setCourses([]));
  }, []);

  useEffect(() => {
    if (!selectedCourse || !token) return;

    setMessages([]);

    const wsUrl = `${WS_ORIGIN}/ws/course-chat?token=${token}&courseId=${selectedCourse.id}`;
    const socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === 'history') {
          const history: ChatMessage[] = typeof parsed.text === 'string' ? JSON.parse(parsed.text) : parsed.text;
          setMessages(history);
        } else {
          const msg = parsed as ChatMessage;
          setMessages((prev) => {
            // Bir xil id kelsa (masalan konferensiya tugatilganda) — qo'shmasdan yangilaymiz
            const idx = msg.id != null ? prev.findIndex((m) => m.id === msg.id) : -1;
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = msg;
              return next;
            }
            return [...prev, msg];
          });
        }
      } catch { /* malformed message */ }
    };

    setWs(socket);
    return () => { socket.close(); setWs(null); };
  }, [selectedCourse, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Aktiv konferensiyani aniqlash (eng oxirgi conference xabari bo'yicha)
  const activeConference = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.messageType === 'conference') {
        return m.conferenceActive ? m : null;
      }
    }
    return null;
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ text: input.trim() }));
    setInput('');
  };

  const announceConference = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    let scheduledAt: string | undefined;
    let whenLabel: string;
    if (mode === 'now') {
      whenLabel = 'hozir';
    } else {
      if (!dateStr) return;
      // Backend LocalDateTime formati: YYYY-MM-DDTHH:mm
      scheduledAt = `${dateStr}T${hour}:${minute}`;
      whenLabel = new Date(scheduledAt).toLocaleString('uz', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      });
    }

    const base = mode === 'now'
      ? '📹 Video konferensiya hozir boshlandi'
      : `📹 Video konferensiya ${whenLabel} da boshlanadi`;
    const note = note0.trim() ? `${base} — ${note0.trim()}` : base;

    ws.send(JSON.stringify({ action: 'conference_start', note, scheduledAt }));
    setShowAnnounce(false);
    setNote0('');
    setMode('now');
    setDateStr('');
    setHour('09');
    setMinute('00');
  };

  const endConference = () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ action: 'conference_end' }));
  };

  const joinConference = (url?: string) => {
    if (url) window.open(url, '_blank');
  };

  const isStarted = (m: ChatMessage) =>
    !m.conferenceStartAt || new Date(m.conferenceStartAt).getTime() <= now;
  const startLabel = (m: ChatMessage) =>
    m.conferenceStartAt
      ? new Date(m.conferenceStartAt).toLocaleString('uz', {
          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
        })
      : '';

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Guruh chat</h1>
        <p className="text-sm text-gray-500 mt-1">Kurs guruhi bilan muloqot va video konferensiya</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex h-[calc(100vh-200px)]">
        {/* Sidebar - courses */}
        <div className="w-72 border-r border-gray-200 flex flex-col">
          <div className="p-3 border-b border-gray-100">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Kurs qidirish..."
              className="w-full px-3 py-2 text-sm bg-gray-50 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {courses.length === 0 ? (
              <p className="text-sm text-gray-400 text-center mt-8">Kurslar yo'q</p>
            ) : (
              courses.filter((c) => !search || c.name.toLowerCase().includes(search.toLowerCase())).map((course) => (
                <button
                  key={course.id}
                  onClick={() => setSelectedCourse(course)}
                  className={`w-full text-left p-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                    selectedCourse?.id === course.id ? 'bg-[var(--primary-light)]' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl flex-shrink-0">{course.flagEmoji || '📚'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{course.name}</p>
                      <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                        <Users size={12} /> {course.studentCount ?? 0} o'quvchi
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          {!selectedCourse ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Kursni tanlang
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                <span className="text-2xl">{selectedCourse.flagEmoji || '📚'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{selectedCourse.name}</p>
                  <p className="text-xs text-gray-500">{selectedCourse.studentCount ?? 0} o'quvchi</p>
                </div>
                {!activeConference && (
                  <button
                    onClick={() => setShowAnnounce((v) => !v)}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-dark)] transition-colors"
                  >
                    <Video size={16} />
                    Konferensiya e'lon qilish
                  </button>
                )}
              </div>

              {/* E'lon qilish formasi */}
              {!activeConference && showAnnounce && (
                <div className="px-4 py-4 bg-gray-50 border-b border-gray-100 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Konferensiya haqida (mavzu / izoh)</label>
                    <input
                      type="text"
                      value={note0}
                      onChange={(e) => setNote0(e.target.value)}
                      placeholder="Masalan: Grammatika bo'yicha jonli dars"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Boshlanish vaqti</label>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                        <input type="radio" checked={mode === 'now'} onChange={() => setMode('now')} />
                        Hozir
                      </label>
                      <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                        <input type="radio" checked={mode === 'scheduled'} onChange={() => setMode('scheduled')} />
                        Soat tanlash
                      </label>
                      {mode === 'scheduled' && (
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={dateStr}
                            onChange={(e) => setDateStr(e.target.value)}
                            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
                          />
                          <select
                            value={hour}
                            onChange={(e) => setHour(e.target.value)}
                            className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                          >
                            {Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0')).map((h) => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                          <span className="text-gray-500">:</span>
                          <select
                            value={minute}
                            onChange={(e) => setMinute(e.target.value)}
                            className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                          >
                            {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={announceConference}
                      disabled={mode === 'scheduled' && !dateStr}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[var(--primary)] text-white rounded-lg hover:bg-[var(--primary-dark)] disabled:opacity-50 transition-colors"
                    >
                      <Video size={16} />
                      E'lon qilish
                    </button>
                    <button
                      onClick={() => setShowAnnounce(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      Bekor qilish
                    </button>
                  </div>
                </div>
              )}

              {/* Pin banner */}
              {activeConference && (
                <div className="px-4 py-3 bg-green-50 border-b border-green-100 flex items-center gap-3">
                  <p className="flex-1 text-sm font-medium text-green-800">
                    {activeConference.text || '📹 Video konferensiya davom etmoqda'}
                  </p>
                  {isStarted(activeConference) ? (
                    <button
                      onClick={() => joinConference(activeConference.conferenceUrl)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <ExternalLink size={14} />
                      Qo'shilish
                    </button>
                  ) : (
                    <span className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-100 rounded-lg">
                      {startLabel(activeConference)} da boshlanadi
                    </span>
                  )}
                  <button
                    onClick={endConference}
                    className="px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Tugatish
                  </button>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg, idx) => {
                  const isMe = msg.senderId === user?.id;

                  // Konferensiya xabari - alohida karta
                  if (msg.messageType === 'conference') {
                    return (
                      <div key={msg.id ?? idx} className="flex justify-center">
                        <div className="max-w-[80%] w-full px-4 py-3 rounded-xl bg-green-50 border border-green-100 text-center">
                          <div className="flex items-center justify-center gap-2 text-sm font-medium text-green-800">
                            <Video size={16} />
                            {msg.text || (msg.conferenceActive
                              ? 'Video konferensiya boshlandi'
                              : 'Video konferensiya tugadi')}
                          </div>
                          {msg.conferenceActive && (
                            isStarted(msg) ? (
                              <button
                                onClick={() => joinConference(msg.conferenceUrl)}
                                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                              >
                                <ExternalLink size={14} />
                                Qo'shilish
                              </button>
                            ) : (
                              <div className="mt-2 text-xs text-green-700">
                                {startLabel(msg)} da boshlanadi
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id ?? idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm ${
                        isMe
                          ? 'bg-[var(--primary)] text-white rounded-br-md'
                          : 'bg-gray-100 text-gray-900 rounded-bl-md'
                      }`}>
                        {!isMe && msg.senderName && (
                          <div className="text-[11px] font-semibold text-[var(--primary)] mb-0.5">{msg.senderName}</div>
                        )}
                        {msg.text}
                        <div className={`text-[10px] mt-1 ${isMe ? 'text-white/70' : 'text-gray-400'}`}>
                          {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('uz', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Xabar yozing..."
                    className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim()}
                    className="w-10 h-10 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center hover:bg-[var(--primary-dark)] disabled:opacity-50 transition-colors"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
