import type { CSSProperties } from 'react';
import type { Goal } from '../../data/landing';
import { Section } from '../ui/Section';
import { IconGlyph } from '../ui/icon';
import { fileUrl } from '../../lib/api';
import { useInView } from '../../lib/useInView';

/**
 * Maqsad kartasining tepasidagi jonli sahna (rasm yuklanmagan bo'lsa ko'rsatiladi).
 * Ikonkaga qarab mos sahna tanlanadi; notanish ikonka uchun umumiy "to'lqinli" sahna.
 * Hammasi CSS animatsiya (index.css: .oz-goal-*), bezak — ekran o'quvchilardan yashirilgan.
 */
function GoalScene({ icon }: { icon: Goal['icon'] }) {
  return (
    <div
      aria-hidden="true"
      className="oz-goal-scene relative flex h-44 items-center justify-center overflow-hidden bg-gradient-to-br from-primary-light via-white to-primary-light"
    >
      {/* Orqa fondagi yumshoq doiralar */}
      <span className="absolute -left-8 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
      <span className="absolute -bottom-12 -right-6 h-36 w-36 rounded-full bg-primary/15 blur-2xl" />

      {icon === 'MessagesSquare' ? (
        <ChatScene />
      ) : icon === 'Timer' || icon === 'Clock' ? (
        <TimerScene icon={icon} />
      ) : icon === 'Brain' ? (
        <OrbitScene icon={icon} />
      ) : (
        <PulseScene icon={icon} />
      )}
    </div>
  );
}

/** Muloqot: ikki tilda navbatma-navbat chiqadigan suhbat pufakchalari. */
function ChatScene() {
  const bubbles: { text: string; mine: boolean }[] = [
    { text: 'Hello! How are you?', mine: false },
    { text: "I'm fine, thank you!", mine: true },
    { text: 'Nice to meet you 👋', mine: false },
  ];
  return (
    <div className="relative flex w-56 flex-col gap-2">
      {bubbles.map((b, i) => (
        <span
          key={b.text}
          className={`oz-goal-bubble max-w-[85%] rounded-2xl px-3 py-1.5 text-xs font-semibold shadow-sm ${
            b.mine
              ? 'self-end rounded-br-md bg-primary text-white'
              : 'self-start rounded-bl-md bg-white text-gray-700'
          }`}
          style={{ '--oz-goal-i': i } as CSSProperties}
        >
          {b.text}
        </span>
      ))}
    </div>
  );
}

/**
 * Vaqt: markazda ikonka, atrofida to'lib boradigan halqa. Halqaning to'lgan uchida kichik
 * tugmacha yuradi — u halqa bilan bir xil tezlikda aylanadi, shuning uchun doim to'lgan
 * chetda turadi (alohida "soat mili" yo'q: ikonka ostida ko'rinmay, noto'g'ri chiqardi).
 */
function TimerScene({ icon }: { icon: Goal['icon'] }) {
  return (
    <div className="relative flex h-28 w-28 items-center justify-center">
      {/* SVG 12 soatdan boshlanishi uchun -90° burilgan */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90 overflow-visible">
        <circle cx="50" cy="50" r="44" fill="none" stroke="rgb(46 158 110 / 0.15)" strokeWidth="6" />
        <circle
          className="oz-goal-ring"
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke="#2e9e6e"
          strokeWidth="6"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="100"
        />
        <circle
          className="oz-goal-knob"
          cx="94"
          cy="50"
          r="5.5"
          fill="#fff"
          stroke="#1f7a55"
          strokeWidth="3"
        />
      </svg>
      <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-lg">
        <IconGlyph name={icon} className="h-7 w-7" />
      </span>
    </div>
  );
}

/** Oson ta'lim: markazdagi ikonka atrofida sekin aylanadigan nuqtalar. */
function OrbitScene({ icon }: { icon: Goal['icon'] }) {
  return (
    <div className="relative flex h-32 w-32 items-center justify-center">
      <span className="absolute inset-2 rounded-full border border-dashed border-primary/30" />
      <span className="oz-goal-orbit absolute inset-2">
        <span className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow" />
        <span className="absolute bottom-[14%] left-[7%] h-2.5 w-2.5 rounded-full bg-amber-400 shadow" />
        <span className="absolute bottom-[14%] right-[7%] h-2 w-2 rounded-full bg-primary/60 shadow" />
      </span>
      <span className="oz-goal-breathe relative flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white shadow-lg">
        <IconGlyph name={icon} className="h-8 w-8" />
      </span>
    </div>
  );
}

/** Umumiy sahna: ikonka atrofida kengayib yo'qoladigan to'lqinlar. */
function PulseScene({ icon }: { icon: Goal['icon'] }) {
  return (
    <div className="relative flex h-28 w-28 items-center justify-center">
      <span className="oz-goal-pulse absolute h-16 w-16 rounded-2xl bg-primary/25" />
      <span className="oz-goal-pulse oz-goal-pulse-2 absolute h-16 w-16 rounded-2xl bg-primary/25" />
      <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white shadow-lg">
        <IconGlyph name={icon} className="h-8 w-8" />
      </span>
    </div>
  );
}

export function Goals({ title, goals }: { title: string; goals: Goal[] }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.25);

  // Kontent bo'sh bo'lsa bo'lim ko'rsatilmaydi.
  if (goals.length === 0) return null;
  return (
    <Section title={title} className="bg-white">
      <div
        ref={ref}
        className={`oz-goals grid grid-cols-1 gap-6 md:grid-cols-3 ${inView ? 'is-in' : ''}`}
      >
        {goals.map((g, i) => {
          const img = fileUrl(g.image);
          return (
            <article
              key={i}
              className="oz-goal oz-card flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
              style={{ '--oz-goal-card-i': i } as CSSProperties}
            >
              {img ? (
                <div className="oz-card-media h-44 overflow-hidden">
                  <img
                    src={img}
                    alt={g.title}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <GoalScene icon={g.icon} />
              )}
              <div className="flex flex-1 items-start gap-3 p-6">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-bold tabular-nums text-primary">
                  {i + 1}
                </span>
                <p className="text-base font-semibold leading-snug text-gray-800">{g.title}</p>
              </div>
            </article>
          );
        })}
      </div>
    </Section>
  );
}
