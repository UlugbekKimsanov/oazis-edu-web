import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, GraduationCap, MessagesSquare, Users } from 'lucide-react';
import Flag from '../../components/ui/Flag';
import PageHeader from '../../components/ui/PageHeader';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States';
import api from '../../lib/api';
import { apiErrorMessage } from '../../lib/errors';
import { formatNumber } from '../../lib/format';
import type { Course } from '../../lib/types';

export default function MyCoursesPage() {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const r = await api.get('/teacher/courses');
      if (id !== requestId.current) return; // eskirgan javob
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

  const retry = () => {
    setLoadError(null);
    void load();
  };

  return (
    <div>
      <PageHeader title="Kurslarim" description="Sizga biriktirilgan va mutaxassisligingizga mos kurslar" />

      {courses === null && loadError ? (
        <div className="rounded-xl border border-gray-200 bg-white">
          <ErrorState message={loadError} onRetry={retry} />
        </div>
      ) : courses === null ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <Skeleton className="h-7 w-10" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="mt-5 h-4 w-48" />
            </div>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white">
          <EmptyState
            icon={GraduationCap}
            title="Sizga hali kurs biriktirilmagan"
            description="Administrator sizni kursga biriktirgach yoki mutaxassisligingizni (tillar) belgilagach, kurslar shu yerda ko'rinadi."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <div key={c.id} className="flex flex-col rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-3 flex items-start gap-3">
                <Flag emoji={c.flagEmoji} height={26} />
                <div className="min-w-0 flex-1">
                  <h3 className="break-words font-semibold text-gray-900">{c.name}</h3>
                  {c.goal && <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{c.goal}</p>}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    c.isPremium ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                  }`}
                >
                  {c.isPremium ? 'Premium' : 'Bepul'}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1.5">
                  <Users size={14} className="text-gray-400" /> {formatNumber(c.studentCount)} o'quvchi
                </span>
                <span className="flex items-center gap-1.5">
                  <BookOpen size={14} className="text-gray-400" /> {formatNumber(c.lessonCount)} dars
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                <Link
                  to={`/teacher/students?courseId=${c.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <Users size={13} /> O'quvchilar
                </Link>
                <Link
                  to={`/teacher/group-chat?courseId=${c.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <MessagesSquare size={13} /> Guruh chat
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
