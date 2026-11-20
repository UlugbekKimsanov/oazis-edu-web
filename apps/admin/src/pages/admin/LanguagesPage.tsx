import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Pencil, Image as ImageIcon, ZoomIn, ZoomOut, ChevronLeft, ArrowRight, Lock, RefreshCw, AlertTriangle,
} from 'lucide-react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import PageHeader from '../../components/ui/PageHeader';
import PhoneFrame from '../../components/ui/PhoneFrame';
import Button from '../../components/ui/Button';
import Flag from '../../components/ui/Flag';
import api, { fileUrl } from '../../lib/api';
import { apiErrorMessage } from '../../lib/errors';
import { formatNumber } from '../../lib/format';
import { confirmDialog, toast } from '../../stores/ui-store';
import type { Language, Course } from '../../lib/types';

type StatusFilter = 'all' | 'enabled' | 'disabled';

// Backend background faylini tekshirmaydi (turi/hajmi) — himoya shu yerda.
const BG_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const BG_MAX_BYTES = 5 * 1024 * 1024;
const BG_RECOMMENDED_BYTES = 500 * 1024;

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 1.5;
const PHONE_W = 390;
const PHONE_H = 844;

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

function sortLanguages(list: Language[]): Language[] {
  return [...list].sort((a, b) => {
    if (!!a.enabled !== !!b.enabled) return a.enabled ? -1 : 1;
    return a.id - b.id;
  });
}

