import { useEffect, useState } from 'react';
import { FeatureCard } from './FeatureCard';
import { prefersReducedMotion, useInView } from '../../lib/useInView';

/** Har bir karta shuncha vaqt "yoritilgan" turadi (index.css'dagi --oz-feature-hold bilan bir xil). */
const HOLD_MS = 2200;

/**
 * Ikonkali kartalar to'ri ("Nima uchun OAZIS", "Kurslar haqida qisqacha").
 * Hover'siz ham jonli: bo'lim ekranga kelganda kartalar ketma-ket ko'tarilib chiqadi, so'ng
 * "yoritish" kartadan kartaga navbat bilan o'tib turadi (ikonka yashilga to'ladi, karta
 * ko'tariladi, ostidagi chiziq to'ladi). Kursor to'r ustida bo'lsa navbat to'xtaydi —
 * o'sha payt odatdagi hover ishlaydi. Harakat kamaytirilgan bo'lsa navbat yoqilmaydi.
 */
export function FeatureGrid({ items }: { items: { icon: string; text: string }[] }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const cycling = inView && !hovered && items.length > 1 && !prefersReducedMotion();

  useEffect(() => {
    if (!cycling) return;
    const timer = window.setInterval(() => {
      setActive((i) => (i + 1) % items.length);
    }, HOLD_MS);
    return () => window.clearInterval(timer);
  }, [cycling, items.length]);

  return (
    <div
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`oz-features grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 ${inView ? 'is-in' : ''}`}
    >
      {items.map((f, i) => (
        <FeatureCard key={i} icon={f.icon} text={f.text} index={i} active={cycling && i === active} />
      ))}
    </div>
  );
}
