import { useEffect, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { prefersReducedMotion } from '../../lib/useInView';

type Variant = 'primary' | 'white' | 'outline' | 'outlineWhite';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
  /**
   * E'tibor tortish: tugma tasodifiy vaqt oralig'ida bir marta "sakrab" qo'yadi
   * (index.css: .oz-attn-run) va kursor ustida biroz ko'tariladi (.oz-btn-live).
   * Faqat asosiy chaqiriq tugmalari uchun.
   */
  attention?: boolean;
}

const variants: Record<Variant, string> = {
  // Hover'da yonidagi chegarali tugmaning aksi: ichi oqarib, yashil chegara va yashil yozuv
  // qoladi. Chegara doim bor, shuning uchun o'lcham o'zgarmaydi. O'chirilgan tugma o'zgarmaydi.
  primary:
    'border-2 border-primary bg-primary text-white enabled:hover:bg-white enabled:hover:text-primary shadow-sm',
  // Yashil fondagi oq tugma: hover'da yonidagi chegarali tugmaning aksi — ichi shaffof
  // bo'lib, oq chegara va oq yozuv qoladi. Chegara doim bor (oq ustida ko'rinmaydi),
  // shuning uchun hover'da o'lcham o'zgarmaydi va balandligi chegarali tugma bilan teng.
  white:
    'border-2 border-white bg-white text-primary hover:bg-transparent hover:text-white shadow-sm [--oz-attn-ring:rgb(255_255_255/0.6)]',
  // Hover'da to'liq bo'yaladi — chegarali tugmada holat o'zgargani aniq ko'rinadi.
  outline: 'border-2 border-primary text-primary hover:bg-primary hover:text-white',
  outlineWhite:
    'border-2 border-white text-white hover:bg-white hover:text-primary [--oz-attn-ring:rgb(255_255_255/0.6)]',
};

/** Sakrash animatsiyasi davomiyligi (index.css'dagi oz-attn-hop bilan bir xil). */
const HOP_MS = 900;
/** Birinchi sakrash sahifa ochilgach shu oraliqda, keyingilari esa undan siyrakroq. */
const FIRST_DELAY_MS: [number, number] = [4000, 9000];
const NEXT_DELAY_MS: [number, number] = [8000, 18000];

const randomBetween = ([min, max]: [number, number]) => min + Math.random() * (max - min);

/**
 * Tasodifiy vaqtlarda `true` bo'lib, sakrash tugagach `false` ga qaytadi.
 * Sakramaydi: tugma ekranda ko'rinmasa, kursor/fokus ustida bo'lsa, varaq orqa fonda bo'lsa
 * yoki tizimda "harakatni kamaytirish" yoqilgan bo'lsa. Har tugma o'z taymeriga ega,
 * shuning uchun tugmalar bir vaqtda sakramaydi.
 */
function useRandomHop(enabled: boolean) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const [hopping, setHopping] = useState(false);

  useEffect(() => {
    if (!enabled || prefersReducedMotion()) return;
    let timer = 0;
    let endTimer = 0;

    const canHop = () => {
      const el = ref.current;
      if (!el || document.hidden || el.disabled) return false;
      if (el.matches(':hover, :focus-visible')) return false;
      const r = el.getBoundingClientRect();
      // Ko'rinmaydigan (yashirilgan menyu ichidagi) yoki ekrandan tashqaridagi tugma sakramaydi.
      return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight;
    };

    const schedule = (range: [number, number]) => {
      timer = window.setTimeout(() => {
        if (canHop()) {
          setHopping(true);
          endTimer = window.setTimeout(() => setHopping(false), HOP_MS);
        }
        schedule(NEXT_DELAY_MS);
      }, randomBetween(range));
    };
    schedule(FIRST_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(endTimer);
    };
  }, [enabled]);

  return { ref, hopping };
}

export function Button({
  variant = 'primary',
  children,
  className = '',
  attention = false,
  ...props
}: ButtonProps) {
  const { ref, hopping } = useRandomHop(attention);
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-colors disabled:opacity-60 ${variants[variant]} ${attention ? 'oz-btn-live' : ''} ${hopping ? 'oz-attn-run' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
