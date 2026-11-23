/**
 * OAZIS mobil ilovasining do'kon havolalari va qurilma platformasini aniqlash.
 * Havolalar build vaqtida `VITE_PLAY_STORE_URL` / `VITE_APP_STORE_URL` bilan
 * almashtirilishi mumkin. App Store havolasi bo'sh bo'lsa (iOS ilovasi hali
 * chiqmagan) iPhone foydalanuvchisiga "tez orada" deb ko'rsatiladi.
 */
export const PLAY_STORE_URL =
  (import.meta.env.VITE_PLAY_STORE_URL as string | undefined)?.trim() ||
  'https://play.google.com/store/apps/details?id=oazis.edu';

export const APP_STORE_URL =
  (import.meta.env.VITE_APP_STORE_URL as string | undefined)?.trim() || '';

export type Platform = 'ios' | 'android' | 'other';

/** Qurilma platformasi: iPhone/iPad → 'ios', Android → 'android', qolganlari (kompyuter) → 'other'. */
export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  // iPadOS 13+ o'zini Mac deb tanishtiradi — sensorli ekran bo'yicha ajratamiz.
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return 'ios';
  return 'other';
}

// ── To'lovga ketgan xaridni eslab qolish ─────────────────────────────
// To'lov provayderi foydalanuvchini saytga qaytaradi; qaytganda xarid haqiqatan
// yakunlanganini (kurs/kitob hisobga tushganini) tekshirib, ilovani yuklashni taklif qilamiz.

export interface PendingPurchase {
  type: 'course' | 'book';
  id: number;
  title: string;
  /** To'lovga yo'naltirilgan vaqt (ms). */
  at: number;
}

const PENDING_KEY = 'oazis.landing.pendingPurchase';
/** Shu vaqtdan eski yozuv e'tiborga olinmaydi (to'lov tashlab ketilgan). */
const PENDING_TTL_MS = 30 * 60 * 1000;

export function savePendingPurchase(purchase: Omit<PendingPurchase, 'at'>): void {
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify({ ...purchase, at: Date.now() }));
  } catch {
    // Storage yopiq — qaytganda tabrik oynasi chiqmaydi, xaridning o'ziga ta'sir qilmaydi.
  }
}

export function loadPendingPurchase(): PendingPurchase | null {
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingPurchase> | null;
    if (
      !parsed ||
      (parsed.type !== 'course' && parsed.type !== 'book') ||
      typeof parsed.id !== 'number' ||
      typeof parsed.at !== 'number' ||
      Date.now() - parsed.at > PENDING_TTL_MS
    ) {
      window.localStorage.removeItem(PENDING_KEY);
      return null;
    }
    return { type: parsed.type, id: parsed.id, title: String(parsed.title ?? ''), at: parsed.at };
  } catch {
    return null;
  }
}

export function clearPendingPurchase(): void {
  try {
    window.localStorage.removeItem(PENDING_KEY);
  } catch {
    // e'tiborsiz
  }
}
