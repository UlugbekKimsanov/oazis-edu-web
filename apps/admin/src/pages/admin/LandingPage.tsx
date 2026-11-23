import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  Plus,
  Trash2,
  Save,
  Eye,
  RotateCcw,
  GripVertical,
  X,
  ImagePlus,
  Play,
  BookOpen,
  Star,
  Users,
  Send,
  Camera,
  PlayCircle,
  Phone,
  Menu,
  Undo2,
  AlertTriangle,
  Info,
  // Icon-picker uchun (iconMap):
  GraduationCap,
  ClipboardCheck,
  MessageCircleQuestion,
  Clock,
  Video,
  Sparkles,
  Bot,
  Award,
  MessagesSquare,
  Brain,
  Timer,
  Globe,
  Headphones,
  Zap,
  TrendingUp,
  CheckCircle2,
  Activity,
  Library,
  MessageSquare,
  Dumbbell,
  Music,
  Bell,
  CreditCard,
  Settings,
  ClipboardList,
  FileQuestion,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import PageHeader from '../../components/ui/PageHeader';
import { ErrorState, LoadingState } from '../../components/ui/States';
import api, { API_ORIGIN, fileUrl } from '../../lib/api';
import { apiErrorMessage } from '../../lib/errors';
import { formatMoney, formatNumber } from '../../lib/format';
import type { Course as SystemCourse } from '../../lib/types';
import { confirmDialog, toast, useUiStore } from '../../stores/ui-store';
import {
  LANDING_ICON_NAMES,
  UnsupportedLandingSchemaError,
  createDefaultLandingContent,
  normalizeEditableLandingContent,
  type LandingContent,
  type LandingIconName,
} from '../../lib/landing-content';

/* =========================================================================
 *  Landing WYSIWYG muharriri
 *  — Landing sahifasining AYNAN vizual nusxasi (mint #E8F5EE, primary #2E9E6E),
 *    lekin har bir element joyida (inline) tahrirlanadi.
 *  Ranglar: index.css'dagi CSS o'zgaruvchilar (--primary / --primary-dark /
 *    --primary-light) orqali — landing'dagi bg-primary* klasslariga mos.
 * =======================================================================*/

// Landing endpointlari /api/... ostida (asosiy `api` baseURL /api/v1),
// shu sabab to'liq URL beramiz — token interceptor baribir ishlaydi.
const LANDING_API_ORIGIN = API_ORIGIN.replace(/\/+$/, '');
const LANDING_URL = `${LANDING_API_ORIGIN}/api/landing`;
const SAVE_URL = `${LANDING_API_ORIGIN}/api/admin/landing/content`;
const UPLOAD_URL = `${LANDING_API_ORIGIN}/api/admin/landing/upload`;
const PUBLIC_URL = 'https://oazisedu.uz';
const MAX_LANDING_IMAGE_BYTES = 5 * 1024 * 1024;
const LANDING_IMAGE_ACCEPT = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';
const ALLOWED_LANDING_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_LANDING_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

function unwrapApiData(value: unknown): unknown {
  if (value !== null && typeof value === 'object' && !Array.isArray(value) && 'data' in value) {
    return (value as { data?: unknown }).data;
  }
  return value;
}

async function requestLandingContent(signal?: AbortSignal): Promise<LandingContent> {
  const response = await api.get(LANDING_URL, { signal });
  return normalizeEditableLandingContent(unwrapApiData(response.data));
}

function landingLoadError(error: unknown): string {
  if (error instanceof UnsupportedLandingSchemaError) return error.message;
  return apiErrorMessage(error, "Landing kontentini yuklab bo'lmadi.");
}

function shortApiError(error: unknown, fallback: string): string {
  if (error === null || typeof error !== 'object') return fallback;

  const candidate = error as {
    message?: unknown;
    response?: { status?: number; data?: unknown };
  };
  const responseData = candidate.response?.data;
  let message: unknown;
  if (typeof responseData === 'string') {
    // Nginx (masalan 413) HTML sahifa qaytaradi — uni adminga ko'rsatmaymiz.
    if (!responseData.trimStart().startsWith('<')) message = responseData;
  } else if (responseData !== null && typeof responseData === 'object') {
    const body = responseData as { message?: unknown; error?: unknown };
    message = body.message ?? body.error;
  }

  if (typeof message !== 'string' || !message.trim()) {
    if (candidate.response?.status === 413) {
      return 'Fayl hajmi server ruxsat etgan chegaradan katta.';
    }
    // Tarmoq / timeout / 5xx — umumiy o'zbekcha matn; o'zimiz tashlagan Error — o'z matni.
    if (candidate.response || 'code' in candidate) return apiErrorMessage(error, fallback);
    return typeof candidate.message === 'string' && candidate.message.trim()
      ? candidate.message.trim()
      : fallback;
  }
  const compact = message.trim().replace(/\s+/g, ' ');
  return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact;
}

function validateLandingImage(file: File): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (
    !ALLOWED_LANDING_IMAGE_EXTENSIONS.has(extension) ||
    !ALLOWED_LANDING_IMAGE_TYPES.has(file.type.toLowerCase())
  ) {
    return 'Faqat JPG, PNG yoki WebP rasm yuklash mumkin.';
  }
  if (file.size === 0) {
    return "Bo'sh faylni yuklab bo'lmaydi.";
  }
  if (file.size > MAX_LANDING_IMAGE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return `Rasm hajmi 5 MB dan oshmasligi kerak (tanlangan fayl ${sizeMb} MB).`;
  }
  return null;
}

const uid = () =>
  (globalThis.crypto && 'randomUUID' in globalThis.crypto
    ? globalThis.crypto.randomUUID()
    : String(Date.now()) + Math.random().toString(16).slice(2));

/* ------------------------- Muharrir bo'limlari (o'tish) -------------------*/
type SectionId =
  | 'navbar'
  | 'hero'
  | 'features'
  | 'courseInfo'
  | 'goals'
  | 'testimonials'
  | 'courses'
  | 'bonus'
  | 'signup'
  | 'footer'
  | 'extra';

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'navbar', label: 'Navbar' },
  { id: 'hero', label: 'Hero' },
  { id: 'features', label: 'Afzalliklar' },
  { id: 'courseInfo', label: 'Kurslar haqida' },
  { id: 'goals', label: 'Maqsadlar' },
  { id: 'testimonials', label: 'Fikrlar' },
  { id: 'courses', label: 'Kurslar' },
  { id: 'bonus', label: 'Bonuslar' },
  { id: 'signup', label: 'Ariza formasi' },
  { id: 'footer', label: 'Footer' },
  { id: 'extra', label: "Qo'shimcha matnlar" },
];

const sectionLabel = (id: SectionId) => SECTIONS.find((s) => s.id === id)?.label ?? id;
const sectionDomId = (id: SectionId) => `landing-editor-${id}`;

function scrollToSection(id: SectionId) {
  document.getElementById(sectionDomId(id))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function SectionAnchor({ id, children }: { id: SectionId; children: ReactNode }) {
  // scroll-mt: yopishqoq boshqaruv paneli bo'lim boshini to'sib qo'ymasligi uchun.
  return (
    <div id={sectionDomId(id)} className="scroll-mt-56 lg:scroll-mt-32">
      {children}
    </div>
  );
}

/* ------------------------- Saqlashdan oldingi tekshiruv -------------------
 * Backend (LandingContentDto) qoidalarining nusxasi. Bu tekshiruv bo'lmasa:
 *  - bo'sh matn 400 xato bilan inglizcha maydon nomi ("hero.title: ...") qaytaradi;
 *  - noto'g'ri havola shared normalizer tomonidan INDAMAY standart qiymatga
 *    almashtirilib saytga chiqib ketadi (masalan Telegram havolasi).
 * -------------------------------------------------------------------------*/
interface LandingIssue {
  section: SectionId;
  text: string;
}

const HTTP_URL_RE = /^https?:\/\/[^\s]+$/;
const NAV_HREF_RE = /^(?:#[A-Za-z0-9_-]*|\/(?!\/)[^\s]*|https?:\/\/[^\s]+)$/;
const PHONE_RE = /^[+0-9()\-\s]{5,50}$/;
const COURSE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const ICON_NAME_RE = /^[A-Za-z][A-Za-z0-9]{0,63}$/;
const ASSET_PATH_RE = /^(?:\/(?!\/)[^\s]*|https?:\/\/[^\s]+|landing\/[A-Za-z0-9._-]+)$/;

const isValidLandingPhone = (phone: string) => {
  const value = phone.trim();
  return PHONE_RE.test(value) && value.replace(/\D/g, '').length >= 7;
};

function trimDeep<T>(value: T): T {
  if (typeof value === 'string') return value.trim() as T;
  if (Array.isArray(value)) return value.map((item) => trimDeep(item)) as T;
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, trimDeep(item)]),
    ) as T;
  }
  return value;
}

/**
 * Saqlashga tayyorlash: matnlar chetidagi bo'shliqlar olinadi, admin ko'ra
 * olmaydigan texnik maydonlar (ID, son) backend qoidasiga keltiriladi.
 */
function prepareLandingContent(content: LandingContent): LandingContent {
  const trimmed = trimDeep(content);

  const usedCourseIds = new Set<string>();
  const courses = trimmed.courses.map((course) => {
    let id = course.id;
    if (!COURSE_ID_RE.test(id) || usedCourseIds.has(id)) id = uid();
    usedCourseIds.add(id);
    return {
      ...course,
      id,
      students: Math.max(0, Math.trunc(course.students) || 0),
      rating: Math.min(5, Math.max(0, course.rating || 0)),
    };
  });

  // Fikr va kitob IDlari: musbat butun va takrorlanmas bo'lishi shart.
  const renumber = <T extends { id: number }>(items: T[]): T[] => {
    const used = new Set<number>();
    let next = items.reduce(
      (max, item) => (Number.isSafeInteger(item.id) && item.id > max ? item.id : max),
      0,
    );
    return items.map((item) => {
      let id = item.id;
      if (!Number.isSafeInteger(id) || id <= 0 || used.has(id)) {
        next += 1;
        id = next;
      }
      used.add(id);
      return { ...item, id };
    });
  };

  return {
    ...trimmed,
    courses,
    testimonials: renumber(trimmed.testimonials),
    bonusBooks: renumber(trimmed.bonusBooks),
  };
}

