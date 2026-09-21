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
 */
export function fileUrl(p?: string): string {
  if (!p) return '';
  return /^https?:\/\//i.test(p) ? p : `${API_BASE}/files/${p.replace(/^\//, '')}`;
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
