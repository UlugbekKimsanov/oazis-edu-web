import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Users, BookOpen, ArrowLeft, Filter, GripVertical, Search } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Flag from '../../components/ui/Flag';
import api, { fileUrl } from '../../lib/api';
import type { Course, Language, User } from '../../lib/types';

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [teacherModalOpen, setTeacherModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Course | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [courseTeachers, setCourseTeachers] = useState<number[]>([]);
  const [form, setForm] = useState({ name: '', languageId: 0, goal: '', isPremium: false, price: 0 });
  const [uploading, setUploading] = useState<'cover' | 'background' | null>(null);
  // Sichqonchani 5px sudraganda drag boshlanadi (oddiy bosishda emas)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const langFilter = Number(searchParams.get('languageId')) || 0;

  // Til bo'yicha multiselect filter (URL'dan kelgan til bilan boshlanadi)
  const [selectedLangs, setSelectedLangs] = useState<number[]>(langFilter ? [langFilter] : []);


  const langById = (id: number) => languages.find((l) => l.id === id);
  const toggleLang = (id: number) =>
    setSelectedLangs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [cRes, lRes, tRes] = await Promise.all([
        api.get('/admin/courses'),
        api.get('/admin/languages'),
        api.get('/admin/users?role=TEACHER'),
      ]);
      setCourses(cRes.data.data ?? cRes.data ?? []);
      setLanguages(lRes.data.data ?? lRes.data ?? []);
      setTeachers(tRes.data.data ?? tRes.data ?? []);
    } catch {
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = courses
    .filter((c) => selectedLangs.length === 0 || selectedLangs.includes(c.languageId))
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    // Til bo'yicha guruhlangan (qo'shni) + nom bo'yicha tartiblangan
    .sort((a, b) => {
      const la = langById(a.languageId)?.name || '';
      const lb = langById(b.languageId)?.name || '';
      if (la !== lb) return la.localeCompare(lb);
      return a.name.localeCompare(b.name);
    });
  const filterLangName = langFilter ? (languages.find((l) => l.id === langFilter)?.name || '') : '';

  // Filter uchun faqat kursi bor tillar
  const langsWithCourses = languages.filter((l) => courses.some((c) => c.languageId === l.id));

  const openCreate = () => {
    setEditItem(null);
    setForm({ name: '', languageId: langFilter || languages[0]?.id || 0, goal: '', isPremium: false, price: 0 });
    setModalOpen(true);
  };

  const openEdit = (item: Course) => {
    setEditItem(item);
    setForm({ name: item.name, languageId: item.languageId, goal: item.goal || '', isPremium: item.isPremium, price: item.price || 0 });
    setModalOpen(true);
  };

  const openTeachers = async (course: Course) => {
    setSelectedCourse(course);
    try {
      const res = await api.get(`/admin/courses/${course.id}/teachers`);
      setCourseTeachers((res.data.data ?? res.data ?? []).map((t: User) => t.id));
    } catch {
      setCourseTeachers([]);
    }
    setTeacherModalOpen(true);
  };

  const toggleTeacher = async (teacherId: number) => {
    if (!selectedCourse) return;
    const has = courseTeachers.includes(teacherId);
    try {
      if (has) {
        await api.delete(`/admin/courses/${selectedCourse.id}/teachers/${teacherId}`);
        setCourseTeachers((prev) => prev.filter((id) => id !== teacherId));
      } else {
        await api.post(`/admin/courses/${selectedCourse.id}/teachers/${teacherId}`);
        setCourseTeachers((prev) => [...prev, teacherId]);
      }
    } catch { /* ignore */ }
  };

  const handleSave = async () => {
    // Premium bo'lsa narx + priceLabel, aks holda null
    const price = form.isPremium && form.price > 0 ? form.price : null;
    const priceLabel = price ? `${price.toLocaleString('ru-RU')} so'm` : null;
    // flagEmoji tildan olinadi (kursda alohida emoji yo'q)
    const flagEmoji = langById(form.languageId)?.flagEmoji ?? '';
    const payload = { ...form, flagEmoji, price, priceLabel };
    try {
      if (editItem) {
        await api.put(`/admin/courses/${editItem.id}`, payload);
      } else {
        await api.post('/admin/courses', payload);
      }
      setModalOpen(false);
      fetchAll();
    } catch (err) {
      /* handled silently */
    }
  };

  // Cover yoki background rasmni yuklash (faqat mavjud kurs uchun)
  const uploadImage = async (kind: 'cover' | 'background', file: File) => {
    if (!editItem) return;
    setUploading(kind);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post(`/admin/courses/${editItem.id}/upload-${kind}`, fd);
      const updated: Course = res.data.data ?? res.data;
      setEditItem(updated);
      fetchAll();
    } catch { /* ignore */ } finally {
      setUploading(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("O'chirishni tasdiqlaysizmi?")) return;
    await api.delete(`/admin/courses/${id}`);
    fetchAll();
  };

  // ── Drag-and-drop tartiblash (@dnd-kit, faqat shu til ichida) ──
  // Yangi tartibni order_index ga yozadi: optimistik lokal yangilanish + fonda saqlash.
  // fetchAll CHAQIRILMAYDI — butun sahifa qayta render bo'lmaydi.
  const applyReorder = (ordered: Course[]) => {
    const posById = new Map(ordered.map((c, i) => [c.id, i + 1]));
    setCourses((prev) =>
      prev.map((c) => (posById.has(c.id) ? { ...c, orderIndex: posById.get(c.id)! } : c))
    );
    // Faqat o'zgargan kurslarni fonda saqlaymiz (await yo'q — UI bloklanmaydi)
    ordered.forEach((c, i) => {
      if (c.orderIndex !== i + 1) {
        api.put(`/admin/courses/${c.id}`, { ...c, orderIndex: i + 1 }).catch(() => {});
      }
    });
  };

  // Shu til guruhida sudrab tashlangach tartibni qayta hisoblaydi
  const onDragEnd = (items: Course[], event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((c) => c.id === active.id);
    const to = items.findIndex((c) => c.id === over.id);
    if (from < 0 || to < 0) return;
    applyReorder(arrayMove(items, from, to));
  };

  // Kurslarni til bo'yicha guruhlab, har guruhni order_index bo'yicha tartiblaymiz
  const groupLangIds = [...new Set(filtered.map((c) => c.languageId))].sort((a, b) =>
    (langById(a)?.name || '').localeCompare(langById(b)?.name || '')
  );
  const groups = groupLangIds.map((lid) => ({
    langId: lid,
    lang: langById(lid),
    items: filtered
      .filter((c) => c.languageId === lid)
      .sort((a, b) => (a.orderIndex ?? a.id) - (b.orderIndex ?? b.id)),
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          {filterLangName && (
            <button onClick={() => navigate('/admin/languages')}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-[var(--primary)] mb-1">
              <ArrowLeft size={14} /> Tillar
            </button>
          )}
          <h1 className="text-2xl font-bold text-gray-900">
            {filterLangName ? `${filterLangName} — kurslar` : 'Kurslar'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {filterLangName ? 'Kurs nomiga bosib darslarga o\'ting' : 'Barcha kurslarni boshqarish'}
          </p>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Yangi kurs</Button>
      </div>

      {/* Til bo'yicha multiselect filter */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={15} className="text-[var(--primary)]" />
          <h2 className="text-sm font-semibold text-gray-900">Tillar bo'yicha filter</h2>
          {selectedLangs.length > 0 && (
            <button onClick={() => setSelectedLangs([])} className="ml-auto text-xs text-gray-400 hover:text-red-600">
              Tozalash
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {langsWithCourses.length === 0 && (
            <span className="text-sm text-gray-400">Kursi bor tillar yo'q</span>
          )}
          {langsWithCourses.map((l) => {
            const active = selectedLangs.includes(l.id);
            return (
              <button
                key={l.id}
                onClick={() => toggleLang(l.id)}
                className={
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ' +
                  (active
                    ? 'bg-[var(--primary)] text-white border-transparent'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50')
                }
              >
                <Flag emoji={l.flagEmoji} height={14} />
                {l.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Kurslar — @dnd-kit bilan silliq sudrab tartiblanadi (faqat til ichida) */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 gap-3 flex-wrap">
          <div className="relative w-72 max-w-full">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Qidirish..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
            />
          </div>
          <span className="text-xs text-gray-400 inline-flex items-center gap-1">
            <GripVertical size={14} /> Dastakdan ushlab sudrang
          </span>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="text-center py-12 text-gray-400">Yuklanmoqda...</div>
          ) : groups.length === 0 ? (
            <div className="text-center py-12 text-gray-400">Ma'lumot topilmadi</div>
          ) : (
            <div className="space-y-6">
              {groups.map((g) => (
                <div key={g.langId}>
                  {/* Til sarlavhasi */}
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <Flag emoji={g.lang?.flagEmoji} height={16} />
                    <h3 className="text-sm font-semibold text-gray-700">{g.lang?.name || '—'}</h3>
                    <span className="text-xs text-gray-400">({g.items.length} ta)</span>
                  </div>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(e) => onDragEnd(g.items, e)}
                  >
                    <SortableContext items={g.items.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {g.items.map((c, idx) => (
                          <SortableCourseRow
                            key={c.id}
                            course={c}
                            position={idx + 1}
                            flagEmoji={c.flagEmoji || g.lang?.flagEmoji}
                            onOpenLessons={() => navigate(`/admin/lessons?courseId=${c.id}`)}
                            onOpenStudents={() => navigate(`/admin/users?courseId=${c.id}&courseName=${encodeURIComponent(c.name)}`)}
                            onOpenTeachers={() => openTeachers(c)}
                            onEdit={() => openEdit(c)}
                            onDelete={() => handleDelete(c.id)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? "Kursni tahrirlash" : "Yangi kurs"}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nomi</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Til</label>
            <select
              value={form.languageId}
              onChange={(e) => setForm({ ...form, languageId: Number(e.target.value) })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
            >
              {languages.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isPremium}
              onChange={(e) => setForm({ ...form, isPremium: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
            />
            <span className="text-sm text-gray-700">Premium kurs</span>
          </label>

          {form.isPremium && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Narxi (so'm)</label>
              <input
                type="number"
                min={0}
                value={form.price || ''}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
                placeholder="199000"
              />
              {form.price > 0 && (
                <p className="text-xs text-gray-500 mt-1">{form.price.toLocaleString('ru-RU')} so'm</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Maqsad</label>
            <input
              value={form.goal}
              onChange={(e) => setForm({ ...form, goal: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
              placeholder="Noldan so'zlashuvgacha"
            />
          </div>

          {editItem ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Card rasmi</label>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center shrink-0">
                  {fileUrl(editItem.coverImage)
                    ? <img src={fileUrl(editItem.coverImage)} alt="" className="w-full h-full object-cover" />
                    : <span className="text-xs text-gray-400">yo'q</span>}
                </div>
                <label className="text-sm text-[var(--primary)] cursor-pointer hover:underline">
                  {uploading === 'cover' ? 'Yuklanmoqda…' : 'Rasm tanlash'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading !== null}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadImage('cover', f);
                    }}
                  />
                </label>
              </div>
              <p className="text-xs text-gray-400 mt-2">Kurs foni til (til tanlash) backgroundidan olinadi — alohida sozlanmaydi.</p>
            </div>
          ) : (
            <p className="text-xs text-gray-400">Card rasmini kursni saqlagandan so'ng tahrirlashda yuklaysiz.</p>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Bekor qilish</Button>
            <Button onClick={handleSave}>{editItem ? 'Saqlash' : 'Yaratish'}</Button>
          </div>
        </div>
      </Modal>

      {/* Teacher assignment modal */}
      <Modal open={teacherModalOpen} onClose={() => setTeacherModalOpen(false)} title={`O'qituvchilar — ${selectedCourse?.name || ''}`}>
        <div className="space-y-2">
          {teachers.length === 0 ? (
            <p className="text-sm text-gray-500">O'qituvchilar topilmadi</p>
          ) : (
            teachers.map((t) => (
              <label key={t.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={courseTeachers.includes(t.id)}
                  onChange={() => toggleTeacher(t.id)}
                  className="w-4 h-4 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">{t.firstName} {t.lastName}</p>
                  <p className="text-xs text-gray-500">{t.specialization || t.email}</p>
                </div>
              </label>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}

// ── Sudraladigan kurs qatori (@dnd-kit) ──────────────────────────────────────
function SortableCourseRow({
  course,
  position,
  flagEmoji,
  onOpenLessons,
  onOpenStudents,
  onOpenTeachers,
  onEdit,
  onDelete,
}: {
  course: Course;
  position: number;
  flagEmoji?: string;
  onOpenLessons: () => void;
  onOpenStudents: () => void;
  onOpenTeachers: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: course.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={
        'flex items-center gap-3 rounded-xl border bg-white px-3 py-2.5 ' +
        (isDragging
          ? 'border-[var(--primary)]/40 shadow-lg ring-2 ring-[var(--primary)]/20'
          : 'border-gray-200 hover:shadow-sm transition-shadow')
      }
    >
      {/* Sudrash dastagi — faqat shu yerdan drag boshlanadi */}
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 touch-none"
        title="Sudrab tartiblang"
        aria-label="Tartiblash"
      >
        <GripVertical size={18} />
      </button>
      <span className="w-5 shrink-0 text-center text-xs font-semibold text-gray-400">{position}</span>
      <Flag emoji={flagEmoji} height={20} />
      <div className="min-w-0 flex-1">
        <button
          onClick={onOpenLessons}
          className="block max-w-full truncate text-left text-sm font-medium text-gray-900 hover:text-[var(--primary)] hover:underline"
          title="Darslarga o'tish"
        >
          {course.name}
        </button>
        {course.goal && <p className="truncate text-xs text-gray-500">{course.goal}</p>}
      </div>
      <div className="hidden items-center gap-2 md:flex">
        {course.isPremium ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            {course.priceLabel || (course.price ? `${course.price.toLocaleString('ru-RU')} so'm` : 'Premium')}
          </span>
        ) : (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Bepul</span>
        )}
        <button
          onClick={onOpenLessons}
          className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] transition-colors"
          title="Darslarni ko'rish"
        >
          {course.lessonCount ?? 0} dars
        </button>
        <button
          onClick={onOpenStudents}
          className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] transition-colors"
          title="Yozilgan o'quvchilar"
        >
          {course.studentCount ?? 0} o'quvchi
        </button>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button onClick={onOpenLessons} className="rounded-lg p-1.5 text-gray-400 hover:bg-green-50 hover:text-green-600" title="Darslar"><BookOpen size={14} /></button>
        <button onClick={onOpenTeachers} className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600" title="O'qituvchilar"><Users size={14} /></button>
        <button onClick={onEdit} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600" title="Tahrirlash"><Pencil size={14} /></button>
        <button onClick={onDelete} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" title="O'chirish"><Trash2 size={14} /></button>
      </div>
    </div>
  );
}
