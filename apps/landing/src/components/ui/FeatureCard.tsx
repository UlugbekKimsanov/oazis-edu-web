import type { CSSProperties } from 'react';
import { IconGlyph } from './icon';

export function FeatureCard({
  icon,
  text,
  index = 0,
  active = false,
}: {
  icon: string;
  text: string;
  /** Kartaning tartib raqami — skrollda ketma-ket chiqish kechikishi uchun. */
  index?: number;
  /** Navbatdagi "yoritilgan" karta (FeatureGrid aylantirib turadi). */
  active?: boolean;
}) {
  return (
    <div
      className={`oz-card oz-feature group relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl border-2 border-gray-100 bg-white p-6 shadow-sm ${active ? 'is-active' : ''}`}
      style={{ '--oz-feature-i': index } as CSSProperties}
    >
      <div className="oz-feature-icon flex h-12 w-12 items-center justify-center rounded-xl bg-primary-light text-primary">
        <IconGlyph name={icon} className="h-6 w-6" />
      </div>
      <p className="text-sm font-medium leading-relaxed text-gray-700">{text}</p>
      {/* Yoritilgan karta ostida to'lib boradigan chiziq — navbat qachon almashishini ko'rsatadi */}
      <span className="oz-feature-bar absolute inset-x-0 bottom-0 h-[3px] origin-left bg-primary" aria-hidden="true" />
    </div>
  );
}