function validateLandingContent(c: LandingContent): LandingIssue[] {
  const issues: LandingIssue[] = [];
  const add = (section: SectionId, text: string) => issues.push({ section, text });

  const text = (section: SectionId, label: string, value: string, max: number) => {
    if (!value.trim()) add(section, `${label} bo'sh bo'lmasligi kerak.`);
    else if (value.length > max) {
      add(section, `${label} ${max} belgidan oshmasligi kerak (hozir ${value.length}).`);
    }
  };
  const count = (section: SectionId, label: string, length: number, max: number) => {
    if (length > max) add(section, `${label} soni ${max} tadan oshmasligi kerak (hozir ${length}).`);
  };
  const optionalUrl = (section: SectionId, label: string, value: string | undefined) => {
    if (!value) return;
    if (value.length > 2048 || !HTTP_URL_RE.test(value)) {
      add(section, `${label} http:// yoki https:// bilan boshlanadigan to'liq havola bo'lishi kerak.`);
    }
  };
  const image = (section: SectionId, label: string, value: string | undefined) => {
    if (!value) return;
    if (value.length > 2048 || !ASSET_PATH_RE.test(value)) {
      add(section, `${label} yo'li noto'g'ri — rasmni qayta yuklang yoki olib tashlang.`);
    }
  };
  const icon = (section: SectionId, label: string, value: string) => {
    if (!ICON_NAME_RE.test(value)) add(section, `${label}: ikonkani qayta tanlang.`);
  };
  const duplicates = (values: string[]) => {
    const seen = new Set<string>();
    const repeated = new Set<string>();
    values.forEach((value) => (seen.has(value) ? repeated.add(value) : seen.add(value)));
    return [...repeated];
  };

  // Navbar
  text('navbar', 'Logotip matni', c.navbar.logo, 100);
  text('navbar', "Navbar tugmasi matni", c.navbar.ctaLabel, 100);
  count('navbar', 'Navbar havolalari', c.navbar.links.length, 20);
  c.navbar.links.forEach((link, index) => {
    const name = `${index + 1}-havola`;
    text('navbar', `${name} matni`, link.label, 100);
    if (!link.href) add('navbar', `${name} manzili bo'sh bo'lmasligi kerak.`);
    else if (link.href.length > 2048 || !NAV_HREF_RE.test(link.href)) {
      add(
        'navbar',
        `${name} manzili noto'g'ri: #bolim (lotin harf, raqam, - va _), /sahifa yoki https://... bo'lishi kerak.`,
      );
    }
  });
  // Sayt havolalarni manzili bo'yicha farqlaydi (React key) — takror bo'lmasligi kerak.
  duplicates(c.navbar.links.map((link) => link.href)).forEach((href) =>
    add('navbar', `Bir xil manzilli havolalar bor ("${href}") — har bir havola manzili alohida bo'lsin.`),
  );

  // Hero + ko'rsatkichlar
  text('hero', 'Asosiy sarlavha', c.hero.title, 1000);
  text('hero', 'Sarlavha osti matni', c.hero.subtitle, 4000);
  text('hero', 'Birinchi tugma matni', c.hero.primaryBtn, 100);
  text('hero', 'Ikkinchi tugma matni', c.hero.secondaryBtn, 100);
  count('hero', "Ko'rsatkichlar", c.stats.length, 20);
  c.stats.forEach((stat, index) => {
    text('hero', `${index + 1}-ko'rsatkich qiymati`, stat.value, 100);
    text('hero', `${index + 1}-ko'rsatkich nomi`, stat.label, 100);
  });
  duplicates(c.stats.map((stat) => stat.label)).forEach((label) =>
    add('hero', `Bir xil nomli ko'rsatkichlar bor ("${label}") — nomlari har xil bo'lsin.`),
  );

  // Afzalliklar / Kurslar haqida
  text('features', "Bo'lim sarlavhasi", c.featuresTitle, 255);
  count('features', 'Kartalar', c.features.length, 50);
  c.features.forEach((item, index) => {
    text('features', `${index + 1}-karta matni`, item.text, 1000);
    icon('features', `${index + 1}-karta`, item.icon);
  });
  text('courseInfo', "Bo'lim sarlavhasi", c.courseInfoTitle, 255);
  count('courseInfo', 'Kartalar', c.courseInfo.length, 50);
  c.courseInfo.forEach((item, index) => {
    text('courseInfo', `${index + 1}-karta matni`, item.text, 1000);
    icon('courseInfo', `${index + 1}-karta`, item.icon);
  });

  // Maqsadlar
  text('goals', "Bo'lim sarlavhasi", c.goalsTitle, 255);
  count('goals', 'Maqsadlar', c.goals.length, 50);
  c.goals.forEach((goal, index) => {
    text('goals', `${index + 1}-maqsad matni`, goal.title, 1000);
    icon('goals', `${index + 1}-maqsad`, goal.icon);
    image('goals', `${index + 1}-maqsad rasmi`, goal.image);
  });

  // Fikrlar
  text('testimonials', "Bo'lim sarlavhasi", c.testimonialsTitle, 255);
  count('testimonials', 'Fikrlar', c.testimonials.length, 100);
  c.testimonials.forEach((item, index) => {
    text('testimonials', `${index + 1}-fikr: ism`, item.name, 255);
    text('testimonials', `${index + 1}-fikr: kurs nomi`, item.course, 255);
    optionalUrl('testimonials', `${index + 1}-fikr: video havolasi`, item.videoUrl);
    image('testimonials', `${index + 1}-fikr rasmi`, item.image);
  });

  // Kurslar
  text('courses', "Bo'lim sarlavhasi", c.coursesTitle, 255);
  text('courses', 'Kategoriya matni', c.courseCard.categoryLabel, 100);
  text('courses', "O'quvchi birligi matni", c.courseCard.studentsLabel, 100);
  text('courses', 'Xarid tugmasi matni', c.courseCard.buyLabel, 100);
  // Kurs kartalari endi tizimdagi haqiqiy kurslardan olinadi (sotuvdagi kurslar) —
  // kontentdagi eski `courses` ro'yxati saytda ko'rsatilmaydi va bu yerda tahrirlanmaydi,
  // shuning uchun u tekshirilmaydi (tuzatib bo'lmaydigan xato chiqmasligi uchun).

  // Bonuslar
  text('bonus', "Bo'lim sarlavhasi", c.bonusTitle, 255);
  text('bonus', 'Bonus matni', c.bonusText, 4000);
  count('bonus', 'Kitoblar', c.bonusBooks.length, 100);
  c.bonusBooks.forEach((book, index) => {
    text('bonus', `${index + 1}-kitob nomi`, book.title, 255);
    image('bonus', `${index + 1}-kitob muqovasi`, book.cover);
  });

  // Ariza formasi
  text('signup', 'Chap tomondagi matn', c.cta.description, 4000);
  text('signup', 'Forma sarlavhasi', c.cta.title, 255);
  text('signup', 'Ism maydoni nomi', c.cta.nameLabel, 100);
  text('signup', 'Telefon maydoni nomi', c.cta.phoneLabel, 100);
  text('signup', 'Yuborish tugmasi matni', c.cta.submitLabel, 100);

  // Footer + kontaktlar
  text('footer', 'Ijtimoiy sahifalar sarlavhasi', c.footer.socialTitle, 255);
  text('footer', 'Aloqa markazi sarlavhasi', c.footer.contactTitle, 255);
  text('footer', 'Kompaniya nomi', c.footer.company, 255);
  if (!c.contacts.phone) add('footer', "Telefon raqami bo'sh bo'lmasligi kerak.");
  else if (!isValidLandingPhone(c.contacts.phone)) {
    add(
      'footer',
      "Telefon raqami noto'g'ri: faqat raqam, +, bo'sh joy, qavs va chiziqcha ishlatiladi (masalan +998 71 200 53 53).",
    );
  }
  optionalUrl('footer', 'Telegram havolasi', c.contacts.telegram);
  optionalUrl('footer', 'Instagram havolasi', c.contacts.instagram);
  optionalUrl('footer', 'YouTube havolasi', c.contacts.youtube);

  // Qo'shimcha matnlar
  text('extra', 'Mobil menyu accessibility matni', c.navbar.menuLabel, 100);
  text('extra', 'Modal sarlavhasi', c.leadModal.title, 255);
  text('extra', 'Modal tavsifi', c.leadModal.description, 4000);
  text('extra', 'Modalni yopish matni', c.leadModal.closeLabel, 100);
  text('extra', 'Ixtiyoriy maydon belgisi', c.leadForm.optionalLabel, 100);
  text('extra', 'Ism placeholderi', c.leadForm.namePlaceholder, 255);
  text('extra', 'Telefon placeholderi', c.leadForm.phonePlaceholder, 255);
  text('extra', 'Yuborilayotgan holat matni', c.leadForm.loadingLabel, 100);
  text('extra', "Telefon noto'g'ri kiritilgandagi xabar", c.leadForm.invalidPhoneMessage, 1000);
  text('extra', 'Muvaffaqiyatli yuborilgandagi xabar', c.leadForm.successMessage, 1000);
  text('extra', 'Server xatosidagi xabar', c.leadForm.errorMessage, 1000);

  return issues;
}

/* ----------------------- Rasm yuklanishini kuzatish -----------------------
 * Rasm yuklanayotgan paytda "Saqlash" bosilsa, yangi rasm saqlangan kontentga
 * kirmay qoladi — shu sabab sahifa nechta yuklash ketayotganini biladi.
 * -------------------------------------------------------------------------*/
const UploadTrackerContext = createContext<(delta: 1 | -1) => void>(() => {});

