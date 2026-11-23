import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import DataTable from '../../components/ui/DataTable';
import PageHeader from '../../components/ui/PageHeader';
import api from '../../lib/api';
import { apiErrorMessage } from '../../lib/errors';
import { formatDate, relativeTime } from '../../lib/format';
import type { StudentProgress } from '../../lib/types';

const PAGE_SIZE = 20;

const clampPercent = (n: unknown) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

export default function StudentsPage() {
  const [params, setParams] = useSearchParams();
  const [students, setStudents] = useState<StudentProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const r = await api.get('/teacher/students');
      if (id !== requestId.current) return; // eskirgan javob
      const data = r.data?.data ?? r.data;
      if (!Array.isArray(data)) throw new Error('unexpected payload');
      // Bir o'quvchi bir necha kursda bo'lishi mumkin — qator kaliti takrorlanmasligi shart
      setStudents((data as StudentProgress[]).map((s, i) => ({ ...s, id: s.id ?? i + 1 })));
      setLoadError(null);
    } catch (err) {
      if (id !== requestId.current) return;
      setLoadError(apiErrorMessage(err, "O'quvchilar ro'yxatini yuklab bo'lmadi."));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- birinchi yuklash; setState faqat javob kelgach chaqiriladi
    void load();
  }, [load]);

  const retry = () => {
    setLoading(true);
    void load();
  };

  // Kurs filtri URL'da — "Kurslarim" sahifasidan to'g'ridan-to'g'ri ochiladi
  const courseFilter = Number(params.get('courseId')) || 0;
  const setCourseFilter = (courseId: number) => {
    setParams(courseId ? { courseId: String(courseId) } : {}, { replace: true });
    setPage(1);
  };

  const courses = useMemo(() => {
    const map = new Map<number, string>();
    for (const s of students) map.set(s.courseId, s.courseName);
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'uz'));
  }, [students]);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('uz');
    return students.filter((s) => {
      if (courseFilter && s.courseId !== courseFilter) return false;
      return !q || `${s.firstName ?? ''} ${s.lastName ?? ''} ${s.courseName ?? ''}`.toLocaleLowerCase('uz').includes(q);
    });
  }, [students, search, courseFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const uniqueStudents = useMemo(() => new Set(filtered.map((s) => s.userId)).size, [filtered]);

  return (
    <div>
      <PageHeader
        title="O'quvchilarim"
        description={
          loading || loadError
            ? "Kurslaringizdagi o'quvchilar va ularning o'zlashtirishi"
            : `${uniqueStudents} ta o'quvchi · ${filtered.length} ta kursga yozilish`
        }
      />

      <DataTable
        columns={[
          { key: 'name', label: "O'quvchi", render: (s) => (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100">
                <span className="text-xs font-bold text-blue-600">
                  {`${s.firstName?.[0] ?? ''}${s.lastName?.[0] ?? ''}`.toUpperCase() || '?'}
                </span>
              </div>
              <span className="font-medium text-gray-900">
                {`${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || 'Ism kiritilmagan'}
              </span>
            </div>
          )},
          { key: 'courseName', label: 'Kurs' },
          { key: 'progress', label: "O'zlashtirish", render: (s) => {
            const pct = clampPercent(s.progress);
            return (
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-24 overflow-hidden rounded-full bg-gray-100"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-9 text-xs font-medium text-gray-600">{pct}%</span>
              </div>
            );
          }},
          { key: 'lessons', label: 'Darslar', render: (s) => (
            <span className="whitespace-nowrap">{s.lessonsCompleted ?? 0} / {s.totalLessons ?? 0}</span>
          )},
          { key: 'enrolledAt', label: 'Yozilgan', render: (s) => (
            <span className="whitespace-nowrap text-gray-500">{formatDate(s.enrolledAt)}</span>
          )},
          { key: 'lastActiveAt', label: 'Oxirgi faollik', render: (s) => (
            <span className="whitespace-nowrap text-gray-500">{relativeTime(s.lastActiveAt) || '—'}</span>
          )},
        ]}
        data={pageRows}
        actions={(s) => (
          <Link
            to={`/teacher/chat?courseId=${s.courseId}&studentId=${s.userId}`}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--primary)] transition-colors hover:bg-[var(--primary-light)]"
          >
            <MessageSquare size={14} /> Yozish
          </Link>
        )}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="O'quvchi ismi yoki kurs..."
        headerRight={
          courses.length > 1 ? (
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(Number(e.target.value))}
              aria-label="Kurs bo'yicha saralash"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
            >
              <option value={0}>Barcha kurslar</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : undefined
        }
        page={safePage}
        totalPages={totalPages}
        onPageChange={setPage}
        loading={loading}
        error={loadError}
        onRetry={retry}
        emptyTitle={courseFilter ? "Bu kursda o'quvchi yo'q" : "Hali o'quvchi yo'q"}
        emptyDescription="Kurslaringizga o'quvchi yozilganda shu yerda ko'rinadi."
      />
    </div>
  );
}
