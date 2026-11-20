import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Send, Users as UsersIcon, GraduationCap, UserCheck, BookOpen, UserPlus,
  Bell, ImagePlus, X, AlertTriangle, Search, Loader2, History,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import PageHeader from '../../components/ui/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import api, { fileUrl } from '../../lib/api';
import { apiErrorMessage } from '../../lib/errors';
import { formatDateTime, formatNumber } from '../../lib/format';
import { confirmDialog, toast } from '../../stores/ui-store';
import type { Course, Language, User } from '../../lib/types';

type Target = 'ALL' | 'STUDENTS' | 'TEACHERS' | 'COURSE' | 'USERS';

/** /admin/users javobida isGuest ham keladi (types.ts'dagi User'da yo'q). */
type PickUser = User & { isGuest?: boolean | null };

const TARGETS: { key: Target; label: string; icon: typeof UsersIcon; desc: string }[] = [
  { key: 'ALL', label: 'Barchaga', icon: UsersIcon, desc: "O'quvchi va o'qituvchilar" },
  { key: 'STUDENTS', label: "O'quvchilar", icon: GraduationCap, desc: "Barcha o'quvchilar" },
  { key: 'TEACHERS', label: "O'qituvchilar", icon: UserCheck, desc: "Barcha o'qituvchilar" },
  { key: 'COURSE', label: 'Kurs', icon: BookOpen, desc: "Kurs o'quvchilari" },
  { key: 'USERS', label: 'Tanlab', icon: UserPlus, desc: 'Foydalanuvchilarni tanlash' },
];

const ROLE_LABEL: Record<string, string> = {
  STUDENT: "O'quvchi",
  TEACHER: "O'qituvchi",
  ADMIN: 'Admin',
  HEAD_ADMIN: 'Bosh admin',
};

// notifications.title VARCHAR(500) — lekin telefon push sarlavhasi baribir qisqartiriladi.
const TITLE_MAX = 150;
// Push (FCM) xabarining umumiy hajmi 4 KB bilan cheklangan — kirill harflari 2 baytdan.
const BODY_MAX = 1000;
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// Tanlash ro'yxatida bir vaqtda chiziladigan qatorlar soni (minglab foydalanuvchida qotmasligi uchun)
const USER_ROWS_LIMIT = 200;

interface SentItem {
  id: number;
  title: string;
  audience: string;
  sent: number;
  at: string;
}

const unwrapList = <T,>(res: { data?: { data?: unknown } | unknown }): T[] => {
  const raw = res.data as { data?: unknown } | unknown;
  const list = raw && typeof raw === 'object' && !Array.isArray(raw) && 'data' in raw ? (raw as { data?: unknown }).data : raw;
  return Array.isArray(list) ? (list as T[]) : [];
};