/* ------------------------------ Lucide icon map --------------------------*/
const iconMap = {
  GraduationCap,
  ClipboardCheck,
  MessageCircleQuestion,
  Clock,
  Video,
  Sparkles,
  Bot,
  Award,
  MessagesSquare,
  Brain,
  Timer,
  BookOpen,
  Star,
  Users,
  Globe,
  Headphones,
  Zap,
  TrendingUp,
  CheckCircle2,
  Activity,
  Library,
  MessageSquare,
  PlayCircle,
  Dumbbell,
  Music,
  Bell,
  CreditCard,
  Settings,
  ClipboardList,
  FileQuestion,
  UserCheck,
  Camera,
  Send,
} satisfies Record<LandingIconName, LucideIcon>;

const getIcon = (name: string): LucideIcon =>
  LANDING_ICON_NAMES.includes(name as LandingIconName)
    ? iconMap[name as LandingIconName]
    : Sparkles;

function IconGlyph({ name, className }: { name: string; className: string }) {
  return createElement(getIcon(name), { className });
}

/* ============================ Inline primitivlar ==========================*/

const inlineCore = 'outline-none rounded-md px-1 -mx-1 transition-colors';
const inlineBase = `bg-transparent ${inlineCore}`;
// Bo'sh majburiy maydon yoki noto'g'ri havola — admin xato qayerdaligini ko'rsin.
const invalidLight = 'bg-red-50 ring-1 ring-red-400';
const invalidDark = 'bg-red-500/30 ring-1 ring-red-200';
const inlineLight =
  'placeholder:text-gray-400 hover:bg-black/[0.04] focus:bg-white focus:ring-2 focus:ring-[var(--primary)]/40';
const inlineDark =
  'placeholder:text-white/50 hover:bg-white/10 focus:bg-white/15 focus:ring-2 focus:ring-white/50';

function InlineText({
  value,
  onChange,
  className = '',
  placeholder,
  dark = false,
  type = 'text',
  step,
  min,
  max,
  title,
  required = true,
  invalid = false,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  dark?: boolean;
  type?: 'text' | 'number' | 'url' | 'tel';
  step?: string;
  min?: string;
  max?: string;
  title?: string;
  /** Bo'sh qoldirib bo'lmaydigan matn (backend @NotBlank) — bo'sh bo'lsa qizil belgilanadi. */
  required?: boolean;
  invalid?: boolean;
}) {
  const trimmed = value.trim();
  const bad =
    invalid ||
    (required && !trimmed) ||
    (type === 'url' && trimmed !== '' && !HTTP_URL_RE.test(trimmed));
  const tone = dark ? inlineDark : inlineLight;
  return (
    <input
      type={type}
      step={step}
      min={min}
      max={max}
      value={value}
      title={title}
      aria-label={title ?? placeholder}
      aria-invalid={bad || undefined}
      placeholder={placeholder ?? (required ? 'Matn kiriting' : undefined)}
      onChange={(e) => onChange(e.target.value)}
      className={`${
        bad ? `${inlineCore} ${dark ? invalidDark : invalidLight}` : inlineBase
      } ${tone} ${className}`}
    />
  );
}

// Balandligi matnga qarab avtomatik o'sadigan textarea (sarlavha/uzun matnlar).
function InlineArea({
  value,
  onChange,
  className = '',
  placeholder = 'Matn kiriting',
  dark = false,
  title,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  dark?: boolean;
  title?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  });
  // Barcha InlineArea maydonlari majburiy matn — bo'sh bo'lsa qizil belgilanadi.
  const bad = !value.trim();
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      title={title}
      aria-label={title ?? placeholder}
      aria-invalid={bad || undefined}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${
        bad ? `${inlineCore} ${dark ? invalidDark : invalidLight}` : inlineBase
      } block w-full resize-none overflow-hidden ${dark ? inlineDark : inlineLight} ${className}`}
    />
  );
}

/* -------------------------------- Icon picker ----------------------------*/
function IconPicker({
  value,
  onChange,
  triggerClassName = '',
  iconClassName = 'h-6 w-6',
  dark = false,
}: {
  value: string;
  onChange: (name: string) => void;
  triggerClassName?: string;
  iconClassName?: string;
  dark?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title="Ikonka tanlash"
        aria-label="Ikonka tanlash"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={
          triggerClassName ||
          (dark
            ? 'flex items-center justify-center rounded-lg p-1 hover:bg-white/15'
            : 'flex items-center justify-center rounded-lg p-1 hover:bg-black/5')
        }
      >
        <IconGlyph name={value} className={iconClassName} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-64 max-w-[calc(100vw-3rem)] rounded-xl border border-gray-200 bg-white p-3 text-left shadow-xl">
          <input
            value={value}
            readOnly
            aria-label="Tanlangan ikonka"
            className="mb-2 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700 outline-none focus:border-[var(--primary)]"
          />
          <div className="grid max-h-48 grid-cols-6 gap-1 overflow-y-auto">
            {LANDING_ICON_NAMES.map((name) => {
              const active = name === value;
              return (
                <button
                  key={name}
                  type="button"
                  title={name}
                  aria-label={name}
                  aria-pressed={active}
                  onClick={() => {
                    onChange(name);
                    setOpen(false);
                  }}
                  className={`flex items-center justify-center rounded-lg p-2 ${
                    active ? 'bg-[var(--primary)] text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <IconGlyph name={name} className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------- Rasm slot ------------------------------*/
async function uploadLandingImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await api.post(UPLOAD_URL, fd);
  const data = res.data?.data ?? res.data;
  const path = data?.path;
  if (typeof path !== 'string' || !path) {
    throw new Error("Server rasm yo'lini qaytarmadi.");
  }
  return path;
}

function ImageSlot({
  value,
  onChange,
  className = '',
  rounded = 'rounded-2xl',
  children,
}: {
  value?: string;
  onChange: (path: string) => void;
  className?: string;
  rounded?: string;
  children?: ReactNode;
}) {
  const trackUpload = useContext(UploadTrackerContext);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const url = fileUrl(value);
  const pick = async (file?: File) => {
    if (!file || uploading) return;
    const validationError = validateLandingImage(file);
    if (validationError) {
      setUploadError(validationError);
      toast.error(validationError);
      return;
    }

    setUploadError('');
    setUploading(true);
    trackUpload(1);
    try {
      const path = await uploadLandingImage(file);
      onChange(path);
    } catch (uploadFailure) {
      const message = shortApiError(uploadFailure, "Rasmni yuklab bo'lmadi.");
      setUploadError(message);
      toast.error(message);
    } finally {
      setUploading(false);
      trackUpload(-1);
    }
  };
  return (
    <div className={`group/slot relative ${rounded} ${className}`}>
      {url ? (
        <img src={url} alt="" className={`h-full w-full object-cover ${rounded}`} />
      ) : (
        children
      )}
      {uploading ? (
        <div
          role="status"
          aria-label="Rasm yuklanmoqda"
          className={`absolute inset-0 z-10 flex items-center justify-center bg-black/45 ${rounded}`}
        >
          <span className="block h-6 w-6 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        </div>
      ) : null}
      {/* Sensorli ekranda hover yo'q — tugmalar doim ko'rinadi. */}
      <div
        className={`absolute right-1.5 top-1.5 z-10 flex gap-1 transition focus-within:opacity-100 group-hover/slot:opacity-100 [@media(hover:none)]:opacity-100 ${
          uploading ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <label
          className={`rounded-md bg-black/50 p-1.5 text-white shadow focus-within:ring-2 focus-within:ring-white hover:bg-black/70 ${
            uploading ? 'cursor-wait' : 'cursor-pointer'
          }`}
          title="Rasm yuklash (JPG, PNG yoki WebP, 5 MB gacha)"
        >
          <ImagePlus size={14} />
          <input
            type="file"
            accept={LANDING_IMAGE_ACCEPT}
            aria-label="Rasm yuklash"
            className="sr-only"
            disabled={uploading}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              void pick(file);
            }}
          />
        </label>
        {value && !uploading ? (
          <button
            type="button"
            onClick={() => {
              setUploadError('');
              onChange('');
            }}
            className="rounded-md bg-black/50 p-1.5 text-white shadow hover:bg-red-600"
            title="Rasmni olib tashlash"
            aria-label="Rasmni olib tashlash"
          >
            <X size={14} />
          </button>
        ) : null}
      </div>
      {uploadError ? (
        <p
          role="alert"
          title={uploadError}
          className="absolute inset-x-1 bottom-1 z-20 max-h-12 overflow-auto rounded-md bg-red-700/95 px-2 py-1 text-[10px] font-medium leading-tight text-white shadow"
        >
          {uploadError}
        </p>
      ) : null}
    </div>
  );
}

/* --------------------------- Sudraladigan ro'yxat ------------------------*/
type HandleProps = Record<string, unknown>;

function SortableCell({
  id,
  children,
  className = '',
}: {
  id: string;
  className?: string;
  children: (args: { handleProps: HandleProps; isDragging: boolean }) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 40 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group/item relative ${isDragging ? 'opacity-90' : ''} ${className}`}
    >
      {children({ handleProps: { ...attributes, ...listeners }, isDragging })}
    </div>
  );
}

