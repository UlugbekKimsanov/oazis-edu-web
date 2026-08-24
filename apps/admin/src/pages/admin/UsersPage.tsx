import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, ArrowLeft, X, GraduationCap } from 'lucide-react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import api from '../../lib/api';
import type { User, Language, Course } from '../../lib/types';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', role: 'STUDENT', password: '', specialization: '' });

  // Kurs bo'yicha filter (Kurslar sahifasidan "N o'quvchi" bosilganda yoki shu yerdagi dropdown'dan)
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const courseId = Number(searchParams.get('courseId')) || 0;
  const courseName = searchParams.get('courseName') || '';

  // Dropdown uchun kurslarni til bo'yicha guruhlaymiz
  const courseGroups = languages
    .map((l) => ({ lang: l, items: courses.filter((c) => c.languageId === l.id).sort((a, b) => a.name.localeCompare(b.name)) }))
    .filter((g) => g.items.length > 0);
  const ungroupedCourses = courses.filter((c) => !languages.some((l) => l.id === c.languageId));

  // Kursni tanlash → URL searchParams yangilanadi → ro'yxat qayta yuklanadi
  const selectCourse = (id: number) => {
    if (!id) { setSearchParams({}); return; }
    const c = courses.find((x) => x.id === id);
    setSearchParams({ courseId: String(id), courseName: c?.name ?? '' });
  };

  // Mutaxassislik = bir nechta til (vergul bilan ajratilgan nomlar holida saqlanadi)
  const specLangs = form.specialization
    ? form.specialization.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const toggleSpecLang = (name: string) => {
    const set = new Set(specLangs);
    if (set.has(name)) set.delete(name); else set.add(name);
    setForm({ ...form, specialization: Array.from(set).join(', ') });
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/users', courseId ? { params: { courseId } } : undefined);
      setUsers(res.data.data ?? res.data ?? []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  useEffect(() => {
    api.get('/admin/languages').then((r) => setLanguages(r.data.data ?? r.data ?? [])).catch(() => {});
    api.get('/admin/courses').then((r) => setCourses(r.data.data ?? r.data ?? [])).catch(() => {});
  }, []);

  const filtered = users.filter((u) =>
    `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditUser(null);
    setForm({ firstName: '', lastName: '', email: '', phone: '', role: 'STUDENT', password: '', specialization: '' });
    setModalOpen(true);
  };

  const openEdit = (user: User) => {
    setEditUser(user);
    setForm({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      phone: user.phone || '',
      role: user.role || 'STUDENT',
      password: '',
      specialization: user.specialization || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editUser) {
        await api.put(`/admin/users/${editUser.id}`, form);
      } else {
        await api.post('/admin/users', form);
      }
      setModalOpen(false);
      fetchUsers();
    } catch (err) {
      /* handled silently */
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("O'chirishni tasdiqlaysizmi?")) return;
    try {
      await api.delete(`/admin/users/${id}`);
      fetchUsers();
    } catch { /* ignore */ }
  };

  const roleColors: Record<string, string> = {
    ADMIN: 'bg-purple-100 text-purple-700',
    TEACHER: 'bg-blue-100 text-blue-700',
    STUDENT: 'bg-green-100 text-green-700',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          {courseId > 0 && (
            <button
              onClick={() => navigate('/admin/courses')}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-[var(--primary)] mb-1"
            >
              <ArrowLeft size={14} /> Kurslar
            </button>
          )}
          <h1 className="text-2xl font-bold text-gray-900">
            {courseId > 0 ? `${courseName || 'Kurs'} — o'quvchilar` : 'Foydalanuvchilar'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {courseId > 0 ? 'Ushbu kursga yozilgan o\'quvchilar' : 'Barcha foydalanuvchilarni boshqarish'}
          </p>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Yangi qo'shish</Button>
      </div>

      {/* Kurs bo'yicha filter — dropdown */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="inline-flex items-center gap-2">
          <GraduationCap size={16} className="text-[var(--primary)]" />
          <span className="text-sm text-gray-600">Kurs bo'yicha:</span>
          <select
            value={courseId || 0}
            onChange={(e) => selectCourse(Number(e.target.value))}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] min-w-52"
          >
            <option value={0}>Barcha foydalanuvchilar</option>
            {courseGroups.map((g) => (
              <optgroup key={g.lang.id} label={g.lang.name}>
                {g.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
            ))}
            {ungroupedCourses.length > 0 && (
              <optgroup label="Boshqa">
                {ungroupedCourses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
            )}
          </select>
        </div>
        {courseId > 0 && (
          <>
            <span className="text-sm text-gray-400">·</span>
            <span className="text-sm text-gray-500">{users.length} o'quvchi yozilgan</span>
            <button
              onClick={() => selectCourse(0)}
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50"
              title="Filtrni olib tashlash"
            >
              <X size={14} /> Tozalash
            </button>
          </>
        )}
      </div>

      <DataTable
        columns={[
          { key: 'name', label: 'Ism', render: (u) => (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[var(--primary)] flex items-center justify-center">
                <span className="text-white text-xs font-bold">{u.firstName?.[0]}{u.lastName?.[0]}</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">{u.firstName} {u.lastName}</p>
                <p className="text-xs text-gray-500">{u.email}</p>
              </div>
            </div>
          )},
          { key: 'phone', label: 'Telefon', render: (u) => u.phone || '—' },
          { key: 'role', label: 'Rol', render: (u) => (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleColors[u.role] || 'bg-gray-100 text-gray-600'}`}>
              {u.role}
            </span>
          )},
          { key: 'ball', label: 'Ball', render: (u) => u.ball ?? 0 },
          { key: 'createdAt', label: 'Sana', render: (u) => u.createdAt ? new Date(u.createdAt).toLocaleDateString('uz') : '—' },
        ]}
        data={filtered}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Ism, email bo'yicha qidirish..."
        loading={loading}
        actions={(u) => (
          <>
            <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
              <Pencil size={14} />
            </button>
            <button onClick={() => handleDelete(u.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600">
              <Trash2 size={14} />
            </button>
          </>
        )}
      />

      {/* Create/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editUser ? "Foydalanuvchini tahrirlash" : "Yangi foydalanuvchi"}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ism</label>
              <input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Familiya</label>
              <input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
              placeholder="+998..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
            >
              <option value="STUDENT">O'quvchi</option>
              <option value="TEACHER">O'qituvchi</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          {form.role === 'TEACHER' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mutaxassisligi (tillar) <span className="text-gray-400">— bir nechtasini tanlash mumkin</span>
              </label>
              <div className="flex flex-wrap gap-2 p-2 border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                {languages.length === 0 ? (
                  <span className="text-sm text-gray-400">Tillar yuklanmoqda…</span>
                ) : (
                  languages.map((l) => {
                    const active = specLangs.includes(l.name);
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => toggleSpecLang(l.name)}
                        className={
                          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ' +
                          (active
                            ? 'bg-[var(--primary)] text-white border-transparent'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50')
                        }
                      >
                        {l.flagEmoji ? <span>{l.flagEmoji}</span> : null}
                        {l.name}
                      </button>
                    );
                  })
                )}
              </div>
              {specLangs.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">Tanlangan: {specLangs.join(', ')}</p>
              )}
            </div>
          )}
          {!editUser && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parol</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
              />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Bekor qilish</Button>
            <Button onClick={handleSave}>{editUser ? 'Saqlash' : 'Yaratish'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