export default function LanguagesPage() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const navigate = useNavigate();
  const requestId = useRef(0);

  // Holati o'zgartirilayotgan tillar — har qator alohida bloklanadi.
  // Ref — ketma-ket tez bosishda (state yangilanmasdan oldin) ikkinchi so'rov ketmasligi uchun.
  const pendingRef = useRef<Set<number>>(new Set());
  const [pendingIds, setPendingIds] = useState<ReadonlySet<number>>(new Set());

  // Tahrirlash (qalamcha) modali — background + preview bir joyda
  const [editId, setEditId] = useState<number | null>(null);
  const [zoom, setZoom] = useState(0.75);
  const [showCards, setShowCards] = useState(true);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null); // tanlangan (hali saqlanmagan) rasm
  const [bgBusy, setBgBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const closeAskingRef = useRef(false);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);

    // Kurslar faqat preview uchun kerak — ular yuklanmasa ham tillar ro'yxati ko'rsatiladi.
    const [lRes, cRes] = await Promise.allSettled([
      api.get('/admin/languages'),
      api.get('/admin/courses'),
    ]);
    if (id !== requestId.current) return; // eskirgan javob yoki sahifa yopilgan

    if (lRes.status === 'fulfilled') {
      const raw = lRes.value.data?.data ?? lRes.value.data;
      setLanguages(sortLanguages(Array.isArray(raw) ? raw : []));
    } else {
      setError(apiErrorMessage(lRes.reason, "Tillar ro'yxatini yuklab bo'lmadi."));
    }

    if (cRes.status === 'fulfilled') {
      const raw = cRes.value.data?.data ?? cRes.value.data;
      setCourses(Array.isArray(raw) ? raw : []);
      setCoursesError(null);
    } else {
      setCoursesError(apiErrorMessage(cRes.reason, "Kurslar ro'yxatini yuklab bo'lmadi."));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- birinchi yuklash
    void load();
    const pending = pendingRef.current;
    return () => {
      requestId.current += 1; // sahifa yopilgach kelgan javob e'tiborga olinmaydi
      pending.clear();
    };
  }, [load]);

  // Tanlangan rasmning object URL'i almashganda yoki sahifa yopilganda bo'shatiladi.
  useEffect(() => {
    if (!pendingUrl) return;
    return () => URL.revokeObjectURL(pendingUrl);
  }, [pendingUrl]);

  const setPending = (id: number, on: boolean) => {
    if (on) pendingRef.current.add(id);
    else pendingRef.current.delete(id);
    setPendingIds(new Set(pendingRef.current));
  };

  const toggleStatus = async (lang: Language) => {
    if (pendingRef.current.has(lang.id)) return;
    const next = !lang.enabled;
    setPending(lang.id, true);
    try {
      const courseCount = lang.courseCount ?? 0;
      const studentCount = lang.studentCount ?? 0;
      if (!next && (courseCount > 0 || studentCount > 0)) {
        const ok = await confirmDialog({
          title: `"${lang.name}" tili o'chirilsinmi?`,
          message:
            `Bu tilda ${formatNumber(courseCount)} ta kurs va ${formatNumber(studentCount)} ta o'quvchi bor. ` +
            "O'chirilsa, til mobil ilovadagi tillar ro'yxatida ko'rinmay qoladi. " +
            "Kurslar va o'quvchilar ma'lumoti o'chmaydi — tilni istalgan payt qayta yoqish mumkin.",
          confirmText: "O'chirish",
          danger: true,
        });
        if (!ok) return;
      }

      // Optimistik yangilash — xato bo'lsa orqaga qaytariladi
      setLanguages((prev) => prev.map((l) => (l.id === lang.id ? { ...l, enabled: next } : l)));
      try {
        await api.patch(`/admin/languages/${lang.id}/status`, null, { params: { enabled: next } });
        toast.success(next ? `"${lang.name}" tili yoqildi` : `"${lang.name}" tili o'chirildi`);
      } catch (err) {
        setLanguages((prev) => prev.map((l) => (l.id === lang.id ? { ...l, enabled: !next } : l)));
        toast.error(apiErrorMessage(err, `"${lang.name}" tili holatini o'zgartirib bo'lmadi.`));
      }
    } finally {
      setPending(lang.id, false);
    }
  };

  const openEdit = (lang: Language) => {
    setZoom(0.75);
    setShowCards(true);
    setPendingFile(null);
    setPendingUrl(null);
    setEditId(lang.id);
  };

  const closeEdit = async () => {
    // Tasdiqlash oynasi ochiqligida Esc qayta bosilsa — ikkinchi tasdiq ochilmaydi
    if (bgBusy || closeAskingRef.current) return;
    if (pendingFile) {
      closeAskingRef.current = true;
      const ok = await confirmDialog({
        title: 'Tanlangan rasm saqlanmagan',
        message: 'Oyna yopilsa, tanlangan background saqlanmaydi. Yopilsinmi?',
        confirmText: 'Yopish',
        danger: true,
      });
      closeAskingRef.current = false;
      if (!ok) return;
    }
    setPendingFile(null);
    setPendingUrl(null);
    setEditId(null);
  };

  // Rasm tanlash — hali yuklamaymiz, faqat preview
  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!BG_TYPES.includes(f.type)) {
      toast.error('Faqat JPG, PNG yoki WebP rasm tanlang.');
      return;
    }
    if (f.size > BG_MAX_BYTES) {
      toast.error(`Rasm hajmi juda katta (${formatBytes(f.size)}). Eng ko'pi ${formatBytes(BG_MAX_BYTES)}.`);
      return;
    }
    setPendingFile(f);
    setPendingUrl(URL.createObjectURL(f));
  };

  const cancelBg = () => {
    setPendingFile(null);
    setPendingUrl(null);
  };

  // "Saqlash" — tanlangan rasmni backend'ga yuklash
  const saveBg = async () => {
    if (editId == null || !pendingFile || bgBusy) return;
    const langId = editId;
    setBgBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', pendingFile);
      const res = await api.post(`/admin/languages/${langId}/upload-background`, fd);
      // Javobda courseCount/studentCount hisoblanmagan — faqat rasm yo'lini olamiz
      const updated: Language | undefined = res.data?.data ?? res.data;
      setLanguages((prev) => prev.map((l) => (l.id === langId ? { ...l, backgroundImage: updated?.backgroundImage } : l)));
      setPendingFile(null);
      setPendingUrl(null);
      toast.success('Background saqlandi');
    } catch (err) {
      // Tanlangan rasm joyida qoladi — qayta urinish mumkin
      toast.error(apiErrorMessage(err, "Background'ni yuklab bo'lmadi."));
    } finally {
      setBgBusy(false);
    }
  };

  const enabledCount = languages.filter((l) => l.enabled).length;
  const disabledCount = languages.length - enabledCount;
  const editLang = editId == null ? null : languages.find((l) => l.id === editId) ?? null;
  const editCourses = editLang ? courses.filter((c) => c.languageId === editLang.id) : [];

  const query = search.trim().toLowerCase();
  const visible = languages.filter((l) => {
    if (statusFilter === 'enabled' && !l.enabled) return false;
    if (statusFilter === 'disabled' && l.enabled) return false;
    return !query || (l.name ?? '').toLowerCase().includes(query);
  });

  const filters: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: 'Hammasi', count: languages.length },
    { key: 'enabled', label: 'Yoqilgan', count: enabledCount },
    { key: 'disabled', label: "O'chirilgan", count: disabledCount },
  ];

  return (
    <div>
      <PageHeader
        title="Tillar"
        description="Tillarni yoqish/o'chirish va til sahifasi fonini sozlash. Mobil ilovada faqat yoqilgan tillar ko'rinadi."
        actions={
          <>
            {!error && languages.length > 0 && (
              <span className="text-sm font-medium text-gray-500">
                {enabledCount} / {languages.length} yoqilgan
              </span>
            )}
            <Button variant="secondary" size="sm" onClick={() => void load()} loading={loading}>
              {!loading && <RefreshCw size={14} />} Yangilash
            </Button>
          </>
        }
      />

      <DataTable
        columns={[
          { key: 'flag', label: '', width: '52px', render: (l: Language) => (
            <Flag emoji={l.flagEmoji} height={22} />
          )},
          { key: 'name', label: 'Nomi', render: (l: Language) => (
            <span className="block max-w-[14rem] truncate font-medium" title={l.name}>{l.name}</span>
          )},
          { key: 'background', label: 'Fon', render: (l: Language) => (
            l.backgroundImage ? (
              <button
                type="button"
                onClick={() => openEdit(l)}
                title="Fonni ko'rish / almashtirish"
                aria-label={`${l.name} — fonni ko'rish`}
                className="block h-10 w-[22px] overflow-hidden rounded bg-gray-100 ring-1 ring-black/10 hover:ring-[var(--primary)]"
              >
                <img src={fileUrl(l.backgroundImage)} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            ) : (
              <span className="text-xs text-gray-400">Sozlanmagan</span>
            )
          )},
          { key: 'courseCount', label: 'Kurslar', render: (l: Language) => (
            <button
              type="button"
              onClick={() => navigate(`/admin/courses?languageId=${l.id}`)}
              className="whitespace-nowrap text-[var(--primary)] font-medium hover:underline"
              title="Kurslarni ko'rish"
            >
              {formatNumber(l.courseCount ?? 0)} ta
            </button>
          )},
          { key: 'studentCount', label: "O'quvchilar", render: (l: Language) => (
            <span className="whitespace-nowrap text-gray-700">{formatNumber(l.studentCount ?? 0)} ta</span>
          )},
          { key: 'status', label: 'Holat', render: (l: Language) => (
            <span
              className={
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ' +
                (l.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')
              }
            >
              {l.enabled ? 'Yoqilgan' : "O'chirilgan"}
            </span>
          )},
        ]}
        data={visible}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Til nomi bo'yicha qidirish..."
        loading={loading}
        error={error}
        onRetry={() => void load()}
        emptyTitle={
          statusFilter === 'enabled' ? "Yoqilgan til yo'q"
            : statusFilter === 'disabled' ? "O'chirilgan til yo'q"
            : 'Tillar topilmadi'
        }
        emptyDescription={
          statusFilter === 'enabled' ? "Mobil ilovada hech bir til ko'rinmayapti. Kerakli tilni \"O'chirilgan\" bo'limidan yoqing."
            : statusFilter === 'disabled' ? 'Barcha tillar yoqilgan.'
            : "Tillar ro'yxati tizimda oldindan belgilangan — bu yerda ular faqat yoqiladi yoki o'chiriladi."
        }
        headerRight={
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5" role="group" aria-label="Holat bo'yicha filtr">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                aria-pressed={statusFilter === f.key}
                className={
                  'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ' +
                  (statusFilter === f.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')
                }
              >
                {f.label} <span className="text-gray-400">{f.count}</span>
              </button>
            ))}
          </div>
        }
        actions={(l: Language) => {
          const pending = pendingIds.has(l.id);
          return (
            <div className="flex items-center justify-end gap-2">
              {/* Holat: enable/disable switch */}
              <button
                type="button"
                onClick={() => void toggleStatus(l)}
                disabled={pending}
                role="switch"
                aria-checked={!!l.enabled}
                aria-busy={pending || undefined}
                aria-label={`${l.name} — ${l.enabled ? "o'chirish" : 'yoqish'}`}
                className={
                  'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-wait ' +
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 ' +
                  (l.enabled ? 'bg-green-500' : 'bg-gray-300')
                }
                title={l.enabled ? "O'chirish" : 'Yoqish'}
              >
                <span
                  className={
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform ' +
                    (l.enabled ? 'translate-x-6' : 'translate-x-1')
                  }
                />
              </button>

              {/* Qalamcha — tahrirlash (background + ko'rish) */}
              <button
                type="button"
                onClick={() => openEdit(l)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                title="Fonni sozlash va ko'rish"
                aria-label={`${l.name} — fonni sozlash va ko'rish`}
              >
                <Pencil size={16} />
              </button>
            </div>
          );
        }}
      />

      {/* ── Tahrirlash modali: background + preview bir joyda ── */}
      <Modal
        open={!!editLang}
        onClose={() => void closeEdit()}
        title={`Fonni sozlash — ${editLang?.name || ''}`}
        maxWidth="max-w-lg"
        closeDisabled={bgBusy}
      >
        {editLang && (
          <div>
            {/* Boshqaruv: zoom (butun qurilma) + kartalar switch */}
            <div className="flex items-center justify-center gap-5 mb-4 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(ZOOM_MIN, +(z - 0.1).toFixed(2)))}
                  disabled={zoom <= ZOOM_MIN}
                  aria-label="Kichraytirish"
                  title="Kichraytirish"
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ZoomOut size={16} />
                </button>
                <span className="text-sm text-gray-600 w-12 text-center">{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(ZOOM_MAX, +(z + 0.1).toFixed(2)))}
                  disabled={zoom >= ZOOM_MAX}
                  aria-label="Kattalashtirish"
                  title="Kattalashtirish"
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ZoomIn size={16} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Kartalar</span>
                <button
                  type="button"
                  onClick={() => setShowCards((s) => !s)}
                  role="switch"
                  aria-checked={showCards}
                  aria-label="Kurs kartalarini ko'rsatish"
                  title={showCards ? "Kartalarni o'chirish" : 'Kartalarni yoqish'}
                  className={
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors ' +
                    (showCards ? 'bg-[var(--primary)]' : 'bg-gray-300')
                  }
                >
                  <span
                    className={
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform ' +
                      (showCards ? 'translate-x-6' : 'translate-x-1')
                    }
                  />
                </button>
              </div>
            </div>

            {!editLang.enabled && (
              <p className="mb-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                Bu til hozir o'chirilgan — mobil ilovada ko'rinmaydi. Fon til yoqilgach ishlatiladi.
              </p>
            )}
            {coursesError && (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <span>{coursesError} Preview'da kurs kartalari ko'rsatilmayapti.</span>
                <button
                  type="button"
                  onClick={() => void load()}
                  disabled={loading}
                  className="shrink-0 font-semibold underline disabled:opacity-50"
                >
                  Qayta urinish
                </button>
              </div>
            )}

            {/* iPhone 12 Pro (390 × 844) — zoom butun qurilmani kattalashtiradi.
                Tashqi blok masshtablangan haqiqiy o'lchamni egallaydi — ortiqcha bo'sh scroll bo'lmaydi. */}
            <div className="overflow-auto" style={{ maxHeight: '58vh' }}>
              <div className="relative mx-auto" style={{ width: PHONE_W * zoom, height: PHONE_H * zoom }}>
                <div className="absolute left-0 top-0" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
                  <PhoneFrame>
                    <LanguagePagePreview
                      lang={editLang}
                      courses={coursesError ? [] : editCourses}
                      showCards={showCards && !coursesError}
                      bgOverride={pendingUrl || undefined}
                    />
                  </PhoneFrame>
                </div>
              </div>
            </div>

            {/* Background boshqaruvi */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
              {pendingFile ? (
                <div className="min-w-0 text-xs">
                  <p className="truncate font-medium text-gray-700" title={pendingFile.name}>{pendingFile.name}</p>
                  <p className={pendingFile.size > BG_RECOMMENDED_BYTES ? 'flex items-center gap-1 text-amber-600' : 'text-gray-400'}>
                    {pendingFile.size > BG_RECOMMENDED_BYTES && <AlertTriangle size={12} className="shrink-0" />}
                    {formatBytes(pendingFile.size)}
                    {pendingFile.size > BG_RECOMMENDED_BYTES
                      ? ` — tavsiya etilgan ${formatBytes(BG_RECOMMENDED_BYTES)}dan katta, ilovada sekin ochilishi mumkin`
                      : ' — hali saqlanmagan'}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-gray-400">
                  JPG, PNG yoki WebP · 1080×1920 (9:16) · tavsiya &lt; {formatBytes(BG_RECOMMENDED_BYTES)}, eng ko'pi {formatBytes(BG_MAX_BYTES)}
                </p>
              )}
              {pendingFile ? (
                <div className="ml-auto flex items-center gap-2">
                  <Button variant="secondary" onClick={cancelBg} disabled={bgBusy}>Bekor qilish</Button>
                  <Button onClick={() => void saveBg()} loading={bgBusy}>{bgBusy ? 'Saqlanmoqda…' : 'Saqlash'}</Button>
                </div>
              ) : (
                <Button className="ml-auto" onClick={() => fileInputRef.current?.click()}>
                  <ImageIcon size={15} /> {editLang.backgroundImage ? 'Fonni almashtirish' : 'Fon tanlash'}
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={BG_TYPES.join(',')}
                className="hidden"
                aria-label="Background rasmi"
                onChange={onPickImage}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Til rangi — mobil ilovadagi LanguageUtils.gradientColors() nusxasi
// (lib/core/utils/language_utils.dart). Tartib muhim: aniqroq kalit so'zlar oldin.
// Mobilda ro'yxat o'zgarsa — bu yer ham yangilansin.
// ─────────────────────────────────────────────────────────────
const LANG_GRADIENTS: [string, string, string[]][] = [
  ['#64B5F6', '#1E88E5', ['american english', 'us english', 'amerikancha ingliz']],
  ['#4FC3F7', '#1565C0', ['english', 'ingliz', 'british', 'britaniya']],
  ['#EF5350', '#6A0000', ['russian', 'ruscha', 'rus tili', 'russkiy', 'rus ']],
  ['#F2994A', '#6D4C41', ['german', 'deutsch', 'nemis', 'allemand']],
  ['#A770EF', '#4A148C', ['korean', 'koreys', 'hangul', 'hangugeo', 'кореец']],
  ['#388E3C', '#26A69A', ['turkmen', 'türkmen', 'turkmeni', 'turkmancha']],
  ['#E44D26', '#6D0000', ['turkish', 'türkçe', 'turkcha', 'türkiye', 'turk tili', 'turk']],
  ['#26A69A', '#00695C', ['arabic', 'arabcha', 'arab tili', 'arabiy', 'arab ']],
  ['#5C6BC0', '#1A237E', ['french', 'fransuz', 'français', 'francais']],
  ['#EF5350', '#7F0000', ['chinese', 'xitoy', 'mandarin', 'zhongwen', '中文', 'putonghua']],
  ['#66BB6A', '#1B5E20', ["o'zbek", 'uzbek', "o'zbekcha"]],
  ['#FF7043', '#BF360C', ['spanish', 'ispan', 'español', 'espanol', 'castellano']],
  ['#388E3C', '#B71C1C', ['italian', 'italyan', 'italiano']],
  ['#EF5350', '#AD1457', ['japanese', 'yapon', 'nihongo', '日本語']],
  ['#388E3C', '#1B5E20', ['portuguese', 'português', 'portugues', 'brasil', 'braziliya']],
  ['#FF7043', '#6D4C41', ['hindi', 'hindcha', 'hindiston', 'हिन्दी']],
  ['#388E3C', '#006064', ['persian', 'farsi', 'forscha', 'fors tili', 'فارسی', 'eron']],
  ['#26C6DA', '#006064', ['tajik', 'tojik']],
  ['#26A69A', '#004D40', ['kazakh', 'qozoq', 'қазақ', 'kazaxcha']],
  ['#EF5350', '#E65100', ["qirg'iz", 'kyrgyz', 'kirg', 'кыргыз']],
  ['#42A5F5', '#FDD835', ['ukrainian', 'ukrain', 'україн']],
  ['#EF5350', '#6A0000', ['polish', 'polyak', 'polski']],
  ['#1565C0', '#E53935', ['dutch', 'golland', 'niderland', 'nederlands']],
  ['#1565C0', '#E65100', ['swedish', 'shved', 'svenska', 'sverige']],
  ['#1565C0', '#B71C1C', ['norwegian', 'norveg', 'norsk', 'norge']],
  ['#EF5350', '#6A0000', ['danish', 'daniya', 'dansk', 'danmark']],
  ['#1565C0', '#0D47A1', ['finnish', 'fincha', 'suomi', 'finlyandiya']],
  ['#1565C0', '#0D47A1', ['greek', 'yunon', 'gretsiya', 'ελληνικά']],
  ['#1565C0', '#EF5350', ['thai', 'tailand', 'ภาษาไทย']],
  ['#EF5350', '#6A0000', ['vietnamese', 'vyetnam', 'vietnam', 'tiếng việt']],
  ['#EF5350', '#8D1C1C', ['indonesian', 'indoneziya', 'bahasa indonesia']],
  ['#1565C0', '#EF5350', ['malay', 'malayziya', 'bahasa melayu', 'malaysia']],
  ['#1565C0', '#0D47A1', ['hebrew', 'ibraniy', 'yevrey', 'עברית', 'isroil']],
  ['#26C6DA', '#1B5E20', ['azerbaijani', 'ozarbayjon', 'azeri', 'azerbaycan', 'azərbaycanca']],
  ['#EF5350', '#880E4F', ['georgian', 'gruzin', 'gruziya', 'ქართული']],
  ['#EF5350', '#1565C0', ['armenian', 'arman', 'armeniya', 'հայերեն']],
  ['#1565C0', '#E65100', ['romanian', 'ruminiya', 'română', 'roman tili']],
  ['#EF5350', '#388E3C', ['hungarian', 'vengr', 'vengriya', 'magyar']],
  ['#1565C0', '#EF5350', ['czech', 'chex', 'čeština', 'chexiya']],
  ['#388E3C', '#EF5350', ['bulgarian', 'bolgar', 'bolgariya', 'български']],
  ['#1565C0', '#EF5350', ['slovak', 'slovakiya', 'slovenčina']],
  ['#1565C0', '#EF5350', ['croatian', 'xorvat', 'xorvatiya', 'hrvatski']],
  ['#388E3C', '#EF5350', ['belarusian', 'belarus', 'беларускі']],
  ['#42A5F5', '#1B5E20', ['estonian', 'estoniya', 'eesti']],
  ['#6D1515', '#78909C', ['latvian', 'latviya', 'latviešu']],
  ['#388E3C', '#E65100', ['lithuanian', 'litva', 'lietuvių']],
  ['#EF5350', '#1565C0', ["mo'g'ul", 'mongolian', 'mongoliya', 'монгол']],
];

function langGradient(name?: string): [string, string] {
  const n = (name ?? '').toLowerCase().trim();
  for (const [from, to, keywords] of LANG_GRADIENTS) {
    if (keywords.some((k) => n.includes(k))) return [from, to];
  }
  return ['#3DDC6A', '#1B8A5C'];
}

// ─────────────────────────────────────────────────────────────
// Mobil "Kursni tanlang" sahifasi ko'rinishi
// (lib/presentation/screens/course/course_selection_screen.dart) —
// til foni aynan shu sahifa orqasida ko'rinadi.
// ─────────────────────────────────────────────────────────────
function LanguagePagePreview({
  lang, courses, showCards, bgOverride,
}: {
  lang: Language;
  courses: Course[];
  showCards: boolean;
  bgOverride?: string;
}) {
  const bg = bgOverride || fileUrl(lang.backgroundImage);
  const [failedBg, setFailedBg] = useState<string | null>(null);
  const [from, to] = langGradient(lang.name);

  return (
    <>
      {/* Til foni — butun sahifa orqasida, tiniq (mobildagi kabi parda yo'q).
          Rasm yuklanmasa mobildagi kabi oddiy fon rangi qoladi. */}
      {bg && failedBg !== bg && (
        <img
          src={bg}
          alt=""
          onError={() => setFailedBg(bg)}
          className="absolute inset-0 z-0 h-full w-full object-cover"
        />
      )}

      <div className="absolute inset-0 z-10 flex flex-col pt-9">
        {/* Orqaga + sarlavha */}
        <div className="flex shrink-0 items-center pl-1.5 pr-[18px] pt-2">
          <span className="flex h-12 w-12 items-center justify-center">
            <ChevronLeft size={20} strokeWidth={2.5} className="text-[#1F7A55]" />
          </span>
          <span className="text-[17px] font-bold text-[#0F2A20]">Kursni tanlang</span>
        </div>

        {/* Kurs kartalari */}
        {!showCards ? null : courses.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-sm text-[#6E827A]">
            Kurslar topilmadi
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-[18px] pb-8 pt-3">
            {courses.map((c) => {
              const cover = fileUrl(c.coverImage) || fileUrl(c.backgroundImage);
              const lessonCount = c.lessonCount ?? 0;
              const hasLessons = lessonCount > 0;
              // Mobilda isPremium bo'sh bo'lsa premium hisoblanadi
              const isFree = c.isPremium === false;
              return (
                <div
                  key={c.id}
                  className="mb-3.5 overflow-hidden rounded-[20px] bg-white"
                  style={{ boxShadow: '0 1px 0 rgba(31,122,85,0.04), 0 8px 24px -12px rgba(31,122,85,0.18)' }}
                >
                  {/* Muqova: to'liq enli 16:9 */}
                  <div className="relative aspect-video w-full">
                    {cover ? (
                      <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
                      >
                        <Flag emoji={c.flagEmoji || lang.flagEmoji || '🎓'} height={44} />
                      </div>
                    )}
                  </div>

                  {/* Pastki qism: nom, tavsif, meta va tugma */}
                  <div className="px-4 pb-3.5 pt-3">
                    <p className="line-clamp-2 text-[16.5px] font-extrabold leading-snug text-[#0F2A20]">{c.name}</p>
                    {c.goal && (
                      <p className="mt-1 line-clamp-2 text-[12.5px] leading-[1.35] text-[#6E827A]">{c.goal}</p>
                    )}
                    <div className="mt-3 flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[#6E827A]">
                        {hasLessons ? `${lessonCount} ta dars` : ''}
                      </span>
                      {!hasLessons ? (
                        <span className="flex h-9 min-w-[110px] items-center justify-center rounded-full bg-white/90 px-[22px] text-[13px] font-bold text-[#8A958F] shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
                          Tez kunda
                        </span>
                      ) : isFree ? (
                        <span className="flex h-9 items-center gap-2 rounded-full bg-white py-1 pl-[15px] pr-1 shadow-[0_2px_9px_rgba(0,0,0,0.10)]">
                          <span className="text-[13px] font-bold" style={{ color: to }}>Kursga o'tish</span>
                          <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: to }}>
                            <ArrowRight size={15} className="text-white" />
                          </span>
                        </span>
                      ) : (
                        <span className="flex h-9 items-center gap-1.5 rounded-3xl bg-[#FFC939] px-4">
                          <Lock size={14} className="text-[#E5A800]" />
                          <span className="text-[13px] font-extrabold text-[#E5A800]">{c.priceLabel || 'Sotib olish'}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
