import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useRememberedSearch } from '../../hooks/useRememberedSearch';
import {
  Plus, Pencil, Trash2, Users, BookOpen, Filter, GripVertical, Search, X, Lock, ArrowRight,
  ImageOff, Image as ImageIcon, Loader2, GraduationCap, SearchX,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Flag from '../../components/ui/Flag';
import PageHeader from '../../components/ui/PageHeader';
import { EmptyState, ErrorState, LoadingState, Skeleton } from '../../components/ui/States';
import api, { fileUrl } from '../../lib/api';
import { apiErrorMessage } from '../../lib/errors';
import { formatMoney, formatNumber } from '../../lib/format';
import { confirmDialog, toast } from '../../stores/ui-store';
import type { Course, Language, User } from '../../lib/types';

/** URL'da eslab qolinadigan parametrlar (yon menyudan qaytganda tiklanadi) */
const COURSES_PARAMS = ['languageId', 'q'] as const;

/** Muqova rasmi: mobil kartada 16:9 ko'rinadi */
const COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const COVER_MAX_BYTES = 5 * 1024 * 1024;
/** Backend `price` — Integer (so'mda); 9 xona undan oshib ketmaydi */
const PRICE_MAX_DIGITS = 9;
/** DB: name / goal / author — VARCHAR(255) */
const TEXT_MAX = 255;

interface CourseForm {
  name: string;
  languageId: number;
  goal: string;
  author: string;
  isPremium: boolean;
  /** Faqat raqamlar (matn sifatida — bo'sh qiymat va NaN muammosi bo'lmasligi uchun) */
  price: string;
}
type FormErrors = Partial<Record<'name' | 'languageId' | 'price' | 'cover', string>>;

const EMPTY_FORM: CourseForm = { name: '', languageId: 0, goal: '', author: '', isPremium: false, price: '' };

const inputCls = (invalid?: boolean) =>
  'w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 ' +
  (invalid
    ? 'border-red-300 focus:ring-red-200 focus:border-red-400'
    : 'border-gray-200 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]');

const sortKey = (c: Course) => c.orderIndex ?? c.id;
const teacherName = (t: User) =>
  [t.firstName, t.lastName].filter(Boolean).join(' ').trim() || t.email || `#${t.id}`;
const unwrapList = <T,>(data: unknown): T[] => {
  const d = data as { data?: unknown } | null;
  const list = d && typeof d === 'object' && 'data' in d ? d.data : data;
  return Array.isArray(list) ? (list as T[]) : [];
};

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [teachersError, setTeachersError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Kurs formasi
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Course | null>(null);
  const [form, setForm] = useState<CourseForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  // Tanlangan, lekin hali yuklanmagan muqova (saqlashda yuklanadi)
  const [cover, setCover] = useState<{ file: File; url: string } | null>(null);
  const coverUrlRef = useRef<string | null>(null);

  const [deletingId, setDeletingId] = useState<number | null>(null);

  // O'qituvchilarni biriktirish oynasi
  const [teacherCourse, setTeacherCourse] = useState<Course | null>(null);
  const [assigned, setAssigned] = useState<User[]>([]);
  const [assignedLoading, setAssignedLoading] = useState(false);
  const [assignedError, setAssignedError] = useState<string | null>(null);
  const [busyTeachers, setBusyTeachers] = useState<number[]>([]);
  const [teacherSearch, setTeacherSearch] = useState('');
  const teacherReq = useRef(0);

  const alive = useRef(true);
  const loadReq = useRef(0);
  // Tartib saqlash so'rovlari ketma-ket bajariladi (tez-tez sudralganda aralashib ketmasin)
  const reorderChain = useRef<Promise<void>>(Promise.resolve());

  // Sichqonchani 5px sudraganda drag boshlanadi (oddiy bosishda emas); klaviaturada: Space + strelkalar
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  useRememberedSearch(COURSES_PARAMS);

  // Til filtri (multiselect, `languageId=1,2`) va qidiruv (`q`) URL'da saqlanadi —
  // refresh, orqaga va sahifalar aro o'tishda yo'qolmaydi
  const selectedLangs = useMemo(
    () => (searchParams.get('languageId') || '').split(',').map(Number).filter((n) => n > 0),
    [searchParams],
  );
  const search = searchParams.get('q') || '';
  const query = search.trim().toLowerCase();
  const patchParams = useCallback(
    (patch: Record<string, string | null>) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v) next.set(k, v);
            else next.delete(k);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  const setSelectedLangs = (ids: number[]) => patchParams({ languageId: ids.join(',') || null });
  const setSearch = (q: string) => patchParams({ q: q || null });
  // Bitta til tanlangan bo'lsa — sarlavha va yangi kurs uchun standart til shu bo'ladi
  const langFilter = selectedLangs.length === 1 ? selectedLangs[0] : 0;

  const langById = (id: number) => languages.find((l) => l.id === id);
  const toggleLang = (id: number) =>
    setSelectedLangs(selectedLangs.includes(id) ? selectedLangs.filter((x) => x !== id) : [...selectedLangs, id]);

  /**
   * Kurslar + tillar (majburiy) va o'qituvchilar (ixtiyoriy) yuklanadi.
   * `silent` — saqlash/o'chirishdan keyingi fon yangilanishi: ro'yxat o'rnida qoladi.
   */
  const load = useCallback(async (silent = false) => {
    const id = ++loadReq.current;
    if (!silent) {
      setLoading(true);
      setLoadError(null);
    }
    const [cRes, lRes, tRes] = await Promise.allSettled([
      api.get('/admin/courses'),
      api.get('/admin/languages'),
      api.get('/admin/users?role=TEACHER'),
    ]);
    if (!alive.current || id !== loadReq.current) return; // eskirgan javob

    if (tRes.status === 'fulfilled') {
      setTeachers(unwrapList<User>(tRes.value.data));
      setTeachersError(null);
    } else {
      setTeachersError(apiErrorMessage(tRes.reason, "O'qituvchilar ro'yxatini yuklab bo'lmadi."));
    }

    if (cRes.status === 'fulfilled' && lRes.status === 'fulfilled') {
      setCourses(unwrapList<Course>(cRes.value.data));
      setLanguages(unwrapList<Language>(lRes.value.data));
      setLoadError(null);
    } else {
      const reason = cRes.status === 'rejected' ? cRes.reason : (lRes as PromiseRejectedResult).reason;
      const msg = apiErrorMessage(reason, "Kurslarni yuklab bo'lmadi.");
      // Fon yangilanishi yiqilsa eski ro'yxat qoladi — bo'sh ro'yxat "kurs yo'q" degan noto'g'ri taassurot beradi
      if (silent) toast.error(`Ro'yxatni yangilab bo'lmadi: ${msg}`);
      else setLoadError(msg);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    alive.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- birinchi yuklash
    void load();
    return () => {
      alive.current = false;
    };
  }, [load]);

  // ── Muqova (object URL) boshqaruvi ──
  const setPendingCover = (file: File | null) => {
    if (coverUrlRef.current) URL.revokeObjectURL(coverUrlRef.current);
    const url = file ? URL.createObjectURL(file) : null;
    coverUrlRef.current = url;
    setCover(file && url ? { file, url } : null);
  };
  useEffect(
    () => () => {
      // Sahifadan chiqilganda vaqtinchalik rasm URL'i bo'shatiladi
      if (coverUrlRef.current) URL.revokeObjectURL(coverUrlRef.current);
    },
    [],
  );

  const onPickCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ''; // shu faylni qayta tanlash mumkin bo'lsin
    if (!f) return;
    if (!COVER_TYPES.includes(f.type)) {
      setErrors((p) => ({ ...p, cover: 'Faqat JPG, PNG yoki WebP rasm yuklash mumkin.' }));
      return;
    }
    if (f.size > COVER_MAX_BYTES) {
      setErrors((p) => ({
        ...p,
        cover: `Rasm hajmi ${(f.size / 1024 / 1024).toFixed(1)} MB — 5 MB dan oshmasligi kerak.`,
      }));
      return;
    }
    setErrors((p) => ({ ...p, cover: undefined }));
    setPendingCover(f);
  };

  // ── Ro'yxat: filtr + guruhlash ──
  const filtered = courses
    .filter((c) => selectedLangs.length === 0 || selectedLangs.includes(c.languageId))
    .filter((c) => !query || (c.name || '').toLowerCase().includes(query) || (c.goal || '').toLowerCase().includes(query));
  const filterLangName = langFilter ? langById(langFilter)?.name || '' : '';

  // Filter uchun: kursi bor tillar + tanlangan (hali kursi yo'q) til
  const countByLang = new Map<number, number>();
  for (const c of courses) countByLang.set(c.languageId, (countByLang.get(c.languageId) || 0) + 1);
  const filterLangs = languages.filter((l) => countByLang.has(l.id) || selectedLangs.includes(l.id));

  // Kurslarni til bo'yicha guruhlab, har guruhni order_index bo'yicha tartiblaymiz
  const groupLangIds = [...new Set(filtered.map((c) => c.languageId))].sort((a, b) =>
    (langById(a)?.name || '').localeCompare(langById(b)?.name || ''),
  );
  const groups = groupLangIds.map((lid) => ({
    langId: lid,
    lang: langById(lid),
    items: filtered.filter((c) => c.languageId === lid).sort((a, b) => sortKey(a) - sortKey(b)),
  }));
  // Qidiruvda guruhning bir qismi ko'rinadi — shu holatda tartiblash butun guruh tartibini buzadi
  const canReorder = !query;

  // ── Forma ──
  const closeForm = () => {
    if (saving) return;
    setModalOpen(false);
    setPendingCover(null);
  };

  const openCreate = (languageId?: number) => {
    setEditItem(null);
    setForm({ ...EMPTY_FORM, languageId: languageId || langFilter || languages[0]?.id || 0 });
    setErrors({});
    setPendingCover(null);
    setModalOpen(true);
  };

  const openEdit = (item: Course) => {
    setEditItem(item);
    setForm({
      name: item.name || '',
      languageId: item.languageId || 0,
      goal: item.goal || '',
      author: item.author || '',
      isPremium: !!item.isPremium,
      price: item.price && item.price > 0 ? String(Math.round(item.price)) : '',
    });
    setErrors({});
    setPendingCover(null);
    setModalOpen(true);
  };

  const priceNum = form.price ? Number(form.price) : 0;
  const patchForm = (patch: Partial<CourseForm>) => setForm((p) => ({ ...p, ...patch }));

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (saving) return;

    const name = form.name.trim();
    const nextErrors: FormErrors = {};
    if (!name) nextErrors.name = 'Kurs nomini kiriting.';
    if (!form.languageId || !langById(form.languageId)) nextErrors.languageId = 'Tilni tanlang.';
    // Narxsiz premium kursni sotib bo'lmaydi (to'lov summasi 0 bo'lib qoladi)
    if (form.isPremium && !(priceNum > 0)) nextErrors.price = 'Premium kurs uchun narxni kiriting (0 dan katta).';
    setErrors(nextErrors);
    if (nextErrors.name || nextErrors.languageId || nextErrors.price) return;

    // Premium bo'lsa narx + priceLabel, aks holda null
    const price = form.isPremium ? priceNum : null;
    const priceLabel = price ? formatMoney(price) : null;
    // flagEmoji tildan olinadi (kursda alohida emoji yo'q)
    const flagEmoji = langById(form.languageId)?.flagEmoji ?? '';
    // Muallif bo'sh bo'lsa null — mobil dars ekranida muallif qatori yashiriladi
    const author = form.author.trim() || null;
    const payload: Record<string, unknown> = {
      name,
      languageId: form.languageId,
      goal: form.goal.trim(),
      author,
      isPremium: form.isPremium,
      flagEmoji,
      price,
      priceLabel,
    };
    if (!editItem) {
      // Yangi kurs o'z tili ro'yxatining oxiriga tushadi
      const siblings = courses.filter((c) => c.languageId === form.languageId);
      payload.orderIndex = siblings.reduce((m, c) => Math.max(m, sortKey(c)), 0) + 1;
    }

    const wasEdit = !!editItem;
    setSaving(true);
    let saved: Course | null;
    try {
      const res = editItem
        ? await api.put(`/admin/courses/${editItem.id}`, payload)
        : await api.post('/admin/courses', payload);
      saved = (res.data?.data ?? res.data ?? null) as Course | null;
    } catch (err) {
      if (!alive.current) return;
      toast.error(apiErrorMessage(err, "Kursni saqlab bo'lmadi. Qayta urinib ko'ring."));
      setSaving(false);
      return;
    }
    if (!alive.current) return;

    // Tanlangan muqova kurs saqlangach yuklanadi (yangi kursda id shu yerda paydo bo'ladi)
    if (cover && saved?.id) {
      try {
        const fd = new FormData();
        fd.append('file', cover.file);
        await api.post(`/admin/courses/${saved.id}/upload-cover`, fd);
      } catch (err) {
        if (!alive.current) return;
        toast.error(
          `Kurs saqlandi, lekin muqova rasmi yuklanmadi: ${apiErrorMessage(err, "qayta urinib ko'ring.")}`,
        );
        // Forma ochiq qoladi; endi u mavjud kursni tahrirlaydi (qayta "Saqlash" dublikat yaratmaydi)
        setEditItem(saved);
        setSaving(false);
        void load(true);
        return;
      }
      if (!alive.current) return;
    }

    toast.success(wasEdit ? 'Kurs saqlandi' : 'Kurs yaratildi');
    setSaving(false);
    setModalOpen(false);
    setPendingCover(null);
    void load(true);
  };

  const handleDelete = async (c: Course) => {
    if (deletingId !== null) return;
    const lessons = c.lessonCount ?? 0;
    const students = c.studentCount ?? 0;
    const parts = [
      lessons > 0 ? `${formatNumber(lessons)} ta dars (barcha materiallari bilan)` : null,
      students > 0 ? `${formatNumber(students)} ta o'quvchining yozilishi va o'zlashtirishi` : null,
      'davomat, sertifikatlar va kurs chatidagi xabarlar',
    ].filter(Boolean);
    const ok = await confirmDialog({
      title: "Kurs o'chirilsinmi?",
      message: `«${c.name}» kursi butunlay o'chiriladi. U bilan birga ${parts.join(', ')} ham o'chadi. Bu amalni qaytarib bo'lmaydi.`,
      confirmText: "O'chirish",
      danger: true,
    });
    if (!ok || !alive.current) return;
    setDeletingId(c.id);
    try {
      await api.delete(`/admin/courses/${c.id}`);
      if (!alive.current) return;
      setCourses((prev) => prev.filter((x) => x.id !== c.id));
      toast.success(`«${c.name}» kursi o'chirildi`);
      void load(true);
    } catch (err) {
      // Xatoni yutmaymiz — admin kurs o'chmaganini bilishi shart
      if (alive.current) toast.error(apiErrorMessage(err, "Kursni o'chirib bo'lmadi. Qayta urinib ko'ring."));
    } finally {
      if (alive.current) setDeletingId(null);
    }
  };

  // ── Drag-and-drop tartiblash (@dnd-kit, faqat shu til ichida) ──
  // Yangi tartibni order_index ga yozadi: optimistik lokal yangilanish + fonda saqlash.
  const applyReorder = (ordered: Course[]) => {
    const changed = ordered
      .map((c, i) => ({ c, pos: i + 1 }))
      .filter(({ c, pos }) => c.orderIndex !== pos);
    if (changed.length === 0) return;
    const posById = new Map(ordered.map((c, i) => [c.id, i + 1]));
    setCourses((prev) => prev.map((c) => (posById.has(c.id) ? { ...c, orderIndex: posById.get(c.id)! } : c)));
    // Faqat o'zgargan kurslar saqlanadi; UI bloklanmaydi, lekin xato yutilmaydi
    reorderChain.current = reorderChain.current.then(async () => {
      const results = await Promise.allSettled(
        changed.map(({ c, pos }) => api.put(`/admin/courses/${c.id}`, { ...c, orderIndex: pos })),
      );
      const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
      if (failed && alive.current) {
        toast.error(`Tartibni saqlab bo'lmadi: ${apiErrorMessage(failed.reason, "qayta urinib ko'ring.")}`);
        void load(true); // serverdagi haqiqiy tartib qaytariladi
      }
    });
  };

  // Shu til guruhida sudrab tashlangach tartibni qayta hisoblaydi
  const onDragEnd = (items: Course[], event: DragEndEvent) => {
    const { active, over } = event;
    if (!canReorder || !over || active.id === over.id) return;
    const from = items.findIndex((c) => c.id === active.id);
    const to = items.findIndex((c) => c.id === over.id);
    if (from < 0 || to < 0) return;
    applyReorder(arrayMove(items, from, to));
  };

  // ── O'qituvchilar ──
  const loadAssigned = async (course: Course) => {
    const id = ++teacherReq.current;
    setAssignedLoading(true);
    setAssignedError(null);
    try {
      const res = await api.get(`/admin/courses/${course.id}/teachers`);
      if (!alive.current || id !== teacherReq.current) return;
      setAssigned(unwrapList<User>(res.data).filter(Boolean));
    } catch (err) {
      if (!alive.current || id !== teacherReq.current) return;
      // Xatoda "hech kim biriktirilmagan" deb ko'rsatilmaydi — aks holda admin dublikat biriktiradi
      setAssignedError(apiErrorMessage(err, "Biriktirilgan o'qituvchilarni yuklab bo'lmadi."));
    } finally {
      if (alive.current && id === teacherReq.current) setAssignedLoading(false);
    }
  };

  const openTeachers = (course: Course) => {
    setTeacherCourse(course);
    setAssigned([]);
    setBusyTeachers([]);
    setTeacherSearch('');
    void loadAssigned(course);
  };

  const closeTeachers = () => {
    teacherReq.current++; // kechikkan javoblar e'tiborga olinmaydi
    setTeacherCourse(null);
  };

  const toggleTeacher = async (teacher: User) => {
    const course = teacherCourse;
    if (!course || busyTeachers.includes(teacher.id)) return;
    const req = teacherReq.current;
    const has = assigned.some((t) => t.id === teacher.id);
    setBusyTeachers((p) => [...p, teacher.id]);
    try {
      if (has) await api.delete(`/admin/courses/${course.id}/teachers/${teacher.id}`);
      else await api.post(`/admin/courses/${course.id}/teachers/${teacher.id}`);
      if (!alive.current || req !== teacherReq.current) return;
      setAssigned((prev) => (has ? prev.filter((t) => t.id !== teacher.id) : [...prev, teacher]));
    } catch (err) {
      if (alive.current) {
        toast.error(
          apiErrorMessage(err, has ? "O'qituvchini kursdan olib bo'lmadi." : "O'qituvchini biriktirib bo'lmadi."),
        );
      }
    } finally {
      if (alive.current) setBusyTeachers((p) => p.filter((x) => x !== teacher.id));
    }
  };

  // Ro'yxat: barcha o'qituvchilar + biriktirilgan, lekin ro'yxatda yo'qlar (masalan roli o'zgargan)
  const teacherRows = useMemo(() => {
    const extra = assigned.filter((a) => !teachers.some((t) => t.id === a.id));
    const q = teacherSearch.trim().toLowerCase();
    return [...teachers, ...extra].filter(
      (t) => !q || `${teacherName(t)} ${t.email || ''} ${t.specialization || ''}`.toLowerCase().includes(q),
    );
  }, [teachers, assigned, teacherSearch]);

  // ── Preview uchun qiymatlar ──
  const formLang = langById(form.languageId);
  // Mobil kartadagi kabi: muqova bo'lmasa kursning background rasmi ishlatiladi
  const previewCover = cover?.url || fileUrl(editItem?.coverImage) || fileUrl(editItem?.backgroundImage);
  const hasData = !loading && !loadError;
  const headerHint = filterLangName ? "Kurs nomiga bosib darslarga o'ting" : 'Barcha kurslarni boshqarish';
  const headerCount =
    filtered.length === courses.length
      ? `jami ${formatNumber(courses.length)} ta`
      : `${formatNumber(filtered.length)} / ${formatNumber(courses.length)} ta`;

  return (
    <div>
      <PageHeader
        title={filterLangName ? `${filterLangName} — kurslar` : 'Kurslar'}
        description={hasData ? `${headerHint} · ${headerCount}` : headerHint}
        back={filterLangName ? { to: '/admin/languages', label: 'Tillar' } : undefined}
        actions={
          <Button onClick={() => openCreate()} disabled={!hasData || languages.length === 0}>
            <Plus size={16} /> Yangi kurs
          </Button>
        }
      />

      {/* Til bo'yicha multiselect filter */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={15} className="text-[var(--primary)]" />
          <h2 className="text-sm font-semibold text-gray-900">Tillar bo'yicha filter</h2>
          {selectedLangs.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedLangs([])}
              className="ml-auto text-xs text-gray-400 hover:text-red-600"
            >
              Tozalash
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {loading ? (
            <>
              <Skeleton className="h-8 w-24 rounded-full" />
              <Skeleton className="h-8 w-28 rounded-full" />
              <Skeleton className="h-8 w-20 rounded-full" />
            </>
          ) : filterLangs.length === 0 ? (
            <span className="text-sm text-gray-400">Kursi bor tillar yo'q</span>
          ) : (
            filterLangs.map((l) => {
              const active = selectedLangs.includes(l.id);
              return (
                <button
                  type="button"
                  key={l.id}
                  onClick={() => toggleLang(l.id)}
                  aria-pressed={active}
                  className={
                    'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ' +
                    (active
                      ? 'bg-[var(--primary)] text-white border-transparent'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50')
                  }
                >
                  <Flag emoji={l.flagEmoji} height={14} />
                  {l.name}
                  <span className={active ? 'text-white/80' : 'text-gray-400'}>{countByLang.get(l.id) || 0}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Kurslar — @dnd-kit bilan silliq sudrab tartiblanadi (faqat til ichida) */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 gap-3 flex-wrap">
          <div className="relative w-72 max-w-full">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Kurs nomi bo'yicha qidirish..."
              aria-label="Kurslarni qidirish"
              className="w-full pl-9 pr-9 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] [&::-webkit-search-cancel-button]:hidden"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Qidiruvni tozalash"
                title="Tozalash"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <span className="text-xs text-gray-400 inline-flex items-center gap-1">
            <GripVertical size={14} />
            {canReorder ? 'Dastakdan ushlab sudrang' : 'Tartiblash uchun qidiruvni tozalang'}
          </span>
        </div>

        <div className="p-3 sm:p-4">
          {loading ? (
            <div className="space-y-2" role="status" aria-label="Yuklanmoqda">
              <Skeleton className="h-4 w-32" />
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : loadError ? (
            <ErrorState message={loadError} onRetry={() => void load()} />
          ) : courses.length === 0 ? (
            languages.length === 0 ? (
              <EmptyState
                icon={GraduationCap}
                title="Hali til qo'shilmagan"
                description="Kurs yaratish uchun avval kamida bitta til kerak."
                action={<Button variant="secondary" onClick={() => navigate('/admin/languages')}>Tillarga o'tish</Button>}
              />
            ) : (
              <EmptyState
                icon={GraduationCap}
                title="Hali kurs yo'q"
                description="Birinchi kursni yarating, so'ng unga darslar qo'shasiz."
                action={<Button onClick={() => openCreate()}><Plus size={16} /> Yangi kurs</Button>}
              />
            )
          ) : groups.length === 0 ? (
            query ? (
              <EmptyState
                icon={SearchX}
                title={`«${search.trim()}» bo'yicha kurs topilmadi`}
                description={selectedLangs.length > 0 ? 'Qidiruv faqat tanlangan tillar ichida bajarildi.' : undefined}
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button variant="secondary" onClick={() => setSearch('')}>Qidiruvni tozalash</Button>
                    {selectedLangs.length > 0 && (
                      <Button variant="secondary" onClick={() => patchParams({ q: null, languageId: null })}>
                        Barcha filtrlarni tozalash
                      </Button>
                    )}
                  </div>
                }
              />
            ) : (
              <EmptyState
                icon={GraduationCap}
                title={filterLangName ? `${filterLangName} tilida hali kurs yo'q` : "Tanlangan tillarda kurs yo'q"}
                description="Shu til uchun kurs yarating yoki filtrni tozalang."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button onClick={() => openCreate()}><Plus size={16} /> Yangi kurs</Button>
                    <Button variant="secondary" onClick={() => setSelectedLangs([])}>Filtrni tozalash</Button>
                  </div>
                }
              />
            )
          ) : (
            <div className="space-y-6">
              {groups.map((g) => (
                <div key={g.langId}>
                  {/* Til sarlavhasi */}
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <Flag emoji={g.lang?.flagEmoji} height={16} />
                    <h3 className="min-w-0 truncate text-sm font-semibold text-gray-700">{g.lang?.name || "Til ko'rsatilmagan"}</h3>
                    <span className="shrink-0 text-xs text-gray-400">({g.items.length} ta)</span>
                    {g.lang && (
                      <button
                        type="button"
                        onClick={() => openCreate(g.langId)}
                        className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary)]/10"
                      >
                        <Plus size={13} /> Kurs qo'shish
                      </button>
                    )}
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
                            sortable={canReorder}
                            deleting={deletingId === c.id}
                            onOpenLessons={() => navigate(`/admin/lessons?courseId=${c.id}`)}
                            onOpenStudents={() => navigate(`/admin/users?courseId=${c.id}&courseName=${encodeURIComponent(c.name)}`)}
                            onOpenTeachers={() => openTeachers(c)}
                            onEdit={() => openEdit(c)}
                            onDelete={() => void handleDelete(c)}
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
      <Modal
        open={modalOpen}
        onClose={closeForm}
        closeDisabled={saving}
        maxWidth="max-w-4xl"
        title={editItem ? 'Kursni tahrirlash' : 'Yangi kurs'}
      >
        <form onSubmit={handleSave} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4 min-w-0">
            <div>
              <label htmlFor="course-name" className="block text-sm font-medium text-gray-700 mb-1">
                Nomi <span className="text-red-500">*</span>
              </label>
              <input
                id="course-name"
                value={form.name}
                maxLength={TEXT_MAX}
                onChange={(e) => {
                  patchForm({ name: e.target.value });
                  if (errors.name) setErrors((p) => ({ ...p, name: undefined }));
                }}
                aria-invalid={!!errors.name}
                className={inputCls(!!errors.name)}
                placeholder="Masalan: Ingliz tili — boshlang'ich"
              />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
            </div>

            <div>
              <label htmlFor="course-lang" className="block text-sm font-medium text-gray-700 mb-1">
                Til <span className="text-red-500">*</span>
              </label>
              <select
                id="course-lang"
                value={form.languageId || ''}
                onChange={(e) => {
                  patchForm({ languageId: Number(e.target.value) });
                  if (errors.languageId) setErrors((p) => ({ ...p, languageId: undefined }));
                }}
                aria-invalid={!!errors.languageId}
                className={inputCls(!!errors.languageId) + ' bg-white'}
              >
                {!formLang && <option value="">— Tilni tanlang —</option>}
                {languages.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}{l.enabled === false ? ' (yoqilmagan)' : ''}
                  </option>
                ))}
              </select>
              {errors.languageId && <p className="mt-1 text-xs text-red-600">{errors.languageId}</p>}
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isPremium}
                  onChange={(e) => {
                    patchForm({ isPremium: e.target.checked });
                    if (errors.price) setErrors((p) => ({ ...p, price: undefined }));
                  }}
                  className="w-4 h-4 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                />
                <span className="text-sm text-gray-700">Premium (pullik) kurs</span>
              </label>
              {!form.isPremium && (
                <p className="mt-1 text-xs text-gray-400">Belgilanmasa kurs bepul bo'ladi.</p>
              )}
            </div>

            {form.isPremium && (
              <div>
                <label htmlFor="course-price" className="block text-sm font-medium text-gray-700 mb-1">
                  Narxi (so'm) <span className="text-red-500">*</span>
                </label>
                <input
                  id="course-price"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={form.price}
                  onChange={(e) => {
                    // Faqat raqamlar: manfiy, kasr va "e" kabi belgilar kiritilmaydi
                    const digits = e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, PRICE_MAX_DIGITS);
                    patchForm({ price: digits });
                    if (errors.price) setErrors((p) => ({ ...p, price: undefined }));
                  }}
                  aria-invalid={!!errors.price}
                  className={inputCls(!!errors.price)}
                  placeholder="199000"
                />
                {errors.price ? (
                  <p className="mt-1 text-xs text-red-600">{errors.price}</p>
                ) : priceNum > 0 ? (
                  <p className="text-xs text-gray-500 mt-1">Ilovada ko'rinishi: {formatMoney(priceNum)}</p>
                ) : null}
              </div>
            )}

            <div>
              <label htmlFor="course-goal" className="block text-sm font-medium text-gray-700 mb-1">Maqsad</label>
              <input
                id="course-goal"
                value={form.goal}
                maxLength={TEXT_MAX}
                onChange={(e) => patchForm({ goal: e.target.value })}
                className={inputCls()}
                placeholder="Noldan so'zlashuvgacha"
              />
              <p className="text-xs text-gray-400 mt-1">Kurs kartasida nom ostida ko'rsatiladigan qisqa tavsif.</p>
            </div>

            <div>
              <label htmlFor="course-author" className="block text-sm font-medium text-gray-700 mb-1">Muallif</label>
              <input
                id="course-author"
                value={form.author}
                maxLength={TEXT_MAX}
                onChange={(e) => patchForm({ author: e.target.value })}
                className={inputCls()}
                placeholder="Masalan: Muhammad Akbarov"
              />
              <p className="text-xs text-gray-400 mt-1">
                Dars videosida muallif sifatida ko'rsatiladi. Bo'sh qolsa kursga
                biriktirilgan ustoz ismi ishlatiladi.
              </p>
            </div>

            <div>
              <span className="block text-sm font-medium text-gray-700 mb-1">Card rasmi (muqova)</span>
              <div className="flex flex-wrap items-center gap-2">
                <label
                  className={
                    'inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-within:ring-2 focus-within:ring-[var(--primary)]/40 ' +
                    (saving ? 'pointer-events-none opacity-50' : 'cursor-pointer')
                  }
                >
                  <ImageIcon size={15} />
                  {cover || editItem?.coverImage ? 'Rasmni almashtirish' : 'Rasm tanlash'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={saving}
                    onChange={onPickCover}
                  />
                </label>
                {cover && (
                  <>
                    <span className="min-w-0 max-w-[14rem] truncate text-xs text-gray-500" title={cover.file.name}>
                      {cover.file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPendingCover(null)}
                      disabled={saving}
                      className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
                    >
                      Bekor qilish
                    </button>
                  </>
                )}
              </div>
              {errors.cover && <p className="mt-1 text-xs text-red-600">{errors.cover}</p>}
              <p className="text-xs text-gray-400 mt-2">
                16:9 nisbat (masalan 1280×720), JPG/PNG/WebP, 5 MB gacha.
                {cover ? ` Rasm «${editItem ? 'Saqlash' : 'Yaratish'}» bosilganda yuklanadi.` : ''}
                {' '}Kurs foni til (til tanlash) backgroundidan olinadi — alohida sozlanmaydi.
              </p>
            </div>
          </div>

          {/* Mobil ilovadagi kurs kartasi — jonli ko'rinish */}
          <div className="min-w-0">
            <p className="mb-2 text-sm font-medium text-gray-700">Mobil ilovada ko'rinishi</p>
            <div className="rounded-2xl bg-[#E8F5EE] p-[18px]">
              <CourseCardPreview
                name={form.name.trim() || 'Kurs nomi'}
                goal={form.goal.trim()}
                flagEmoji={formLang?.flagEmoji}
                coverUrl={previewCover}
                isPremium={form.isPremium}
                priceLabel={form.isPremium && priceNum > 0 ? formatMoney(priceNum) : null}
                lessonCount={editItem?.lessonCount ?? 0}
              />
            </div>
            <p className="mt-2 text-xs text-gray-400">
              {(editItem?.lessonCount ?? 0) > 0
                ? "Muqova bo'lmasa — til rangidagi fon va bayroq ko'rsatiladi."
                : "Kursda dars bo'lmaguncha ilovada «Tez kunda» deb ko'rinadi va ochilmaydi."}
            </p>
          </div>

          <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4 lg:col-span-2">
            <Button variant="secondary" onClick={closeForm} disabled={saving}>Bekor qilish</Button>
            <Button type="submit" loading={saving}>{editItem ? 'Saqlash' : 'Yaratish'}</Button>
          </div>
        </form>
      </Modal>

      {/* Teacher assignment modal */}
      <Modal
        open={teacherCourse !== null}
        onClose={closeTeachers}
        closeDisabled={busyTeachers.length > 0}
        title={`O'qituvchilar — ${teacherCourse?.name || ''}`}
      >
        {assignedLoading ? (
          <LoadingState className="py-10" />
        ) : assignedError ? (
          <ErrorState
            message={assignedError}
            onRetry={() => { if (teacherCourse) void loadAssigned(teacherCourse); }}
            className="py-8"
          />
        ) : teachersError && teachers.length === 0 && assigned.length === 0 ? (
          <ErrorState message={teachersError} onRetry={() => void load(true)} className="py-8" />
        ) : teachers.length === 0 && assigned.length === 0 ? (
          <EmptyState
            icon={Users}
            title="O'qituvchilar yo'q"
            description="Avval Foydalanuvchilar bo'limida o'qituvchi yarating, so'ng kursga biriktirasiz."
            action={<Link to="/admin/users" className="text-sm font-medium text-[var(--primary)] hover:underline">Foydalanuvchilarga o'tish</Link>}
            className="py-8"
          />
        ) : (
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <p className="text-xs text-gray-500">
                Biriktirilgan: <span className="font-semibold text-gray-700">{assigned.length} ta</span>. Belgilash darhol saqlanadi.
              </p>
              {teachers.length > 6 && (
                <div className="relative ml-auto w-56 max-w-full">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="search"
                    value={teacherSearch}
                    onChange={(e) => setTeacherSearch(e.target.value)}
                    placeholder="O'qituvchini qidirish..."
                    aria-label="O'qituvchini qidirish"
                    className="w-full rounded-lg border border-gray-200 py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
                  />
                </div>
              )}
            </div>
            {teachersError && (
              <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{teachersError}</p>
            )}
            <div className="space-y-1">
              {teacherRows.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">Qidiruv bo'yicha o'qituvchi topilmadi</p>
              ) : (
                teacherRows.map((t) => {
                  const busy = busyTeachers.includes(t.id);
                  return (
                    <label
                      key={t.id}
                      className={'flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 ' + (busy ? 'cursor-wait opacity-70' : 'cursor-pointer')}
                    >
                      {busy && <Loader2 size={16} className="shrink-0 animate-spin text-[var(--primary)]" />}
                      <input
                        type="checkbox"
                        checked={assigned.some((a) => a.id === t.id)}
                        disabled={busy}
                        onChange={() => void toggleTeacher(t)}
                        className={'w-4 h-4 shrink-0 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)] ' + (busy ? 'sr-only' : '')}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">{teacherName(t)}</p>
                        <p className="truncate text-xs text-gray-500">{t.specialization || t.email}</p>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ── Mobil ilovadagi kurs kartasi (course_selection_screen.dart → _CourseCard) ──
// Dizayn mobil bilan bir xil saqlanadi: 16:9 muqova, nom, maqsad, meta va tugma.
function CourseCardPreview({
  name, goal, flagEmoji, coverUrl, isPremium, priceLabel, lessonCount,
}: {
  name: string;
  goal: string;
  flagEmoji?: string;
  coverUrl?: string;
  isPremium: boolean;
  priceLabel: string | null;
  lessonCount: number;
}) {
  // Rasm yuklanmasa — fallback (qaysi URL yiqilganini eslab qolamiz, yangi rasmda qayta uriniladi)
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const showCover = !!coverUrl && brokenUrl !== coverUrl;
  const hasLessons = lessonCount > 0;

  return (
    <div
      className="mx-auto w-full max-w-[354px] overflow-hidden rounded-[20px] bg-white"
      style={{ boxShadow: '0 1px 0 rgba(31,122,85,0.04), 0 8px 24px rgba(31,122,85,0.18)' }}
    >
      <div className="relative aspect-video w-full">
        {showCover ? (
          <img src={coverUrl} alt="" onError={() => setBrokenUrl(coverUrl || null)} className="h-full w-full object-cover" />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #3DDC6A, #1B8A5C)' }}
          >
            {flagEmoji ? <Flag emoji={flagEmoji} height={44} /> : <span style={{ fontSize: 56 }}>🎓</span>}
          </div>
        )}
      </div>
      <div style={{ padding: '12px 16px 14px' }}>
        <p className="line-clamp-2 break-words" style={{ fontSize: 16.5, fontWeight: 800, color: '#0F2A20', lineHeight: 1.25 }}>
          {name}
        </p>
        {goal && (
          <p className="line-clamp-2 break-words" style={{ marginTop: 4, fontSize: 12.5, lineHeight: 1.35, color: '#6E827A' }}>
            {goal}
          </p>
        )}
        <div className="flex items-center gap-2" style={{ marginTop: 12 }}>
          <span className="min-w-0 flex-1 truncate" style={{ fontSize: 12, fontWeight: 600, color: '#6E827A' }}>
            {hasLessons ? `${lessonCount} ta dars` : ''}
          </span>
          {!hasLessons ? (
            <span
              className="inline-flex shrink-0 items-center justify-center bg-white/90"
              style={{ height: 36, minWidth: 110, padding: '0 22px', borderRadius: 30, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', fontSize: 13, fontWeight: 700, color: '#8A958F' }}
            >
              Tez kunda
            </span>
          ) : !isPremium ? (
            <span
              className="inline-flex shrink-0 items-center bg-white"
              style={{ height: 36, padding: '4px 4px 4px 15px', borderRadius: 30, boxShadow: '0 2px 9px rgba(0,0,0,0.10)', fontSize: 13, fontWeight: 700, color: '#1B8A5C', gap: 8 }}
            >
              Kursga o'tish
              <span className="inline-flex items-center justify-center rounded-full" style={{ width: 28, height: 28, background: '#1B8A5C' }}>
                <ArrowRight size={15} color="#fff" />
              </span>
            </span>
          ) : (
            <span
              className="inline-flex shrink-0 items-center"
              style={{ height: 36, padding: '0 16px', borderRadius: 24, background: '#FFC939', fontSize: 13, fontWeight: 800, color: '#E5A800', gap: 6 }}
            >
              <Lock size={14} />
              {priceLabel || 'Sotib olish'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sudraladigan kurs qatori (@dnd-kit) ──────────────────────────────────────
function SortableCourseRow({
  course,
  position,
  flagEmoji,
  sortable,
  deleting,
  onOpenLessons,
  onOpenStudents,
  onOpenTeachers,
  onEdit,
  onDelete,
}: {
  course: Course;
  position: number;
  flagEmoji?: string;
  sortable: boolean;
  deleting: boolean;
  onOpenLessons: () => void;
  onOpenStudents: () => void;
  onOpenTeachers: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: course.id,
    disabled: !sortable,
  });
  // Qaysi URL yuklanmaganini eslab qolamiz — muqova almashtirilsa yangi rasm qayta sinab ko'riladi
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
  };
  const coverSrc = fileUrl(course.coverImage);
  const hasPrice = !!course.price && course.price > 0;
  const chipBtn =
    'rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] transition-colors whitespace-nowrap';

  // Bir xil belgilar: keng ekranda o'ngda, tor ekranda nom ostida
  const chips = (
    <>
      {!course.isPremium ? (
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Bepul</span>
      ) : hasPrice ? (
        <span className="whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
          {course.priceLabel || formatMoney(course.price)}
        </span>
      ) : (
        <span
          className="whitespace-nowrap rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
          title="Premium kurs, lekin narx kiritilmagan — tahrirlab narxni kiriting"
        >
          Narx kiritilmagan
        </span>
      )}
      <button type="button" onClick={onOpenLessons} className={chipBtn} title="Darslarni ko'rish">
        {formatNumber(course.lessonCount)} dars
      </button>
      <button type="button" onClick={onOpenStudents} className={chipBtn} title="Yozilgan o'quvchilar">
        {formatNumber(course.studentCount)} o'quvchi
      </button>
    </>
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={
        'flex items-center gap-2 sm:gap-3 rounded-xl border bg-white px-2.5 sm:px-3 py-2.5 ' +
        (deleting ? 'opacity-50 ' : '') +
        (isDragging
          ? 'border-[var(--primary)]/40 shadow-lg ring-2 ring-[var(--primary)]/20'
          : 'border-gray-200 hover:shadow-sm transition-shadow')
      }
    >
      {/* Sudrash dastagi — faqat shu yerdan drag boshlanadi */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={!sortable}
        className={
          'shrink-0 touch-none ' +
          (sortable ? 'cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500' : 'cursor-not-allowed text-gray-200')
        }
        title={sortable ? 'Sudrab tartiblang' : 'Tartiblash uchun qidiruvni tozalang'}
        aria-label={`«${course.name}» kursini tartiblash`}
      >
        <GripVertical size={18} />
      </button>
      <span className="w-5 shrink-0 text-center text-xs font-semibold text-gray-400">{position}</span>
      {/* Muqova (16:9) — qaysi kursda rasm yo'qligi darhol ko'rinadi */}
      <div className="hidden h-9 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gray-100 sm:flex">
        {coverSrc && brokenSrc !== coverSrc ? (
          <img src={coverSrc} alt="" loading="lazy" onError={() => setBrokenSrc(coverSrc)} className="h-full w-full object-cover" />
        ) : (
          <span title="Muqova rasmi yo'q" className="text-gray-300"><ImageOff size={15} /></span>
        )}
      </div>
      <Flag emoji={flagEmoji} height={20} />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onOpenLessons}
          className="block max-w-full truncate text-left text-sm font-medium text-gray-900 hover:text-[var(--primary)] hover:underline"
          title={`${course.name} — darslarga o'tish`}
        >
          {course.name}
        </button>
        {course.goal && <p className="truncate text-xs text-gray-500" title={course.goal}>{course.goal}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-1.5 md:hidden">{chips}</div>
      </div>
      <div className="hidden items-center gap-2 md:flex">{chips}</div>
      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        <button type="button" onClick={onOpenLessons} className="hidden rounded-lg p-1.5 text-gray-400 hover:bg-green-50 hover:text-green-600 sm:block" title="Darslar" aria-label="Darslar"><BookOpen size={14} /></button>
        <button type="button" onClick={onOpenTeachers} className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600" title="O'qituvchilar" aria-label="O'qituvchilar"><Users size={14} /></button>
        <button type="button" onClick={onEdit} disabled={deleting} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50" title="Tahrirlash" aria-label="Tahrirlash"><Pencil size={14} /></button>
        <button type="button" onClick={onDelete} disabled={deleting} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50" title="O'chirish" aria-label="O'chirish">
          {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </button>
      </div>
    </div>
  );
}
