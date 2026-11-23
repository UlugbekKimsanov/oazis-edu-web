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
 * Bonuslar — admin panelda kurslarga biriktirilgan HAQIQIY sovg'a kitoblar
 * (namunaviy ro'yxat emas). Hech qaysi sotuvdagi kursga sovg'a biriktirilmagan
 * bo'lsa bo'lim ko'rsatilmaydi.
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
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {gifts.map((g) => {
            const cover = fileUrl(g.cover);
            return (
              <div key={g.bookId} className="min-w-0">
                <div className="relative">
                  {cover ? (
                    <img
                      src={cover}
                      alt={g.title}
                      loading="lazy"
                      decoding="async"
                      className="aspect-[3/4] w-full rounded-xl bg-white object-cover shadow-sm"
                    />
                  ) : (
                    <div className="flex aspect-[3/4] items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-dark text-white shadow-sm">
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
        <div>
          <h3 className="text-2xl font-bold leading-snug text-gray-900 sm:text-3xl">{text}</h3>
        </div>
      </div>
    </Section>
  );
}
