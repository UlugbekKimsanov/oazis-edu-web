import type { Feature } from '../../data/landing';
import { Section } from '../ui/Section';
import { FeatureCard } from '../ui/FeatureCard';

export function Features({ title, features }: { title: string; features: Feature[] }) {
  return (
    <Section id="about" title={title} className="bg-white">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f, i) => (
          <FeatureCard key={i} icon={f.icon} text={f.text} />
        ))}
      </div>
    </Section>
  );
}
