import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Users, GraduationCap, BookOpen, Library, TrendingUp, Activity, RefreshCw,
  UserPlus, ShoppingBag, Bell, PlusCircle, ChevronRight, Layers,
} from 'lucide-react';
import StatsCard from '../../components/ui/StatsCard';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States';
import api, { API_ORIGIN } from '../../lib/api';
import { apiErrorMessage } from '../../lib/errors';
import { formatDateTime, formatMoney, formatNumber, relativeTime } from '../../lib/format';
import type { DashboardStats } from '../../lib/types';

interface ActivityItem { text: string; createdAt?: string | null }

const LEADS_STATS_URL = `${API_ORIGIN}/api/admin/landing/leads/stats`;

/** Backend faoliyat turini bermaydi — matn boshidan aniqlaymiz (noma'lum bo'lsa umumiy ikonka). */
function activityMeta(text: string): { icon: LucideIcon; cls: string } {
  if (text.startsWith('Yangi o\'quvchi')) return { icon: UserPlus, cls: 'bg-emerald-50 text-emerald-600' };
  if (text.startsWith('Kitob sotib')) return { icon: ShoppingBag, cls: 'bg-amber-50 text-amber-600' };
  return { icon: Activity, cls: 'bg-gray-100 text-gray-500' };
}

const QUICK_ACTIONS: { to: string; icon: LucideIcon; label: string }[] = [
  { to: '/admin/lessons', icon: PlusCircle, label: "Dars qo'shish" },
  { to: '/admin/courses', icon: GraduationCap, label: 'Kurslarni boshqarish' },
  { to: '/admin/notifications', icon: Bell, label: 'Bildirishnoma yuborish' },
  { to: '/admin/users', icon: Users, label: 'Foydalanuvchilar' },
];

function StatsSkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-white p-5">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <Skeleton className="mt-4 h-7 w-20" />
          <Skeleton className="mt-2 h-4 w-28" />
        </div>
      ))}
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">{children}</h2>;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityItem[] | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [newLeads, setNewLeads] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setRefreshing(true);

    // Uchala so'rov mustaqil: biri yiqilsa qolganlari ko'rsatiladi.
    const [statsRes, activityRes, leadsRes] = await Promise.allSettled([
      api.get('/admin/dashboard'),
      api.get('/admin/recent-activity'),
      api.get(LEADS_STATS_URL),
    ]);
    if (id !== requestId.current) return; // eskirgan javob

    if (statsRes.status === 'fulfilled') {
      setStats(statsRes.value.data.data ?? statsRes.value.data);
      setStatsError(null);
      setUpdatedAt(new Date().toISOString());
    } else {
      // Xatoda soxta "0" ko'rsatilmaydi — platforma bo'sh degan noto'g'ri taassurot qoldirmaslik uchun
      setStatsError(apiErrorMessage(statsRes.reason, "Statistikani yuklab bo'lmadi."));
    }

    if (activityRes.status === 'fulfilled') {
      const list = activityRes.value.data.data ?? activityRes.value.data;
      setActivity(Array.isArray(list) ? list : []);
      setActivityError(null);
    } else {
      setActivityError(apiErrorMessage(activityRes.reason, "So'nggi faoliyatni yuklab bo'lmadi."));
    }

    if (leadsRes.status === 'fulfilled') {
      const payload = leadsRes.value.data?.data ?? leadsRes.value.data;
      const n = Number(payload?.newRequests);
      setNewLeads(Number.isFinite(n) ? n : null);
    } else {
      setNewLeads(null); // ixtiyoriy blok — xatoda shunchaki ko'rsatilmaydi
    }

    setRefreshing(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- birinchi yuklash
    void load();
  }, [load]);

  const firstLoad = stats === null && statsError === null;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={
          updatedAt
            ? `Platformaning umumiy statistikasi · yangilandi ${formatDateTime(updatedAt)}`
            : 'Platformaning umumiy statistikasi'
        }
        actions={
          <Button variant="secondary" onClick={() => void load()} loading={refreshing && !firstLoad} disabled={firstLoad}>
            {!(refreshing && !firstLoad) && <RefreshCw size={14} />} Yangilash
          </Button>
        }
      />

      {/* Yangi so'rovlar — e'tibor talab qiladigan yagona narsa, shuning uchun eng tepada */}
      {newLeads !== null && newLeads > 0 && (
        <Link
          to="/admin/leads"
          className="mb-6 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 transition-colors hover:bg-blue-100"
        >
          <UserPlus size={18} className="shrink-0" />
          <span className="flex-1">
            <b>{formatNumber(newLeads)} ta</b> yangi so'rov javob kutmoqda
          </span>
          <span className="inline-flex items-center gap-1 font-medium">Ko'rish <ChevronRight size={14} /></span>
        </Link>
      )}

      {statsError && !stats ? (
        <div className="mb-8 rounded-xl border border-gray-200 bg-white">
          <ErrorState message={statsError} onRetry={() => void load()} />
        </div>
      ) : (
        <>
          {statsError && (
            <p role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              Yangilab bo'lmadi: {statsError} Quyida oxirgi yuklangan ma'lumot ko'rsatilgan.
            </p>
          )}

          <SectionTitle>Foydalanuvchilar</SectionTitle>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats ? (
              <>
                <StatsCard title="Jami o'quvchilar" value={formatNumber(stats.totalStudents)} icon={Users} from="#2E9E6E" onClick={() => navigate('/admin/users?role=STUDENT')} />
                <StatsCard title="Bugun faol" value={formatNumber(stats.activeStudentsToday)} icon={Activity} from="#10B981" hint="Bugun dars qilgan o'quvchilar" />
                <StatsCard title="O'qituvchilar" value={formatNumber(stats.totalTeachers)} icon={GraduationCap} from="#6366F1" onClick={() => navigate('/admin/users?role=TEACHER')} />
                <StatsCard title="Jami daromad" value={formatMoney(stats.revenue)} icon={TrendingUp} from="#F97316" hint="Kurs va kitob to'lovlari" onClick={() => navigate('/admin/income')} />
              </>
            ) : (
              <StatsSkeleton count={4} />
            )}
          </div>

          <SectionTitle>Kontent</SectionTitle>
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {stats ? (
              <>
                <StatsCard title="Kurslar" value={formatNumber(stats.totalCourses)} icon={Layers} from="#F59E0B" onClick={() => navigate('/admin/courses')} />
                <StatsCard title="Darslar" value={formatNumber(stats.totalLessons)} icon={BookOpen} from="#EC4899" onClick={() => navigate('/admin/lessons')} />
                <StatsCard title="Kitoblar" value={formatNumber(stats.totalBooks)} icon={Library} from="#8B5CF6" onClick={() => navigate('/admin/books')} />
              </>
            ) : (
              <StatsSkeleton count={3} />
            )}
          </div>
        </>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* So'nggi faoliyat */}
        <section className="rounded-xl border border-gray-200 bg-white p-6 lg:col-span-2">
          <h2 className="mb-2 text-lg font-semibold text-gray-900">So'nggi faoliyat</h2>
          {activityError && !activity ? (
            <ErrorState message={activityError} onRetry={() => void load()} className="py-8" />
          ) : activity === null ? (
            <div className="space-y-4 py-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          ) : activity.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="Hali faoliyat yo'q"
              description="Yangi o'quvchi ro'yxatdan o'tsa yoki kitob sotilsa, shu yerda ko'rinadi."
              className="py-8"
            />
          ) : (
            <ul>
              {activity.map((item, i) => {
                const meta = activityMeta(item.text);
                return (
                  <li key={`${item.createdAt ?? ''}-${i}`} className="flex items-center gap-3 border-b border-gray-50 py-2.5 last:border-0">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.cls}`}>
                      <meta.icon size={15} />
                    </span>
                    <span className="min-w-0 flex-1 break-words text-sm text-gray-700">{item.text}</span>
                    <time
                      className="shrink-0 whitespace-nowrap text-xs text-gray-400"
                      title={formatDateTime(item.createdAt, '')}
                    >
                      {relativeTime(item.createdAt)}
                    </time>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Tezkor amallar */}
        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Tezkor amallar</h2>
          <ul className="space-y-1">
            {QUICK_ACTIONS.map((a) => (
              <li key={a.to}>
                <Link
                  to={a.to}
                  className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <a.icon size={18} className="shrink-0 text-[var(--primary)]" />
                  <span className="flex-1">{a.label}</span>
                  <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
