import { Play } from 'lucide-react';
import type { Testimonial } from '../../data/landing';
import { Section } from '../ui/Section';
import { fileUrl } from '../../lib/api';

function Thumb({ t }: { t: Testimonial }) {
  const img = fileUrl(t.image);
  return (
    <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden bg-gradient-to-br from-primary/80 to-primary-dark">
      {img && <img src={img} alt={t.name} className="absolute inset-0 h-full w-full object-cover" />}
      <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition-transform group-hover:scale-110">
        <Play className="h-6 w-6 fill-white" />
      </span>
    </div>
  );
}

export function Testimonials({ title, testimonials }: { title: string; testimonials: Testimonial[] }) {
  return (
    <Section id="testimonials" title={title} className="bg-primary-light">
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
        {testimonials.map((t) => (
          <div
            key={t.id}
            className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm"
          >
            {t.videoUrl ? (
              <a href={t.videoUrl} target="_blank" rel="noreferrer" aria-label={t.name}>
                <Thumb t={t} />
              </a>
            ) : (
              <Thumb t={t} />
            )}
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
