import type { CourseInfoItem } from '../../data/landing';
import { Section } from '../ui/Section';
import { FeatureGrid } from '../ui/FeatureGrid';

export function CourseInfo({ title, items }: { title: string; items: CourseInfoItem[] }) {
  // Kontent bo'sh bo'lsa bo'lim ko'rsatilmaydi.
  if (items.length === 0) return null;
  return (
    <Section title={title} className="bg-primary-light">
      <FeatureGrid items={items} />
    </Section>
  );
}
