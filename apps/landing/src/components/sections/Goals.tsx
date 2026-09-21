import type { Goal } from '../../data/landing';
import { Section } from '../ui/Section';
import { IconGlyph } from '../ui/icon';
import { fileUrl } from '../../lib/api';

export function Goals({ title, goals }: { title: string; goals: Goal[] }) {
  return (
    <Section title={title} className="bg-white">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {goals.map((g, i) => {
          const img = fileUrl(g.image);
          return (
            <div
              key={i}
              className="flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
            >
              {img ? (
                <img src={img} alt={g.title} className="h-40 w-full object-cover" />
              ) : (
                <div className="flex h-40 items-center justify-center bg-gradient-to-br from-primary to-primary-dark text-white">
                  <IconGlyph name={g.icon} className="h-14 w-14" />
                </div>
              )}
              <div className="p-6">
                <p className="text-sm font-medium leading-relaxed text-gray-700">{g.title}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
