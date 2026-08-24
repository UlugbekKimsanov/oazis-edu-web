import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import api from '../../lib/api';

const COLORS = ['#2E9E6E', '#5B6BFF', '#F59E0B', '#EC4899', '#8B5CF6', '#10B981'];

export default function ReportsPage() {
  const [enrollData, setEnrollData] = useState<{ name: string; count: number }[]>([]);
  const [activityData, setActivityData] = useState<{ date: string; active: number }[]>([]);
  const [courseDistribution, setCourseDistribution] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    // Try to load from API, fallback to mock
    api.get('/admin/reports/enrollments').then((r) => setEnrollData(r.data.data ?? r.data)).catch(() => {
      setEnrollData([
        { name: 'Yan', count: 45 }, { name: 'Fev', count: 62 }, { name: 'Mar', count: 89 },
        { name: 'Apr', count: 124 }, { name: 'May', count: 156 },
      ]);
    });

    api.get('/admin/reports/activity').then((r) => setActivityData(r.data.data ?? r.data)).catch(() => {
      setActivityData([
        { date: '11-May', active: 210 }, { date: '12-May', active: 245 }, { date: '13-May', active: 198 },
        { date: '14-May', active: 310 }, { date: '15-May', active: 287 }, { date: '16-May', active: 342 }, { date: '17-May', active: 356 },
      ]);
    });

    api.get('/admin/reports/courses').then((r) => setCourseDistribution(r.data.data ?? r.data)).catch(() => {
      setCourseDistribution([
        { name: 'Ingliz tili', value: 540 }, { name: 'Rus tili', value: 280 },
        { name: 'Turk tili', value: 180 }, { name: 'Nemis tili', value: 95 },
        { name: 'Koreys tili', value: 120 }, { name: 'Boshqa', value: 85 },
      ]);
    });
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Hisobotlar</h1>
        <p className="text-sm text-gray-500 mt-1">Platformaning analitik ko'rsatkichlari</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Enrollments bar chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Oylik ro'yxatdan o'tishlar</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={enrollData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" fill="#2E9E6E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Activity line chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Kunlik faol foydalanuvchilar</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={activityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey="active" stroke="#5B6BFF" strokeWidth={2} dot={{ fill: '#5B6BFF' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Course distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Kurslar bo'yicha taqsimot</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={courseDistribution} cx="50%" cy="50%" outerRadius={90} fill="#8884d8" dataKey="value" label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                {courseDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top performers */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Eng faol o'quvchilar</h3>
          <div className="space-y-3">
            {[
              { name: 'Alisher Karimov', score: 480, course: 'Ingliz tili' },
              { name: 'Malika Rustamova', score: 420, course: 'Ingliz tili' },
              { name: 'Jasur Toshmatov', score: 380, course: 'Rus tili' },
              { name: 'Nilufar Azimova', score: 350, course: 'Turk tili' },
              { name: 'Sardor Umarov', score: 320, course: 'Nemis tili' },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-[var(--primary-light)] text-[var(--primary)] text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{s.name}</p>
                  <p className="text-xs text-gray-500">{s.course}</p>
                </div>
                <span className="text-sm font-bold text-[var(--primary)]">{s.score} ball</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
