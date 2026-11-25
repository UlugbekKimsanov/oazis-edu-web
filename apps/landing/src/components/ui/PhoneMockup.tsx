import { useEffect, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Check,
  Flame,
  GraduationCap,
  Home,
  Pause,
  Play,
  Pointer,
  User,
  X,
} from 'lucide-react';
import { prefersReducedMotion } from '../../lib/useInView';

interface Question {
  word: string;
  options: [string, string, string];
  correct: number;
}

/** Namuna savollar — ilovadagi so'z testi ko'rinishida. */
const QUESTIONS: Question[] = [
  { word: 'Hello', options: ['Rahmat', 'Salom', 'Xayr'], correct: 1 },
  { word: 'Thank you', options: ['Rahmat', 'Kechirasiz', 'Marhamat'], correct: 0 },
  { word: 'Good morning', options: ['Xayrli tun', 'Xayrli kech', 'Xayrli tong'], correct: 2 },
  { word: 'Book', options: ['Daftar', 'Kitob', 'Qalam'], correct: 1 },
];

const POINTS_PER_ANSWER = 10;
/** Namoyish rejimi: savol ko'rinib turadi -> javob bosiladi -> keyingi savol. */
const AUTO_THINK_MS = 1900;
const NEXT_AFTER_ANSWER_MS = 1500;
/** Foydalanuvchi shuncha vaqt tegmasa, namoyish rejimi qayta yoqiladi. */
const IDLE_BACK_TO_AUTO_MS = 9000;

/**
 * Hero'dagi interaktiv telefon maketi: OAZIS ilovasidagi dars ekrani, ichida haqiqiy bosiladigan
 * mini-test. Foydalanuvchi javobni o'zi tanlaydi: to'g'ri bo'lsa yashil va ball qo'shiladi,
 * xato bo'lsa qizil silkinadi va to'g'ri javob ko'rsatiladi. Hech kim tegmasa maket o'zi
 * namoyish qiladi (avtomatik javob beradi). Maket kursorga qarab qimirlamaydi.
 * Ekran nisbati haqiqiy telefonnikidek (9:19.5) — kontent uzunligiga bog'liq emas.
 * Ranglar mobil ilova bilan bir xil: fon #E8F5EE, asosiy #2E9E6E.
 */
