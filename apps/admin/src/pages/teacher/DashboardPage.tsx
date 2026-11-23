import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, GraduationCap, MessageSquare, MessageSquareWarning, RefreshCw, Users } from 'lucide-react';
import Button from '../../components/ui/Button';
import PageHeader from '../../components/ui/PageHeader';
import StatsCard from '../../components/ui/StatsCard';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States';
import api from '../../lib/api';
import { apiErrorMessage } from '../../lib/errors';
import { formatNumber, relativeTime } from '../../lib/format';
import { useAuthStore } from '../../stores/auth-store';
import type { ChatRoom, TeacherDashboardStats } from '../../lib/types';

export default function TeacherDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [stats, setStats] = useState<TeacherDashboardStats | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const r = await api.get('/teacher/dashboard');
      if (id !== requestId.current) return; // eskirgan javob
      const data = (r.data?.data ?? r.data) as Partial<TeacherDashboardStats> | null;
      if (!data || typeof data !== 'object') throw new Error('unexpected payload');
      setStats({
        myCourses: Number(data.myCourses ?? 0),
        myStudents: Number(data.myStudents ?? 0),
        awaitingChats: Number(data.awaitingChats ?? 0),
        activeChats: Number(data.activeChats ?? 0),
        recentAwaiting: Array.isArray(data.recentAwaiting) ? data.recentAwaiting : [],
      });
      setLoadError(null);
    } catch (err) {
      if (id !== requestId.current) return;
      setLoadError(apiErrorMessage(err, "Ko'rsatkichlarni yuklab bo'lmadi."));
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

  const chatLink = (room: ChatRoom) => `/teacher/chat?courseId=${room.courseId}&studentId=${room.studentId}`;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={user?.firstName ? `Xush kelibsiz, ${user.firstName}` : 'Ustoz paneli'}
        actions={
          <Button variant="secondary" onClick={refresh} loading={refreshing && stats !== null}>
            {!(refreshing && stats !== null) && <RefreshCw size={14} />} Yangilash
          </Button>
        }
      />

      {stats === null && loadError ? (
        <div className="rounded-xl border border-gray-200 bg-white">
          <ErrorState message={loadError} onRetry={refresh} />
        </div>
      ) : stats === null ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-5">
              <Skeleton className="h-11 w-11 rounded-xl" />
              <Skeleton className="mt-4 h-7 w-16" />
              <Skeleton className="mt-2 h-4 w-28" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {loadError && (
            <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              Ma'lumot yangilanmadi: {loadError}
            </p>
          )}

          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="Kurslarim"
              value={formatNumber(stats.myCourses)}
              icon={GraduationCap}
              from="#2E9E6E"
              onClick={() => navigate('/teacher/courses')}
            />
            <StatsCard
              title="O'quvchilarim"
              value={formatNumber(stats.myStudents)}
              icon={Users}
              from="#6366F1"
              onClick={() => navigate('/teacher/students')}
            />
            <StatsCard
              title="Javob kutayotgan chatlar"
              value={formatNumber(stats.awaitingChats)}
              icon={MessageSquareWarning}
              from="#F59E0B"
              hint="Oxirgi xabar o'quvchidan"
              onClick={() => navigate('/teacher/chat')}
            />
            <StatsCard
              title="Yozishmalar"
              value={formatNumber(stats.activeChats)}
              icon={MessageSquare}
              from="#EC4899"
              hint="Xabar yozilgan chatlar"
              onClick={() => navigate('/teacher/chat')}
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900">Javob kutayotgan savollar</h2>
              {stats.awaitingChats > stats.recentAwaiting.length && (
                <Link to="/teacher/chat" className="text-sm font-medium text-[var(--primary)] hover:underline">
                  Barchasi ({stats.awaitingChats})
                </Link>
              )}
            </div>
            {stats.myCourses === 0 ? (
              <EmptyState
                icon={GraduationCap}
                title="Sizga hali kurs biriktirilmagan"
                description="Kurs biriktirilgach, o'quvchilar va ularning savollari shu yerda ko'rinadi. Administratorga murojaat qiling."
              />
            ) : stats.recentAwaiting.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Javobsiz savol yo'q"
                description="O'quvchi savol yozganda shu yerda ko'rinadi."
              />
            ) : (
              <ul className="divide-y divide-gray-50">
                {stats.recentAwaiting.map((room) => (
                  <li key={`${room.courseId}-${room.studentId}`}>
                    <Link to={chatLink(room)} className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-gray-50">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100">
                        <span className="text-xs font-bold text-blue-600">{room.studentName?.[0]?.toUpperCase() || '?'}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-sm font-medium text-gray-900">{room.studentName}</span>
                          <span className="truncate text-xs text-gray-400">{room.courseName}</span>
                        </div>
                        <p className="mt-0.5 truncate text-sm text-gray-600">{room.lastMessage}</p>
                      </div>
                      <span className="shrink-0 whitespace-nowrap text-xs text-gray-400">{relativeTime(room.lastTime)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
