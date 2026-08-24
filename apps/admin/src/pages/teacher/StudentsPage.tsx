import { useEffect, useState } from 'react';
import DataTable from '../../components/ui/DataTable';
import api from '../../lib/api';
import type { StudentProgress } from '../../lib/types';

export default function StudentsPage() {
  const [students, setStudents] = useState<(StudentProgress & { id: number })[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/teacher/students').then((r) => {
      const data = (r.data.data ?? r.data ?? []).map((s: StudentProgress, i: number) => ({ ...s, id: s.userId || i }));
      setStudents(data);
    }).catch(() => setStudents([])).finally(() => setLoading(false));
  }, []);

  const filtered = students.filter((s) =>
    `${s.firstName} ${s.lastName} ${s.courseName}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">O'quvchilarim</h1>
        <p className="text-sm text-gray-500 mt-1">Kurslaringizdagi o'quvchilar progressi</p>
      </div>

      <DataTable
        columns={[
          { key: 'name', label: "O'quvchi", render: (s) => (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-xs font-bold text-blue-600">{s.firstName?.[0]}{s.lastName?.[0]}</span>
              </div>
              <span className="font-medium">{s.firstName} {s.lastName}</span>
            </div>
          )},
          { key: 'courseName', label: 'Kurs' },
          { key: 'progress', label: 'Progress', render: (s) => (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-[100px]">
                <div className="h-full bg-[var(--primary)] rounded-full" style={{ width: `${s.progress}%` }} />
              </div>
              <span className="text-xs font-medium text-gray-600">{s.progress}%</span>
            </div>
          )},
          { key: 'lessons', label: 'Darslar', render: (s) => `${s.lessonsCompleted}/${s.totalLessons}` },
        ]}
        data={filtered}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="O'quvchi nomi yoki kurs bo'yicha..."
        loading={loading}
      />
    </div>
  );
}
