import { useEffect, useState } from 'react';
import { Users, BookOpen, GraduationCap } from 'lucide-react';
import api from '../../lib/api';
import type { Course } from '../../lib/types';

export default function MyCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/teacher/courses').then((r) => setCourses(r.data.data ?? r.data ?? [])).catch(() => setCourses([])).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Yuklanmoqda...</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Kurslarim</h1>
        <p className="text-sm text-gray-500 mt-1">Sizga biriktirilgan kurslar</p>
      </div>

      {courses.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <GraduationCap size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">Sizga hali kurs biriktirilmagan</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{c.flagEmoji || '📚'}</span>
                <div>
                  <h3 className="font-semibold text-gray-900">{c.name}</h3>
                  <p className="text-xs text-gray-500">{c.goal || 'Kurs'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <Users size={14} />
                  <span>{c.studentCount ?? 0} o'quvchi</span>
                </div>
                <div className="flex items-center gap-1">
                  <BookOpen size={14} />
                  <span>{c.lessonCount ?? 0} dars</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.isPremium ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                  {c.isPremium ? 'Premium' : 'Bepul'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
