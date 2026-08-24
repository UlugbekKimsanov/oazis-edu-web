import type { CourseInfoItem } from '../../data/landing';
import { Section } from '../ui/Section';
import { FeatureCard } from '../ui/FeatureCard';

export function CourseInfo({ items }: { items: CourseInfoItem[] }) {
  return (
    <Section title="Kurslar haqida qisqacha" className="bg-primary-light">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((f, i) => (
          <FeatureCard key={i} icon={f.icon} text={f.text} />
        ))}
      </div>
    </Section>
  );
}
