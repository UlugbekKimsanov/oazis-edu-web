import { useEffect, useRef, useState } from 'react';

/**
 * Element ekranga birinchi marta kirganini bildiradi (bir marta `true` bo'ladi va shunday qoladi).
 * Skrollga bog'liq animatsiyalar uchun: sanab chiquvchi raqamlar, ketma-ket yonadigan qadamlar.
 * IntersectionObserver yo'q muhitda (eski brauzer, test) darhol `true` qaytaradi.
 */
export function useInView<T extends Element>(threshold = 0.35) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
}

/** Foydalanuvchi tizimda "harakatni kamaytirish"ni yoqqanmi. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
