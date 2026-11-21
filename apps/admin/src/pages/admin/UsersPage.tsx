import { useEffect, useId, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useRememberedSearch } from '../../hooks/useRememberedSearch';
import { Plus, Pencil, Trash2, X, GraduationCap, RefreshCw, Eye, EyeOff, Lock } from 'lucide-react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import PageHeader from '../../components/ui/PageHeader';
import api from '../../lib/api';
import { apiErrorMessage } from '../../lib/errors';
import { formatDate, formatDateTime, formatNumber, parseServerDate } from '../../lib/format';
import { toast, confirmDialog } from '../../stores/ui-store';
import { useAuthStore } from '../../stores/auth-store';
import type { User, Language, Course } from '../../lib/types';

/** URL'da eslab qolinadigan parametrlar (yon menyudan qaytganda tiklanadi) */
const USERS_PARAMS = ['courseId', 'courseName', 'role'] as const;

/** Bir sahifadagi qatorlar soni (sahifalash brauzerda bajariladi) */
const PAGE_SIZE = 20;

/** Backend BaseUser'ni to'g'ridan-to'g'ri qaytaradi — maydonlar null bo'lishi mumkin */
interface UserRow extends Omit<User, 'firstName' | 'lastName' | 'email' | 'phone' | 'specialization' | 'createdAt'> {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  specialization?: string | null;
  createdAt?: string | null;
  lastActiveAt?: string | null;
  isGuest?: boolean | null;
  isDefault?: boolean | null;
}

type RoleTab = '' | 'STUDENT' | 'TEACHER' | 'ADMIN';

const ROLE_TABS: { value: RoleTab; label: string }[] = [
  { value: '', label: 'Barchasi' },
  { value: 'STUDENT', label: "O'quvchilar" },
  { value: 'TEACHER', label: "O'qituvchilar" },
  { value: 'ADMIN', label: 'Adminlar' },
];

const ROLE_LABELS: Record<string, string> = {
  STUDENT: "O'quvchi",
  TEACHER: "O'qituvchi",
  ADMIN: 'Admin',
  HEAD_ADMIN: 'Bosh admin',
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-700',
  HEAD_ADMIN: 'bg-purple-100 text-purple-700',
  TEACHER: 'bg-blue-100 text-blue-700',
  STUDENT: 'bg-green-100 text-green-700',
};

const isAdminRole = (role?: string | null) => role === 'ADMIN' || role === 'HEAD_ADMIN';

/** Rol tabiga mosligi ("Adminlar" tabi bosh adminni ham o'z ichiga oladi) */
const matchesRole = (u: UserRow, tab: RoleTab) =>
  !tab || (tab === 'ADMIN' ? isAdminRole(u.role) : u.role === tab);

const fullName = (u: UserRow) =>
  [u.firstName, u.lastName].map((s) => (s ?? '').trim()).filter(Boolean).join(' ')
  || u.email || u.phone || `Foydalanuvchi #${u.id}`;

const initials = (u: UserRow) =>
  (((u.firstName ?? '').trim()[0] ?? '') + ((u.lastName ?? '').trim()[0] ?? '')
    || (u.email ?? '').trim()[0] || '?').toUpperCase();

/**
 * Backend'dagi PhoneNumberUtil bilan bir xil qoida: 9 xonali yoki 998 bilan boshlanuvchi 12 xonali raqam.
 * '' — bo'sh (telefon ixtiyoriy), null — format noto'g'ri, aks holda "+998XXXXXXXXX".
 */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const full = digits.length === 9 ? `998${digits}` : digits;
  return full.length === 12 && full.startsWith('998') ? `+${full}` : null;
}

