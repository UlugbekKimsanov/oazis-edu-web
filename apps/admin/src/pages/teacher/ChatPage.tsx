import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import api, { WS_ORIGIN } from '../../lib/api';
import { useAuthStore } from '../../stores/auth-store';
import type { ChatMessage } from '../../lib/types';

interface ChatRoom {
  courseId: number;
  studentId: number;
  studentName: string;
  courseName: string;
  lastMessage?: string;
  lastTime?: string;
}

export default function ChatPage() {
  const { user, token } = useAuthStore();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [search, setSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/teacher/chat/rooms').then((r) => setRooms(r.data.data ?? r.data ?? [])).catch(() => setRooms([]));
  }, []);

  useEffect(() => {
    if (!selectedRoom || !token) return;

    setMessages([]);

    const wsUrl = `${WS_ORIGIN}/ws/chat?token=${token}&courseId=${selectedRoom.courseId}&studentId=${selectedRoom.studentId}`;
    const socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === 'history') {
          const history: ChatMessage[] = typeof parsed.text === 'string' ? JSON.parse(parsed.text) : parsed.text;
          setMessages(history);
        } else {
          setMessages((prev) => [...prev, parsed as ChatMessage]);
        }
      } catch { /* malformed message */ }
    };

    socket.onerror = () => {
      // Fallback: load history via REST if WebSocket fails
      api.get(`/teacher/chat/history?courseId=${selectedRoom.courseId}&studentId=${selectedRoom.studentId}`)
        .then((r) => setMessages(r.data.data ?? r.data ?? []))
        .catch(() => {});
    };

    setWs(socket);
    return () => { socket.close(); setWs(null); };
  }, [selectedRoom, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ text: input.trim() }));
    setInput('');
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Chat</h1>
        <p className="text-sm text-gray-500 mt-1">O'quvchilar bilan muloqot</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex h-[calc(100vh-200px)]">
        {/* Sidebar - rooms */}
        <div className="w-72 border-r border-gray-200 flex flex-col">
          <div className="p-3 border-b border-gray-100">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Qidirish..."
              className="w-full px-3 py-2 text-sm bg-gray-50 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {rooms.length === 0 ? (
              <p className="text-sm text-gray-400 text-center mt-8">Chatlar yo'q</p>
            ) : (
              rooms.filter((r) => !search || r.studentName.toLowerCase().includes(search.toLowerCase()) || r.courseName.toLowerCase().includes(search.toLowerCase())).map((room) => (
                <button
                  key={`${room.courseId}-${room.studentId}`}
                  onClick={() => setSelectedRoom(room)}
                  className={`w-full text-left p-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                    selectedRoom?.studentId === room.studentId && selectedRoom?.courseId === room.courseId
                      ? 'bg-[var(--primary-light)]'
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-blue-600">{room.studentName?.[0] || '?'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{room.studentName}</p>
                      <p className="text-xs text-gray-500 truncate">{room.courseName}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          {!selectedRoom ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Chatni tanlang
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-xs font-bold text-blue-600">{selectedRoom.studentName?.[0]}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{selectedRoom.studentName}</p>
                  <p className="text-xs text-gray-500">{selectedRoom.courseName}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg, idx) => {
                  const isMe = msg.senderId === user?.id;
                  return (
                    <div key={msg.id ?? idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm ${
                        isMe
                          ? 'bg-[var(--primary)] text-white rounded-br-md'
                          : 'bg-gray-100 text-gray-900 rounded-bl-md'
                      }`}>
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
