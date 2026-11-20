// Sana, vaqt va pul formatlash — butun panel uchun yagona.

/**
 * Backend (UTC server) sanani vaqt zonasiz yuboradi: "2026-11-12T12:20:11".
 * Brauzer bunday satrni MAHALLIY vaqt deb o'qiydi va natija Toshkentda
 * 5 soatga orqada qoladi. Zona ko'rsatilmagan bo'lsa UTC deb talqin qilamiz.
 */
export function parseServerDate(iso?: string | null): Date | null {
  if (!iso) return null;
  const s = String(iso).trim().replace(' ', 'T');
  const hasTime = s.includes('T');
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(s);
  const d = new Date(hasTime && !hasZone ? `${s}Z` : s);
  return isNaN(d.getTime()) ? null : d;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 12.11.2026 */
export function formatDate(iso?: string | null, fallback = '—'): string {
  const d = parseServerDate(iso);
  if (!d) return fallback;
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** 12.11.2026, 17:20 */
export function formatDateTime(iso?: string | null, fallback = '—'): string {
  const d = parseServerDate(iso);
  if (!d) return fallback;
  return `${formatDate(iso)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "5 daqiqa oldin", "kecha", ... — 7 kundan eskisi to'liq sana. */
export function relativeTime(iso?: string | null, now: number = Date.now()): string {
  const d = parseServerDate(iso);
  if (!d) return '';
  const min = Math.floor((now - d.getTime()) / 60000);
  if (min < 1) return 'hozir';
  if (min < 60) return `${min} daqiqa oldin`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} soat oldin`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'kecha';
  if (days < 7) return `${days} kun oldin`;
  return formatDate(iso);
}

/** 1 250 000 — minglik ajratgich bo'sh joy (brauzer tiliga bog'liq emas). */
export function formatNumber(n?: number | null): string {
  const v = Number(n ?? 0);
  if (!isFinite(v)) return '0';
  return Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** 1 250 000 so'm */
export function formatMoney(n?: number | null): string {
  return `${formatNumber(n)} so'm`;
}