export function PhoneMockup({ className = '' }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [points, setPoints] = useState(0);
  // Harakat kamaytirilgan bo'lsa namoyish rejimi yoqilmaydi — maket faqat bosilganda o'zgaradi.
  const [auto, setAuto] = useState(() => !prefersReducedMotion());
  const [touched, setTouched] = useState(false);
  const [playing, setPlaying] = useState(false);

  const question = QUESTIONS[index];
  const answered = picked !== null;
  const isCorrect = answered && picked === question.correct;
  const progress = ((index + (answered ? 1 : 0)) / QUESTIONS.length) * 100;

  // Namoyish rejimi: javob berilmagan bo'lsa, biroz "o'ylab" to'g'ri javobni bosadi.
  useEffect(() => {
    if (!auto || answered) return;
    const timer = window.setTimeout(() => {
      setPicked(question.correct);
      setPoints((p) => p + POINTS_PER_ANSWER);
    }, AUTO_THINK_MS);
    return () => window.clearTimeout(timer);
  }, [auto, answered, question]);

  // Javobdan keyin keyingi savolga o'tadi (oxirgisidan keyin boshiga qaytadi).
  useEffect(() => {
    if (!answered) return;
    const timer = window.setTimeout(() => {
      setPicked(null);
      setIndex((i) => (i + 1) % QUESTIONS.length);
    }, NEXT_AFTER_ANSWER_MS);
    return () => window.clearTimeout(timer);
  }, [answered, index]);

  // Foydalanuvchi to'xtab qolsa, namoyish rejimi qayta yoqiladi.
  useEffect(() => {
    if (auto || answered || prefersReducedMotion()) return;
    const timer = window.setTimeout(() => setAuto(true), IDLE_BACK_TO_AUTO_MS);
    return () => window.clearTimeout(timer);
  }, [auto, answered, index]);

  const choose = (option: number) => {
    if (answered) return;
    setAuto(false);
    setTouched(true);
    setPicked(option);
    if (option === question.correct) setPoints((p) => p + POINTS_PER_ANSWER);
  };

  const optionClass = (i: number) => {
    const base =
      'relative flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left text-xs font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary';
    if (!answered) {
      return `${base} cursor-pointer border-gray-200 bg-white text-gray-700 hover:border-primary hover:bg-primary-light active:scale-[0.98]`;
    }
    if (i === question.correct) return `${base} border-primary bg-primary text-white`;
    if (i === picked) return `${base} oz-ph-shake border-red-400 bg-red-50 text-red-600`;
    return `${base} border-gray-200 bg-white text-gray-400`;
  };

  return (
    <div className={`mx-auto w-[14.5rem] ${className}`}>
      <div className="relative select-none">
        {/* Orqadagi yumshoq nur */}
        <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-white/15 blur-2xl" aria-hidden="true" />

        {/* Korpus */}
        <div
          className="rounded-[2.4rem] bg-gray-900 p-2 shadow-2xl ring-1 ring-white/20"
          role="group"
          aria-label="OAZIS ilovasi namunasi: so'z testi"
        >
          <div className="relative flex aspect-[9/19.5] flex-col overflow-hidden rounded-[1.9rem] bg-[#E8F5EE] text-gray-800">
            {/* Kamera */}
            <div
              className="absolute left-1/2 top-2 z-10 h-4 w-16 -translate-x-1/2 rounded-full bg-gray-900"
              aria-hidden="true"
            />

            <div className="flex min-h-0 flex-1 flex-col px-3.5 pb-2 pt-9">
              {/* Sarlavha: dars nomi, ball va streak */}
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-medium text-gray-500">
                    3-dars · {index + 1}/{QUESTIONS.length}
                  </div>
                  <div className="truncate text-sm font-bold text-gray-900">Salomlashish</div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span
                    key={points}
                    className={`rounded-full bg-primary px-2 py-1 text-[10px] font-bold tabular-nums text-white shadow-sm ${points > 0 ? 'oz-ph-pop' : ''}`}
                    aria-live="polite"
                  >
                    {points} ball
                  </span>
                  <span className="flex items-center gap-0.5 rounded-full bg-white px-1.5 py-1 text-[10px] font-bold text-orange-500 shadow-sm">
                    <Flame size={11} strokeWidth={2.5} aria-hidden="true" />5
                  </span>
                </div>
              </div>

              {/* Progress */}
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Video dars — bosilsa "ijro" holati almashadi */}
              <button
                type="button"
                onClick={() => {
                  setTouched(true);
                  setPlaying((p) => !p);
                }}
                aria-label={playing ? "Videoni to'xtatish" : 'Videoni ijro etish'}
                className="group relative mt-3.5 flex h-24 w-full shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-primary to-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-primary shadow transition-transform group-hover:scale-110 group-active:scale-95">
                  {playing ? (
                    <Pause size={14} fill="currentColor" />
                  ) : (
                    <Play size={14} fill="currentColor" className="translate-x-px" />
                  )}
                </span>
                <span className="absolute bottom-1.5 right-2 rounded bg-black/35 px-1 text-[9px] font-medium text-white">
                  04:12
                </span>
                {/* Ijro chizig'i */}
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-white/25" aria-hidden="true">
                  <span className={`block h-full bg-white ${playing ? 'oz-ph-video is-playing' : 'oz-ph-video'}`} />
                </span>
              </button>

              {/* Savol */}
              <div className="mt-3.5 rounded-xl bg-white p-3 shadow-sm">
                <div className="text-[10px] font-medium text-gray-500">Tarjimasini tanlang</div>
                <div key={question.word} className="oz-ph-question mt-0.5 text-sm font-bold text-gray-900">
                  «{question.word}»
                </div>

                <div className="mt-2.5 space-y-2">
                  {question.options.map((option, i) => (
                    <button
                      key={`${index}-${i}`}
                      type="button"
                      onClick={() => choose(i)}
                      disabled={answered}
                      className={optionClass(i)}
                    >
                      {option}
                      {answered && i === question.correct && (
                        <Check size={14} strokeWidth={3} className="oz-ph-pop" aria-hidden="true" />
                      )}
                      {answered && i === picked && i !== question.correct && (
                        <X size={14} strokeWidth={3} aria-hidden="true" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Natija xabari */}
              <div className="flex min-h-6 flex-1 items-center justify-center" aria-live="polite">
                {answered && (
                  <span
                    className={`oz-ph-pop rounded-full px-2.5 py-1 text-[10px] font-bold text-white shadow ${isCorrect ? 'bg-primary' : 'bg-red-500'}`}
                  >
                    {isCorrect
                      ? `To'g'ri! +${POINTS_PER_ANSWER} ball`
                      : `To'g'ri javob: ${question.options[question.correct]}`}
                  </span>
                )}
              </div>
            </div>

            {/* Pastki navigatsiya */}
            <div
              className="flex shrink-0 items-center justify-around border-t border-black/5 bg-white px-2 pb-3 pt-2.5 text-gray-300"
              aria-hidden="true"
            >
              <Home size={15} className="text-primary" />
              <GraduationCap size={15} />
              <BookOpen size={15} />
              <BarChart3 size={15} />
              <User size={15} />
            </div>
          </div>
        </div>
      </div>

      {/* Taklif: birinchi bosishgacha ko'rinadi */}
      <p
        className={`mt-4 flex items-center justify-center gap-1.5 text-xs font-medium text-white/85 transition-opacity duration-300 ${touched ? 'opacity-0' : 'opacity-100'}`}
        aria-hidden={touched}
      >
        <Pointer size={14} className="oz-ph-hint" aria-hidden="true" />
        Sinab ko'ring — javobni bosing
      </p>
    </div>
  );
}