export default function NotificationsPage() {
  const [target, setTarget] = useState<Target>('ALL');
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [users, setUsers] = useState<PickUser[] | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<number>(0);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [sending, setSending] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [imgUploading, setImgUploading] = useState(false);
  const [uncertain, setUncertain] = useState<string | null>(null);
  const [sentLog, setSentLog] = useState<SentItem[]>([]);

  // State yangilanishini kutmasdan ikkinchi bosishni to'sadi (ikki marta yuborilmasin)
  const sendingRef = useRef(false);
  const loadId = useRef(0);
  const uploadId = useRef(0);
  const logId = useRef(0);

  const load = useCallback(async () => {
    const id = ++loadId.current;
    // Uchala so'rov mustaqil: biri yiqilsa qolganlari ishlayveradi.
    const [coursesRes, languagesRes, usersRes] = await Promise.allSettled([
      api.get('/admin/courses'),
      api.get('/admin/languages'),
      api.get('/admin/users'),
    ]);
    if (id !== loadId.current) return; // eskirgan javob

    if (coursesRes.status === 'fulfilled') {
      setCourses(unwrapList<Course>(coursesRes.value));
      setCoursesError(null);
    } else {
      setCoursesError(apiErrorMessage(coursesRes.reason, "Kurslar ro'yxatini yuklab bo'lmadi."));
    }
    // Til nomi faqat kurs yonidagi izoh — yuklanmasa ham ishga xalaqit bermaydi
    if (languagesRes.status === 'fulfilled') setLanguages(unwrapList<Language>(languagesRes.value));
    if (usersRes.status === 'fulfilled') {
      setUsers(unwrapList<PickUser>(usersRes.value));
      setUsersError(null);
    } else {
      setUsersError(apiErrorMessage(usersRes.reason, "Foydalanuvchilar ro'yxatini yuklab bo'lmadi."));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- boshlang'ich yuklash; setState faqat javob kelgach chaqiriladi
    void load();
  }, [load]);

  const retryLoad = () => {
    setCoursesError(null);
    setUsersError(null);
    void load();
  };

  const langName = (id: number) => languages.find((l) => l.id === id)?.name || '';
  const selectedCourse = courses?.find((c) => c.id === courseId) ?? null;

  const selectedSet = useMemo(() => new Set(selectedUsers), [selectedUsers]);

  const toggleUser = (id: number) =>
    setSelectedUsers((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    const list = users ?? [];
    if (!q) return list;
    return list.filter((u) =>
      `${u.firstName ?? ''} ${u.lastName ?? ''}`.toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q),
    );
  }, [users, userSearch]);

  const selectFiltered = () =>
    setSelectedUsers((prev) => Array.from(new Set([...prev, ...filteredUsers.map((u) => u.id)])));

  /**
   * Qabul qiluvchilar soni — backend mantig'i bilan bir xil hisoblanadi
   * (ALL = STUDENT + TEACHER, COURSE = kursga yozilganlar). Noma'lum bo'lsa null.
   */
  const recipientCount: number | null = useMemo(() => {
    const byRole = (roles: string[]) => (users ? users.filter((u) => roles.includes(u.role)).length : null);
    switch (target) {
      case 'ALL': return byRole(['STUDENT', 'TEACHER']);
      case 'STUDENTS': return byRole(['STUDENT']);
      case 'TEACHERS': return byRole(['TEACHER']);
      case 'COURSE': return selectedCourse ? (selectedCourse.studentCount ?? null) : null;
      case 'USERS': return selectedUsers.length;
    }
  }, [target, users, selectedCourse, selectedUsers]);

  const audienceLabel = (() => {
    switch (target) {
      case 'ALL': return "Barcha o'quvchi va o'qituvchilarga";
      case 'STUDENTS': return "Barcha o'quvchilarga";
      case 'TEACHERS': return "Barcha o'qituvchilarga";
      case 'COURSE': return selectedCourse ? `«${selectedCourse.name}» kursi o'quvchilariga` : "Kurs o'quvchilariga";
      case 'USERS': return 'Tanlangan foydalanuvchilarga';
    }
  })();
  const countLabel = recipientCount != null ? `${formatNumber(recipientCount)} ta qabul qiluvchi` : null;

  // ── Tekshiruv ────────────────────────────────────────────
  const cleanTitle = title.trim();
  const cleanBody = body.trim();
  const titleError = !cleanTitle ? 'Sarlavhani kiriting' : cleanTitle.length > TITLE_MAX ? `Sarlavha ${TITLE_MAX} belgidan oshmasin` : null;
  const bodyError = !cleanBody ? 'Xabar matnini kiriting' : cleanBody.length > BODY_MAX ? `Matn ${BODY_MAX} belgidan oshmasin` : null;
  const targetError =
    target === 'COURSE' && !selectedCourse ? 'Kursni tanlang'
    : target === 'USERS' && selectedUsers.length === 0 ? 'Kamida bitta foydalanuvchini tanlang'
    : recipientCount === 0 ? "Bu tanlov bo'yicha qabul qiluvchi yo'q"
    : null;

  const uploadImage = async (file: File) => {
    if (!IMAGE_TYPES.includes(file.type)) {
      toast.error('Faqat JPG, PNG yoki WEBP rasm yuklash mumkin.');
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      toast.error('Rasm hajmi 5 MB dan oshmasligi kerak.');
      return;
    }
    const id = ++uploadId.current;
    setImgUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/admin/notifications/upload-image', fd);
      if (id !== uploadId.current) return;
      const url = res.data?.data?.url as string | undefined;
      if (url) setImage(url);
      else toast.error("Rasm yuklandi, lekin manzili qaytmadi. Qayta urinib ko'ring.");
    } catch (err) {
      if (id === uploadId.current) toast.error(apiErrorMessage(err, "Rasmni yuklab bo'lmadi."));
    } finally {
      if (id === uploadId.current) setImgUploading(false);
    }
  };

  const send = async () => {
    if (sendingRef.current) return;
    if (imgUploading) {
      toast.info('Rasm yuklanishi tugashini kuting.');
      return;
    }
    if (titleError || bodyError || targetError) {
      setShowErrors(true);
      toast.error(targetError ?? titleError ?? bodyError ?? "Formani to'ldiring");
      return;
    }

    // Tasdiqlash oynasi ochilishidan OLDIN qulflanadi — ikki marta bosish ikki marta yubormaydi.
    sendingRef.current = true;
    setSending(true);
    try {
      // Tasdiqlangan narsa aynan yuboriladi (payload oldindan yig'iladi)
      const payload: Record<string, unknown> = { target, title: cleanTitle, body: cleanBody };
      if (target === 'COURSE') payload.courseId = courseId;
      if (target === 'USERS') payload.userIds = selectedUsers;
      if (image) payload.image = image;
      const audience = countLabel ? `${audienceLabel} (${countLabel})` : audienceLabel;

      const ok = await confirmDialog({
        title: 'Bildirishnoma yuborilsinmi?',
        message: `${audience} yuboriladi. Sarlavha: «${cleanTitle}»${image ? ', rasm bilan' : ''}. Yuborilgan xabarni qaytarib yoki o'chirib bo'lmaydi.`,
        confirmText: 'Yuborish',
      });
      if (!ok) return;

      setUncertain(null);
      // Ko'p qabul qiluvchida yuborish 60 soniyadan uzoq davom etishi mumkin: umumiy timeout
      // uzilsa admin "xato" deb qayta yuborardi va hamma xabarni ikki marta olardi.
      const res = await api.post('/admin/notifications', payload, { timeout: 0 });
      const sent = Number(res.data?.data?.sent ?? 0);

      if (sent > 0) toast.success(`${formatNumber(sent)} ta foydalanuvchiga yuborildi`);
      else toast.info("Xabar hech kimga yuborilmadi: qabul qiluvchi topilmadi.");
      setSentLog((prev) => [
        { id: ++logId.current, title: cleanTitle, audience: audienceLabel, sent, at: new Date().toISOString() },
        ...prev,
      ].slice(0, 20));
      setTitle('');
      setBody('');
      setSelectedUsers([]);
      setUserSearch('');
      setImage(null);
      setShowErrors(false);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      // Javob kelmadi yoki server yuborish o'rtasida yiqildi — xabar bir qismga yetgan bo'lishi mumkin.
      if (!status || status >= 500) {
        setUncertain(
          "Serverdan aniq javob olinmadi. Xabar to'liq yoki qisman yuborilgan bo'lishi mumkin — " +
          "qayta yuborishdan oldin ilovada (Bildirishnomalar bo'limida) tekshiring, aks holda o'quvchilar xabarni ikki marta oladi.",
        );
      }
      toast.error(apiErrorMessage(err, "Bildirishnomani yuborib bo'lmadi."));
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const inputCls =
    'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] disabled:bg-gray-50 disabled:text-gray-500';
  const errCls = ' border-red-300 focus:border-red-400 focus:ring-red-200';
  const visibleUsers = filteredUsers.slice(0, USER_ROWS_LIMIT);

  return (
    <div>
      <PageHeader title="Bildirishnomalar" description="Foydalanuvchilarga ilova ichida va push orqali xabar yuborish" />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <fieldset disabled={sending} className="min-w-0 space-y-5 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
          {/* Kimga */}
          <div>
            <p className="mb-2 block text-sm font-medium text-gray-700">Kimga</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TARGETS.map((t) => {
                const active = target === t.key;
                const Icon = t.icon;
                return (
                  <button
                    key={t.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setTarget(t.key)}
                    className={
                      'flex items-start gap-2 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 disabled:cursor-not-allowed ' +
                      (active ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-gray-200 hover:bg-gray-50')
                    }
                  >
                    <Icon size={18} className={'mt-0.5 shrink-0 ' + (active ? 'text-[var(--primary)]' : 'text-gray-400')} />
                    <div className="min-w-0">
                      <p className={'text-sm font-medium ' + (active ? 'text-[var(--primary)]' : 'text-gray-800')}>{t.label}</p>
                      <p className="text-[11px] leading-tight text-gray-400">{t.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Kurs tanlash */}
          {target === 'COURSE' && (
            <div>
              <label htmlFor="notif-course" className="mb-1 block text-sm font-medium text-gray-700">
                Kurs <span className="text-red-500">*</span>
              </label>
              {coursesError ? (
                <ErrorState message={coursesError} onRetry={retryLoad} className="rounded-lg border border-gray-100 !py-6" />
              ) : courses === null ? (
                <LoadingState className="!py-6" />
              ) : courses.length === 0 ? (
                <EmptyState icon={BookOpen} title="Kurslar yo'q" description="Avval «Kurslar» bo'limida kurs qo'shing." className="!py-6" />
              ) : (
                <>
                  <select
                    id="notif-course"
                    value={courseId}
                    onChange={(e) => setCourseId(Number(e.target.value))}
                    className={inputCls + (showErrors && !selectedCourse ? errCls : '')}
                  >
                    <option value={0}>— Kurs tanlang —</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}{langName(c.languageId) ? ` (${langName(c.languageId)})` : ''}
                        {c.studentCount != null ? ` — ${c.studentCount} o'quvchi` : ''}
                      </option>
                    ))}
                  </select>
                  {showErrors && !selectedCourse && <p className="mt-1 text-xs text-red-600">Kursni tanlang</p>}
                </>
              )}
            </div>
          )}

          {/* Foydalanuvchi tanlash */}
          {target === 'USERS' && (
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="notif-user-search" className="block text-sm font-medium text-gray-700">
                  Foydalanuvchilar <span className="text-red-500">*</span>{' '}
                  <span className="font-normal text-gray-400">({selectedUsers.length} ta tanlandi)</span>
                </label>
                {users && users.length > 0 && (
                  <div className="flex items-center gap-3 text-xs">
                    <button type="button" onClick={selectFiltered} disabled={filteredUsers.length === 0} className="font-medium text-[var(--primary)] hover:underline disabled:opacity-40 disabled:no-underline">
                      {userSearch.trim() ? `Topilganlarni tanlash (${filteredUsers.length})` : 'Hammasini tanlash'}
                    </button>
                    <button type="button" onClick={() => setSelectedUsers([])} disabled={selectedUsers.length === 0} className="font-medium text-gray-500 hover:underline disabled:opacity-40 disabled:no-underline">
                      Tozalash
                    </button>
                  </div>
                )}
              </div>
              {usersError ? (
                <ErrorState message={usersError} onRetry={retryLoad} className="rounded-lg border border-gray-100 !py-6" />
              ) : users === null ? (
                <LoadingState className="!py-6" />
              ) : (
                <>
                  <div className="relative mb-2">
                    <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      id="notif-user-search"
                      type="search"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Qidirish (ism, email, telefon)"
                      className={inputCls + ' pl-9'}
                    />
                  </div>
                  <div className={'max-h-60 divide-y divide-gray-50 overflow-y-auto rounded-lg border ' + (showErrors && selectedUsers.length === 0 ? 'border-red-300' : 'border-gray-100')}>
                    {filteredUsers.length === 0 ? (
                      <p className="p-3 text-sm text-gray-400">
                        {users.length === 0 ? "Foydalanuvchilar yo'q" : "Qidiruv bo'yicha hech kim topilmadi"}
                      </p>
                    ) : (
                      <>
                        {visibleUsers.map((u) => {
                          const name = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || 'Ismsiz';
                          const contact = u.email || u.phone || '';
                          const role = u.isGuest ? 'Mehmon' : (ROLE_LABEL[u.role] ?? u.role);
                          return (
                            <label key={u.id} className="flex cursor-pointer items-center gap-3 p-2.5 hover:bg-gray-50">
                              <input
                                type="checkbox"
                                checked={selectedSet.has(u.id)}
                                onChange={() => toggleUser(u.id)}
                                className="h-4 w-4 shrink-0 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-gray-800" title={name}>{name}</p>
                                <p className="truncate text-xs text-gray-400">{[contact, role].filter(Boolean).join(' · ')}</p>
                              </div>
                            </label>
                          );
                        })}
                        {filteredUsers.length > USER_ROWS_LIMIT && (
                          <p className="p-3 text-xs text-gray-400">
                            Yana {formatNumber(filteredUsers.length - USER_ROWS_LIMIT)} ta foydalanuvchi bor — qidiruv orqali toping.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  {showErrors && selectedUsers.length === 0 && (
                    <p className="mt-1 text-xs text-red-600">Kamida bitta foydalanuvchini tanlang</p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Kimga borishi — har doim ko'rinib turadi */}
          <div
            className={
              'flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ' +
              (recipientCount === 0 ? 'bg-amber-50 text-amber-800' : 'bg-[var(--primary)]/5 text-gray-700')
            }
            aria-live="polite"
          >
            <UsersIcon size={16} className="mt-0.5 shrink-0 text-[var(--primary)]" />
            <p className="min-w-0 break-words">
              <span className="font-medium">{audienceLabel}</span> yuboriladi
              {countLabel ? <> — <span className="font-semibold">{countLabel}</span></> : usersError && target !== 'COURSE' ? ' (soni noma\'lum)' : ''}
              {recipientCount === 0 && target !== 'USERS' && target !== 'COURSE' ? ". Hozircha bunday foydalanuvchi yo'q." : ''}
              {recipientCount === 0 && target === 'COURSE' ? ". Bu kursga hali hech kim yozilmagan." : ''}
            </p>
          </div>

          {/* Sarlavha + matn */}
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label htmlFor="notif-title" className="block text-sm font-medium text-gray-700">
                Sarlavha <span className="text-red-500">*</span>
              </label>
              <span className={'text-xs ' + (title.length > TITLE_MAX ? 'text-red-600' : 'text-gray-400')}>{title.length}/{TITLE_MAX}</span>
            </div>
            <input
              id="notif-title"
              value={title}
              maxLength={TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={showErrors && !!titleError}
              className={inputCls + (showErrors && titleError ? errCls : '')}
              placeholder="Masalan: Yangi dars qo'shildi"
            />
            {showErrors && titleError && <p className="mt-1 text-xs text-red-600">{titleError}</p>}
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label htmlFor="notif-body" className="block text-sm font-medium text-gray-700">
                Matn <span className="text-red-500">*</span>
              </label>
              <span className={'text-xs ' + (body.length > BODY_MAX ? 'text-red-600' : 'text-gray-400')}>{body.length}/{BODY_MAX}</span>
            </div>
            <textarea
              id="notif-body"
              value={body}
              maxLength={BODY_MAX}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              aria-invalid={showErrors && !!bodyError}
              className={inputCls + (showErrors && bodyError ? errCls : '')}
              placeholder="Xabar matni..."
            />
            {showErrors && bodyError && <p className="mt-1 text-xs text-red-600">{bodyError}</p>}
          </div>

          {/* Rasm (ixtiyoriy) */}
          <div>
            <p className="mb-1 block text-sm font-medium text-gray-700">
              Rasm <span className="font-normal text-gray-400">(ixtiyoriy)</span>
            </p>
            {image ? (
              <div className="relative inline-block">
                <img src={fileUrl(image)} alt="Biriktirilgan rasm" className="max-h-40 max-w-full rounded-lg border border-gray-200" />
                <button
                  type="button"
                  onClick={() => setImage(null)}
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600 disabled:opacity-50"
                  title="Rasmni olib tashlash"
                  aria-label="Rasmni olib tashlash"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <>
                <label
                  className={
                    'inline-flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 ' +
                    (imgUploading || sending ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-gray-50')
                  }
                >
                  {imgUploading ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
                  {imgUploading ? 'Yuklanmoqda…' : 'Rasm tanlash'}
                  <input
                    type="file"
                    accept={IMAGE_TYPES.join(',')}
                    className="hidden"
                    disabled={imgUploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadImage(f);
                      e.target.value = '';
                    }}
                  />
                </label>
                <p className="mt-1 text-xs text-gray-400">JPG, PNG yoki WEBP, 5 MB gacha.</p>
              </>
            )}
          </div>

          {uncertain && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <p className="min-w-0 flex-1 break-words">{uncertain}</p>
              <button type="button" onClick={() => setUncertain(null)} aria-label="Yopish" className="shrink-0 rounded p-0.5 hover:bg-amber-100">
                <X size={14} />
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="min-w-0 text-xs text-gray-400">
              Yuborishdan oldin tasdiq so'raladi. Yuborilgan xabarni qaytarib bo'lmaydi.
            </p>
            <Button onClick={send} loading={sending} disabled={imgUploading}>
              {!sending && <Send size={15} />} {sending ? 'Yuborilmoqda…' : 'Yuborish'}
            </Button>
          </div>
        </fieldset>

        <div className="min-w-0 space-y-6 lg:sticky lg:top-6">
          {/* Ko'rinishi — mobil ilovadagi bildirishnoma kartasi (notification_screen.dart) bilan bir xil */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="mb-3 text-sm font-medium text-gray-700">Ilovada ko'rinishi</p>
            <div className="rounded-2xl bg-[#E8F5EE] p-4">
              <div
                className="flex items-center gap-3 rounded-2xl bg-white p-3.5"
                style={{ border: '1.5px solid rgba(46,158,110,0.3)', boxShadow: '0 3px 10px rgba(0,0,0,0.07)' }}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: 'rgba(46,158,110,0.12)', color: '#2E9E6E' }}>
                  <Bell size={22} fill="currentColor" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={'min-w-0 flex-1 break-words text-sm font-bold ' + (cleanTitle ? 'text-[#1A1A1A]' : 'text-gray-300')}>
                      {cleanTitle || 'Sarlavha'}
                    </p>
                    <span className="h-2 w-2 shrink-0 rounded-full bg-[#2E9E6E]" />
                  </div>
                  <p className={'mt-[3px] line-clamp-2 break-words text-xs ' + (cleanBody ? 'text-[#666666]' : 'text-gray-300')}>
                    {cleanBody || 'Xabar matni'}
                  </p>
                  {image && (
                    <img src={fileUrl(image)} alt="" className="mt-2 h-[150px] w-full rounded-xl object-cover" />
                  )}
                  <p className="mt-1 text-[11px] text-[#BBBBBB]">Hozir</p>
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-gray-400">
              Ro'yxatda matnning faqat 2 qatori ko'rinadi. Push faqat ilovada bildirishnomaga ruxsat bergan qurilmalarga boradi; qolganlar xabarni ilova ichida ko'radi.
            </p>
          </div>

          {/* Shu seansda yuborilganlar (backendda umumiy tarix endpointi yo'q) */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="mb-1 text-sm font-medium text-gray-700">Hozirgina yuborilganlar</p>
            {sentLog.length === 0 ? (
              <EmptyState
                icon={History}
                title="Hali hech narsa yuborilmadi"
                description="Bu yerda faqat shu sahifa ochiq turganida yuborgan xabarlaringiz ko'rinadi."
                className="!py-6"
              />
            ) : (
              <ul className="divide-y divide-gray-100">
                {sentLog.map((s) => (
                  <li key={s.id} className="py-2.5">
                    <p className="truncate text-sm font-medium text-gray-800" title={s.title}>{s.title}</p>
                    <p className="mt-0.5 break-words text-xs text-gray-500">
                      {s.audience} · {formatNumber(s.sent)} ta · {formatDateTime(s.at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
