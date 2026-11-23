import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, Image as ImageIcon, X, FileText, Upload, ExternalLink, Gift } from 'lucide-react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import PageHeader from '../../components/ui/PageHeader';
import api, { fileUrl } from '../../lib/api';
import { apiErrorMessage } from '../../lib/errors';
import { formatMoney, formatNumber } from '../../lib/format';
import { confirmDialog, toast } from '../../stores/ui-store';
import type { Book, Course, Language } from '../../lib/types';
import { useCourseGifts } from '../../lib/courseGifts';
import GiftLinkModal, { type GiftLinkItem } from '../../components/GiftLinkModal';

// Admin endpoint `Books` entity'sini qaytaradi (BooksDto emas): muqova `coverImage`da
// (coverUrl YO'Q), kitob fayli `filePath`da keladi.
interface AdminBook extends Book {
  filePath?: string | null;
  previewPages?: string | null;
  imageId?: number | null;
  fileId?: number | null;
}

type Category = 'digital' | 'print';
type DeliveryType = 'FREE' | 'NEGOTIABLE' | 'PAID';

interface BookForm {
  title: string;
  author: string;
  category: Category;
  description: string;
  price: string; // faqat raqamlar — bo'sh qoldirish mumkin bo'lishi uchun satr
  isFree: boolean;
  emoji: string;
  pages: string;
  language: string;
  deliveryType: DeliveryType;
  deliveryPrice: string;
}

type FieldErrors = Partial<Record<'title' | 'author' | 'price' | 'deliveryPrice', string>>;

// Kitoblar uchun emojilar (tanlash uchun)
const BOOK_EMOJIS = [
  '📚', '📖', '📕', '📗', '📘', '📙', '📔', '📓', '📒',
];

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const IMAGE_ACCEPT = IMAGE_TYPES.join(',');
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
// Mobil ilova PDF'ni to'liq xotiraga yuklab ochadi — juda katta fayl telefonda ochilmaydi.
const MAX_PDF_BYTES = 200 * 1024 * 1024;
// books.price / delivery_price — INTEGER ustun
const MAX_INT = 2_147_483_647;

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]';
const errCls = ' border-red-400 focus:border-red-500 focus:ring-red-200';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

const emptyForm = (language = ''): BookForm => ({
  title: '', author: '', category: 'digital', description: '', price: '', isFree: false,
  emoji: '📚', pages: '', language, deliveryType: 'FREE', deliveryPrice: '',
});

const unwrap = <T,>(res: { data: unknown }): T => {
  const body = res.data as { data?: T } | T;
  return ((body as { data?: T })?.data ?? body) as T;
};

const digitsOnly = (v: string) => v.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 10);

const coverPath = (b?: AdminBook | null) => b?.coverImage || b?.coverUrl || '';

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

function imageProblem(f: File): string | null {
  if (!IMAGE_TYPES.includes(f.type)) return `"${f.name}": faqat JPG, PNG yoki WebP rasm yuklash mumkin.`;
  if (f.size > MAX_IMAGE_BYTES) return `"${f.name}": rasm hajmi 10 MB dan oshmasligi kerak (${formatBytes(f.size)}).`;
  return null;
}

function pdfProblem(f: File): string | null {
  const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) return 'Faqat PDF fayl yuklash mumkin — mobil ilova faqat PDF ochadi.';
  if (f.size === 0) return "Fayl bo'sh.";
  if (f.size > MAX_PDF_BYTES) return `PDF hajmi 200 MB dan oshmasligi kerak (${formatBytes(f.size)}).`;
  return null;
}

