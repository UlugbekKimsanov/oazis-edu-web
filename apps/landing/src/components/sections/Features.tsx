import type { Feature } from '../../data/landing';
import { Section } from '../ui/Section';
import { FeatureGrid } from '../ui/FeatureGrid';

export function Features({ title, features }: { title: string; features: Feature[] }) {
  // Kontent bo'sh bo'lsa bo'lim ko'rsatilmaydi.
  if (features.length === 0) return null;
  return (
    <Section id="about" title={title} className="bg-white">
      <FeatureGrid items={features} />
    </Section>
  );
}
