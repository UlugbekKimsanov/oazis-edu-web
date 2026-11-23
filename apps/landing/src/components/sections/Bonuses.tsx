import { BookOpen, Gift } from 'lucide-react';
import { Section } from '../ui/Section';
import { fileUrl } from '../../lib/api';

/** Kursga sovg'a sifatida biriktirilgan haqiqiy kitob. */
export interface GiftBookItem {
  bookId: number;
  title: string;
  /** Muqova yo'li (bo'lmasa rangli fon ko'rsatiladi). */
  cover?: string;
  /** Kitob turi: 'print' — bosma, aks holda elektron. */
  category?: string;
  /** Shu kitob sovg'a qilinadigan kurs(lar) nomi. */
  courses: string[];
}

/**
 * Bonuslar — admin panelda kurslarga biriktirilgan HAQIQIY sovg'a kitoblar.
 * Yozuv tepada markazda, kartalar esa soniga qarab markazda tekis joylashadi —
 * 1 ta sovg'ada ham, 5 tada ham ko'rinish buzilmaydi. Har bir sovg'a alohida
 * karta: rasm, nom, turi va qaysi kurs bilan berilishi bitta chegara ichida.
 * Sovg'a bo'lmasa bo'lim ko'rsatilmaydi.
 */
export function Bonuses({
  title,
  text,
  gifts,
}: {
  title: string;
  text: string;
  gifts: GiftBookItem[];
}) {
  if (gifts.length === 0) return null;

  return (
    <Section title={title} className="bg-primary-light">
      <p className="mx-auto max-w-2xl text-center text-xl font-bold leading-snug text-gray-900 sm:text-2xl">
        {text}
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-4 sm:gap-5">
          {gifts.map((g) => {
            const cover = fileUrl(g.cover);
            return (
              <div
                key={g.bookId}
                className="oz-card flex w-40 min-w-0 flex-col rounded-2xl border-2 border-gray-100 bg-white p-3 shadow-sm sm:w-44"
              >
                <div className="oz-card-media relative overflow-hidden rounded-xl">
                  {cover ? (
                    <img
                      src={cover}
                      alt={g.title}
                      loading="lazy"
                      decoding="async"
                      className="aspect-[3/4] w-full rounded-xl bg-primary-light object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[3/4] items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-dark text-white">
                      <BookOpen className="h-8 w-8" />
                    </div>
                  )}
                  <span className="gift-gold absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold">
                    <Gift className="h-3.5 w-3.5" /> Sovg'a
                  </span>
                </div>
                <p
                  className="mt-2 line-clamp-2 text-sm font-semibold text-gray-900 [overflow-wrap:anywhere]"
                  title={g.title}
                >
                  {g.title}
                </p>
                <p className="mt-0.5 text-xs font-medium text-primary">
                  {g.category === 'print' ? 'Bosma kitob' : 'Elektron kitob'}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-gray-600">
                  {g.courses.map((c) => `«${c}»`).join(', ')} kursi bilan
                </p>
              </div>
            );
          })}
      </div>
    </Section>
  );
}