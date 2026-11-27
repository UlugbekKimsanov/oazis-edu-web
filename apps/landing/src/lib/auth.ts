import axios from 'axios';
import { API_BASE } from './api';

/**
 * Landing'dagi foydalanuvchi sessiyasi va auth so'rovlari.
 * Kontrakt mobil ilova bilan AYNAN bir xil (`/api/v1/auth/*`):
 *  - email: 5 xonali OTP (asosiy usul) yoki parol;
 *  - Google: faqat `idToken` yuboriladi;
 *  - ro'yxatdan o'tish: ism, familiya, telefon, email + email OTP.
 * Mehmon (guest) rejimi bu yerda yo'q — backend mehmon hisobi bilan xaridni taqiqlaydi.
 */

export interface AuthUser {
  id: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  role?: string;
  token: string;
}

export type ProductType = 'course' | 'book';

/** Landing'da "Xarid qilish" bosilgan mahsulot. */
export interface PurchaseProduct {
  type: ProductType;
  id: number;
  title: string;
  /** Faqat kitob: bosma kitobmi (yetkazib beriladi, ilovada o'qilmaydi). */
  print?: boolean;
}

export function productKey(product: Pick<PurchaseProduct, 'type' | 'id'>): string {
  return `${product.type}:${product.id}`;
}

/** Google Identity Services uchun web client ID (public qiymat, build vaqtida beriladi). */
export const GOOGLE_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() || '';

const STORAGE_KEY = 'oazis.landing.session';

const client = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  // Email OTP yuborish SMTP'ga bog'liq — katalog so'rovlaridan uzoqroq kutamiz.
  timeout: 20000,
});

/** Token eskirgan/yaroqsiz — foydalanuvchi qayta kirishi kerak. */
export class SessionExpiredError extends Error {
  constructor() {
    super('Sessiya muddati tugagan. Qaytadan kiring.');
    this.name = 'SessionExpiredError';
  }
}

// ── Sessiyani saqlash ────────────────────────────────────────────────

export function loadSession(): AuthUser | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthUser> | null;
    if (!parsed || typeof parsed.token !== 'string' || !parsed.token) return null;
    return parsed as AuthUser;
  } catch {
    return null;
  }
}

export function saveSession(user: AuthUser): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Storage yopiq (private rejim) — sessiya faqat shu sahifa davomida yashaydi.
  }
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // e'tiborsiz
  }
}

export function displayName(user: AuthUser): string {
  const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  return name || user.email || 'Profil';
}

// ── Xatolar ──────────────────────────────────────────────────────────

/** Backend `message`ini, bo'lmasa tarmoq holatiga mos o'zbekcha matnni qaytaradi. */
export function apiErrorMessage(
  error: unknown,
  fallback = "Xatolik yuz berdi. Qayta urinib ko'ring.",
): string {
  if (error instanceof SessionExpiredError) return error.message;
  if (!axios.isAxiosError(error)) return fallback;

  const data: unknown = error.response?.data;
  if (data && typeof data === 'object') {
    const message = (data as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message.trim();
  }
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return "Server javob bermadi. Birozdan so'ng qayta urinib ko'ring.";
  }
  if (!error.response) return "Internet yoki server bilan aloqa yo'q.";
  return fallback;
}

// ── Auth so'rovlari ──────────────────────────────────────────────────

function toAuthUser(data: unknown): AuthUser {
  const payload = (data && typeof data === 'object' && 'data' in data)
    ? (data as { data?: unknown }).data
    : data;
  const user = payload as Partial<AuthUser> | null | undefined;
  if (!user || typeof user.token !== 'string' || !user.token) {
    throw new Error("Server noto'g'ri javob qaytardi");
  }
  return {
    id: Number(user.id),
    firstName: user.firstName ?? undefined,
    lastName: user.lastName ?? undefined,
    email: user.email ?? undefined,
    phone: user.phone ?? undefined,
    role: user.role ?? undefined,
    token: user.token,
  };
}

/** Emailga 5 xonali kod yuboradi. `isLogin=false` — ro'yxatdan o'tish uchun. */
export async function sendOtp(email: string, isLogin: boolean): Promise<void> {
  // SMTP ba'zan (ayniqsa server qayta ishga tushgach birinchi xatda) 20 soniyadan
  // uzoq javob beradi. Erta uzilsa foydalanuvchi qayta so'raydi va pochtasiga
  // ikki xil kod keladi — eskisi yaroqsiz bo'lib qoladi. Shuning uchun uzoqroq kutamiz.
  await client.post('/auth/send-otp', { email, login: isLogin }, { timeout: 60000 });
}

/** Email + OTP bilan kirish (mobil ilovadagi asosiy usul). */
export async function loginWithOtp(email: string, otpCode: string): Promise<AuthUser> {
  const res = await client.post('/auth/login', { email, password: otpCode, mobile: true });
  return toAuthUser(res.data);
}

/** Email + parol bilan kirish. */
export async function loginWithPassword(email: string, password: string): Promise<AuthUser> {
  const res = await client.post('/auth/login', { email, password, mobile: false });
  return toAuthUser(res.data);
}

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  /** `+998901234567` ko'rinishida. */
  phone: string;
  email: string;
  otpCode: string;
}

export async function registerAccount(payload: RegisterPayload): Promise<AuthUser> {
  // Mobil ilova kabi parol bo'sh yuboriladi — keyingi kirishlar email OTP orqali.
  const res = await client.post('/auth/register', { ...payload, password: '' });
  return toAuthUser(res.data);
}

/** Google ID token bilan kirish/ro'yxatdan o'tish. */
export async function loginWithGoogle(idToken: string): Promise<AuthUser> {
  const res = await client.post('/auth/google', { idToken });
  return toAuthUser(res.data);
}

/**
 * Kirgan foydalanuvchini bepul kursga yozadi (mobil ilovadagi "Boshlash" bilan bir xil
 * `POST /api/v1/courses/{id}/enroll`) — kurs ilovada "Mening kurslarim"da tayyor turadi.
 */
/**
 * Mobil ilovadan `?t=<token>` bilan kelgan foydalanuvchiga saytda login sessiyasi
 * ochadi (har token bilan faqat bir marta). Javob — oddiy login javobi.
 */
export async function exchangeCheckoutSession(checkoutToken: string): Promise<AuthUser> {
  const res = await axios.post(
    `${API_BASE}/api/landing/checkout/${encodeURIComponent(checkoutToken)}/session`,
    null,
    { timeout: 15000 },
  );
  return toAuthUser(res.data);
}

export async function enrollFreeCourse(authToken: string, courseId: number): Promise<void> {
  await client.post(`/courses/${courseId}/enroll`, null, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
}

// ── Xarid ────────────────────────────────────────────────────────────

/**
 * Tanlangan mahsulot uchun qisqa muddatli checkout tokenini oladi
 * (mobil ilova ishlatadigan `POST /api/v1/checkout-links`).
 * Token keyin `CheckoutOverlay`ga beriladi.
 */
export async function createCheckoutToken(
  authToken: string,
  productType: ProductType,
  productId: number,
): Promise<string> {
  try {
    const res = await client.post(
      '/checkout-links',
      { productType, productId },
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    const data = (res.data as { data?: { token?: string } } | undefined)?.data;
    if (!data?.token) throw new Error("To'lov havolasi olinmadi");
    return data.token;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      throw new SessionExpiredError();
    }
    throw error;
  }
}