// Kitobning galereya rasmlari — backend JSON array string qaytaradi
function parseGallery(book?: AdminBook | null): string[] {
  if (!book?.images) return [];
  try {
    const arr = JSON.parse(book.images);
    return Array.isArray(arr) ? arr.filter((p): p is string => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

const deliveryLabel = (b: AdminBook): string => {
  if (b.deliveryType === 'PAID') return b.deliveryPrice ? `+${formatMoney(b.deliveryPrice)}` : 'Pullik';
  if (b.deliveryType === 'NEGOTIABLE') return 'Kelishiladi';
  return 'Bepul';
};

export default function BooksPage() {
  const [books, setBooks] = useState<AdminBook[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [languagesFailed, setLanguagesFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | Category>('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<AdminBook | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  // Yaratishda tanlangan (hali yuklanmagan) muqova rasmi
  const [pendingCover, setPendingCover] = useState<File | null>(null);
  const [pendingCoverUrl, setPendingCoverUrl] = useState<string | null>(null);
  // Yaratishda tanlangan galereya rasmlari (saqlashda yuklanadi)
  const [pendingImages, setPendingImages] = useState<{ file: File; url: string }[]>([]);
  const [galleryUploading, setGalleryUploading] = useState(false);
  // Yaratishda tanlangan kitob fayli (PDF) — saqlashda yuklanadi
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [fileUploading, setFileUploading] = useState(false);
  // Serverdagi PDF yoki muqovani olib tashlash jarayoni
  const [removing, setRemoving] = useState<'file' | 'cover' | null>(null);
  const [filePct, setFilePct] = useState<number | null>(null);
  const [form, setForm] = useState<BookForm>(emptyForm());
  const [errors, setErrors] = useState<FieldErrors>({});

  // Sovg'a sifatida kursga biriktirish (xuddi shu bog'lanish «Kurslar»dan ham boshqariladi)
  const gifts = useCourseGifts();
  const [giftBook, setGiftBook] = useState<AdminBook | null>(null);
  const [giftCourses, setGiftCourses] = useState<Course[]>([]);
  const [giftCoursesError, setGiftCoursesError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    api.get('/admin/courses')
      .then((res) => {
        if (!active) return;
        const list = unwrap<Course[]>(res);
        setGiftCourses(Array.isArray(list) ? list : []);
        setGiftCoursesError(null);
      })
      .catch((e: unknown) => {
        if (active) setGiftCoursesError(apiErrorMessage(e, "Kurslar ro'yxatini yuklab bo'lmadi."));
      });
    return () => { active = false; };
  }, []);

  const giftCourseItems: GiftLinkItem[] = giftCourses.map((c) => ({
    id: c.id,
    title: c.name,
    subtitle: `${c.priceLabel || formatMoney(c.price)} · ${formatNumber(c.studentCount)} o'quvchi`,
    thumb: c.coverImage
      ? <img src={fileUrl(c.coverImage)} alt="" loading="lazy" className="h-full w-full object-cover" />
      : c.flagEmoji || '🎓',
    disabledReason: c.isPremium ? undefined : "Bepul kurs — sovg'a faqat pullik kursga biriktiriladi",
  }));

  const toggleGiftCourse = async (item: GiftLinkItem) => {
    const book = giftBook;
    if (!book) return;
    const adding = !gifts.isLinked(item.id, book.id);
    const students = giftCourses.find((c) => c.id === item.id)?.studentCount ?? 0;
    // Biriktirish qaytarib bo'lmaydigan ta'sirga ega: mavjud o'quvchilar kitobni darhol oladi
    if (adding && students > 0) {
      const ok = await confirmDialog({
        title: "Sovg'a kitob biriktirilsinmi?",
        message: `«${book.title}» «${item.title}» kursiga sovg'a sifatida biriktiriladi. Kursning hozirgi ${formatNumber(students)} ta o'quvchisi ham bu kitobni darhol bepul oladi — buni qaytarib bo'lmaydi.`,
        confirmText: 'Biriktirish',
      });
      if (!ok) return;
    }
    const result = await gifts.toggle(item.id, book.id);
    if (!result.ok) return;
    toast.success(
      result.linked
        ? result.granted > 0
          ? `«${item.title}» kursiga biriktirildi — ${formatNumber(result.granted)} ta o'quvchi kitobni oldi`
          : `«${item.title}» kursiga sovg'a sifatida biriktirildi`
        : `«${item.title}» kursidan olib tashlandi`,
    );
  };

  const requestId = useRef(0);
  // Yaratilgan object URL'lar — sahifadan chiqishda ham bo'shatiladi
  const objectUrls = useRef(new Set<string>());

  const makeUrl = (file: File) => {
    const url = URL.createObjectURL(file);
    objectUrls.current.add(url);
    return url;
  };
  const dropUrl = (url?: string | null) => {
    if (!url) return;
    URL.revokeObjectURL(url);
    objectUrls.current.delete(url);
  };

  // silent — ro'yxat allaqachon ko'rinib turganda (saqlash/yuklashdan keyin) skeletsiz yangilash
  const load = useCallback(async (silent = false) => {
    const id = ++requestId.current;
    if (!silent) setLoading(true);
    try {
      const res = await api.get('/admin/books');
      if (id !== requestId.current) return; // eskirgan javob
      const list = unwrap<AdminBook[]>(res);
      setBooks(Array.isArray(list) ? list : []);
      setLoadError(null);
    } catch (e) {
      if (id !== requestId.current) return;
      const msg = apiErrorMessage(e, "Kitoblar ro'yxatini yuklab bo'lmadi.");
      // Xatoda bo'sh ro'yxat ko'rsatilmaydi — "kitob yo'q" degan noto'g'ri taassurot qoldirmaslik uchun
      if (silent) toast.error(`Ro'yxatni yangilab bo'lmadi: ${msg}`);
      else setLoadError(msg);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- birinchi yuklash
    void load();
    let active = true;
    api.get('/admin/languages')
      .then((res) => {
        if (!active) return;
        const list = unwrap<Language[]>(res);
        setLanguages(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        // Til ixtiyoriy maydon — forma ichida ogohlantirish ko'rsatiladi
        if (active) setLanguagesFailed(true);
      });
    const urls = objectUrls.current;
    return () => {
      active = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
      urls.clear();
    };
  }, [load]);

  const query = search.trim().toLowerCase();
  const filtered = books.filter((b) =>
    (categoryFilter === 'all' || b.category === categoryFilter)
    && `${b.title ?? ''} ${b.author ?? ''}`.toLowerCase().includes(query));

  const busyUpload = uploading || galleryUploading || fileUploading || removing !== null;
  const busy = saving || busyUpload;

  const setField = <K extends keyof BookForm>(key: K, value: BookForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const clearPending = () => {
    dropUrl(pendingCoverUrl);
    setPendingCover(null);
    setPendingCoverUrl(null);
    pendingImages.forEach((p) => dropUrl(p.url));
    setPendingImages([]);
    setPendingFile(null);
    setFilePct(null);
  };

  const openCreate = () => {
    setEditItem(null);
    clearPending();
    setErrors({});
    setForm(emptyForm(languages[0]?.name || ''));
    setModalOpen(true);
  };

  const openEdit = (item: AdminBook) => {
    setEditItem(item);
    clearPending();
    setErrors({});
    setForm({
      title: item.title ?? '', author: item.author ?? '',
      category: item.category === 'print' ? 'print' : 'digital',
      description: item.description || '',
      price: item.price ? String(item.price) : '',
      isFree: !!item.isFree,
      emoji: item.emoji || '📚', pages: item.pages || '', language: item.language || '',
      deliveryType: item.deliveryType || 'FREE',
      deliveryPrice: item.deliveryPrice ? String(item.deliveryPrice) : '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (busy) return;
    clearPending();
    setModalOpen(false);
  };

  const validate = (): FieldErrors => {
    const errs: FieldErrors = {};
    if (!form.title.trim()) errs.title = 'Kitob nomini kiriting.';
    if (!form.author.trim()) errs.author = 'Muallifni kiriting.';
    if (!form.isFree) {
      const p = Number(form.price);
      if (!form.price || !Number.isFinite(p) || p <= 0) errs.price = 'Narxni kiriting yoki «Bepul» ni belgilang.';
      else if (p > MAX_INT) errs.price = 'Narx juda katta.';
    }
    if (form.category === 'print' && form.deliveryType === 'PAID') {
      const d = Number(form.deliveryPrice);
      if (!form.deliveryPrice || !Number.isFinite(d) || d <= 0) errs.deliveryPrice = 'Yetkazib berish narxini kiriting.';
      else if (d > MAX_INT) errs.deliveryPrice = 'Narx juda katta.';
    }
    return errs;
  };

  const postFile = async (bookId: number, kind: 'upload-cover' | 'upload-image', file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return unwrap<AdminBook>(await api.post(`/admin/books/${bookId}/${kind}`, fd));
  };

  const postBookFile = async (bookId: number, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    setFilePct(0);
    const res = await api.post(`/admin/books/${bookId}/upload-file`, fd, {
      // Katta PDF sekin internetda uzoq yuklanadi — standart 60s timeout o'chiriladi
      timeout: 0,
      onUploadProgress: (e) => {
        if (e.total) setFilePct(Math.round((e.loaded / e.total) * 100));
      },
    });
    return unwrap<AdminBook>(res);
  };

  const handleSave = async () => {
    if (busy) return;
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error(Object.values(errs)[0] ?? "Formani to'ldiring.");
      return;
    }

    // Yetkazib berish faqat bosma kitoblar uchun; narx faqat 'PAID' bo'lsa
    const isPrint = form.category === 'print';
    const price = form.isFree ? 0 : Number(form.price);
    const payload = {
      title: form.title.trim(),
      author: form.author.trim(),
      category: form.category,
      description: form.description.trim(),
      price,
      isFree: form.isFree,
      // Mobil ilova narxni aynan shu matn bilan ko'rsatadi
      priceLabel: form.isFree ? 'Bepul' : formatMoney(price),
      emoji: form.emoji,
      pages: form.pages.trim(),
      language: form.language,
      deliveryType: isPrint ? form.deliveryType : null,
      deliveryPrice: isPrint && form.deliveryType === 'PAID' ? Number(form.deliveryPrice) : null,
      // PUT quyidagi maydonlarni ham body'dagi qiymat bilan ustiga yozadi — yuborilmasa
      // kitob fayli (filePath), muqova ranglari va h.k. NULL bo'lib qoladi.
      ...(editItem ? {
        coverColor1: editItem.coverColor1 ?? null,
        coverColor2: editItem.coverColor2 ?? null,
        pageCount: editItem.pageCount ?? null,
        previewPages: editItem.previewPages ?? null,
        imageId: editItem.imageId ?? null,
        fileId: editItem.fileId ?? null,
        filePath: editItem.filePath ?? null,
      } : {}),
    };

    setSaving(true);
    try {
      if (editItem) {
        await api.put(`/admin/books/${editItem.id}`, payload);
        toast.success('Kitob saqlandi');
        clearPending();
        setModalOpen(false);
        void load(true);
        return;
      }

      let created = unwrap<AdminBook>(await api.post('/admin/books', payload));
      if (!created?.id) {
        toast.success('Kitob yaratildi');
        clearPending();
        setModalOpen(false);
        void load(true);
        return;
      }
      const bookId = created.id;

      // Kitob yaratildi — endi tanlangan fayllar yangi id'ga yuklanadi.
      // Biror fayl yuklanmasa kitob o'chmaydi: oyna tahrirlash rejimida ochiq qoladi.
      const failed: string[] = [];
      let firstError: unknown = null;
      if (pendingCover) {
        try { created = await postFile(bookId, 'upload-cover', pendingCover); }
        catch (e) { failed.push('muqova rasmi'); firstError ??= e; }
      }
      // Galereya rasmlari KETMA-KET yuklanadi (parallel so'rovda backend ro'yxatni ustiga yozadi)
      let failedImages = 0;
      for (const p of pendingImages) {
        try { created = await postFile(bookId, 'upload-image', p.file); }
        catch (e) { failedImages += 1; firstError ??= e; }
      }
      if (failedImages > 0) failed.push(`${failedImages} ta galereya rasmi`);
      if (pendingFile && !isPrint) {
        setFileUploading(true);
        try { created = await postBookFile(bookId, pendingFile); }
        catch (e) { failed.push('PDF fayl'); firstError ??= e; }
        finally { setFileUploading(false); setFilePct(null); }
      }

      clearPending();
      void load(true);
      if (failed.length > 0) {
        setEditItem(created);
        toast.error(`Kitob yaratildi, lekin yuklanmadi: ${failed.join(', ')}. ${apiErrorMessage(firstError, "Qayta yuklab ko'ring.")}`);
      } else {
        toast.success('Kitob yaratildi');
        setModalOpen(false);
      }
    } catch (e) {
      toast.error(apiErrorMessage(e, "Kitobni saqlab bo'lmadi. Qayta urinib ko'ring."));
    } finally {
      setSaving(false);
    }
  };

  // Muqova: tahrirlashda darhol yuklanadi, yaratishda faqat tanlanadi (saqlashda yuklanadi)
  const onCoverPicked = async (file: File) => {
    const problem = imageProblem(file);
    if (problem) { toast.error(problem); return; }
    if (!editItem) {
      dropUrl(pendingCoverUrl);
      setPendingCover(file);
      setPendingCoverUrl(makeUrl(file));
      return;
    }
    setUploading(true);
    try {
      setEditItem(await postFile(editItem.id, 'upload-cover', file));
      toast.success('Muqova yangilandi');
      void load(true);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Muqovani yuklab bo'lmadi. Qayta urinib ko'ring."));
    } finally {
      setUploading(false);
    }
  };

  // Galereya: tahrirlashda darhol, lekin KETMA-KET yuklanadi.
  // Parallel so'rovlarda backend bir xil eski ro'yxatni o'qib qayta yozadi va
  // rasmlar yo'qolib qoladi, shuning uchun har fayl navbat bilan yuboriladi.
  const onGalleryPicked = async (picked: File[]) => {
    const files: File[] = [];
    for (const f of picked) {
      const problem = imageProblem(f);
      if (problem) toast.error(problem);
      else files.push(f);
    }
    if (!files.length) return;
    if (!editItem) {
      setPendingImages((items) => [...items, ...files.map((f) => ({ file: f, url: makeUrl(f) }))]);
      return;
    }
    setGalleryUploading(true);
    let failed = 0;
    let firstError: unknown = null;
    try {
      for (const file of files) {
        try {
          setEditItem(await postFile(editItem.id, 'upload-image', file));
        } catch (e) {
          failed += 1;
          firstError ??= e;
        }
      }
      if (failed > 0) {
        toast.error(`${failed === files.length ? 'Rasmlar' : `${failed} ta rasm`} yuklanmadi. ${apiErrorMessage(firstError, "Qayta urinib ko'ring.")}`);
      }
      if (failed < files.length) void load(true);
    } finally {
      setGalleryUploading(false);
    }
  };

  // Galereyadan rasmni o'chirish
  const removeGalleryImage = async (path: string) => {
    if (!editItem) return;
    setGalleryUploading(true);
    try {
      const res = await api.delete(
        `/admin/books/${editItem.id}/images?path=${encodeURIComponent(path)}`,
      );
      setEditItem(unwrap<AdminBook>(res));
      void load(true);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Rasmni o'chirib bo'lmadi. Qayta urinib ko'ring."));
    } finally {
      setGalleryUploading(false);
    }
  };

  // Kitob fayli (PDF): tahrirlashda darhol yuklanadi, yaratishda saqlash bilan birga
  const onBookFilePicked = async (file: File) => {
    const problem = pdfProblem(file);
    if (problem) { toast.error(problem); return; }
    if (!editItem) { setPendingFile(file); return; }
    setFileUploading(true);
    try {
      setEditItem(await postBookFile(editItem.id, file));
      toast.success('PDF fayl yuklandi');
      void load(true);
    } catch (e) {
      toast.error(apiErrorMessage(e, "PDF faylni yuklab bo'lmadi. Qayta urinib ko'ring."));
    } finally {
      setFileUploading(false);
      setFilePct(null);
    }
  };

  // Serverga yuklangan PDF yoki muqovani olib tashlash (faqat tahrirlashda)
  const removeStored = async (kind: 'file' | 'cover') => {
    const target = editItem;
    if (!target || busy) return;
    const ok = await confirmDialog(kind === 'file'
      ? {
          title: 'Kitob fayli olib tashlansinmi?',
          message: `«${target.title}» kitobining PDF fayli serverdan o'chiriladi. Yangi fayl yuklanmaguncha kitob ilovada ochilmaydi. Bu amalni qaytarib bo'lmaydi.`,
          confirmText: 'Olib tashlash',
          danger: true,
        }
      : {
          title: 'Muqova rasmi olib tashlansinmi?',
          message: `«${target.title}» kitobining muqova rasmi serverdan o'chiriladi. Bu amalni qaytarib bo'lmaydi.`,
          confirmText: 'Olib tashlash',
          danger: true,
        });
    if (!ok) return;
    setRemoving(kind);
    try {
      const updated = unwrap<AdminBook | null>(await api.delete(`/admin/books/${target.id}/${kind}`));
      const cleared: Partial<AdminBook> = kind === 'file' ? { filePath: null } : { coverImage: undefined, coverUrl: undefined };
      // Javobda entity kelmasa ham forma holati yangilanadi
      const next: AdminBook = updated && typeof updated.id === 'number' ? { ...updated, ...cleared } : { ...target, ...cleared };
      setEditItem((cur) => (cur && cur.id === target.id ? next : cur));
      toast.success(kind === 'file' ? 'PDF fayl olib tashlandi' : 'Muqova rasmi olib tashlandi');
      void load(true);
    } catch (e) {
      toast.error(apiErrorMessage(e, kind === 'file'
        ? "PDF faylni olib tashlab bo'lmadi. Qayta urinib ko'ring."
        : "Muqovani olib tashlab bo'lmadi. Qayta urinib ko'ring."));
    } finally {
      setRemoving(null);
    }
  };

  const handleDelete = async (book: AdminBook) => {
    if (deletingId !== null) return;
    const ok = await confirmDialog({
      title: "Kitob o'chirilsinmi?",
      // user_books va book_ratings — ON DELETE CASCADE; sale_records kaskadsiz (sotilgan kitob o'chmaydi)
      message: `«${book.title}» butunlay o'chiriladi: kitob uni kutubxonasiga qo'shgan barcha foydalanuvchilardan olib tashlanadi, o'qish jarayoni va baholari ham o'chadi. Sotuvlar tarixida yozuvi bor (sotilgan) kitobni o'chirib bo'lmaydi. Bu amalni qaytarib bo'lmaydi.`,
      confirmText: "O'chirish",
      danger: true,
    });
    if (!ok) return;
    setDeletingId(book.id);
    try {
      await api.delete(`/admin/books/${book.id}`);
      toast.success("Kitob o'chirildi");
      void load(true);
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      toast.error(
        status === 500
          // Sotuv yozuvi (sale_records) kitobga bog'langan bo'lsa baza o'chirishga yo'l qo'ymaydi
          ? "Kitobni o'chirib bo'lmadi. Ehtimol, bu kitob sotilgan — sotuvlar tarixida yozuvi bor kitob o'chirilmaydi."
          : apiErrorMessage(e, "Kitobni o'chirib bo'lmadi. Qayta urinib ko'ring."),
      );
    } finally {
      setDeletingId(null);
    }
  };

  const emojis = !form.emoji || BOOK_EMOJIS.includes(form.emoji) ? BOOK_EMOJIS : [form.emoji, ...BOOK_EMOJIS];
  const languageNames = languages.map((l) => l.name);
  const languageOptions = form.language && !languageNames.includes(form.language)
    ? [form.language, ...languageNames]
    : languageNames;
  const editCover = coverPath(editItem);
  const isDigital = form.category === 'digital';
  const priceNum = Number(form.price) || 0;
  const deliveryNum = Number(form.deliveryPrice) || 0;

  return (
    <div>
      <PageHeader
        title="Kutubxona"
        description={
          loading || loadError
            ? 'Elektron va bosma kitoblarni boshqarish'
            : `Elektron va bosma kitoblarni boshqarish · jami ${formatNumber(books.length)} ta kitob`
        }
        actions={<Button onClick={openCreate}><Plus size={16} /> Yangi kitob</Button>}
      />

      <DataTable
        columns={[
          { key: 'cover', label: '', width: '52px', render: (b) => (
            coverPath(b)
              ? <img src={fileUrl(coverPath(b))} alt="" loading="lazy" className="w-9 h-12 object-cover rounded bg-gray-100" />
              : <span className="text-xl" aria-hidden="true">{b.emoji || '📚'}</span>
          )},
          { key: 'title', label: 'Nomi', render: (b) => (
            <div className="min-w-[9rem] max-w-[14rem] sm:max-w-xs">
              <p className="font-medium truncate" title={b.title}>{b.title}</p>
              <p className="text-xs text-gray-500 truncate" title={b.author}>{b.author || '—'}</p>
            </div>
          )},
          { key: 'category', label: 'Turi', render: (b) => (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${b.category === 'digital' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
              {b.category === 'digital' ? 'Elektron' : 'Bosma'}
            </span>
          )},
          { key: 'file', label: 'Fayl', render: (b) => (
            b.category !== 'digital'
              ? <span className="text-gray-300">—</span>
              : b.filePath
                ? <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 whitespace-nowrap">PDF bor</span>
                : <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 whitespace-nowrap" title="Fayl yuklanmagan — ilovada kitob ochilmaydi">Fayl yo'q</span>
          )},
          { key: 'price', label: 'Narx', render: (b) => (
            <div className="whitespace-nowrap">
              {b.isFree
                ? <span className="text-green-600 font-medium">Bepul</span>
                : formatMoney(b.price)}
              {b.category === 'print' && (
                <p className="text-xs text-gray-400">Yetkazish: {deliveryLabel(b)}</p>
              )}
            </div>
          )},
          { key: 'rating', label: 'Reyting', render: (b) => (
            <span className="whitespace-nowrap">
              ⭐ {typeof b.rating === 'number' ? b.rating.toFixed(1) : '—'}{' '}
              <span className="text-xs text-gray-400" title="Baholar soni">({formatNumber(b.reviewCount)})</span>
            </span>
          )},
        ]}
        data={filtered}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Nomi yoki muallif bo'yicha..."
        loading={loading}
        error={loadError}
        onRetry={() => void load()}
        emptyTitle={categoryFilter === 'all' ? "Hali kitob qo'shilmagan" : "Bu turda kitob yo'q"}
        emptyDescription={
          categoryFilter === 'all'
            ? "Birinchi kitobni qo'shing — u mobil ilovadagi kutubxonada ko'rinadi."
            : "Boshqa turni tanlang yoki yangi kitob qo'shing."
        }
        emptyAction={<Button onClick={openCreate}><Plus size={16} /> Yangi kitob</Button>}
        headerRight={
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'all' | Category)}
            aria-label="Kitob turi bo'yicha saralash"
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
          >
            <option value="all">Barcha turlar</option>
            <option value="digital">Elektron</option>
            <option value="print">Bosma</option>
          </select>
        }
        actions={(b) => {
          const giftCount = gifts.links.filter((l) => l.bookId === b.id).length;
          const isPrint = b.category === 'print';
          return (
          <>
            <button type="button" onClick={() => setGiftBook(b)}
              disabled={isPrint && giftCount === 0}
              title={
                isPrint && giftCount === 0
                  ? "Bosma kitobni sovg'a qilib bo'lmaydi — faqat elektron kitob"
                  : giftCount > 0
                    ? `Sovg'a sifatida biriktirilgan kurslar: ${giftCount} ta`
                    : "Kursga sovg'a sifatida biriktirish"
              }
              aria-label={`Kursga sovg'a sifatida biriktirish: ${b.title}`}
              className={
                'inline-flex items-center gap-1 p-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed ' +
                (giftCount > 0 ? 'bg-pink-50 text-pink-600 hover:bg-pink-100' : 'text-gray-400 hover:bg-pink-50 hover:text-pink-600')
              }>
              <Gift size={14} />{giftCount > 0 && <span>{giftCount}</span>}
            </button>
            <button type="button" onClick={() => openEdit(b)} title="Tahrirlash" aria-label={`Tahrirlash: ${b.title}`}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"><Pencil size={14} /></button>
            <button type="button" onClick={() => void handleDelete(b)} disabled={deletingId !== null}
              title="O'chirish" aria-label={`O'chirish: ${b.title}`}
              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed"><Trash2 size={14} /></button>
          </>
          );
        }}
      />

      <GiftLinkModal
        open={!!giftBook}
        onClose={() => setGiftBook(null)}
        title={giftBook ? `Sovg'a sifatida biriktirish — ${giftBook.title}` : "Sovg'a sifatida biriktirish"}
        description={
          <>
            Belgilangan kurslarni sotib olgan o'quvchi bu kitobni kutubxonasiga <b>bepul</b> oladi.
            Kurs belgilanganda uning hozirgi o'quvchilari ham kitobni oladi. Belgi olib tashlansa,
            avval berilgan kitoblar o'quvchilarda qoladi.
          </>
        }
        items={giftCourseItems}
        isSelected={(courseId) => !!giftBook && gifts.isLinked(courseId, giftBook.id)}
        isBusy={(courseId) => !!giftBook && gifts.isBusy(courseId, giftBook.id)}
        onToggle={(item) => void toggleGiftCourse(item)}
        loadError={gifts.loadError || giftCoursesError}
        emptyText="Hali kurs yo'q. Avval «Kurslar» bo'limida kurs yarating."
      />

      <Modal open={modalOpen} onClose={closeModal} closeDisabled={busy}
        title={editItem ? "Kitobni tahrirlash" : "Yangi kitob"} maxWidth="max-w-xl">
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => { e.preventDefault(); void handleSave(); }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="book-title" className={labelCls}>Nomi <span className="text-red-500">*</span></label>
              <input id="book-title" value={form.title} maxLength={255}
                aria-invalid={!!errors.title}
                onChange={(e) => setField('title', e.target.value)}
                className={inputCls + (errors.title ? errCls : '')} />
              {errors.title && <p className="text-xs text-red-600 mt-1">{errors.title}</p>}
            </div>
            <div>
              <label htmlFor="book-author" className={labelCls}>Muallif <span className="text-red-500">*</span></label>
              <input id="book-author" value={form.author} maxLength={255}
                aria-invalid={!!errors.author}
                onChange={(e) => setField('author', e.target.value)}
                className={inputCls + (errors.author ? errCls : '')} />
              {errors.author && <p className="text-xs text-red-600 mt-1">{errors.author}</p>}
            </div>
          </div>
          <div>
            <label htmlFor="book-description" className={labelCls}>Tavsif</label>
            <textarea id="book-description" value={form.description} onChange={(e) => setField('description', e.target.value)} rows={3} className={inputCls} />
          </div>

          {/* Emoji picker */}
          <div>
            <span className={labelCls}>Emoji</span>
            <div role="group" aria-label="Emoji" className="flex flex-wrap gap-1.5 p-2 border border-gray-200 rounded-lg max-h-28 overflow-y-auto">
              {emojis.map((em) => (
                <button
                  key={em}
                  type="button"
                  aria-label={`Emoji ${em}`}
                  aria-pressed={form.emoji === em}
                  onClick={() => setField('emoji', em)}
                  className={
                    'w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-colors ' +
                    (form.emoji === em ? 'bg-[var(--primary)]/15 ring-2 ring-[var(--primary)]' : 'hover:bg-gray-100')
                  }
                >
                  {em}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">Muqova rasmi yuklanmagan bo'lsa, ilovada shu emoji ko'rinadi.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="book-category" className={labelCls}>Turi</label>
              <select id="book-category" value={form.category} onChange={(e) => setField('category', e.target.value as Category)} className={inputCls}>
                <option value="digital">Elektron</option>
                <option value="print">Bosma</option>
              </select>
            </div>
            <div>
              <label htmlFor="book-pages" className={labelCls}>Sahifalar</label>
              <input id="book-pages" value={form.pages} maxLength={50} onChange={(e) => setField('pages', e.target.value)} className={inputCls} placeholder="380 bet" />
            </div>
            <div>
              <label htmlFor="book-language" className={labelCls}>Til</label>
              <select id="book-language" value={form.language} onChange={(e) => setField('language', e.target.value)} className={inputCls}>
                <option value="">— Tanlang —</option>
                {languageOptions.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              {languagesFailed && <p className="text-xs text-amber-600 mt-1">Tillar ro'yxati yuklanmadi — sahifani yangilang.</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
            <div>
              <label htmlFor="book-price" className={labelCls}>
                Narx (so'm) {!form.isFree && <span className="text-red-500">*</span>}
              </label>
              <input id="book-price" type="text" inputMode="numeric" autoComplete="off"
                value={form.isFree ? '' : form.price} disabled={form.isFree}
                placeholder={form.isFree ? 'Bepul' : '45000'}
                aria-invalid={!!errors.price}
                onChange={(e) => setField('price', digitsOnly(e.target.value))}
                className={inputCls + (form.isFree ? ' opacity-50 bg-gray-50' : '') + (errors.price ? errCls : '')} />
              {errors.price
                ? <p className="text-xs text-red-600 mt-1">{errors.price}</p>
                : !form.isFree && priceNum > 0 && <p className="text-xs text-gray-500 mt-1">Ilovada: {formatMoney(priceNum)}</p>}
            </div>
            <div className="flex items-start sm:pt-8">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isFree}
                  onChange={(e) => {
                    const free = e.target.checked;
                    // Bepul bo'lsa narx tozalanadi; qayta pullik qilinsa narx qaytadan kiritiladi
                    setForm((f) => ({ ...f, isFree: free, price: free ? '' : f.price }));
                    setErrors((er) => ({ ...er, price: undefined }));
                  }}
                  className="w-4 h-4 rounded" />
                <span className="text-sm text-gray-700">Bepul</span>
              </label>
            </div>
          </div>

          {/* Yetkazib berish — faqat bosma kitoblar uchun */}
          {form.category === 'print' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
              <label htmlFor="book-delivery" className="block text-sm font-medium text-gray-700 mb-2">📦 Yetkazib berish</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select id="book-delivery" value={form.deliveryType}
                  onChange={(e) => setField('deliveryType', e.target.value as DeliveryType)}
                  className={inputCls}>
                  <option value="FREE">Bepul</option>
                  <option value="NEGOTIABLE">Kelishiladi</option>
                  <option value="PAID">Pullik</option>
                </select>
                {form.deliveryType === 'PAID' && (
                  <input type="text" inputMode="numeric" autoComplete="off" value={form.deliveryPrice}
                    aria-label="Yetkazib berish narxi (so'm)"
                    aria-invalid={!!errors.deliveryPrice}
                    onChange={(e) => setField('deliveryPrice', digitsOnly(e.target.value))}
                    className={inputCls + (errors.deliveryPrice ? errCls : '')} placeholder="Yetkazib berish narxi (so'm)" />
                )}
              </div>
              {form.deliveryType === 'PAID' && errors.deliveryPrice && (
                <p className="text-xs text-red-600 mt-1">{errors.deliveryPrice}</p>
              )}
              {form.deliveryType === 'PAID' && !errors.deliveryPrice && deliveryNum > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  To'lovda umumiy summaga qo'shiladi: +{formatMoney(deliveryNum)}
                  {!form.isFree && priceNum > 0 && ` (jami ${formatMoney(priceNum + deliveryNum)})`}
                </p>
              )}
            </div>
          )}

          {/* Kitob fayli (PDF) — faqat elektron kitoblar uchun; ilovada o'quvchi shu faylni ochadi */}
          {isDigital && (
            <div>
              <span className={labelCls}>Kitob fayli (PDF)</span>
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 p-3">
                <FileText size={20} className={editItem?.filePath || pendingFile ? 'text-[var(--primary)] shrink-0' : 'text-gray-300 shrink-0'} />
                <div className="min-w-0 flex-1 text-sm">
                  {fileUploading ? (
                    <span className="text-gray-600">Yuklanmoqda… {filePct !== null ? `${filePct}%` : ''}</span>
                  ) : editItem ? (
                    editItem.filePath ? (
                      <a href={fileUrl(editItem.filePath)} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[var(--primary)] hover:underline">
                        Fayl yuklangan <ExternalLink size={12} />
                      </a>
                    ) : (
                      <span className="text-red-600">Fayl yuklanmagan — ilovada kitob ochilmaydi</span>
                    )
                  ) : pendingFile ? (
                    <span className="block truncate text-gray-700" title={pendingFile.name}>
                      {pendingFile.name} <span className="text-gray-400">({formatBytes(pendingFile.size)})</span>
                    </span>
                  ) : (
                    <span className="text-gray-500">Fayl tanlanmagan</span>
                  )}
                </div>
                {!editItem && pendingFile && !busy && (
                  <button type="button" onClick={() => setPendingFile(null)} title="Olib tashlash" aria-label="Tanlangan faylni olib tashlash"
                    className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X size={14} /></button>
                )}
                <label className={'inline-flex items-center gap-1.5 text-sm text-[var(--primary)] ' + (busy ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:underline')}>
                  <Upload size={14} /> {editItem?.filePath || pendingFile ? 'Almashtirish' : 'PDF tanlash'}
                  <input type="file" accept="application/pdf,.pdf" className="sr-only" disabled={busy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) void onBookFilePicked(f);
                    }} />
                </label>
                {editItem?.filePath && (
                  <button type="button" disabled={busy} onClick={() => void removeStored('file')}
                    className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline">
                    <Trash2 size={14} /> {removing === 'file' ? 'Olib tashlanmoqda…' : 'Olib tashlash'}
                  </button>
                )}
              </div>
              {fileUploading && filePct !== null && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuenow={filePct} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full bg-[var(--primary)] transition-all" style={{ width: `${filePct}%` }} />
                </div>
              )}
              <p className="text-xs text-gray-400 mt-1">
                {editItem
                  ? "Faqat PDF, 200 MB gacha. Tanlangan fayl darhol yuklanadi va eskisining o'rnini bosadi."
                  : 'Faqat PDF, 200 MB gacha. Fayl kitob saqlanganda yuklanadi.'}
              </p>
            </div>
          )}

          {/* Muqova rasmi (ixtiyoriy) — yaratishda ham, tahrirlashda ham */}
          <div>
            <span className={labelCls}>Muqova rasmi (ixtiyoriy)</span>
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-16 h-20 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center shrink-0">
                {editCover
                  ? <img src={fileUrl(editCover)} alt="Muqova" className="w-full h-full object-cover" />
                  : pendingCoverUrl
                      ? <img src={pendingCoverUrl} alt="Tanlangan muqova" className="w-full h-full object-cover" />
                      : <span className="text-2xl" aria-hidden="true">{form.emoji}</span>}
              </div>
              <label className={'inline-flex items-center gap-2 text-sm text-[var(--primary)] ' + (busy ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:underline')}>
                <ImageIcon size={15} /> {uploading ? 'Yuklanmoqda…' : editCover || pendingCoverUrl ? 'Rasmni almashtirish' : 'Rasm tanlash'}
                <input type="file" accept={IMAGE_ACCEPT} className="sr-only" disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    // Xuddi shu faylni qayta tanlash mumkin bo'lishi uchun
                    e.target.value = '';
                    if (f) void onCoverPicked(f);
                  }} />
              </label>
              {editItem && editCover && (
                <button type="button" disabled={busy} onClick={() => void removeStored('cover')}
                  className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline">
                  <Trash2 size={14} /> {removing === 'cover' ? 'Olib tashlanmoqda…' : 'Olib tashlash'}
                </button>
              )}
              {!editItem && pendingCoverUrl && !busy && (
                <button type="button"
                  onClick={() => { dropUrl(pendingCoverUrl); setPendingCover(null); setPendingCoverUrl(null); }}
                  className="text-sm text-gray-500 hover:text-red-600 hover:underline">Olib tashlash</button>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              JPG, PNG yoki WebP, 10 MB gacha.{' '}
              {editItem ? "Tanlangan rasm darhol yuklanadi; foydalanuvchi kitob tafsilotida shu rasmni ko'radi." : "Saqlanganda rasm ham yuklanadi."}
            </p>
          </div>

          {/* Galereya — bir nechta qo'shimcha rasm (mobil ilovada zoom bilan ko'rinadi) */}
          <div>
            <span className={labelCls}>Qo'shimcha rasmlar (galereya)</span>
            <div className="flex flex-wrap gap-2">
              {editItem
                ? parseGallery(editItem).map((p) => (
                    <div key={p} className="relative w-16 h-20 rounded-lg overflow-hidden bg-gray-100 group">
                      <img src={fileUrl(p)} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        title="Rasmni o'chirish"
                        aria-label="Rasmni o'chirish"
                        disabled={busy}
                        onClick={() => void removeGalleryImage(p)}
                        className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white transition sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-30"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))
                : pendingImages.map((p) => (
                    <div key={p.url} className="relative w-16 h-20 rounded-lg overflow-hidden bg-gray-100 group">
                      <img src={p.url} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        title="Olib tashlash"
                        aria-label="Rasmni olib tashlash"
                        disabled={busy}
                        onClick={() => {
                          dropUrl(p.url);
                          setPendingImages((items) => items.filter((it) => it.url !== p.url));
                        }}
                        className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white transition sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-30"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
              <label className={'w-16 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 transition ' + (busy ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-[var(--primary)] hover:text-[var(--primary)]')}>
                <Plus size={18} />
                <span className="text-[10px] mt-0.5">{galleryUploading ? 'Kuting…' : "Qo'shish"}</span>
                <input type="file" accept={IMAGE_ACCEPT} multiple className="sr-only" disabled={busy}
                  aria-label="Galereyaga rasm qo'shish"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    e.target.value = '';
                    if (files.length) void onGalleryPicked(files);
                  }} />
              </label>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Mobil ilovada kitob sahifasida galereya sifatida ko'rinadi; rasm bosilganda kattalashtirib ko'rish mumkin.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-4">
            {saving && !editItem && (pendingCover || pendingImages.length > 0 || pendingFile) && (
              <span className="mr-auto text-xs text-gray-500">Fayllar yuklanmoqda — oynani yopmang…</span>
            )}
            <Button variant="secondary" onClick={closeModal} disabled={busy}>{editItem ? 'Yopish' : 'Bekor qilish'}</Button>
            <Button type="submit" loading={saving} disabled={busyUpload}>{editItem ? 'Saqlash' : 'Yaratish'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
