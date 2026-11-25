import {
  Award,
  CreditCard,
  Download,
  GraduationCap,
  PlayCircle,
  Smartphone,
  UserPlus,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Section } from '../ui/Section';
import { Button } from '../ui/Button';
import { useInView } from '../../lib/useInView';

interface Step {
  Icon: LucideIcon;
  title: string;
  text: string;
}

/** O'quvchining yo'li: ro'yxatdan o'tishdan sertifikatgacha. */
const STEPS: Step[] = [
  { Icon: UserPlus, title: "Ro'yxatdan o'tish", text: 'Email orqali bir daqiqada' },
  { Icon: GraduationCap, title: 'Kurs tanlash', text: "O'zingizga mos daraja" },
  { Icon: CreditCard, title: "To'lov", text: 'Click yoki Payme orqali' },
  { Icon: Download, title: 'Ilovani yuklash', text: 'Kurs ilovada ochiladi' },
  { Icon: PlayCircle, title: 'Darslar va mashqlar', text: 'Video, test va mashqlar' },
  { Icon: Award, title: 'Sertifikat', text: 'Kursni tugatgach beriladi' },
];

/**
 * "Qanday ishlaydi?" — qadamlar bitta oq panelda, bir qatorda. Keng ekranda ikonkalar
 * markazidan bitta ingichka chiziq o'tadi; uning bo'ylab bitta sharcha birinchi qadamdan
 * oxirgisiga to'xtovsiz, bir tekis yuradi. Sharcha qaysi ikonkaga yetsa, o'sha ikonka
 * yashilga to'lib yonadi va sharcha o'tib ketgach yana so'nadi.
 * Hammasi bitta CSS soati bilan ishlaydi (index.css: .oz-flow-ball, .oz-step-badge) —
 * sharcha va yoritish hech qachon bir-biridan ajralib ketmaydi.
 * Telefonda chiziq yo'q — yoritish qadamlar bo'ylab xuddi shu tartibda o'tadi.
 * Qadamlar soni STEPS'dan olinadi — chiziq va vaqtlar --oz-steps orqali o'zi moslashadi.
 */
export function HowItWorks({ onDownload }: { onDownload: () => void }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);

  return (
    <Section
      id="how"
      title="Qanday ishlaydi?"
      subtitle="Ro'yxatdan o'tishdan sertifikatgacha — bitta yo'l"
      className="bg-primary-light/60"
    >
      <div
        ref={ref}
        className={`oz-steps mx-auto max-w-6xl rounded-2xl border border-primary/15 bg-white p-5 sm:p-8 ${inView ? 'is-in' : ''}`}
      >
        <div className="relative" style={{ '--oz-steps': STEPS.length } as CSSProperties}>
          {/* Chiziq: birinchi ikonka markazidan oxirgisinikigacha (faqat bir qatorli keng ekranda). */}
          <div
            aria-hidden="true"
            className="oz-flow-track pointer-events-none absolute top-6 hidden h-px lg:block"
          >
            <span className="oz-flow-ball" />
          </div>

          <ol className="oz-steps-grid relative grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:gap-y-0">
            {STEPS.map(({ Icon, title, text }, i) => (
              <li
                key={title}
                className="oz-step flex flex-col items-center text-center"
                style={{ '--oz-step-i': i } as CSSProperties}
              >
                {/* Oq halqa chiziqni ikonka atrofida uzib turadi */}
                <span className="oz-step-badge flex h-12 w-12 items-center justify-center rounded-xl ring-8 ring-white">
                  <Icon size={22} strokeWidth={2.1} aria-hidden="true" />
                </span>
                <span className="mt-3 text-[11px] font-semibold tabular-nums text-primary">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-0.5 text-sm font-semibold text-gray-900">{title}</h3>
                <p className="mt-1 text-xs leading-snug text-gray-500">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="mt-10 flex justify-center">
        <Button type="button" onClick={onDownload} attention>
          <Smartphone size={18} />
          Ilovani yuklab olish
        </Button>
      </div>
    </Section>
  );
}
