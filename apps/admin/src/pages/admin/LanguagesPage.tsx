import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Image as ImageIcon, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Lock, BookOpen, Zap } from 'lucide-react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Flag from '../../components/ui/Flag';
import api, { fileUrl } from '../../lib/api';
import type { Language, Course } from '../../lib/types';

export default function LanguagesPage() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  // Tahrirlash (qalamcha) modali — background + preview bir joyda
  const [editLang, setEditLang] = useState<Language | null>(null);
  const [zoom, setZoom] = useState(0.75);
  const [showCards, setShowCards] = useState(true);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null); // tanlangan (hali saqlanmagan) rasm
  const [bgBusy, setBgBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const fetchAll = async () => {
    setLoading(true);
    try {
      const [lRes, cRes] = await Promise.all([
        api.get('/admin/languages'),
        api.get('/admin/courses'),
      ]);
      const list: Language[] = lRes.data.data ?? lRes.data ?? [];
      // Yoqilgan tillar birinchi, keyin id bo'yicha
      list.sort((a, b) => {
        if (!!a.enabled !== !!b.enabled) return a.enabled ? -1 : 1;
        return a.id - b.id;
      });
      setLanguages(list);
      setCourses(cRes.data.data ?? cRes.data ?? []);
    } catch {
      setLanguages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const toggleStatus = async (lang: Language) => {
    const next = !lang.enabled;
    setBusyId(lang.id);
    setLanguages((prev) => prev.map((l) => (l.id === lang.id ? { ...l, enabled: next } : l)));
    try {
      await api.patch(`/admin/languages/${lang.id}/status`, null, { params: { enabled: next } });
    } catch {
      setLanguages((prev) => prev.map((l) => (l.id === lang.id ? { ...l, enabled: !next } : l)));
    } finally {
      setBusyId(null);
    }
  };

  const openEdit = (lang: Language) => {
    setZoom(0.75);
    setShowCards(true);
    setPendingFile(null);
    setPendingUrl(null);
    setEditLang(lang);
  };

  const closeEdit = () => {
    if (pendingUrl) URL.revokeObjectURL(pendingUrl);
    setPendingFile(null);
    setPendingUrl(null);
    setEditLang(null);
  };

  // Rasm tanlash — hali yuklamaymiz, faqat preview
  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (pendingUrl) URL.revokeObjectURL(pendingUrl);
    setPendingFile(f);
    setPendingUrl(URL.createObjectURL(f));
  };

  const cancelBg = () => {
    if (pendingUrl) URL.revokeObjectURL(pendingUrl);
    setPendingFile(null);
    setPendingUrl(null);
  };

  // "Sozlash" — tanlangan rasmni backend'ga yuklash
  const saveBg = async () => {
    if (!editLang || !pendingFile) return;
    setBgBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', pendingFile);
      const res = await api.post(`/admin/languages/${editLang.id}/upload-background`, fd);
      const updated: Language = res.data.data ?? res.data;
      setLanguages((prev) => prev.map((l) => (l.id === editLang.id ? { ...l, backgroundImage: updated.backgroundImage } : l)));
      setEditLang((cur) => (cur ? { ...cur, backgroundImage: updated.backgroundImage } : cur));
      if (pendingUrl) URL.revokeObjectURL(pendingUrl);
      setPendingFile(null);
      setPendingUrl(null);
    } catch { /* ignore */ } finally {
      setBgBusy(false);
    }
  };

  const enabledCount = languages.filter((l) => l.enabled).length;
  const editCourses = editLang ? courses.filter((c) => c.languageId === editLang.id) : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tillar</h1>
          <p className="text-sm text-gray-500 mt-1">
            Tillarni yoqish/o'chirish. Mobil ilovada faqat yoqilgan tillar ko'rinadi.
          </p>
        </div>
        <span className="text-sm font-medium text-gray-500">
          {enabledCount} / {languages.length} yoqilgan
        </span>
      </div>

      <DataTable
        columns={[
          { key: 'flag', label: '', width: '52px', render: (l: Language) => (
            <Flag emoji={l.flagEmoji} height={22} />
          )},
          { key: 'name', label: 'Nomi', render: (l: Language) => <span className="font-medium">{l.name}</span> },
          { key: 'courseCount', label: 'Kurslar', render: (l: Language) => (
            <button
              onClick={() => navigate(`/admin/courses?languageId=${l.id}`)}
              className="text-[var(--primary)] font-medium hover:underline"
              title="Kurslarni ko'rish"
            >
              {l.courseCount ?? 0} ta
            </button>
          )},
          { key: 'studentCount', label: "O'quvchilar", render: (l: Language) => (
            <span className="text-gray-700">{l.studentCount ?? 0} ta</span>
          )},
          { key: 'status', label: 'Holat', render: (l: Language) => (
            <span
              className={
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' +
                (l.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')
              }
            >
              {l.enabled ? 'Yoqilgan' : "O'chirilgan"}
            </span>
          )},
        ]}
        data={languages.filter((l) => l.name.toLowerCase().includes(search.toLowerCase()))}
        searchValue={search}
        onSearchChange={setSearch}
        loading={loading}
        actions={(l: Language) => (
          <div className="flex items-center justify-end gap-2">
            {/* Holat: enable/disable switch */}
            <button
              onClick={() => toggleStatus(l)}
              disabled={busyId === l.id}
              role="switch"
              aria-checked={!!l.enabled}
              className={
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ' +
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
              onClick={() => openEdit(l)}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              title="Tahrirlash"
            >
              <Pencil size={16} />
            </button>
          </div>
        )}
      />

      {/* ── Tahrirlash modali: background + preview bir joyda ── */}
      <Modal open={!!editLang} onClose={closeEdit} title={`Tahrirlash — ${editLang?.name || ''}`} maxWidth="max-w-lg">
        {editLang && (
          <div>
            {/* Boshqaruv: zoom (butun qurilma) + kartalar switch */}
            <div className="flex items-center justify-center gap-5 mb-4 flex-wrap">
              <div className="flex items-center gap-2">
                <button onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">
                  <ZoomOut size={16} />
                </button>
                <span className="text-sm text-gray-600 w-12 text-center">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(2)))}
                  className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">
                  <ZoomIn size={16} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Kartalar</span>
                <button
                  onClick={() => setShowCards((s) => !s)}
                  role="switch"
                  aria-checked={showCards}
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

            {/* iPhone 12 Pro (390 × 844) — zoom butun qurilmani kattalashtiradi */}
            <div className="overflow-auto" style={{ maxHeight: '58vh' }}>
              <div style={{ height: 844 * zoom }} className="flex justify-center">
                <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
                  <PhoneFrame>
                    <LanguagePagePreview
                      lang={editLang}
                      courses={editCourses}
                      showCards={showCards}
                      fileUrl={fileUrl}
                      bgOverride={pendingUrl || undefined}
                    />
                  </PhoneFrame>
                </div>
              </div>
            </div>

            {/* Background boshqaruvi */}
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-400">Background: JPG/PNG, 1080×1920 (9:16), &lt; 500 KB</p>
              {pendingFile ? (
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={cancelBg} disabled={bgBusy}>Bekor qilish</Button>
                  <Button onClick={saveBg} disabled={bgBusy}>{bgBusy ? 'Saqlanmoqda…' : 'Sozlash'}</Button>
                </div>
              ) : (
                <Button onClick={() => fileInputRef.current?.click()}>
                  <ImageIcon size={15} /> Background sozlash
                </Button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// iPhone 12 Pro ramka
// ─────────────────────────────────────────────────────────────
function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative rounded-[52px] bg-black shadow-2xl"
      style={{ width: 390, height: 844, padding: 12 }}
    >
      {/* Notch */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-36 h-7 bg-black rounded-b-2xl z-30" />
      {/* Ekran — background va kontent shu ichida joylashadi */}
      <div className="w-full h-full rounded-[40px] overflow-hidden bg-[#E8F5EE] relative">
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Mobil tillar/kurslar sahifasi ko'rinishi
// ─────────────────────────────────────────────────────────────
function LanguagePagePreview({
  lang, courses, showCards, fileUrl, bgOverride,
}: {
  lang: Language;
  courses: Course[];
  showCards: boolean;
  fileUrl: (p?: string) => string;
  bgOverride?: string;
}) {
  const bg = bgOverride || fileUrl(lang.backgroundImage);
  const accents = ['#2E9E6E', '#FF8A65', '#A78BFA'];

  return (
    <>
      {/* Background — butun ekranni to'liq qoplaydi */}
      <div className="absolute inset-0 z-0">
        {bg
          ? <img src={bg} alt="" className="absolute inset-0 w-full h-full object-cover" />
          : <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, #A7E8C8, #E8F5EE)' }} />}
        {/* O'qilishi uchun yumshoq veil */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/10" />
      </div>

      {/* Kontent — background ustida, scroll bo'ladi */}
      <div className="absolute inset-0 z-10 overflow-y-auto px-4 pt-14 pb-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-white/80 backdrop-blur flex items-center justify-center shadow-sm">
            <ChevronLeft size={20} className="text-[#1F7A55]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[20px] font-extrabold text-[#0F2A20] leading-none truncate">{lang.name}</span>
              <Flag emoji={lang.flagEmoji} height={15} />
            </div>
            <p className="text-[12px] text-[#1F7A55] mt-1">O'zingizga mos kursni tanlang</p>
          </div>
        </div>

        {/* Daraja aniqlash pill */}
        <div className="mb-4 flex items-center gap-2.5 rounded-full px-4 py-2.5 bg-gradient-to-r from-[#3DDC6A] to-[#2E9E6E] shadow-lg shadow-[#2E9E6E]/30">
          <span className="w-6 h-6 rounded-full bg-white/25 flex items-center justify-center">
            <Zap size={13} className="text-white" />
          </span>
          <span className="text-white text-[13px] font-semibold">1 daqiqada darajangizni aniqlang</span>
        </div>

        {/* Kurs kartalari */}
        {!showCards ? null : courses.length === 0 ? (
          <div className="mt-10 text-center text-sm text-[#0F2A20] font-medium bg-white/70 rounded-2xl py-6">
            Bu tilda kurslar yo'q
          </div>
        ) : (
          <div className="space-y-3.5">
            {courses.map((c, i) => {
              const accent = accents[i % accents.length];
              const cover = fileUrl(c.coverImage);
              const cardBg = fileUrl(c.backgroundImage);
              const num = String(i + 1).padStart(2, '0');
              return (
                <div
                  key={c.id}
                  className="relative rounded-[22px] overflow-hidden bg-white/95 backdrop-blur-sm shadow-[0_10px_28px_-12px_rgba(31,122,85,0.45)] ring-1 ring-black/5"
                >
                  {/* Karta foni (agar mavjud bo'lsa) */}
                  {cardBg && (
                    <div className="absolute inset-0">
                      <img src={cardBg} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-white/70" />
                    </div>
                  )}
                  {/* Raqam badge */}
                  <div className="absolute top-3 right-3 w-8 h-8 rounded-xl bg-[#0F2A20]/85 text-white text-[12px] font-extrabold flex items-center justify-center">
                    {num}
                  </div>

                  <div className="relative p-4">
                    <div className="flex gap-3.5">
                      {/* Ikon / cover */}
                      <div
                        className="w-14 h-14 rounded-2xl shrink-0 flex items-center justify-center overflow-hidden shadow-md"
                        style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}
                      >
                        {cover
                          ? <img src={cover} alt="" className="w-full h-full object-cover" />
                          : <BookOpen size={24} className="text-white" />}
                      </div>
                      {/* Matn */}
                      <div className="flex-1 min-w-0 pr-7">
                        <p className="text-[15.5px] font-extrabold text-[#0F2A20] leading-tight">{c.name}</p>
                        {c.goal && (
                          <p className="text-[11.5px] text-[#5B6B63] mt-1 leading-snug line-clamp-2">{c.goal}</p>
                        )}
                      </div>
                    </div>

                    {/* Meta + narx */}
                    <div className="flex items-center gap-3 mt-3">
                      <span className="inline-flex items-center gap-1 text-[11px] text-[#6E827A]">
                        <BookOpen size={12} /> {c.lessonCount ?? 0} dars
                      </span>
                      <span className="ml-auto">
                        {c.isPremium ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#E5A800] bg-[#FFC939]/20 px-2.5 py-0.5 rounded-full">
                            <Lock size={11} /> {c.priceLabel || 'Premium'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[11px] font-bold text-[#1F7A55] bg-[#DCEEDF] px-2.5 py-0.5 rounded-full">
                            Bepul
                          </span>
                        )}
                      </span>
                    </div>

                    {/* CTA */}
                    <button className="mt-3.5 w-full h-11 rounded-2xl bg-gradient-to-r from-[#3DDC6A] to-[#2E9E6E] text-white text-[13.5px] font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-[#2E9E6E]/30">
                      Kursga o'tish <ChevronRight size={17} />
                    </button>
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
