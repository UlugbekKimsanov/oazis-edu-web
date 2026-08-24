import { Play } from 'lucide-react';
import type { Testimonial } from '../../data/landing';
import { Section } from '../ui/Section';

export function Testimonials({ testimonials }: { testimonials: Testimonial[] }) {
  return (
    <Section id="fikrlar" title="O'quvchilarimiz fikrlari" className="bg-primary-light">
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
        {testimonials.map((t) => (
          <div
            key={t.id}
            className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm"
          >
            <div className="relative flex aspect-[3/4] items-center justify-center bg-gradient-to-br from-primary/80 to-primary-dark">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition-transform group-hover:scale-110">
                <Play className="h-6 w-6 fill-white" />
              </span>
            </div>
            <div className="p-3">
              <p className="text-xs font-semibold text-gray-800">{t.name}</p>
              <p className="text-xs text-gray-500">{t.course}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
