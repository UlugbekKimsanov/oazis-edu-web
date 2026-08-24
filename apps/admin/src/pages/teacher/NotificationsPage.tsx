import { useEffect, useState } from 'react';
import { Bell, BellOff, CheckCheck } from 'lucide-react';
import api from '../../lib/api';

interface Notification {
  id: number;
  userId: number;
  title: string;
  body: string;
  type: string;
  refId?: number;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    api.get('/notifications')
      .then((r) => setItems(r.data.data ?? r.data ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const markAsRead = async (id: number) => {
    await api.patch(`/notifications/${id}/read`);
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
  };

  const markAllAsRead = async () => {
    await api.patch('/notifications/read-all');
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const filtered = filter === 'unread' ? items.filter((n) => !n.isRead) : items;
  const unreadCount = items.filter((n) => !n.isRead).length;

  const typeStyles: Record<string, { bg: string; text: string }> = {
    NEW_STUDENT: { bg: 'bg-blue-50', text: 'text-blue-600' },
    COURSE_UPDATE: { bg: 'bg-purple-50', text: 'text-purple-600' },
    NEW_TEACHER: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
    REPORT: { bg: 'bg-amber-50', text: 'text-amber-600' },
    CHAT: { bg: 'bg-cyan-50', text: 'text-cyan-600' },
    GENERAL: { bg: 'bg-gray-50', text: 'text-gray-600' },
  };

  const typeLabels: Record<string, string> = {
    NEW_STUDENT: "Yangi o'quvchi",
    COURSE_UPDATE: 'Kurs yangilandi',
    NEW_TEACHER: "Yangi o'qituvchi",
    REPORT: 'Hisobot',
    CHAT: 'Xabar',
    GENERAL: 'Umumiy',
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Hozir';
    if (mins < 60) return `${mins} daqiqa oldin`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} soat oldin`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} kun oldin`;
    return d.toLocaleDateString('uz');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bildirishnomalar</h1>
          <p className="text-sm text-gray-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} ta o'qilmagan xabar` : "Barcha xabarlar o'qilgan"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${filter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              Barchasi
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${filter === 'unread' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              O'qilmagan {unreadCount > 0 && `(${unreadCount})`}
            </button>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary-light)] rounded-lg transition-colors"
            >
              <CheckCheck size={14} />
              Barchasini o'qish
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm text-gray-400">Yuklanmoqda...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <BellOff size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-400">
            {filter === 'unread' ? "O'qilmagan bildirishnomalar yo'q" : "Bildirishnomalar yo'q"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => {
            const style = typeStyles[n.type] ?? typeStyles.GENERAL;
            return (
              <button
                key={n.id}
                onClick={() => !n.isRead && markAsRead(n.id)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  n.isRead
                    ? 'bg-white border-gray-100 opacity-70'
                    : 'bg-white border-[var(--primary)]/20 shadow-sm shadow-[var(--primary)]/5 ring-1 ring-[var(--primary)]/10'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg ${style.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <Bell size={16} className={style.text} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className={`text-sm font-semibold ${n.isRead ? 'text-gray-500' : 'text-gray-900'}`}>
                        {n.title}
                      </p>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-[var(--primary)] flex-shrink-0" />
                      )}
                    </div>
                    {n.body && (
                      <p className={`text-sm ${n.isRead ? 'text-gray-400' : 'text-gray-600'}`}>{n.body}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}>
                        {typeLabels[n.type] ?? n.type}
                      </span>
                      <span className="text-[11px] text-gray-400">{formatTime(n.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
