import { useState } from 'react';

// Flag emoji'dan ISO mamlakat kodini chiqarish (🇬🇧 -> gb)
export function flagCode(emoji?: string): string | null {
  if (!emoji) return null;
  const ri = Array.from(emoji)
    .map((c) => c.codePointAt(0) || 0)
    .filter((cp) => cp >= 0x1f1e6 && cp <= 0x1f1ff);
  if (ri.length < 2) return null;
  return ri.slice(0, 2).map((cp) => String.fromCharCode(cp - 0x1f1e6 + 97)).join('');
}

/**
 * Windows brauzerlar flag emoji'ni render qilmaydi — shuning uchun haqiqiy bayroq
 * rasmi (flagcdn). Rasm yuklanmasa — kod chip (UZ, RO, ...) ko'rinadi.
 * Tabiiy nisbat (width:auto) — hech qachon cho'zilmaydi.
 */
export default function Flag({ emoji, height = 24 }: { emoji?: string; height?: number }) {
  const code = flagCode(emoji);
  const [err, setErr] = useState(false);
  if (!code) return <span style={{ fontSize: height }}>{emoji || '🏳️'}</span>;
  if (err) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-[3px] bg-gray-200 text-gray-600 font-bold uppercase shrink-0"
        style={{ height, width: Math.round(height * 1.5), fontSize: Math.round(height * 0.5) }}
      >
        {code}
      </span>
    );
  }
  return (
    <img
      src={`https://flagcdn.com/h40/${code}.png`}
      alt={code}
      onError={() => setErr(true)}
      className="rounded-[3px] ring-1 ring-black/5 shrink-0"
      style={{ height, width: 'auto', display: 'block' }}
    />
  );
}