function SortableList<T>({
  items,
  onChange,
  idPrefix,
  containerClassName = '',
  renderItem,
  footer,
  describe,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  idPrefix: string;
  containerClassName?: string;
  footer?: ReactNode;
  /** O'chirishni tasdiqlash oynasida ko'rsatiladigan element nomi. */
  describe?: (item: T) => string;
  renderItem: (args: {
    item: T;
    index: number;
    update: (patch: Partial<T>) => void;
    remove: () => void;
    handleProps: HandleProps;
    isDragging: boolean;
  }) => ReactNode;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Har bir elementga barqaror kalit. Avval kalit indeks edi (`nav-0`, `nav-1`):
  // tartib o'zgarganda yoki element o'chirilganda kartaning ichki holati
  // (rasm yuklanishi, xato matni) qo'shni kartaga "ko'chib" qolardi.
  const [keys, setKeys] = useState<string[]>(() => items.map(() => `${idPrefix}-${uid()}`));
  let ids = keys;
  if (keys.length !== items.length) {
    // Tashqaridan qo'shilgan element (oxiriga) yoki qisqargan ro'yxat.
    ids =
      keys.length < items.length
        ? [...keys, ...items.slice(keys.length).map(() => `${idPrefix}-${uid()}`)]
        : keys.slice(0, items.length);
    setKeys(ids);
  }

  // Asinxron amallar (rasm yuklash, tasdiqlash oynasi) tugaganda ro'yxatning
  // ESKI nusxasi ustiga yozib yubormaslik uchun eng so'nggi holat ref'da turadi.
  const latest = useRef({ items, ids, onChange });
  const alive = useRef(true);
  useEffect(() => {
    latest.current = { items, ids, onChange };
  });
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const updateByKey = (key: string, patch: Partial<T>) => {
    if (!alive.current) return;
    const current = latest.current;
    const index = current.ids.indexOf(key);
    if (index === -1) return; // element shu orada o'chirilgan
    current.onChange(current.items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const removeByKey = async (key: string) => {
    const before = latest.current;
    const beforeIndex = before.ids.indexOf(key);
    if (beforeIndex === -1) return;
    const rawName = describe?.(before.items[beforeIndex]).trim() ?? '';
    const name = rawName.length > 60 ? `${rawName.slice(0, 57)}...` : rawName;
    const ok = await confirmDialog({
      title: "Element o'chirilsinmi?",
      message: `${name ? `"${name}"` : 'Bu element'} ro'yxatdan olib tashlanadi. Saytga «Saqlash» bosilgandan keyin chiqadi.`,
      confirmText: "O'chirish",
      danger: true,
    });
    if (!ok || !alive.current) return;
    const current = latest.current;
    const index = current.ids.indexOf(key);
    if (index === -1) return;
    setKeys(current.ids.filter((id) => id !== key));
    current.onChange(current.items.filter((_, i) => i !== index));
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    setKeys(arrayMove(ids, from, to));
    onChange(arrayMove(items, from, to));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className={containerClassName}>
          {items.map((item, index) => {
            const key = ids[index];
            return (
              <SortableCell key={key} id={key}>
                {({ handleProps, isDragging }) =>
                  renderItem({
                    item,
                    index,
                    isDragging,
                    handleProps,
                    update: (patch) => updateByKey(key, patch),
                    remove: () => void removeByKey(key),
                  })
                }
              </SortableCell>
            );
          })}
          {footer}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// Element ustidagi kichik boshqaruv paneli: sudrash + o'chirish.
function ItemControls({
  handleProps,
  onRemove,
  align = 'right',
}: {
  handleProps: HandleProps;
  onRemove: () => void;
  align?: 'left' | 'right';
}) {
  return (
    <div
      className={`absolute top-2 z-20 flex gap-1 opacity-0 transition focus-within:opacity-100 group-hover/item:opacity-100 [@media(hover:none)]:opacity-100 ${
        align === 'left' ? 'left-2' : 'right-2'
      }`}
    >
      <button
        type="button"
        {...(handleProps as Record<string, unknown>)}
        className="cursor-grab touch-none rounded-md bg-white p-1 text-gray-500 shadow ring-1 ring-gray-200 active:cursor-grabbing"
        title="Sudrab tartiblang"
        aria-label="Sudrab tartiblang"
      >
        <GripVertical size={14} />
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-md bg-white p-1 text-gray-500 shadow ring-1 ring-gray-200 hover:text-red-600"
        title="O'chirish"
        aria-label="O'chirish"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function AddCard({
  onClick,
  label,
  className = '',
}: {
  onClick: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label || "Qo'shish"}
      aria-label={label || "Qo'shish"}
      className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 p-6 text-sm font-medium text-gray-400 transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] ${className}`}
    >
      <Plus size={20} />
      {label}
    </button>
  );
}

/* ---------------------------- Layout yordamchilari -----------------------*/
function Container({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
  );
}

function PreviewSection({
  id,
  bg,
  title,
  onTitle,
  children,
}: {
  id?: string;
  bg: string;
  title: string;
  onTitle: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <section id={id} className={`py-16 sm:py-20 ${bg}`}>
      <Container>
        <div className="mb-10 text-center sm:mb-14">
          <InlineArea
            value={title}
            onChange={onTitle}
            className="mx-auto max-w-3xl text-center text-2xl font-bold text-gray-900 sm:text-3xl md:text-4xl"
          />
        </div>
        {children}
      </Container>
    </section>
  );
}

/* ================================ Bo'limlar ==============================*/

function NavbarEditor({
  value,
  onChange,
}: {
  value: LandingContent['navbar'];
  onChange: (v: LandingContent['navbar']) => void;
}) {
  const set = (p: Partial<LandingContent['navbar']>) => onChange({ ...value, ...p });
  return (
    <header className="rounded-t-2xl border-b border-gray-100 bg-white/90 backdrop-blur">
      <Container className="flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2">
        <InlineText
          title="Logotip matni"
          value={value.logo}
          onChange={(logo) => set({ logo })}
          className="w-32 text-xl font-extrabold tracking-tight text-[var(--primary)]"
        />
        {/* Tor ekranda ham havolalar tahrirlanishi kerak — shuning uchun yashirilmaydi. */}
        <nav className="flex flex-wrap items-center gap-2">
          <SortableList
            items={value.links}
            onChange={(links) => set({ links })}
            idPrefix="nav"
            describe={(item) => item.label}
            containerClassName="flex flex-wrap items-center gap-2"
            footer={
              <button
                type="button"
                onClick={() => set({ links: [...value.links, { label: 'Havola', href: '#' }] })}
                title="Havola qo'shish"
                aria-label="Havola qo'shish"
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-dashed border-gray-300 text-gray-400 hover:border-[var(--primary)] hover:text-[var(--primary)]"
              >
                <Plus size={14} />
              </button>
            }
            renderItem={({ item, update, remove, handleProps }) => (
              <div className="group/item relative flex flex-col">
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    {...(handleProps as Record<string, unknown>)}
                    className="cursor-grab touch-none text-gray-300 hover:text-gray-500"
                    title="Sudrab tartiblang"
                    aria-label="Sudrab tartiblang"
                  >
                    <GripVertical size={12} />
                  </button>
                  <InlineText
                    value={item.label}
                    onChange={(label) => update({ label })}
                    title="Havola matni"
                    className="w-24 text-sm font-medium text-gray-600"
                  />
                  <button
                    type="button"
                    onClick={remove}
                    className="text-gray-300 hover:text-red-600"
                    title="Havolani o'chirish"
                    aria-label="Havolani o'chirish"
                  >
                    <X size={12} />
                  </button>
                </div>
                <InlineText
                  value={item.href}
                  onChange={(href) => update({ href })}
                  invalid={!NAV_HREF_RE.test(item.href.trim())}
                  title="Havola manzili: #bolim, /sahifa yoki https://..."
                  placeholder="#havola"
                  className="ml-3.5 w-24 text-[10px] text-gray-400"
                />
              </div>
            )}
          />
          <span className="inline-flex items-center justify-center rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white">
            <InlineText
              value={value.ctaLabel}
              onChange={(ctaLabel) => set({ ctaLabel })}
              dark
              className="w-32 text-center text-white"
            />
          </span>
        </nav>
        <Menu aria-hidden className="h-6 w-6 text-gray-700 md:hidden" />
      </Container>
    </header>
  );
}

function HeroEditor({
  hero,
  stats,
  onHero,
  onStats,
}: {
  hero: LandingContent['hero'];
  stats: LandingContent['stats'];
  onHero: (p: Partial<LandingContent['hero']>) => void;
  onStats: (s: LandingContent['stats']) => void;
}) {
  return (
    <section
      id="top"
      className="relative overflow-hidden bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] text-white"
    >
      <Container className="py-20 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <InlineArea
            dark
            value={hero.title}
            onChange={(title) => onHero({ title })}
            className="text-center text-3xl font-extrabold leading-tight sm:text-4xl md:text-5xl"
          />
          <InlineArea
            dark
            value={hero.subtitle}
            onChange={(subtitle) => onHero({ subtitle })}
            className="mx-auto mt-6 max-w-2xl text-center text-base text-white/85 sm:text-lg"
          />
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <span className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-semibold text-[var(--primary)] shadow-sm">
              <InlineText
                value={hero.primaryBtn}
                onChange={(primaryBtn) => onHero({ primaryBtn })}
                className="w-36 text-center text-[var(--primary)]"
              />
            </span>
            <span className="inline-flex items-center justify-center rounded-xl border-2 border-white px-6 py-3 text-sm font-semibold text-white">
              <InlineText
                dark
                value={hero.secondaryBtn}
                onChange={(secondaryBtn) => onHero({ secondaryBtn })}
                className="w-24 text-center text-white"
              />
            </span>
          </div>
        </div>

        <div className="mx-auto mt-14 max-w-3xl">
          <SortableList
            items={stats}
            onChange={onStats}
            idPrefix="stat"
            describe={(item) => `${item.value} ${item.label}`}
            containerClassName="grid grid-cols-3 gap-4 sm:gap-8"
            footer={
              <button
                type="button"
                onClick={() => onStats([...stats, { value: '0', label: 'Nomi' }])}
                title="Ko'rsatkich qo'shish"
                aria-label="Ko'rsatkich qo'shish"
                className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-white/40 text-xs font-medium text-white/70 hover:border-white hover:text-white"
              >
                <Plus size={18} />
              </button>
            }
            renderItem={({ item, update, remove, handleProps }) => (
              <div className="group/item relative text-center">
                <ItemControls handleProps={handleProps} onRemove={remove} />
                <InlineText
                  dark
                  value={item.value}
                  onChange={(value) => update({ value })}
                  className="w-full text-center text-2xl font-extrabold sm:text-4xl"
                />
                <InlineText
                  dark
                  value={item.label}
                  onChange={(label) => update({ label })}
                  className="mt-1 w-full text-center text-xs text-white/75 sm:text-sm"
                />
              </div>
            )}
          />
        </div>
      </Container>
    </section>
  );
}

// Features + CourseInfo (bir xil FeatureCard grid).
function FeatureGridEditor({
  id,
  bg,
  title,
  onTitle,
  items,
  onItems,
  addTemplate,
}: {
  id?: string;
  bg: string;
  title: string;
  onTitle: (v: string) => void;
  items: LandingContent['features'];
  onItems: (items: LandingContent['features']) => void;
  addTemplate: LandingContent['features'][number];
}) {
  return (
    <PreviewSection id={id} bg={bg} title={title} onTitle={onTitle}>
      <SortableList
        items={items}
        onChange={onItems}
        idPrefix="feat"
        describe={(item) => item.text}
        containerClassName="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
        footer={
          <AddCard
            onClick={() => onItems([...items, { ...addTemplate }])}
            label="Qo'shish"
            className="min-h-[150px]"
          />
        }
        renderItem={({ item, update, remove, handleProps }) => (
          <div className="group/item relative flex h-full flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
            <ItemControls handleProps={handleProps} onRemove={remove} />
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
              <IconPicker
                value={item.icon}
                onChange={(icon) => update({ icon })}
                triggerClassName="flex h-full w-full items-center justify-center rounded-xl hover:bg-[var(--primary)]/10"
              />
            </div>
            <InlineArea
              value={item.text}
              onChange={(text) => update({ text })}
              className="text-sm font-medium leading-relaxed text-gray-700"
            />
          </div>
        )}
      />
    </PreviewSection>
  );
}

function GoalsEditor({
  title,
  onTitle,
  goals,
  onGoals,
}: {
  title: string;
  onTitle: (v: string) => void;
  goals: LandingContent['goals'];
  onGoals: (g: LandingContent['goals']) => void;
}) {
  return (
    <PreviewSection bg="bg-white" title={title} onTitle={onTitle}>
      <SortableList
        items={goals}
        onChange={onGoals}
        idPrefix="goal"
        describe={(item) => item.title}
        containerClassName="grid grid-cols-1 gap-6 md:grid-cols-3"
        footer={
          <AddCard
            onClick={() => onGoals([...goals, { icon: 'Timer', title: 'Yangi maqsad' }])}
            label="Maqsad qo'shish"
            className="min-h-[240px]"
          />
        }
        renderItem={({ item, update, remove, handleProps }) => (
          <div className="group/item relative flex flex-col rounded-2xl border border-gray-100 bg-white shadow-sm">
            <ItemControls handleProps={handleProps} onRemove={remove} align="left" />
            <ImageSlot
              value={item.image}
              onChange={(image) => update({ image })}
              className="h-40 w-full"
              rounded="rounded-t-2xl"
            >
              <div className="flex h-40 w-full items-center justify-center rounded-t-2xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] text-white">
                <IconPicker
                  dark
                  value={item.icon}
                  onChange={(icon) => update({ icon })}
                  iconClassName="h-14 w-14"
                  triggerClassName="flex items-center justify-center rounded-xl p-2 hover:bg-white/15"
                />
              </div>
            </ImageSlot>
            <div className="p-6">
              <InlineArea
                value={item.title}
                onChange={(title) => update({ title })}
                className="text-sm font-medium leading-relaxed text-gray-700"
              />
            </div>
          </div>
        )}
      />
    </PreviewSection>
  );
}

function TestimonialsEditor({
  title,
  onTitle,
  items,
  onItems,
}: {
  title: string;
  onTitle: (v: string) => void;
  items: LandingContent['testimonials'];
  onItems: (t: LandingContent['testimonials']) => void;
}) {
  return (
    <section id="testimonials" className="bg-[var(--primary-light)] py-16 sm:py-20">
      <Container>
        <div className="mb-10 text-center sm:mb-14">
          <InlineArea
            value={title}
            onChange={onTitle}
            className="mx-auto max-w-3xl text-center text-2xl font-bold text-gray-900 sm:text-3xl md:text-4xl"
          />
        </div>
        <SortableList
          items={items}
          onChange={onItems}
          idPrefix="tst"
          describe={(item) => `${item.name} — ${item.course}`}
          containerClassName="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5"
          footer={
            <AddCard
              onClick={() =>
                onItems([...items, { id: Date.now(), name: "O'quvchi fikri", course: 'Kurs' }])
              }
              label="Qo'shish"
              className="min-h-[220px]"
            />
          }
          renderItem={({ item, update, remove, handleProps }) => (
            <div className="group/item relative flex flex-col rounded-2xl bg-white shadow-sm">
              <ItemControls handleProps={handleProps} onRemove={remove} align="left" />
              <ImageSlot
                value={item.image}
                onChange={(image) => update({ image })}
                className="aspect-[3/4] w-full"
                rounded="rounded-t-2xl"
              >
                <div className="relative flex aspect-[3/4] w-full items-center justify-center rounded-t-2xl bg-gradient-to-br from-[var(--primary)]/80 to-[var(--primary-dark)]">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg">
                    <Play className="h-6 w-6 fill-white" />
                  </span>
                </div>
              </ImageSlot>
              <div className="p-3">
                <InlineText
                  value={item.name}
                  onChange={(name) => update({ name })}
                  className="w-full text-xs font-semibold text-gray-800"
                />
                <InlineText
                  value={item.course}
                  onChange={(course) => update({ course })}
                  className="w-full text-xs text-gray-500"
                />
                <InlineText
                  type="url"
                  value={item.videoUrl ?? ''}
                  onChange={(videoUrl) => update({ videoUrl })}
                  required={false}
                  placeholder="Video havolasi (https://...)"
                  className="mt-1 w-full text-[10px] text-gray-400"
                />
              </div>
            </div>
          )}
        />
      </Container>
    </section>
  );
}

/** Landing kartasidagi o'quvchilar soni — fokusdan chiqqanda yoki Enter bosilganda saqlanadi. */
function StudentsInput({
  value,
  disabled,
  onCommit,
}: {
  value: number;
  disabled: boolean;
  onCommit: (next: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const parsed = Number(draft);
    const next = draft.trim() === '' || !Number.isFinite(parsed) ? 0 : Math.max(0, Math.trunc(parsed));
    setDraft(null);
    if (next !== value) onCommit(next);
  };
  return (
    <input
      type="number"
      min={0}
      step={1}
      inputMode="numeric"
      disabled={disabled}
      value={draft ?? String(value)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') setDraft(null);
      }}
      title="Saytda ko'rsatiladigan o'quvchilar soni (yozib, Enter bosing)"
      aria-label="O'quvchilar soni"
      className="w-16 rounded-md border border-dashed border-gray-300 bg-transparent px-1.5 py-0.5 text-xs text-gray-700 outline-none focus:border-[var(--primary)] disabled:opacity-60"
    />
  );
}

/**
 * Landing «Kurslar» bo'limi — tizimdagi HAQIQIY kurslar (admin «Kurslar» bo'limi).
 * Bu yerda kurs yaratilmaydi: mavjud kurs sotuvga chiqariladi yoki sotuvdan olinadi,
 * saytda ko'rinadigan o'quvchilar soni belgilanadi. Bu amallar darhol saqlanadi
 * (sahifaning «Saqlash» tugmasiga bog'liq emas); nom, narx, muqova «Kurslar»da tahrirlanadi.
 */
function CoursesEditor({
  title,
  onTitle,
  copy,
  onCopy,
}: {
  title: string;
  onTitle: (v: string) => void;
  copy: LandingContent['courseCard'];
  onCopy: (p: Partial<LandingContent['courseCard']>) => void;
}) {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<SystemCourse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    api
      .get('/admin/courses')
      .then((res) => {
        if (!active) return;
        const list: unknown = res.data?.data ?? res.data;
        setCourses(Array.isArray(list) ? (list as SystemCourse[]) : []);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (active) setLoadError(apiErrorMessage(err, "Kurslar ro'yxatini yuklab bo'lmadi."));
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const patchSale = async (
    course: SystemCourse,
    body: { onSale?: boolean; landingStudents?: number },
    okText: string,
  ) => {
    if (busyId !== null) return;
    setBusyId(course.id);
    try {
      const res = await api.patch(`/admin/courses/${course.id}/sale`, body);
      const saved = (res.data?.data ?? {}) as Partial<SystemCourse>;
      setCourses((prev) =>
        prev
          ? prev.map((c) =>
              c.id === course.id
                ? {
                    ...c,
                    onSale: saved.onSale ?? body.onSale ?? c.onSale,
                    landingStudents: saved.landingStudents ?? body.landingStudents ?? c.landingStudents,
                  }
                : c,
            )
          : prev,
      );
      toast.success(okText);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Saqlab bo'lmadi. Qayta urinib ko'ring."));
    } finally {
      setBusyId(null);
    }
  };

  const takeOffSale = async (course: SystemCourse) => {
    const ok = await confirmDialog({
      title: 'Kurs sotuvdan olinsinmi?',
      message: `«${course.name}» saytdagi «Kurslar» bo'limidan olib tashlanadi. Kursning o'zi, darslari va o'quvchilari o'zgarmaydi — istalgan payt qayta sotuvga chiqarish mumkin.`,
      confirmText: 'Sotuvdan olish',
      danger: true,
    });
    if (ok) await patchSale(course, { onSale: false }, `«${course.name}» sotuvdan olindi`);
  };

  const onSale = (courses ?? []).filter((c) => c.onSale);
  const offSale = (courses ?? []).filter((c) => !c.onSale);
  const priceText = (c: SystemCourse) =>
    !c.isPremium ? 'Bepul' : c.priceLabel || (c.price ? formatMoney(c.price) : 'Narx kiritilmagan');

  return (
    <PreviewSection id="courses" bg="bg-white" title={title} onTitle={onTitle}>
      <p className="mx-auto mb-6 flex max-w-3xl items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
        <Info size={16} className="mt-0.5 shrink-0" />
        <span>
          Bu yerda tizimdagi haqiqiy kurslar ko'rinadi. Saytga faqat <b>sotuvdagi</b> kurslar chiqadi.
          Sotuvga chiqarish, sotuvdan olish va o'quvchilar soni <b>darhol saqlanadi</b>. Kurs nomi,
          narxi, muqovasi va tartibi{' '}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => navigate('/admin/courses')}
          >
            «Kurslar»
          </button>{' '}
          bo'limida o'zgartiriladi.
        </span>
      </p>

      {loadError ? (
        <div className="mx-auto max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          <p>{loadError}</p>
          <button
            type="button"
            className="mt-3 font-semibold underline"
            onClick={() => {
              setLoadError(null);
              setReloadKey((k) => k + 1);
            }}
          >
            Qayta urinish
          </button>
        </div>
      ) : courses === null ? (
        <p className="py-10 text-center text-sm text-gray-400">Kurslar yuklanmoqda...</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {onSale.map((course) => {
            const cover = fileUrl(course.coverImage || course.backgroundImage);
            const busy = busyId === course.id;
            return (
              <div
                key={course.id}
                className={`flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${busy ? 'opacity-60' : ''}`}
              >
                {cover ? (
                  <img
                    src={cover}
                    alt={course.name}
                    loading="lazy"
                    className="mb-4 h-28 w-full rounded-xl object-cover"
                  />
                ) : (
                  <div className="mb-4 flex h-28 items-center justify-center rounded-xl bg-[var(--primary-light)] text-5xl">
                    <span>{course.flagEmoji || '🎓'}</span>
                  </div>
                )}
                <span className="mb-2 inline-block w-fit rounded-full bg-[var(--primary-light)] px-3 py-1 text-xs font-semibold text-[var(--primary)]">
                  <InlineText
                    value={copy.categoryLabel}
                    onChange={(categoryLabel) => onCopy({ categoryLabel })}
                    title="Barcha kurs kartalari uchun kategoriya matni"
                    className="w-24 text-xs font-semibold text-[var(--primary)]"
                  />
                </span>
                <h3 className="text-base font-bold text-gray-900">{course.name}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    <StudentsInput
                      value={course.landingStudents ?? 0}
                      disabled={busyId !== null}
                      onCommit={(landingStudents) =>
                        void patchSale(course, { landingStudents }, "O'quvchilar soni saqlandi")
                      }
                    />
                    <InlineText
                      value={copy.studentsLabel}
                      onChange={(studentsLabel) => onCopy({ studentsLabel })}
                      title="Barcha kurs kartalari uchun o'quvchi birligi"
                      className="w-16 text-xs"
                    />
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <BookOpen className="h-3.5 w-3.5" /> {formatNumber(course.lessonCount)} dars
                  </span>
                </div>
                <div className="mt-auto pt-4">
                  <span className="text-lg font-bold text-gray-900">{priceText(course)}</span>
                </div>
                <span className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-white">
                  {course.isPremium ? (
                    <InlineText
                      dark
                      value={copy.buyLabel}
                      onChange={(buyLabel) => onCopy({ buyLabel })}
                      title="Barcha pullik kurs kartalari uchun xarid tugmasi"
                      className="w-full text-center text-sm font-semibold text-white"
                    />
                  ) : (
                    'Bepul boshlash'
                  )}
                </span>
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => void takeOffSale(course)}
                  className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  <X size={14} /> Sotuvdan olish
                </button>
              </div>
            );
          })}
          <AddCard
            onClick={() => setPickerOpen(true)}
            label="Kurs qo'shish"
            className="min-h-[320px]"
          />
        </div>
      )}

      {pickerOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-gray-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="course-picker-title"
          onMouseDown={(e) => {
            if (e.currentTarget === e.target) setPickerOpen(false);
          }}
        >
          <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div>
                <h3 id="course-picker-title" className="text-base font-bold text-gray-900">
                  Sotuvga chiqariladigan kursni tanlang
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  Ro'yxatda tizimda mavjud, lekin hozir sotuvda bo'lmagan kurslar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Yopish"
              >
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto p-3">
              {offSale.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-gray-500">
                  <p>Tizimdagi barcha kurslar allaqachon sotuvda.</p>
                  <button
                    type="button"
                    className="mt-2 font-semibold text-[var(--primary)] underline"
                    onClick={() => navigate('/admin/courses')}
                  >
                    Yangi kurs yaratish («Kurslar» bo'limi)
                  </button>
                </div>
              ) : (
                <ul className="space-y-2">
                  {offSale.map((course) => {
                    const cover = fileUrl(course.coverImage || course.backgroundImage);
                    const noPrice = course.isPremium && !(course.price && course.price > 0);
                    return (
                      <li
                        key={course.id}
                        className="flex items-center gap-3 rounded-xl border border-gray-200 p-2.5"
                      >
                        <div className="flex h-11 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--primary-light)] text-xl">
                          {cover ? (
                            <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" />
                          ) : (
                            <span>{course.flagEmoji || '🎓'}</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gray-900" title={course.name}>
                            {course.name}
                          </p>
                          <p className={`text-xs ${noPrice ? 'text-red-600' : 'text-gray-500'}`}>
                            {priceText(course)} · {formatNumber(course.lessonCount)} dars
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={busyId !== null || noPrice}
                          title={noPrice ? "Avval «Kurslar» bo'limida narxini kiriting" : undefined}
                          onClick={() =>
                            void patchSale(course, { onSale: true }, `«${course.name}» sotuvga chiqarildi`)
                          }
                          className="shrink-0 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--primary-dark)] disabled:opacity-50"
                        >
                          {busyId === course.id ? 'Saqlanmoqda...' : 'Sotuvga chiqarish'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </PreviewSection>
  );
}

function BonusesEditor({
  title,
  onTitle,
  text,
  onText,
  books,
  onBooks,
}: {
  title: string;
  onTitle: (v: string) => void;
  text: string;
  onText: (v: string) => void;
  books: LandingContent['bonusBooks'];
  onBooks: (b: LandingContent['bonusBooks']) => void;
}) {
  return (
    <PreviewSection bg="bg-[var(--primary-light)]" title={title} onTitle={onTitle}>
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <SortableList
          items={books}
          onChange={onBooks}
          idPrefix="book"
          describe={(item) => item.title}
          containerClassName="grid grid-cols-3 gap-4 sm:grid-cols-4"
          footer={
            <AddCard
              onClick={() => onBooks([...books, { id: Date.now(), title: 'Yangi kitob' }])}
              label=""
              className="aspect-[3/4] p-2"
            />
          }
          renderItem={({ item, update, remove, handleProps }) => (
            <div className="group/item relative">
              <ItemControls handleProps={handleProps} onRemove={remove} align="left" />
              <ImageSlot
                value={item.cover}
                onChange={(cover) => update({ cover })}
                className="aspect-[3/4] w-full shadow-sm"
                rounded="rounded-xl"
              >
                <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] p-3 text-center text-white shadow-sm">
                  <BookOpen className="h-7 w-7" />
                  <InlineText
                    dark
                    value={item.title}
                    onChange={(title) => update({ title })}
                    className="w-full text-center text-[10px] font-medium leading-tight"
                  />
                </div>
              </ImageSlot>
              {item.cover ? (
                <InlineText
                  value={item.title}
                  onChange={(title) => update({ title })}
                  title="Kitob nomi (rasmning alt matni)"
                  className="mt-1 w-full text-center text-[10px] text-gray-600"
                />
              ) : null}
            </div>
          )}
        />
        <div>
          <InlineArea
            value={text}
            onChange={onText}
            className="text-2xl font-bold leading-snug text-gray-900 sm:text-3xl"
          />
        </div>
      </div>
    </PreviewSection>
  );
}

function SignupEditor({
  cta,
  onCta,
}: {
  cta: LandingContent['cta'];
  onCta: (p: Partial<LandingContent['cta']>) => void;
}) {
  return (
    <section
      id="royxatdan-otish"
      className="bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] py-16 sm:py-20"
    >
      <Container>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="text-white">
            <InlineArea
              dark
              value={cta.description}
              onChange={(description) => onCta({ description })}
              className="text-2xl font-bold leading-snug sm:text-3xl md:text-4xl"
            />
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-lg sm:p-8">
            <InlineText
              value={cta.title}
              onChange={(title) => onCta({ title })}
              className="mb-5 w-full text-xl font-bold text-gray-900"
            />
            <div className="space-y-4">
              <div>
                <InlineText
                  value={cta.nameLabel}
                  onChange={(nameLabel) => onCta({ nameLabel })}
                  className="mb-1 block w-full text-sm font-medium text-gray-600"
                />
                <div className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-400">
                  {cta.nameLabel || 'Ism'}
                </div>
              </div>
              <div>
                <InlineText
                  value={cta.phoneLabel}
                  onChange={(phoneLabel) => onCta({ phoneLabel })}
                  className="mb-1 block w-full text-sm font-medium text-gray-600"
                />
                <div className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-400">
                  {cta.phoneLabel || 'Telefon raqam'}
                </div>
              </div>
              <span className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-white">
                <InlineText
                  dark
                  value={cta.submitLabel}
                  onChange={(submitLabel) => onCta({ submitLabel })}
                  className="w-40 text-center text-white"
                />
              </span>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

function FooterEditor({
  logo,
  onLogo,
  footer,
  onFooter,
  contacts,
  onContacts,
}: {
  logo: string;
  onLogo: (v: string) => void;
  footer: LandingContent['footer'];
  onFooter: (p: Partial<LandingContent['footer']>) => void;
  contacts: LandingContent['contacts'];
  onContacts: (p: Partial<LandingContent['contacts']>) => void;
}) {
  const social = (Icon: LucideIcon, value: string, onChange: (v: string) => void, ph: string) => (
    <div className="flex items-center gap-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
        <Icon className="h-4 w-4" />
      </span>
      <InlineText
        dark
        type="url"
        value={value}
        onChange={onChange}
        required={false}
        placeholder={ph}
        className="flex-1 text-sm text-white/80"
      />
    </div>
  );
  return (
    <footer className="rounded-b-2xl bg-[var(--primary-dark)] text-white">
      <Container className="py-12">
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <InlineText
              dark
              value={logo}
              onChange={onLogo}
              className="w-40 text-xl font-extrabold"
            />
            <InlineText
              dark
              value={footer.socialTitle}
              onChange={(socialTitle) => onFooter({ socialTitle })}
              className="mt-3 w-full text-sm font-semibold text-white/70"
            />
            <div className="mt-3 max-w-xs space-y-2">
              {social(Send, contacts.telegram, (telegram) => onContacts({ telegram }), 'Telegram URL')}
              {social(Camera, contacts.instagram, (instagram) => onContacts({ instagram }), 'Instagram URL')}
              {social(PlayCircle, contacts.youtube, (youtube) => onContacts({ youtube }), 'YouTube URL')}
            </div>
          </div>
          <div className="sm:text-right">
            <InlineText
              dark
              value={footer.contactTitle}
              onChange={(contactTitle) => onFooter({ contactTitle })}
              className="ml-auto w-full text-sm font-semibold text-white/70 sm:text-right"
            />
            <div className="mt-3 inline-flex items-center gap-2 text-lg font-bold">
              <Phone className="h-5 w-5" />
              <InlineText
                dark
                type="tel"
                value={contacts.phone}
                onChange={(phone) => onContacts({ phone })}
                invalid={!isValidLandingPhone(contacts.phone)}
                title="Telefon raqami: faqat raqam, +, bo'sh joy, qavs va chiziqcha"
                className="w-48 text-lg font-bold"
              />
            </div>
          </div>
        </div>
        <div className="mt-10 border-t border-white/10 pt-6 text-center">
          <InlineText
            dark
            value={footer.company}
            onChange={(company) => onFooter({ company })}
            className="w-full text-center text-sm text-white/60"
          />
        </div>
      </Container>
    </footer>
  );
}

function CopyField({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  // Bu maydonlarning barchasi backendda majburiy (@NotBlank).
  const empty = !value.trim();
  const className = `mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-800 outline-none transition focus:ring-2 ${
    empty
      ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15'
      : 'border-gray-200 focus:border-[var(--primary)] focus:ring-[var(--primary)]/15'
  }`;

  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-600">
        {label} <span className="text-red-500">*</span>
      </span>
      {multiline ? (
        <textarea
          rows={3}
          value={value}
          aria-invalid={empty || undefined}
          onChange={(event) => onChange(event.target.value)}
          className={`${className} resize-y`}
        />
      ) : (
        <input
          value={value}
          aria-invalid={empty || undefined}
          onChange={(event) => onChange(event.target.value)}
          className={className}
        />
      )}
      {empty ? (
        <span className="mt-1 block text-xs text-red-600">Bo'sh qoldirib bo'lmaydi</span>
      ) : null}
    </label>
  );
}

function AdditionalCopyEditor({
  navbar,
  onNavbar,
  leadForm,
  onLeadForm,
  leadModal,
  onLeadModal,
}: {
  navbar: LandingContent['navbar'];
  onNavbar: (p: Partial<LandingContent['navbar']>) => void;
  leadForm: LandingContent['leadForm'];
  onLeadForm: (p: Partial<LandingContent['leadForm']>) => void;
  leadModal: LandingContent['leadModal'];
  onLeadModal: (p: Partial<LandingContent['leadModal']>) => void;
}) {
  return (
    <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-gray-900">Modal, forma va accessibility matnlari</h2>
      <p className="mt-1 text-xs text-gray-500">
        Previewda doim ko'rinmaydigan holat xabarlari va yordamchi matnlarni shu yerda tahrirlang.
      </p>

      <div className="mt-5 grid gap-6 xl:grid-cols-3">
        <fieldset className="space-y-3 rounded-xl border border-gray-100 p-4">
          <legend className="px-1 text-sm font-semibold text-gray-800">Navigatsiya va modal</legend>
          <CopyField
            label="Mobil menyu accessibility matni"
            value={navbar.menuLabel}
            onChange={(menuLabel) => onNavbar({ menuLabel })}
          />
          <CopyField
            label="Modal sarlavhasi"
            value={leadModal.title}
            onChange={(title) => onLeadModal({ title })}
          />
          <CopyField
            multiline
            label="Modal tavsifi"
            value={leadModal.description}
            onChange={(description) => onLeadModal({ description })}
          />
          <CopyField
            label="Modalni yopish accessibility matni"
            value={leadModal.closeLabel}
            onChange={(closeLabel) => onLeadModal({ closeLabel })}
          />
        </fieldset>

        <fieldset className="space-y-3 rounded-xl border border-gray-100 p-4">
          <legend className="px-1 text-sm font-semibold text-gray-800">Forma yordamchi matnlari</legend>
          <CopyField
            label="Ixtiyoriy maydon belgisi"
            value={leadForm.optionalLabel}
            onChange={(optionalLabel) => onLeadForm({ optionalLabel })}
          />
          <CopyField
            label="Ism placeholderi"
            value={leadForm.namePlaceholder}
            onChange={(namePlaceholder) => onLeadForm({ namePlaceholder })}
          />
          <CopyField
            label="Telefon placeholderi"
            value={leadForm.phonePlaceholder}
            onChange={(phonePlaceholder) => onLeadForm({ phonePlaceholder })}
          />
          <CopyField
            label="Yuborilayotgan holat matni"
            value={leadForm.loadingLabel}
            onChange={(loadingLabel) => onLeadForm({ loadingLabel })}
          />
        </fieldset>

        <fieldset className="space-y-3 rounded-xl border border-gray-100 p-4">
          <legend className="px-1 text-sm font-semibold text-gray-800">Forma natija xabarlari</legend>
          <CopyField
            multiline
            label="Telefon noto'g'ri kiritilganda"
            value={leadForm.invalidPhoneMessage}
            onChange={(invalidPhoneMessage) => onLeadForm({ invalidPhoneMessage })}
          />
          <CopyField
            multiline
            label="Muvaffaqiyatli yuborilganda"
            value={leadForm.successMessage}
            onChange={(successMessage) => onLeadForm({ successMessage })}
          />
          <CopyField
            multiline
            label="Server xatosida"
            value={leadForm.errorMessage}
            onChange={(errorMessage) => onLeadForm({ errorMessage })}
          />
        </fieldset>
      </div>
    </section>
  );
}

/* ================================ Sahifa ================================*/
export default function LandingPage() {
  const navigate = useNavigate();
  const [content, setContent] = useState<LandingContent | null>(null);
  // Serverda turgan (oxirgi yuklangan/saqlangan) kontent — "o'zgargan" belgisini aniqlash uchun.
  const [saved, setSaved] = useState<LandingContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploads, setUploads] = useState(0);
  // Kontent butunlay almashtirilganda (qayta yuklash / bekor qilish / standart)
  // kanvas qayta quriladi — kartalarning ichki holati eski kontentdan qolib ketmaydi.
  const [revision, setRevision] = useState(0);
  const [showIssues, setShowIssues] = useState(false);
  const savingRef = useRef(false);

  const fetchContent = async () => {
    setLoading(true);
    setError('');
    try {
      const nextContent = await requestLandingContent();
      setContent(nextContent);
      setSaved(nextContent);
      setShowIssues(false);
      setRevision((value) => value + 1);
    } catch (loadError) {
      setError(landingLoadError(loadError));
      setContent(null);
      setSaved(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void requestLandingContent(controller.signal)
      .then((nextContent) => {
        if (controller.signal.aborted) return;
        setContent(nextContent);
        setSaved(nextContent);
        setError('');
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(landingLoadError(loadError));
        setContent(null);
        setSaved(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const trackUpload = useCallback(
    (delta: 1 | -1) => setUploads((value) => Math.max(0, value + delta)),
    [],
  );

  const savedJson = useMemo(() => (saved ? JSON.stringify(saved) : ''), [saved]);
  const dirty = useMemo(
    () => content !== null && content !== saved && JSON.stringify(content) !== savedJson,
    [content, saved, savedJson],
  );

  // Birinchi muvaffaqiyatsiz saqlashdan keyin xatolar ro'yxati jonli yangilanadi.
  const issues = useMemo(
    () => (showIssues && content ? validateLandingContent(prepareLandingContent(content)) : []),
    [showIssues, content],
  );

  const patch = (p: Partial<LandingContent>) => setContent((c) => (c ? { ...c, ...p } : c));

  const save = async () => {
    if (!content || savingRef.current) return;
    if (uploads > 0) {
      toast.info('Rasm yuklanishi tugashini kuting, keyin saqlang.');
      return;
    }

    const prepared = prepareLandingContent(content);
    const found = validateLandingContent(prepared);
    if (found.length > 0) {
      setShowIssues(true);
      toast.error(
        `Saqlanmadi: ${found.length} ta xato bor. ${sectionLabel(found[0].section)} — ${found[0].text}`,
      );
      scrollToSection(found[0].section);
      return;
    }

    let canonicalContent: LandingContent;
    try {
      canonicalContent = normalizeEditableLandingContent(prepared);
    } catch (schemaError) {
      toast.error(
        schemaError instanceof UnsupportedLandingSchemaError
          ? schemaError.message
          : "Kontentni saqlashga tayyorlab bo'lmadi.",
      );
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      await api.put(SAVE_URL, canonicalContent);
      setSaved(canonicalContent);
      // Saqlash davomida admin yozishda davom etgan bo'lsa, uning matnini ustidan yozmaymiz.
      setContent((current) => (current === content ? canonicalContent : current));
      setShowIssues(false);
      toast.success("Saqlandi — o'zgarishlar saytda ko'rinadi.");
    } catch (saveError) {
      toast.error(
        shortApiError(saveError, "Saqlab bo'lmadi. O'zgarishlaringiz shu sahifada turibdi — qayta urinib ko'ring."),
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const discardChanges = async () => {
    if (!saved || !dirty || savingRef.current) return;
    const ok = await confirmDialog({
      title: "Saqlanmagan o'zgarishlar tashlab yuborilsinmi?",
      message: "Oxirgi saqlangan holatga qaytiladi. Kiritilgan o'zgarishlarni qayta tiklab bo'lmaydi.",
      confirmText: 'Tashlab yuborish',
      cancelText: 'Tahrirni davom ettirish',
      danger: true,
    });
    if (!ok) return;
    setContent(saved);
    setShowIssues(false);
    setRevision((value) => value + 1);
    toast.info('Oxirgi saqlangan holat tiklandi.');
  };

  const resetToDefault = async () => {
    if (savingRef.current) return;
    const ok = await confirmDialog({
      title: 'Standart kontentga qaytarilsinmi?',
      message:
        "Barcha matnlar, ro'yxatlar va rasmlar boshlang'ich (standart) holatga almashtiriladi. Saytga faqat «Saqlash» bosilgandan keyin chiqadi.",
      confirmText: 'Ha, qaytarish',
      danger: true,
    });
    if (!ok) return;
    setContent(createDefaultLandingContent());
    setShowIssues(false);
    setRevision((value) => value + 1);
    toast.info('Standart kontent qo\'yildi. Saytga chiqarish uchun «Saqlash» tugmasini bosing.');
  };

  // Ctrl/Cmd+S — saqlash. Handler doim eng so'nggi `save`ni chaqirishi uchun ref.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 's') return;
      event.preventDefault();
      if (useUiStore.getState().confirmState) return;
      void saveRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Saqlanmagan o'zgarishlar bilan sahifadan chiqib ketishdan himoya.
  useEffect(() => {
    if (!dirty) return;

    // Yorliqni yopish / yangilash / tashqi manzilga o'tish.
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Eski brauzerlar ogohlantirishni faqat returnValue orqali ko'rsatadi.
      event.returnValue = '';
    };

    // Panel ichidagi havolalar (yon menyu). Ilova BrowserRouter'da ishlaydi, unda
    // useBlocker yo'q — shu sabab havola bosilishini capture bosqichida ushlaymiz:
    // preventDefault qilingan bosishni react-router <Link> o'zi e'tiborsiz qoldiradi.
    const onLinkClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if ((anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;

      event.preventDefault();
      void confirmDialog({
        title: "Saqlanmagan o'zgarishlar bor",
        message: "Sahifadan chiqsangiz, landing'ga kiritilgan o'zgarishlar yo'qoladi.",
        confirmText: 'Saqlamasdan chiqish',
        cancelText: 'Sahifada qolish',
        danger: true,
      }).then((ok) => {
        if (ok) navigate(`${url.pathname}${url.search}${url.hash}`);
      });
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onLinkClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onLinkClick, true);
    };
  }, [dirty, navigate]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Landing sahifasi" description="Ommaviy sayt kontenti muharriri" />
        <LoadingState label="Landing kontenti yuklanmoqda..." />
      </div>
    );
  }
  if (error || !content) {
    return (
      <div>
        <PageHeader title="Landing sahifasi" description="Ommaviy sayt kontenti muharriri" />
        <ErrorState
          message={error || "Landing kontentini yuklab bo'lmadi."}
          onRetry={() => void fetchContent()}
        />
      </div>
    );
  }

  const busy = saving || uploads > 0;

  return (
    <div>
      {/* Yopishqoq boshqaruv paneli. Mobilda layout sarlavhasi (h-14) ostida turadi. */}
      <div className="sticky top-14 z-30 -mx-4 -mt-4 mb-6 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:-mt-6 sm:px-6 lg:top-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto min-w-0">
            <h1 className="text-lg font-bold text-gray-900">Landing sahifasi</h1>
            <p
              role="status"
              className={`flex items-center gap-1.5 text-xs ${
                dirty ? 'font-medium text-amber-700' : 'text-gray-500'
              }`}
            >
              <span
                aria-hidden
                className={`h-2 w-2 shrink-0 rounded-full ${
                  saving || uploads > 0 ? 'animate-pulse bg-blue-500' : dirty ? 'bg-amber-500' : 'bg-green-500'
                }`}
              />
              {saving
                ? 'Saqlanmoqda...'
                : uploads > 0
                  ? 'Rasm yuklanmoqda...'
                  : dirty
                    ? "Saqlanmagan o'zgarishlar bor"
                    : "Barcha o'zgarishlar saqlangan"}
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => void resetToDefault()}
            disabled={busy}
            title="Standartga qaytarish"
            aria-label="Standartga qaytarish"
          >
            <RotateCcw size={16} />
            <span className="hidden xl:inline">Standartga qaytarish</span>
          </Button>
          {dirty ? (
            <Button
              variant="secondary"
              onClick={() => void discardChanges()}
              disabled={busy}
              title="Saqlanmagan o'zgarishlarni bekor qilish"
              aria-label="Saqlanmagan o'zgarishlarni bekor qilish"
            >
              <Undo2 size={16} />
              <span className="hidden md:inline">Bekor qilish</span>
            </Button>
          ) : null}
          <a
            href={PUBLIC_URL}
            target="_blank"
            rel="noreferrer"
            title="Saytni yangi oynada ochish (faqat saqlangan kontent ko'rinadi)"
            aria-label="Saytni yangi oynada ochish"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40"
          >
            <Eye size={16} />
            <span className="hidden md:inline">Saytni ko'rish</span>
          </a>
          <Button
            onClick={() => void save()}
            loading={saving}
            disabled={uploads > 0}
            title={uploads > 0 ? 'Rasm yuklanishi tugashini kuting' : 'Saqlash (Ctrl+S)'}
          >
            {saving ? null : <Save size={16} />}
            Saqlash
          </Button>
        </div>

        {/* Bo'limlar orasida tez o'tish */}
        <nav aria-label="Muharrir bo'limlari" className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          {SECTIONS.map((section) => {
            const hasIssue = issues.some((issue) => issue.section === section.id);
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollToSection(section.id)}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  hasIssue
                    ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-[var(--primary)] hover:text-[var(--primary)]'
                }`}
              >
                {section.label}
              </button>
            );
          })}
        </nav>
      </div>

      {issues.length > 0 ? (
        <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-red-800">
            <AlertTriangle size={16} className="shrink-0" />
            Saqlash uchun {issues.length} ta xatoni tuzating
          </p>
          <ul className="mt-2 space-y-1">
            {issues.slice(0, 10).map((issue, index) => (
              <li key={`${issue.section}-${index}`}>
                <button
                  type="button"
                  onClick={() => scrollToSection(issue.section)}
                  className="text-left text-sm text-red-700 hover:underline"
                >
                  <span className="font-semibold">{sectionLabel(issue.section)}:</span> {issue.text}
                </button>
              </li>
            ))}
          </ul>
          {issues.length > 10 ? (
            <p className="mt-2 text-xs text-red-700">...va yana {issues.length - 10} ta xato.</p>
          ) : null}
        </div>
      ) : null}

      <UploadTrackerContext.Provider value={trackUpload}>
        {/* Landing'ning aynan nusxasi — WYSIWYG kanvas */}
        <div key={revision} className="rounded-2xl border border-gray-200 shadow-sm">
          <SectionAnchor id="navbar">
            <NavbarEditor value={content.navbar} onChange={(navbar) => patch({ navbar })} />
          </SectionAnchor>

          <SectionAnchor id="hero">
            <HeroEditor
              hero={content.hero}
              stats={content.stats}
              onHero={(p) => patch({ hero: { ...content.hero, ...p } })}
              onStats={(stats) => patch({ stats })}
            />
          </SectionAnchor>

          <SectionAnchor id="features">
            <FeatureGridEditor
              id="about"
              bg="bg-white"
              title={content.featuresTitle}
              onTitle={(featuresTitle) => patch({ featuresTitle })}
              items={content.features}
              onItems={(features) => patch({ features })}
              addTemplate={{ icon: 'Sparkles', text: 'Yangi imkoniyat' }}
            />
          </SectionAnchor>

          <SectionAnchor id="courseInfo">
            <FeatureGridEditor
              bg="bg-[var(--primary-light)]"
              title={content.courseInfoTitle}
              onTitle={(courseInfoTitle) => patch({ courseInfoTitle })}
              items={content.courseInfo}
              onItems={(courseInfo) => patch({ courseInfo })}
              addTemplate={{ icon: 'Video', text: "Yangi ma'lumot" }}
            />
          </SectionAnchor>

          <SectionAnchor id="goals">
            <GoalsEditor
              title={content.goalsTitle}
              onTitle={(goalsTitle) => patch({ goalsTitle })}
              goals={content.goals}
              onGoals={(goals) => patch({ goals })}
            />
          </SectionAnchor>

          <SectionAnchor id="testimonials">
            <TestimonialsEditor
              title={content.testimonialsTitle}
              onTitle={(testimonialsTitle) => patch({ testimonialsTitle })}
              items={content.testimonials}
              onItems={(testimonials) => patch({ testimonials })}
            />
          </SectionAnchor>

          <SectionAnchor id="courses">
            <CoursesEditor
              title={content.coursesTitle}
              onTitle={(coursesTitle) => patch({ coursesTitle })}
              copy={content.courseCard}
              onCopy={(p) => patch({ courseCard: { ...content.courseCard, ...p } })}
            />
          </SectionAnchor>

          <SectionAnchor id="bonus">
            <BonusesEditor
              title={content.bonusTitle}
              onTitle={(bonusTitle) => patch({ bonusTitle })}
              text={content.bonusText}
              onText={(bonusText) => patch({ bonusText })}
              books={content.bonusBooks}
              onBooks={(bonusBooks) => patch({ bonusBooks })}
            />
          </SectionAnchor>

          <SectionAnchor id="signup">
            <SignupEditor cta={content.cta} onCta={(p) => patch({ cta: { ...content.cta, ...p } })} />
          </SectionAnchor>

          <SectionAnchor id="footer">
            <FooterEditor
              logo={content.navbar.logo}
              onLogo={(logo) => patch({ navbar: { ...content.navbar, logo } })}
              footer={content.footer}
              onFooter={(p) => patch({ footer: { ...content.footer, ...p } })}
              contacts={content.contacts}
              onContacts={(p) => patch({ contacts: { ...content.contacts, ...p } })}
            />
          </SectionAnchor>
        </div>
      </UploadTrackerContext.Provider>

      <SectionAnchor id="extra">
        <AdditionalCopyEditor
          navbar={content.navbar}
          onNavbar={(p) => patch({ navbar: { ...content.navbar, ...p } })}
          leadForm={content.leadForm}
          onLeadForm={(p) => patch({ leadForm: { ...content.leadForm, ...p } })}
          leadModal={content.leadModal}
          onLeadModal={(p) => patch({ leadModal: { ...content.leadModal, ...p } })}
        />
      </SectionAnchor>
    </div>
  );
}
