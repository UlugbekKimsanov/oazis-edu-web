import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellOff, CheckCheck, MessageSquare, RefreshCw } from 'lucide-react';
import Button from '../../components/ui/Button';
import PageHeader from '../../components/ui/PageHeader';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States';
import api from '../../lib/api';
import { apiErrorMessage } from '../../lib/errors';
import { formatDateTime, relativeTime } from '../../lib/format';
import { toast } from '../../stores/ui-store';

interface Notification {
  id: number;
  userId: number;
  title: string;
  body?: string | null;
  type?: string | null;
  refId?: number | null;
  isRead?: boolean | null;
  image?: string | null;
  createdAt?: string | null;
}

type Filter = 'all' | 'unread';

const TYPE_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  CHAT: { bg: 'bg-cyan-50', text: 'text-cyan-600', label: "O'quvchi xabari" },
  ADMIN: { bg: 'bg-purple-50', text: 'text-purple-600', label: "Ma'muriyat" },
  NEW_STUDENT: { bg: 'bg-blue-50', text: 'text-blue-600', label: "Yangi o'quvchi" },
  COURSE_UPDATE: { bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'Kurs yangilandi' },
};
const DEFAULT_STYLE = { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Bildirishnoma' };

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [markingAll, setMarkingAll] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const r = await api.get('/notifications');
      if (id !== requestId.current) return; // eskirgan javob
      const data = r.data?.data ?? r.data;
      if (!Array.isArray(data)) throw new Error('unexpected payload');
      setItems(data as Notification[]);
      setLoadError(null);
    } catch (err) {
      if (id !== requestId.current) return;
      setLoadError(apiErrorMessage(err, "Bildirishnomalarni yuklab bo'lmadi."));
    } finally {
      if (id === requestId.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- birinchi yuklash; setState faqat javob kelgach chaqiriladi
    void load();
  }, [load]);

  const refresh = () => {
    setRefreshing(true);
    void load();
  };

  const setRead = (ids: Set<number> | 'all', isRead: boolean) =>
    setItems((prev) => (prev ?? []).map((n) => (ids === 'all' || ids.has(n.id) ? { ...n, isRead } : n)));

  /** O'qilgan deb belgilaydi (optimistik); xato bo'lsa holat qaytariladi. */
  const markAsRead = async (n: Notification) => {
    if (n.isRead) return;
    setRead(new Set([n.id]), true);
    try {
      await api.patch(`/notifications/${n.id}/read`);
    } catch (err) {
      setRead(new Set([n.id]), false);
      toast.error(apiErrorMessage(err, "O'qilgan deb belgilab bo'lmadi."));
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = new Set((items ?? []).filter((n) => !n.isRead).map((n) => n.id));
    if (unreadIds.size === 0) return;
    setMarkingAll(true);
    setRead('all', true);
    try {
      await api.patch('/notifications/read-all');
      toast.success("Barcha bildirishnomalar o'qilgan deb belgilandi");
    } catch (err) {
      setRead(unreadIds, false);
      toast.error(apiErrorMessage(err, "Belgilab bo'lmadi. Qayta urinib ko'ring."));
    } finally {
      setMarkingAll(false);
    }
  };

  const open = (n: Notification) => {
    void markAsRead(n);
    // O'quvchi xabari — o'sha kursdagi javob kutayotgan chatga o'tamiz
    if (n.type === 'CHAT') navigate(n.refId ? `/teacher/chat?courseId=${n.refId}` : '/teacher/chat');
  };

  const unreadCount = useMemo(() => (items ?? []).filter((n) => !n.isRead).length, [items]);
  const filtered = useMemo(
    () => (filter === 'unread' ? (items ?? []).filter((n) => !n.isRead) : items ?? []),
    [items, filter],
  );

  return (
    <div>
      <PageHeader
        title="Bildirishnomalar"
        description={
          items === null
            ? "O'quvchilar xabarlari va ma'muriyat e'lonlari"
            : unreadCount > 0 ? `${unreadCount} ta o'qilmagan` : "Barchasi o'qilgan"
        }
        actions={
          <>
            {unreadCount > 0 && (
              <Button variant="secondary" onClick={() => void markAllAsRead()} loading={markingAll}>
                {!markingAll && <CheckCheck size={14} />} Barchasini o'qilgan qilish
              </Button>
            )}
            <Button variant="secondary" onClick={refresh} loading={refreshing && items !== null}>
              {!(refreshing && items !== null) && <RefreshCw size={14} />} Yangilash
            </Button>
          </>
        }
      />

      <div className="mb-4 inline-flex rounded-lg bg-gray-100 p-0.5" role="tablist" aria-label="Saralash">
        {([['all', 'Barchasi'], ['unread', "O'qilmagan"]] as [Filter, string][]).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            onClick={() => setFilter(value)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
            {value === 'unread' && unreadCount > 0 && ` (${unreadCount})`}
          </button>
        ))}
      </div>

      {items !== null && loadError && (
        <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Ro'yxat yangilanmadi: {loadError}
        </p>
      )}

      {items === null && loadError ? (
        <div className="rounded-xl border border-gray-200 bg-white">
          <ErrorState message={loadError} onRetry={refresh} />
        </div>
      ) : items === null ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-4">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-72 max-w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white">
          <EmptyState
            icon={BellOff}
            title={filter === 'unread' ? "O'qilmagan bildirishnoma yo'q" : "Bildirishnomalar yo'q"}
            description={filter === 'unread' ? undefined : "O'quvchi sizga yozganda yoki ma'muriyat e'lon yuborganda shu yerda ko'rinadi."}
          />
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((n) => {
            const style = (n.type && TYPE_STYLE[n.type]) || DEFAULT_STYLE;
            const isChat = n.type === 'CHAT';
            const Icon = isChat ? MessageSquare : Bell;
            const interactive = isChat || !n.isRead;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => open(n)}
                  disabled={!interactive}
                  title={isChat ? 'Chatni ochish' : !n.isRead ? "O'qilgan deb belgilash" : undefined}
                  className={`w-full rounded-xl border bg-white p-4 text-left transition-colors disabled:cursor-default ${
                    n.isRead
                      ? 'border-gray-100'
                      : 'border-[var(--primary)]/25 ring-1 ring-[var(--primary)]/10'
                  } ${interactive ? 'hover:bg-gray-50' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${style.bg}`}>
                      <Icon size={16} className={style.text} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`break-words text-sm ${n.isRead ? 'font-medium text-gray-600' : 'font-semibold text-gray-900'}`}>
                          {n.title}
                        </p>
                        {!n.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]" aria-label="O'qilmagan" />}
                      </div>
                      {n.body && (
                        <p className={`mt-0.5 whitespace-pre-line break-words text-sm ${n.isRead ? 'text-gray-500' : 'text-gray-700'}`}>
                          {n.body}
                        </p>
                      )}
                      {n.image && (
                        <img src={n.image} alt="" loading="lazy" className="mt-2 max-h-40 rounded-lg border border-gray-100" />
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${style.bg} ${style.text}`}>{style.label}</span>
                        <span className="text-[11px] text-gray-400" title={formatDateTime(n.createdAt, '')}>
                          {relativeTime(n.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
