import axios from 'axios';
import { landingContent, type LandingContent } from '../data/landing';

export const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ||
  'https://api.oazisedu.uz';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 8000,
});

/**
 * Landing kontentini backend'dan olishga urinadi.
 * Muvaffaqiyatsiz bo'lsa statik `landingContent` fallbackdan foydalanadi,
 * shunda backend bo'lmasa ham sahifa to'liq ishlaydi.
 */
export async function fetchLandingContent(): Promise<LandingContent> {
  try {
    const { data } = await client.get<Partial<LandingContent>>('/api/landing');
    // API javob shakli statik obyekt bilan bir xil bo'lsa — mergeqilamiz.
    return { ...landingContent, ...data } as LandingContent;
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
