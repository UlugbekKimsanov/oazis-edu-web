import axios from 'axios';
import {
  isLandingSchemaSupported,
  landingContent,
  normalizeLandingContent,
  type LandingContent,
} from '../data/landing';

export const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ||
  'https://api.oazisedu.uz';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 8000,
});

/**
 * Rasm yo'lini to'liq URLga aylantiradi.
 * Bo'sh bo'lsa '' qaytaradi (komponent placeholder ko'rsatadi),
 * to'liq http(s) URL bo'lsa o'zini, aks holda `${API_BASE}/files/<path>`.
 * Backend ba'zi yo'llarni allaqachon '/files/...' prefiksi bilan qaytaradi —
 * bunday yo'lga qayta prefiks qo'shilmaydi (aks holda /files/files/... 404 bo'ladi).
 */
export function fileUrl(p?: string): string {
  if (!p) return '';
  if (/^https?:\/\//i.test(p)) return p;
  const clean = p.replace(/^\//, '');
  return clean.startsWith('files/') ? `${API_BASE}/${clean}` : `${API_BASE}/files/${clean}`;
}

/**
 * Landing kontentini backend'dan olishga urinadi.
 * Muvaffaqiyatsiz bo'lsa statik `landingContent` fallbackdan foydalanadi,
 * shunda backend bo'lmasa ham sahifa to'liq ishlaydi.
 *
 * V22 dagi eski sxema va qisman obyektlar canonical sxemaga normalizatsiya qilinadi.
 */
export async function fetchLandingContent(): Promise<LandingContent> {
  try {
    const res = await client.get('/api/landing');
    // Backend javobi ApiResponse bilan o'raladi: { success, message, data }.
    // Ba'zi holatlarda to'g'ridan-to'g'ri obyekt ham kelishi mumkin — ikkalasini ham qo'llaymiz.
    const raw = (res.data && typeof res.data === 'object' && 'data' in res.data)
      ? (res.data as { data?: unknown }).data
      : res.data;

    if (!raw || typeof raw !== 'object' || !isLandingSchemaSupported(raw)) {
      return landingContent;
    }
    return normalizeLandingContent(raw);
  } catch {
    return landingContent;
  }
}

export interface LeadPayload {
  name?: string;
  phone: string;
}

export async function submitLead(payload: LeadPayload): Promise<void> {
  await client.post('/api/landing/leads', payload);
}

/** Admin panel boshqaradigan jonli kurs katalogi elementi (GET /api/v1/courses). */
export interface ApiCourse {
  id: number;
  name: string;
  category?: string;
  imageUrl?: string;
  backgroundUrl?: string;
  flagEmoji?: string;
  goal?: string;
  isPremium?: boolean;
  price?: number;
  priceLabel?: string;
  lessonCount?: number;
  hours?: number;
}

/** Admin panel boshqaradigan jonli kitob katalogi elementi (GET /api/v1/books). */
export interface ApiBook {
  id: number;
  title: string;
  author?: string;
  category?: string;
  description?: string;
  price?: number;
  priceLabel?: string;
  isFree?: boolean;
  emoji?: string;
  rating?: number;
  reviewCount?: number;
  pageCount?: number;
  coverUrl?: string;
}

function unwrapList<T>(data: unknown): T[] {
  const raw = (data && typeof data === 'object' && 'data' in data)
    ? (data as { data?: unknown }).data
    : data;
  return Array.isArray(raw) ? (raw as T[]) : [];
}

/** Jonli kurslar ro'yxati; xatoda bo'sh massiv (chaqiruvchi fallback ko'rsatadi). */
export async function fetchCourses(): Promise<ApiCourse[]> {
  try {
    const res = await client.get('/api/v1/courses');
    return unwrapList<ApiCourse>(res.data);
  } catch {
    return [];
  }
}

/** Jonli kitoblar ro'yxati; xatoda bo'sh massiv (bo'lim ko'rsatilmaydi). */
export async function fetchBooks(): Promise<ApiBook[]> {
  try {
    const res = await client.get('/api/v1/books');
    return unwrapList<ApiBook>(res.data);
  } catch {
    return [];
  }
}

/** Checkout'da tanlanadigan to'lov usuli. */
export interface CheckoutMethod {
  code: string;
  name: string;
  isNasiya?: boolean;
}

/** Mobil ilovadan kelgan token bo'yicha checkout ma'lumotlari. */
export interface CheckoutInfo {
  productType: 'course' | 'book';
  productId: number;
  title: string;
  priceLabel: string;
  amountSum?: number;
  deliveryLabel?: string | null;
  userName?: string;
  methods: CheckoutMethod[];
  expiresAt?: string;
}

/**
 * ApiResponse envelope'ini ({success,message,data}) ochadi.
 * success=false bo'lsa yoki data bo'lmasa xato tashlaydi —
 * checkout oqimida fallback yo'q, chaqiruvchi xatoni o'zi ko'rsatadi.
 */
function unwrapOrThrow<T>(data: unknown): T {
  if (data && typeof data === 'object' && 'data' in data) {
    const env = data as { success?: boolean; message?: string; data?: unknown };
    if (env.success === false || env.data == null) {
      throw new Error(env.message || "So'rov muvaffaqiyatsiz yakunlandi");
    }
    return env.data as T;
  }
  if (data == null) throw new Error("Server bo'sh javob qaytardi");
  return data as T;
}

/** Token bo'yicha checkout ma'lumotlarini oladi; token noto'g'ri/muddati o'tgan bo'lsa throw. */
export async function fetchCheckout(token: string): Promise<CheckoutInfo> {
  const res = await client.get(`/api/landing/checkout/${encodeURIComponent(token)}`);
  const info = unwrapOrThrow<CheckoutInfo>(res.data);
  if (typeof info !== 'object' || !info.title) {
    throw new Error("Checkout ma'lumotlari noto'g'ri formatda");
  }
  return info;
}

/** Tanlangan usul bilan to'lovni boshlaydi; muvaffaqiyatda redirect uchun checkoutUrl qaytaradi. */
export async function payCheckout(token: string, method: string): Promise<string> {
  const res = await client.post(
    `/api/landing/checkout/${encodeURIComponent(token)}/pay`,
    { method },
  );
  const data = unwrapOrThrow<{ checkoutUrl?: string }>(res.data);
  if (!data.checkoutUrl) throw new Error("To'lov havolasi olinmadi");
  return data.checkoutUrl;
}
