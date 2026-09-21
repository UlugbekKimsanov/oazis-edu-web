import { BookOpen } from 'lucide-react';
import type { BonusBook } from '../../data/landing';
import { Section } from '../ui/Section';
import { fileUrl } from '../../lib/api';

export function Bonuses({
  title,
  text,
  books,
}: {
  title: string;
  text: string;
  books: BonusBook[];
}) {
  return (
    <Section title={title} className="bg-primary-light">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
          {books.map((b) => {
            const cover = fileUrl(b.cover);
            return cover ? (
              <img
                key={b.id}
                src={cover}
                alt={b.title}
                className="aspect-[3/4] w-full rounded-xl object-cover shadow-sm"
              />
            ) : (
              <div
                key={b.id}
                className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary-dark p-3 text-center text-white shadow-sm"
              >
                <BookOpen className="h-7 w-7" />
                <span className="text-[10px] font-medium leading-tight">{b.title}</span>
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
