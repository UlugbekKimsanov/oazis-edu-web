/** O'zbekiston raqamini `+998 90 123 45 67` ko'rinishiga keltiradi. */
export function formatUzPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  const local = (digits.startsWith('998') ? digits.slice(3) : digits).slice(0, 9);
  const parts = [local.slice(0, 2), local.slice(2, 5), local.slice(5, 7), local.slice(7, 9)]
    .filter(Boolean);
  return `+998${parts.length ? ` ${parts.join(' ')}` : ' '}`;
}

/** To'liq kiritilgan (maskalangan) raqammi. */
export function isCompleteUzPhone(value: string): boolean {
  return /^\+998 \d{2} \d{3} \d{2} \d{2}$/.test(value);
}
