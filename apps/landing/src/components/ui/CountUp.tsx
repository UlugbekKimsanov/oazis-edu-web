import { useEffect, useState } from 'react';
import { prefersReducedMotion, useInView } from '../../lib/useInView';

const DURATION_MS = 1400;

/**
 * Ko'rsatkich ekranga kelganda 0 dan o'z qiymatigacha sanab chiqadi.
 * "100+", "200+" kabi qiymatlarda faqat raqam qismi sanaladi, old/orqa belgilar saqlanadi.
 * Raqamsiz qiymat o'zgarishsiz ko'rsatiladi.
 */
export function CountUp({ value }: { value: string | number }) {
  const text = String(value);
  const match = /^(\D*)(\d+)(.*)$/.exec(text);
  const target = match ? Number(match[2]) : null;

  const { ref, inView } = useInView<HTMLSpanElement>(0.6);
  const [current, setCurrent] = useState<number | null>(null);

  useEffect(() => {
    if (target === null || !inView) return;
    if (prefersReducedMotion()) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / DURATION_MS);
      // easeOutCubic — oxiriga yaqin sekinlashadi
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, inView]);

  if (!match || target === null) return <span>{text}</span>;

  // Sanash boshlanmaguncha (yoki harakat kamaytirilgan bo'lsa) yakuniy qiymat turadi —
  // JS ishlamasa ham raqam to'g'ri ko'rinadi. tabular-nums: raqamlar almashganda kenglik sakramaydi.
  const shown = current ?? target;
  return (
    <span ref={ref} className="tabular-nums" aria-label={text}>
      {match[1]}
      {shown}
      {match[3]}
    </span>
  );
}