/** +998901234567 → +998 90 123 45 67 (boshqa formatdagi eski qiymat o'zgarishsiz qoladi) */
function prettyPhone(phone?: string | null): string {
  if (!phone) return '—';
  const m = /^\+?998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(phone.replace(/[\s()-]/g, ''));
  return m ? `+998 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 6;

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  password: string;
  specialization: string;
}
type FormErrors = Partial<Record<keyof FormState, string>>;

const EMPTY_FORM: FormState = { firstName: '', lastName: '', email: '', phone: '', role: 'STUDENT', password: '', specialization: '' };

const INPUT_CLS =
  'w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]';
const inputCls = (error?: string) => `${INPUT_CLS} ${error ? 'border-red-300' : 'border-gray-200'}`;

function Field({ id, label, required, error, hint, children }: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500" aria-hidden="true">*</span>}
      </label>
      {children}
      {error
        ? <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>
        : hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}

type MetaStatus = 'loading' | 'ok' | 'error';
interface LoadResult { courseId: number; users: UserRow[]; error: string | null }

export default function UsersPage() {
  const uid = useId();
  const selfId = useAuthStore((s) => s.user?.id);

  // Ro'yxat qaysi kurs filtri uchun yuklanganini ham saqlaymiz — filtr almashganda eski ro'yxat ko'rinib qolmaydi
  const [result, setResult] = useState<LoadResult | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [metaState, setMetaState] = useState<{ langs: MetaStatus; courses: MetaStatus }>({ langs: 'loading', courses: 'loading' });
  const [metaTick, setMetaTick] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Filtrlar URL'da: kurs (Kurslar sahifasidan "N o'quvchi" bosilganda yoki shu yerdagi dropdown'dan)
  // va rol (?role=STUDENT|TEACHER|ADMIN — masalan Dashboard'dagi kartalardan)
  const [searchParams, setSearchParams] = useSearchParams();
  useRememberedSearch(USERS_PARAMS);
  const courseId = Math.max(0, Math.trunc(Number(searchParams.get('courseId')) || 0));
  const roleParam = (searchParams.get('role') || '').toUpperCase();
  const roleTab: RoleTab = roleParam === 'STUDENT' || roleParam === 'TEACHER' || roleParam === 'ADMIN' ? roleParam : '';
  // Kurs nomi: avval yuklangan kurslardan (URL'dagi nom eskirgan bo'lishi mumkin), keyin URL'dan
  const courseName = courses.find((c) => c.id === courseId)?.name || searchParams.get('courseName') || '';

  const loading = !result || result.courseId !== courseId;
  const loadError = loading ? null : (result?.error ?? null);

  useEffect(() => {
    let active = true;
    api.get('/admin/users', courseId ? { params: { courseId } } : undefined)
      .then((res) => {
        if (!active) return;
        const list = res.data?.data ?? res.data;
        setResult({ courseId, users: Array.isArray(list) ? list : [], error: null });
      })
      .catch((err) => {
        if (!active) return;
        setResult({ courseId, users: [], error: apiErrorMessage(err, "Foydalanuvchilarni yuklab bo'lmadi.") });
      });
    return () => {
      active = false;
    };
  }, [courseId, reloadTick]);

  useEffect(() => {
    let active = true;
    api.get('/admin/languages')
      .then((r) => {
        if (!active) return;
        const list = r.data?.data ?? r.data;
        setLanguages(Array.isArray(list) ? list : []);
        setMetaState((s) => ({ ...s, langs: 'ok' }));
      })
      .catch(() => { if (active) setMetaState((s) => ({ ...s, langs: 'error' })); });
    api.get('/admin/courses')
      .then((r) => {
        if (!active) return;
        const list = r.data?.data ?? r.data;
        setCourses(Array.isArray(list) ? list : []);
        setMetaState((s) => ({ ...s, courses: 'ok' }));
      })
      .catch(() => { if (active) setMetaState((s) => ({ ...s, courses: 'error' })); });
    return () => {
      active = false;
    };
  }, [metaTick]);

  /** Jadvalni skelet bilan qayta yuklash ("Yangilash" va xatodan keyingi "Qayta urinish") */
  const reload = () => {
    setResult(null);
    setReloadTick((t) => t + 1);
  };
  /** Saqlash/o'chirishdan keyin — ro'yxat miltillamasdan yangilanadi */
  const refreshSilently = () => setReloadTick((t) => t + 1);

  const retryMeta = () => {
    setMetaState({ langs: 'loading', courses: 'loading' });
    setMetaTick((t) => t + 1);
  };

  // URL parametrlarini boshqalarini saqlagan holda yangilash
  const updateParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v); else next.delete(k);
    }
    setSearchParams(next);
    setPage(1);
  };

  // Kursni tanlash → URL yangilanadi → ro'yxat qayta yuklanadi (rol tabi saqlanib qoladi)
  const selectCourse = (id: number) => {
    if (!id) { updateParams({ courseId: null, courseName: null }); return; }
    const c = courses.find((x) => x.id === id);
    updateParams({ courseId: String(id), courseName: c?.name ?? null });
  };

  // Dropdown uchun kurslarni til bo'yicha guruhlaymiz
  const courseGroups = languages
    .map((l) => ({ lang: l, items: courses.filter((c) => c.languageId === l.id).sort((a, b) => a.name.localeCompare(b.name)) }))
    .filter((g) => g.items.length > 0);
  const ungroupedCourses = courses.filter((c) => !languages.some((l) => l.id === c.languageId));
  const courseInOptions = courseId === 0 || courses.some((c) => c.id === courseId);

  // Tizimning umumiy "Mehmon" akkaunti ro'yxatda ko'rsatilmaydi: u o'chirilsa yoki tahrirlansa
  // mobil ilovada mehmon rejimi buziladi. Yangilari tepada (backend tartib bermaydi).
  const users = useMemo(() => {
    const list = (result?.users ?? []).filter((u) => !u.isGuest);
    const time = (u: UserRow) => parseServerDate(u.createdAt)?.getTime() ?? 0;
    return list.sort((a, b) => time(b) - time(a) || b.id - a.id);
  }, [result]);

  const roleCounts: Record<RoleTab, number> = {
    '': users.length,
    STUDENT: users.filter((u) => matchesRole(u, 'STUDENT')).length,
    TEACHER: users.filter((u) => matchesRole(u, 'TEACHER')).length,
    ADMIN: users.filter((u) => matchesRole(u, 'ADMIN')).length,
  };

  // Qidiruv: har bir so'z ism/familiya/email/telefonning istalgan joyida uchrashi kerak
  const filtered = useMemo(() => {
    const words = search.toLowerCase().split(/\s+/).filter(Boolean);
    return users.filter((u) => {
      if (!matchesRole(u, roleTab)) return false;
      if (words.length === 0) return true;
      const phoneDigits = (u.phone ?? '').replace(/\D/g, '');
      const hay = [u.firstName, u.lastName, u.email, u.phone].map((s) => (s ?? '').toLowerCase()).join(' ');
      return words.every((w) => {
        if (hay.includes(w)) return true;
        // "90-123" yoki "+99890" kabi yozilgan telefon bo'lagi
        const wDigits = w.replace(/\D/g, '');
        return /^[\d+()-]+$/.test(w) && wDigits.length > 0 && phoneDigits.includes(wDigits);
      });
    });
  }, [users, roleTab, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Mutaxassislik = bir nechta til (vergul bilan ajratilgan nomlar holida saqlanadi)
  const specLangs = form.specialization
    ? form.specialization.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  // Tillar ro'yxatida yo'q eski qiymatlar ham ko'rinsin (aks holda ular bildirmasdan saqlanib qolaverardi)
  const legacySpecs = metaState.langs === 'ok' ? specLangs.filter((s) => !languages.some((l) => l.name === s)) : [];
  const toggleSpecLang = (name: string) => {
    const set = new Set(specLangs);
    if (set.has(name)) set.delete(name); else set.add(name);
    setForm((f) => ({ ...f, specialization: Array.from(set).join(', ') }));
    setErrors((e) => (e.specialization ? { ...e, specialization: undefined } : e));
  };

  const setField = (key: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  const openCreate = () => {
    setEditUser(null);
    // Ochiq tabga mos rol bilan boshlaymiz ("O'qituvchilar" tabida — o'qituvchi)
    setForm({ ...EMPTY_FORM, role: roleTab || 'STUDENT' });
    setErrors({});
    setShowPassword(false);
    setModalOpen(true);
  };

  const openEdit = (user: UserRow) => {
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
    setErrors({});
    setShowPassword(false);
    setModalOpen(true);
  };

  const closeModal = () => { if (!saving) setModalOpen(false); };

  const validate = (): { errors: FormErrors; phone: string } => {
    const e: FormErrors = {};
    const email = form.email.trim();
    const phone = normalizePhone(form.phone);
    // Yuklangan ro'yxat bo'yicha oldindan tekshiruv (to'liq kafolat emas — yakuniy so'z backendda)
    const others = (result?.users ?? []).filter((u) => u.id !== editUser?.id);

    if (!form.firstName.trim()) e.firstName = 'Ismni kiriting';

    // Email — kirish uchun asosiy ma'lumot. Faqat emailsiz eski akkauntni tahrirlashda bo'sh qoldirish mumkin.
    if (!email) {
      if (!editUser || editUser.email) e.email = 'Emailni kiriting';
    } else if (!EMAIL_RE.test(email)) {
      e.email = "Email noto'g'ri formatda";
    } else if (others.some((u) => (u.email ?? '').toLowerCase() === email.toLowerCase())) {
      e.email = 'Bu email boshqa foydalanuvchida band';
    }

    if (phone === null) {
      e.phone = "Telefon raqam noto'g'ri. Namuna: +998 90 123 45 67";
    } else if (phone && others.some((u) => normalizePhone(u.phone ?? '') === phone)) {
      e.phone = 'Bu telefon raqam boshqa foydalanuvchida band';
    }

    // Yaratishda parol majburiy; tahrirlashda faqat kiritilgan bo'lsa almashtiriladi
    if (!editUser && !form.password) e.password = 'Parolni kiriting';
    else if (form.password && form.password.length < MIN_PASSWORD) e.password = `Parol kamida ${MIN_PASSWORD} ta belgidan iborat bo'lsin`;
    // users.specialization — VARCHAR(255)
    if (form.role === 'TEACHER' && specLangs.join(', ').length > 255) e.specialization = "Juda ko'p til tanlandi";
    return { errors: e, phone: phone ?? '' };
  };

  const handleSave = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (saving) return;
    const { errors: found, phone } = validate();
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    // Backend Map<String,String> kutadi. Bo'sh email '' emas, null bo'lib ketadi —
    // aks holda users.email UNIQUE cheklovi ikkinchi bo'sh emailda xato beradi.
    const base: Record<string, string | null> = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim() || null,
      phone,
      role: form.role,
      specialization: form.role === 'TEACHER' ? specLangs.join(', ') : '',
    };

    setSaving(true);
    try {
      if (editUser) {
        // Parol faqat kiritilgan bo'lsa yuboriladi — bo'sh bo'lsa server eskisini qoldiradi
        await api.put(`/admin/users/${editUser.id}`, form.password ? { ...base, password: form.password } : base);
        toast.success(form.password ? "O'zgarishlar saqlandi, parol almashtirildi" : "O'zgarishlar saqlandi");
      } else {
        await api.post('/admin/users', { ...base, password: form.password });
        toast.success("Foydalanuvchi qo'shildi");
      }
      setModalOpen(false);
      refreshSilently();
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status && status >= 500) {
        // Backend bu holatlarda sababni yubormaydi (umumiy 500) — eng ehtimoliy sabablarni aytamiz
        const adminInvolved = isAdminRole(form.role) || isAdminRole(editUser?.role);
        toast.error(adminInvolved
          ? "Saqlab bo'lmadi. Adminlarni faqat bosh admin qo'sha yoki tahrirlay oladi. Yoki bu email/telefon boshqa foydalanuvchida band."
          : "Saqlab bo'lmadi. Bu email yoki telefon raqam boshqa foydalanuvchida band bo'lishi mumkin.");
      } else {
        toast.error(apiErrorMessage(err, "Saqlab bo'lmadi. Qayta urinib ko'ring."));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user: UserRow) => {
    if (deletingId !== null) return;
    const ok = await confirmDialog({
      title: "Foydalanuvchini o'chirish",
      message: `"${fullName(user)}" (${ROLE_LABELS[user.role] ?? user.role}) o'chirilsinmi? Uning kurslardagi natijalari, ballari va yozishmalari ham butunlay o'chadi. Bu amalni qaytarib bo'lmaydi.`,
      confirmText: "O'chirish",
      danger: true,
    });
    if (!ok) return;
    setDeletingId(user.id);
    try {
      await api.delete(`/admin/users/${user.id}`);
      toast.success("Foydalanuvchi o'chirildi");
      refreshSilently();
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      toast.error(status && status >= 500 && isAdminRole(user.role)
        ? "O'chirib bo'lmadi. Adminlarni faqat bosh admin o'chira oladi."
        : apiErrorMessage(err, "O'chirib bo'lmadi. Qayta urinib ko'ring."));
    } finally {
      setDeletingId(null);
    }
  };

  const emptyTitle = roleTab
    ? `${ROLE_TABS.find((t) => t.value === roleTab)?.label} topilmadi`
    : courseId > 0 ? 'Bu kursga hali hech kim yozilmagan' : "Hali foydalanuvchi yo'q";
  const emptyDescription = courseId > 0
    ? "Kursga yozilgan foydalanuvchilar shu yerda ko'rinadi. Boshqa kursni tanlang yoki filtrni olib tashlang."
    : roleTab
      ? "Bu rolda hali hech kim yo'q. Yangi foydalanuvchi qo'shishingiz mumkin."
      : "Birinchi foydalanuvchini qo'shing — yoki ular mobil ilovada ro'yxatdan o'tgach shu yerda paydo bo'ladi.";

  return (
    <div>
      <PageHeader
        title={courseId > 0 ? `${courseName || 'Kurs'} — o'quvchilar` : 'Foydalanuvchilar'}
        description={courseId > 0 ? "Ushbu kursga yozilgan o'quvchilar" : 'Barcha foydalanuvchilarni boshqarish'}
        back={courseId > 0 ? { to: '/admin/courses', label: 'Kurslar' } : undefined}
        actions={
          <>
            <Button variant="secondary" onClick={reload} disabled={loading} title="Ro'yxatni yangilash">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Yangilash
            </Button>
            <Button onClick={openCreate}><Plus size={16} /> Yangi qo'shish</Button>
          </>
        }
      />

      {/* Rol bo'yicha tablar */}
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Rol bo'yicha filtr">
        {ROLE_TABS.map((t) => {
          const active = roleTab === t.value;
          return (
            <button
              key={t.value || 'ALL'}
              type="button"
              aria-pressed={active}
              onClick={() => updateParams({ role: t.value || null })}
              className={
                'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ' +
                (active
                  ? 'bg-[var(--primary)] text-white border-transparent'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50')
              }
            >
              {t.label}
              {!loading && !loadError && (
                <span className={`rounded-full px-1.5 text-xs ${active ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>
                  {formatNumber(roleCounts[t.value])}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Kurs bo'yicha filter — dropdown */}
      <div className="mb-4 flex items-center gap-x-3 gap-y-2 flex-wrap">
        <label htmlFor={`${uid}-course`} className="inline-flex items-center gap-2 text-sm text-gray-600">
          <GraduationCap size={16} className="text-[var(--primary)]" />
          Kurs bo'yicha:
        </label>
        <select
          id={`${uid}-course`}
          value={courseId}
          onChange={(e) => selectCourse(Number(e.target.value))}
          className="w-full sm:w-auto sm:min-w-52 max-w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
        >
          <option value={0}>Barcha foydalanuvchilar</option>
          {/* URL'dagi kurs ro'yxatda bo'lmasa (hali yuklanmagan yoki o'chirilgan) — tanlov bo'sh ko'rinmasin */}
          {!courseInOptions && <option value={courseId}>{courseName || `Kurs #${courseId}`}</option>}
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
        {metaState.courses === 'error' && (
          <span className="text-sm text-red-600">
            Kurslar ro'yxati yuklanmadi.{' '}
            <button type="button" onClick={retryMeta} className="underline hover:no-underline">Qayta urinish</button>
          </span>
        )}
        {courseId > 0 && (
          <>
            {!loading && !loadError && (
              <span className="text-sm text-gray-500">{formatNumber(users.length)} kishi yozilgan</span>
            )}
            <button
              type="button"
              onClick={() => selectCourse(0)}
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-50"
              title="Filtrni olib tashlash"
            >
              <X size={14} /> Tozalash
            </button>
          </>
        )}
      </div>

      <DataTable<UserRow>
        columns={[
          { key: 'name', label: 'Ism', render: (u) => (
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 shrink-0 rounded-full bg-[var(--primary)] flex items-center justify-center">
                <span className="text-white text-xs font-bold">{initials(u)}</span>
              </div>
              <div className="min-w-0 max-w-[16rem]">
                <p className="font-medium text-gray-900 truncate" title={fullName(u)}>
                  {fullName(u)}
                  {u.id === selfId && <span className="ml-1.5 text-xs font-normal text-gray-400">(siz)</span>}
                </p>
                {u.email && <p className="text-xs text-gray-500 truncate" title={u.email}>{u.email}</p>}
              </div>
            </div>
          )},
          { key: 'phone', label: 'Telefon', render: (u) => <span className="whitespace-nowrap">{prettyPhone(u.phone)}</span> },
          { key: 'role', label: 'Rol', render: (u) => (
            <div className="max-w-[14rem]">
              <span className={`inline-block whitespace-nowrap text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600'}`}>
                {u.isDefault && u.role === 'ADMIN' ? 'Bosh admin' : ROLE_LABELS[u.role] ?? u.role ?? '—'}
              </span>
              {u.role === 'TEACHER' && u.specialization && (
                <p className="mt-0.5 text-xs text-gray-500 truncate" title={u.specialization}>{u.specialization}</p>
              )}
            </div>
          )},
          { key: 'ball', label: 'Ball', render: (u) => formatNumber(u.ball) },
          { key: 'lastActiveAt', label: 'Oxirgi faollik', render: (u) => (
            <span className="whitespace-nowrap">{formatDate(u.lastActiveAt)}</span>
          )},
          { key: 'createdAt', label: "Qo'shilgan", render: (u) => (
            <span className="whitespace-nowrap" title={u.createdAt ? formatDateTime(u.createdAt) : undefined}>{formatDate(u.createdAt)}</span>
          )},
        ]}
        data={pageRows}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Ism, email yoki telefon bo'yicha qidirish..."
        loading={loading}
        error={loadError}
        onRetry={reload}
        page={safePage}
        totalPages={totalPages}
        onPageChange={setPage}
        headerRight={!loading && !loadError ? (
          <span className="text-sm text-gray-500">
            {filtered.length === users.length
              ? `Jami: ${formatNumber(users.length)} ta`
              : `${formatNumber(filtered.length)} / ${formatNumber(users.length)} ta`}
          </span>
        ) : undefined}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        emptyAction={courseId > 0
          ? <Button variant="secondary" size="sm" onClick={() => selectCourse(0)}><X size={14} /> Filtrni olib tashlash</Button>
          : <Button size="sm" onClick={openCreate}><Plus size={14} /> Yangi qo'shish</Button>}
        actions={(u) => (
          u.id === selfId ? (
            // Backend o'z akkauntini tahrirlash/o'chirishga ruxsat bermaydi
            <span className="p-1.5 text-gray-300" title="O'z akkauntingizni bu yerdan o'zgartirib bo'lmaydi">
              <Lock size={14} />
            </span>
          ) : (
            <>
              <button
                type="button"
                onClick={() => openEdit(u)}
                disabled={deletingId === u.id}
                aria-label={`Tahrirlash: ${fullName(u)}`}
                title="Tahrirlash"
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-40"
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(u)}
                disabled={deletingId !== null}
                aria-label={`O'chirish: ${fullName(u)}`}
                title="O'chirish"
                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deletingId === u.id
                  ? <RefreshCw size={14} className="animate-spin" />
                  : <Trash2 size={14} />}
              </button>
            </>
          )
        )}
      />

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={closeModal}
        closeDisabled={saving}
        title={editUser ? 'Foydalanuvchini tahrirlash' : 'Yangi foydalanuvchi'}
      >
        <form onSubmit={handleSave} noValidate className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field id={`${uid}-first`} label="Ism" required error={errors.firstName}>
              <input
                id={`${uid}-first`}
                value={form.firstName}
                onChange={(e) => setField('firstName', e.target.value)}
                maxLength={255}
                autoComplete="off"
                aria-invalid={!!errors.firstName}
                className={inputCls(errors.firstName)}
              />
            </Field>
            <Field id={`${uid}-last`} label="Familiya" error={errors.lastName}>
              <input
                id={`${uid}-last`}
                value={form.lastName}
                onChange={(e) => setField('lastName', e.target.value)}
                maxLength={255}
                autoComplete="off"
                className={inputCls(errors.lastName)}
              />
            </Field>
          </div>
          <Field
            id={`${uid}-email`}
            label="Email"
            required={!editUser || !!editUser.email}
            error={errors.email}
            hint="Foydalanuvchi ilovaga shu email orqali kiradi."
          >
            <input
              id={`${uid}-email`}
              type="email"
              value={form.email}
              onChange={(e) => setField('email', e.target.value)}
              maxLength={255}
              autoComplete="off"
              placeholder="ism@example.com"
              aria-invalid={!!errors.email}
              className={inputCls(errors.email)}
            />
          </Field>
          <Field id={`${uid}-phone`} label="Telefon" error={errors.phone} hint="Ixtiyoriy. O'zbekiston raqami: +998 va 9 ta raqam.">
            <input
              id={`${uid}-phone`}
              type="tel"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
              maxLength={25}
              autoComplete="off"
              placeholder="+998 90 123 45 67"
              aria-invalid={!!errors.phone}
              className={inputCls(errors.phone)}
            />
          </Field>
          <Field
            id={`${uid}-role`}
            label="Rol"
            required
            hint={isAdminRole(form.role)
              ? "Admin boshqaruv paneliga to'liq kira oladi. Adminlarni faqat bosh admin qo'sha yoki tahrirlay oladi."
              : undefined}
          >
            <select
              id={`${uid}-role`}
              value={form.role}
              onChange={(e) => setField('role', e.target.value)}
              className={`${inputCls()} bg-white`}
            >
              <option value="STUDENT">O'quvchi</option>
              <option value="TEACHER">O'qituvchi</option>
              <option value="ADMIN">Admin</option>
              {/* Eski yozuvlarda uchrashi mumkin — tanlov noto'g'ri ko'rinmasligi uchun */}
              {form.role === 'HEAD_ADMIN' && <option value="HEAD_ADMIN">Bosh admin</option>}
            </select>
          </Field>
          {form.role === 'TEACHER' && (
            <div>
              <p className="block text-sm font-medium text-gray-700 mb-1">
                Mutaxassisligi (tillar) <span className="font-normal text-gray-400">— bir nechtasini tanlash mumkin</span>
              </p>
              <div className="flex flex-wrap gap-2 p-2 border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                {metaState.langs === 'loading' ? (
                  <span className="text-sm text-gray-400">Tillar yuklanmoqda…</span>
                ) : metaState.langs === 'error' ? (
                  <span className="text-sm text-red-600">
                    Tillar ro'yxatini yuklab bo'lmadi.{' '}
                    <button type="button" onClick={retryMeta} className="underline hover:no-underline">Qayta urinish</button>
                  </span>
                ) : languages.length === 0 && legacySpecs.length === 0 ? (
                  <span className="text-sm text-gray-400">Tillar topilmadi</span>
                ) : (
                  <>
                    {languages.map((l) => {
                      const active = specLangs.includes(l.name);
                      return (
                        <button
                          key={l.id}
                          type="button"
                          aria-pressed={active}
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
                    })}
                    {legacySpecs.map((name) => (
                      <button
                        key={`legacy-${name}`}
                        type="button"
                        aria-pressed
                        onClick={() => toggleSpecLang(name)}
                        title="Tillar ro'yxatida yo'q qiymat — olib tashlash uchun bosing"
                        className="inline-flex items-center gap-1.5 rounded-full border border-transparent bg-gray-600 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
                      >
                        {name} <X size={12} />
                      </button>
                    ))}
                  </>
                )}
              </div>
              {errors.specialization
                ? <p role="alert" className="mt-1 text-xs text-red-600">{errors.specialization}</p>
                : specLangs.length > 0 && <p className="text-xs text-gray-500 mt-1">Tanlangan: {specLangs.join(', ')}</p>}
            </div>
          )}
          <Field
            id={`${uid}-password`}
            label={editUser ? 'Yangi parol (ixtiyoriy)' : 'Parol'}
            required={!editUser}
            error={errors.password}
            hint={editUser
              ? `Bo'sh qoldirilsa parol o'zgarmaydi. Kamida ${MIN_PASSWORD} ta belgi.`
              : `Kamida ${MIN_PASSWORD} ta belgi.`}
          >
            <div className="relative">
              <input
                id={`${uid}-password`}
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setField('password', e.target.value)}
                maxLength={72}
                autoComplete="new-password"
                aria-invalid={!!errors.password}
                className={`${inputCls(errors.password)} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Parolni yashirish' : "Parolni ko'rsatish"}
                title={showPassword ? 'Parolni yashirish' : "Parolni ko'rsatish"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={closeModal} disabled={saving}>Bekor qilish</Button>
            <Button type="submit" loading={saving}>{editUser ? 'Saqlash' : 'Yaratish'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
