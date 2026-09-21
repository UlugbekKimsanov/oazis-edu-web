import { IconGlyph } from './icon';

export function FeatureCard({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex h-full flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light text-primary">
        <IconGlyph name={icon} className="h-6 w-6" />
      </div>
      <p className="text-sm font-medium leading-relaxed text-gray-700">{text}</p>
    </div>
  );
}
