import { createElement, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import api, { API_ORIGIN, fileUrl } from '../../lib/api';
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
  return "Kontentni yuklab bo'lmadi.";
}

function shortApiError(error: unknown, fallback: string): string {
  if (error === null || typeof error !== 'object') return fallback;

  const candidate = error as {
    message?: unknown;
    response?: { data?: unknown };
  };
  const responseData = candidate.response?.data;
  let message: unknown;
  if (typeof responseData === 'string') {
    message = responseData;
  } else if (responseData !== null && typeof responseData === 'object') {
    const body = responseData as { message?: unknown; error?: unknown };
    message = body.message ?? body.error;
  }
  message ??= candidate.message;

  if (typeof message !== 'string' || !message.trim()) return fallback;
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
  if (file.size > MAX_LANDING_IMAGE_BYTES) {
    return "Rasm hajmi 5 MiB dan oshmasligi kerak.";
  }
  return null;
}

const uid = () =>
  (globalThis.crypto && 'randomUUID' in globalThis.crypto
    ? globalThis.crypto.randomUUID()
    : String(Date.now()) + Math.random().toString(16).slice(2));

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

const inlineBase = 'bg-transparent outline-none rounded-md px-1 -mx-1 transition-colors';
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
}) {
  return (
    <input
      type={type}
      step={step}
      min={min}
      max={max}
      value={value}
      title={title}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${inlineBase} ${dark ? inlineDark : inlineLight} ${className}`}
    />
  );
}

// Balandligi matnga qarab avtomatik o'sadigan textarea (sarlavha/uzun matnlar).
function InlineArea({
  value,
  onChange,
  className = '',
  placeholder,
  dark = false,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  dark?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  });
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${inlineBase} block w-full resize-none overflow-hidden ${
        dark ? inlineDark : inlineLight
      } ${className}`}
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
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title="Ikonka tanlash"
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
        <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-3 text-left shadow-xl">
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
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const url = fileUrl(value);
  const pick = async (file?: File) => {
    if (!file) return;
    const validationError = validateLandingImage(file);
    if (validationError) {
      setUploadError(validationError);
      return;
    }

    setUploadError('');
    setUploading(true);
    try {
      const path = await uploadLandingImage(file);
      onChange(path);
    } catch (uploadFailure) {
      setUploadError(shortApiError(uploadFailure, "Rasmni yuklab bo'lmadi."));
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className={`group/slot relative ${rounded} ${className}`}>
      {url ? (
        <img src={url} alt="" className={`h-full w-full object-cover ${rounded}`} />
      ) : (
        children
      )}
      <div className="absolute right-1.5 top-1.5 z-10 flex gap-1 opacity-0 transition group-hover/slot:opacity-100 focus-within:opacity-100">
        <label
          className="cursor-pointer rounded-md bg-black/50 p-1.5 text-white shadow hover:bg-black/70"
          title="Rasm yuklash"
        >
          {uploading ? (
            <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <ImagePlus size={14} />
          )}
          <input
            type="file"
            accept={LANDING_IMAGE_ACCEPT}
            className="hidden"
            disabled={uploading}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              void pick(file);
            }}
          />
        </label>
        {value ? (
          <button
            type="button"
            onClick={() => {
              setUploadError('');
              onChange('');
            }}
            className="rounded-md bg-black/50 p-1.5 text-white shadow hover:bg-red-600"
            title="Rasmni olib tashlash"
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
}: {
  items: T[];
  onChange: (items: T[]) => void;
  idPrefix: string;
  containerClassName?: string;
  footer?: ReactNode;
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
  const ids = items.map((_, i) => `${idPrefix}-${i}`);
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    onChange(arrayMove(items, from, to));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className={containerClassName}>
          {items.map((item, index) => (
            <SortableCell key={ids[index]} id={ids[index]}>
              {({ handleProps, isDragging }) =>
                renderItem({
                  item,
                  index,
                  isDragging,
                  handleProps,
                  update: (patch) =>
                    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it))),
                  remove: () => onChange(items.filter((_, i) => i !== index)),
                })
              }
            </SortableCell>
          ))}
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
      className={`absolute top-2 z-20 flex gap-1 opacity-0 transition group-hover/item:opacity-100 ${
        align === 'left' ? 'left-2' : 'right-2'
      }`}
    >
      <button
        type="button"
        {...(handleProps as Record<string, unknown>)}
        className="cursor-grab touch-none rounded-md bg-white p-1 text-gray-500 shadow ring-1 ring-gray-200 active:cursor-grabbing"
        title="Sudrab tartiblang"
      >
        <GripVertical size={14} />
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-md bg-white p-1 text-gray-500 shadow ring-1 ring-gray-200 hover:text-red-600"
        title="O'chirish"
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
      <Container className="flex h-16 items-center justify-between gap-4">
        <InlineText
          value={value.logo}
          onChange={(logo) => set({ logo })}
          className="w-32 text-xl font-extrabold tracking-tight text-[var(--primary)]"
        />
        <nav className="hidden items-center gap-2 md:flex">
          <SortableList
            items={value.links}
            onChange={(links) => set({ links })}
            idPrefix="nav"
            containerClassName="flex items-center gap-2"
            footer={
              <button
                type="button"
                onClick={() => set({ links: [...value.links, { label: 'Havola', href: '#' }] })}
                title="Havola qo'shish"
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
                  >
                    <GripVertical size={12} />
                  </button>
                  <InlineText
                    value={item.label}
                    onChange={(label) => update({ label })}
                    className="w-24 text-sm font-medium text-gray-600"
                  />
                  <button
                    type="button"
                    onClick={remove}
                    className="text-gray-300 hover:text-red-600"
                    title="O'chirish"
                  >
                    <X size={12} />
                  </button>
                </div>
                <InlineText
                  value={item.href}
                  onChange={(href) => update({ href })}
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
        <Menu className="h-6 w-6 text-gray-700 md:hidden" />
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
            containerClassName="grid grid-cols-3 gap-4 sm:gap-8"
            footer={
              <button
                type="button"
                onClick={() => onStats([...stats, { value: '0', label: 'Nomi' }])}
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
                  placeholder="Video URL"
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

function CoursesEditor({
  title,
  onTitle,
  items,
  onItems,
  copy,
  onCopy,
}: {
  title: string;
  onTitle: (v: string) => void;
  items: LandingContent['courses'];
  onItems: (c: LandingContent['courses']) => void;
  copy: LandingContent['courseCard'];
  onCopy: (p: Partial<LandingContent['courseCard']>) => void;
}) {
  return (
    <PreviewSection id="courses" bg="bg-white" title={title} onTitle={onTitle}>
      <SortableList
        items={items}
        onChange={onItems}
        idPrefix="crs"
        containerClassName="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        footer={
          <AddCard
            onClick={() =>
              onItems([
                ...items,
                {
                  id: uid(),
                  flag: '🏳️',
                  name: 'Yangi kurs',
                  students: 0,
                  price: "799 000 so'm",
                  rating: 5.0,
                },
              ])
            }
            label="Kurs qo'shish"
            className="min-h-[320px]"
          />
        }
        renderItem={({ item, update, remove, handleProps }) => (
          <div className="group/item relative flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
            <ItemControls handleProps={handleProps} onRemove={remove} />
            <div className="mb-4 flex h-28 items-center justify-center rounded-xl bg-[var(--primary-light)] text-5xl">
              <InlineText
                value={item.flag}
                onChange={(flag) => update({ flag })}
                className="w-20 text-center text-5xl"
              />
            </div>
            <span className="mb-2 inline-block w-fit rounded-full bg-[var(--primary-light)] px-3 py-1 text-xs font-semibold text-[var(--primary)]">
              <InlineText
                value={copy.categoryLabel}
                onChange={(categoryLabel) => onCopy({ categoryLabel })}
                title="Barcha kurs kartalari uchun kategoriya matni"
                className="w-24 text-xs font-semibold text-[var(--primary)]"
              />
            </span>
            <InlineText
              value={item.name}
              onChange={(name) => update({ name })}
              className="w-full text-base font-bold text-gray-900"
            />
            <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                <InlineText
                  type="number"
                  min="0"
                  step="1"
                  value={String(item.students)}
                  onChange={(v) => {
                    const parsed = Number(v);
                    update({
                      students:
                        v === '' || !Number.isFinite(parsed) ? 0 : Math.max(0, Math.trunc(parsed)),
                    });
                  }}
                  className="w-10 text-xs"
                />
                <InlineText
                  value={copy.studentsLabel}
                  onChange={(studentsLabel) => onCopy({ studentsLabel })}
                  title="Barcha kurs kartalari uchun o'quvchi birligi"
                  className="w-16 text-xs"
                />
              </span>
              <span className="inline-flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <InlineText
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  value={String(item.rating)}
                  onChange={(v) => {
                    const parsed = Number(v);
                    update({
                      rating:
                        v === '' || !Number.isFinite(parsed)
                          ? 0
                          : Math.min(5, Math.max(0, parsed)),
                    });
                  }}
                  className="w-10 text-xs"
                />
              </span>
            </div>
            <div className="mt-4">
              <InlineText
                value={item.price}
                onChange={(price) => update({ price })}
                className="w-full text-lg font-bold text-gray-900"
              />
            </div>
            <InlineText
              type="url"
              value={item.buyUrl ?? ''}
              onChange={(buyUrl) => update({ buyUrl })}
              placeholder="Harid havolasi (URL)"
              className="mt-1 w-full text-[10px] text-gray-400"
            />
            <span className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-white">
              <InlineText
                dark
                value={copy.buyLabel}
                onChange={(buyLabel) => onCopy({ buyLabel })}
                title="Barcha kurs kartalari uchun xarid tugmasi"
                className="w-full text-center text-sm font-semibold text-white"
              />
            </span>
          </div>
        )}
      />
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
  const className =
    'mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15';

  return (
    <label className="block">
      <span className="text-xs font-semibold text-gray-600">{label}</span>
      {multiline ? (
        <textarea
          rows={3}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${className} resize-y`}
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={className}
        />
      )}
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
  const [content, setContent] = useState<LandingContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  const fetchContent = async () => {
    setLoading(true);
    setError('');
    try {
      setContent(await requestLandingContent());
    } catch (loadError) {
      setError(landingLoadError(loadError));
      setContent(null);
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
        setError('');
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(landingLoadError(loadError));
        setContent(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  // Status xabarini bir necha soniyadan so'ng avtomatik yopamiz.
  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(null), 3500);
    return () => clearTimeout(t);
  }, [status]);

  const patch = (p: Partial<LandingContent>) => setContent((c) => (c ? { ...c, ...p } : c));

  const save = async () => {
    if (!content) return;
    setSaving(true);
    setStatus(null);
    try {
      const canonicalContent = normalizeEditableLandingContent(content);
      await api.put(SAVE_URL, canonicalContent);
      setContent(canonicalContent);
      setStatus({ type: 'success', text: 'Saqlandi' });
    } catch (saveError) {
      setStatus({
        type: 'error',
        text:
          saveError instanceof UnsupportedLandingSchemaError
            ? saveError.message
            : shortApiError(saveError, 'Saqlashda xatolik yuz berdi'),
      });
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = () => {
    setContent(createDefaultLandingContent());
    setResetOpen(false);
    setStatus({ type: 'success', text: "Standart kontent tiklandi (saqlash uchun 'Saqlash')" });
  };

  if (loading) {
    return <div className="py-16 text-center text-gray-400">Yuklanmoqda...</div>;
  }
  if (error || !content) {
    return (
      <div className="py-16 text-center">
        <p className="mb-4 text-gray-500">{error || "Kontentni yuklab bo'lmadi."}</p>
        <Button variant="secondary" onClick={fetchContent}>
          Qayta urinish
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* Sticky boshqaruv paneli */}
      <div className="sticky top-0 z-50 -mx-6 -mt-6 mb-6 flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white/95 px-6 py-3 backdrop-blur">
        <div className="mr-auto">
          <h1 className="text-lg font-bold text-gray-900">Landing sahifasi</h1>
          <p className="text-xs text-gray-500">Har bir elementni bevosita bosib tahrirlang</p>
        </div>
        {status && (
          <span
            className={`text-sm font-medium ${
              status.type === 'success' ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {status.text}
          </span>
        )}
        <Button variant="secondary" onClick={() => setResetOpen(true)}>
          <RotateCcw size={16} />
          Standartga qaytarish
        </Button>
        <a href={PUBLIC_URL} target="_blank" rel="noreferrer">
          <Button variant="secondary">
            <Eye size={16} />
            Ko'rish
          </Button>
        </a>
        <Button onClick={save} disabled={saving}>
          <Save size={16} />
          {saving ? 'Saqlanmoqda...' : 'Saqlash'}
        </Button>
      </div>

      {/* Landing'ning aynan nusxasi — WYSIWYG kanvas */}
      <div className="rounded-2xl border border-gray-200 shadow-sm">
        <NavbarEditor value={content.navbar} onChange={(navbar) => patch({ navbar })} />

        <HeroEditor
          hero={content.hero}
          stats={content.stats}
          onHero={(p) => patch({ hero: { ...content.hero, ...p } })}
          onStats={(stats) => patch({ stats })}
        />

        <FeatureGridEditor
          id="about"
          bg="bg-white"
          title={content.featuresTitle}
          onTitle={(featuresTitle) => patch({ featuresTitle })}
          items={content.features}
          onItems={(features) => patch({ features })}
          addTemplate={{ icon: 'Sparkles', text: 'Yangi imkoniyat' }}
        />

        <FeatureGridEditor
          bg="bg-[var(--primary-light)]"
          title={content.courseInfoTitle}
          onTitle={(courseInfoTitle) => patch({ courseInfoTitle })}
          items={content.courseInfo}
          onItems={(courseInfo) => patch({ courseInfo })}
          addTemplate={{ icon: 'Video', text: "Yangi ma'lumot" }}
        />

        <GoalsEditor
          title={content.goalsTitle}
          onTitle={(goalsTitle) => patch({ goalsTitle })}
          goals={content.goals}
          onGoals={(goals) => patch({ goals })}
        />

        <TestimonialsEditor
          title={content.testimonialsTitle}
          onTitle={(testimonialsTitle) => patch({ testimonialsTitle })}
          items={content.testimonials}
          onItems={(testimonials) => patch({ testimonials })}
        />

        <CoursesEditor
          title={content.coursesTitle}
          onTitle={(coursesTitle) => patch({ coursesTitle })}
          items={content.courses}
          onItems={(courses) => patch({ courses })}
          copy={content.courseCard}
          onCopy={(p) => patch({ courseCard: { ...content.courseCard, ...p } })}
        />

        <BonusesEditor
          title={content.bonusTitle}
          onTitle={(bonusTitle) => patch({ bonusTitle })}
          text={content.bonusText}
          onText={(bonusText) => patch({ bonusText })}
          books={content.bonusBooks}
          onBooks={(bonusBooks) => patch({ bonusBooks })}
        />

        <SignupEditor cta={content.cta} onCta={(p) => patch({ cta: { ...content.cta, ...p } })} />

        <FooterEditor
          logo={content.navbar.logo}
          onLogo={(logo) => patch({ navbar: { ...content.navbar, logo } })}
          footer={content.footer}
          onFooter={(p) => patch({ footer: { ...content.footer, ...p } })}
          contacts={content.contacts}
          onContacts={(p) => patch({ contacts: { ...content.contacts, ...p } })}
        />
      </div>

      <AdditionalCopyEditor
        navbar={content.navbar}
        onNavbar={(p) => patch({ navbar: { ...content.navbar, ...p } })}
        leadForm={content.leadForm}
        onLeadForm={(p) => patch({ leadForm: { ...content.leadForm, ...p } })}
        leadModal={content.leadModal}
        onLeadModal={(p) => patch({ leadModal: { ...content.leadModal, ...p } })}
      />

      {/* Standartga qaytarish tasdig'i */}
      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="Standartga qaytarish">
        <p className="text-sm text-gray-600">
          Barcha o'zgarishlar bekor qilinib, standart (boshlang'ich) kontent tiklanadi. Bu amal
          faqat "Saqlash" bosilgandan so'ng bazaga yoziladi. Davom etilsinmi?
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setResetOpen(false)}>
            Bekor qilish
          </Button>
          <Button variant="danger" onClick={resetToDefault}>
            <RotateCcw size={16} />
            Ha, qaytarish
          </Button>
        </div>
      </Modal>
    </div>
  );
}
