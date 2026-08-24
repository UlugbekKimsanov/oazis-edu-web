import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, GraduationCap, BookOpen, Library, TrendingUp, Activity } from 'lucide-react';
import StatsCard from '../../components/ui/StatsCard';
import api from '../../lib/api';
import type { DashboardStats } from '../../lib/types';

interface ActivityItem { text: string; createdAt?: string | null }

function relativeTime(iso?: string | null): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '';
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 1) return 'hozir';
  if (min < 60) return `${min} daqiqa oldin`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} soat oldin`;
  const d = Math.floor(h / 24);
  return `${d} kun oldin`;
}

const EMPTY_STATS: DashboardStats = {
  totalStudents: 0, totalTeachers: 0, totalCourses: 0,
  totalLessons: 0, totalBooks: 0, activeStudentsToday: 0, revenue: 0,
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    api.get('/admin/dashboard')
      .then((r) => setStats(r.data.data ?? r.data))
      .catch(() => setStats(EMPTY_STATS));
    api.get('/admin/recent-activity')
      .then((r) => setActivity(r.data.data ?? r.data ?? []))
      .catch(() => setActivity([]));
  }, []);

  if (!stats) return <div className="flex items-center justify-center h-64 text-gray-400">Yuklanmoqda...</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Platformaning umumiy statistikasi</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatsCard title="Jami o'quvchilar" value={stats.totalStudents.toLocaleString()} icon={Users} from="#2E9E6E" to="#1F7A55" onClick={() => navigate('/admin/users')} />
        <StatsCard title="O'qituvchilar" value={stats.totalTeachers} icon={GraduationCap} from="#6366F1" to="#4338CA" onClick={() => navigate('/admin/users')} />
        <StatsCard title="Kurslar" value={stats.totalCourses} icon={BookOpen} from="#F59E0B" to="#D97706" onClick={() => navigate('/admin/courses')} />
        <StatsCard title="Kitoblar" value={stats.totalBooks} icon={Library} from="#8B5CF6" to="#6D28D9" onClick={() => navigate('/admin/books')} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatsCard title="Bugungi faol" value={stats.activeStudentsToday} icon={Activity} from="#10B981" to="#059669" onClick={() => navigate('/admin/users')} />
        <StatsCard title="Jami darslar" value={stats.totalLessons} icon={BookOpen} from="#EC4899" to="#BE185D" onClick={() => navigate('/admin/lessons')} />
        <StatsCard title="Daromad (so'm)" value={stats.revenue.toLocaleString()} icon={TrendingUp} from="#F97316" to="#EA580C" onClick={() => navigate('/admin/income')} />
      </div>

      {/* So'nggi faoliyat — real */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">So'nggi faoliyat</h2>
        {activity.length === 0 ? (
          <p className="text-sm text-gray-400">Faoliyat yo'q</p>
        ) : (
          <div className="space-y-3">
            {activity.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-700">{item.text}</span>
                <span className="text-xs text-gray-400 whitespace-nowrap ml-4">{relativeTime(item.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
