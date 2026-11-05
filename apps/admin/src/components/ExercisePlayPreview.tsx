import { useMemo, useState } from 'react';
import { ChevronLeft, CircleCheck, CircleX } from 'lucide-react';
import type { Exercise } from '../lib/types';

// ─────────────────────────────────────────────────────────────
// Mashq — o'quvchi ko'rinishi.
//
// Mobil ilovadagi `lib/presentation/screens/lesson/exercise_screen.dart`
// (_FillBlanksGame) bilan AYNAN bir xil mantiq va dizayn:
//   1. Barcha mashq gaplari bitta matn; har `_` guruhi — bitta bo'shliq.
//   2. Bankdan so'z bosiladi → birinchi bo'sh joyga tushadi, keyingisi → keyingi.
//   3. To'ldirilgan bo'shliqni bossa — so'z bankka qaytadi.
//   4. Hammasi to'lgach "Tekshirish" → har bo'shliq yashil/qizil, xato bo'lsa
//      to'g'ri gap ko'rsatiladi. "Yakunlash" → natija (sinovda saqlanmaydi).
//
// Mobil dizayn o'zgarsa — bu fayl ham yangilanishi shart.
// ─────────────────────────────────────────────────────────────

// Ranglar — mobil bilan bir xil
const C = {
  bg: '#E8F5EE',
  primary: '#2E9E6E',
  deep: '#1F7A55',
  error: '#E53935',
  errorBg: '#FFEBEB',
  ink: '#1A1A1A',
  muted: '#888888',
};

const BLANK_RE = /_+/g;

/** Matn segmenti: oddiy matn yoki bo'shliq (indeks bilan) */
type Segment = { text: string; blank?: undefined } | { blank: number; text?: undefined };
/** Matndagi bitta bo'sh joy */
type BlankRef = { exerciseId: number; correct: string };

/**
 * Barcha mashq gaplarini bitta matnga yig'adi (mobil `_buildText` bilan bir xil):
 * gaplar orderIndex bo'yicha, bo'shliqlar position bo'yicha; ortiqcha `_` matn
 * bo'lib qoladi, `_` yetmasa qolgan bo'shliqlar gap oxiriga qo'shiladi.
 */
function buildExerciseText(exercises: Exercise[]): { segments: Segment[]; blanks: BlankRef[] } {
  const segments: Segment[] = [];
  const blanks: BlankRef[] = [];
  const sorted = [...exercises].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

  const addBlank = (exerciseId: number, correct: string) => {
    blanks.push({ exerciseId, correct });
    segments.push({ blank: blanks.length - 1 });
  };

  let first = true;
  for (const ex of sorted) {
    const sentence = (ex.sentence ?? '').trim();
    const exBlanks = [...(ex.blanks ?? [])]
      .map((b) => ({ ...b, correctAnswer: (b.correctAnswer ?? '').trim() }))
      .filter((b) => b.correctAnswer !== '')
      .sort((a, b) => a.position - b.position);
    if (sentence === '' || exBlanks.length === 0) continue;

    // Gaplar orasida bo'sh joy
    if (!first) segments.push({ text: '  ' });
    first = false;

    let cursor = 0;
    let bi = 0;
    for (const m of sentence.matchAll(BLANK_RE)) {
      if (bi >= exBlanks.length) break; // ortiqcha '_' — matn bo'lib qoladi
      const start = m.index ?? 0;
      if (start > cursor) segments.push({ text: sentence.slice(cursor, start) });
      addBlank(ex.id, exBlanks[bi++].correctAnswer);
      cursor = start + m[0].length;
    }
    if (cursor < sentence.length) segments.push({ text: sentence.slice(cursor) });
    // '_' yetarli bo'lmasa — qolgan bo'shliqlar gap oxirida
    while (bi < exBlanks.length) {
      segments.push({ text: ' ' });
      addBlank(ex.id, exBlanks[bi++].correctAnswer);
    }
  }
  return { segments, blanks };
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** So'zlar banki (mobil `_buildBank`): to'g'ri javoblar + chalg'ituvchilar (takrorsiz), aralash */
function buildWordBank(blanks: BlankRef[], exercises: Exercise[]): string[] {
  const words = blanks.map((b) => b.correct);
  const seen = new Set(words.map((w) => w.toLowerCase()));
  const distractors: string[] = [];
  for (const ex of exercises) {
    for (const raw of (ex.options ?? '').split(',')) {
      const opt = raw.trim();
      if (opt === '') continue;
      const key = opt.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      distractors.push(opt);
    }
  }
  shuffle(distractors);
  // Bank juda uzun bo'lib ketmasligi uchun chalg'ituvchilar cheklanadi
  const limit = Math.max(3, blanks.length);
  return shuffle([...words, ...distractors.slice(0, limit)]);
}

// ─────────────────────────────────────────────────────────────

interface Props {
  exercises: Exercise[];
  /** Orqaga / Yopish */
  onExit?: () => void;
}

/** 390×844 ekran ichida ishlaydigan o'yin + yakuniy natija */
export default function ExercisePlayPreview({ exercises, onExit }: Props) {
  const [attempt, setAttempt] = useState(0);
  const [finished, setFinished] = useState<{ correct: number; total: number } | null>(null);

  if (finished) {
    return (
      <ResultScreen
        correct={finished.correct}
        total={finished.total}
        onRetry={() => { setFinished(null); setAttempt((a) => a + 1); }}
        onExit={onExit}
      />
    );
  }
  // key — qayta urinishda o'yin noldan quriladi (mobil ValueKey kabi)
  return (
    <FillBlanksGame
      key={attempt}
      exercises={exercises}
      onBack={onExit}
      onFinish={(correct, total) => setFinished({ correct, total })}
    />
  );
}

// ── O'yin ────────────────────────────────────────────────────

function FillBlanksGame({ exercises, onBack, onFinish }: {
  exercises: Exercise[];
  onBack?: () => void;
  onFinish: (correct: number, total: number) => void;
}) {
  const { segments, blanks, bank } = useMemo(() => {
    const t = buildExerciseText(exercises);
    return { ...t, bank: buildWordBank(t.blanks, exercises) };
  }, [exercises]);

  /** blank indeksi → bankdagi chip indeksi */
  const [placed, setPlaced] = useState<Record<number, number>>({});
  /** "Tekshirish" bosilganmi */
  const [checked, setChecked] = useState(false);

  const total = blanks.length;
  const placedCount = Object.keys(placed).length;
  const usedChips = new Set(Object.values(placed));
  const activeBlank = (() => {
    for (let i = 0; i < total; i++) if (placed[i] === undefined) return i;
    return null;
  })();
  const allFilled = placedCount === total && total > 0;
  const wordAt = (i: number) => (placed[i] === undefined ? null : bank[placed[i]]);
  const isCorrect = (i: number) => {
    const w = wordAt(i);
    return w != null && w.toLowerCase() === blanks[i].correct.toLowerCase();
  };
  let correctCount = 0;
  for (let i = 0; i < total; i++) if (isCorrect(i)) correctCount++;
  const allCorrect = correctCount === total;

  const tapChip = (chip: number) => {
    if (checked || usedChips.has(chip) || activeBlank == null) return;
    setPlaced((p) => ({ ...p, [activeBlank]: chip }));
  };
  const tapBlank = (i: number) => {
    if (checked || placed[i] === undefined) return;
    setPlaced((p) => { const n = { ...p }; delete n[i]; return n; });
  };
  const check = () => { if (allFilled && !checked) setChecked(true); };
  const finish = () => onFinish(correctCount, total);

  const progress = total === 0 ? 0 : (checked ? correctCount : placedCount) / total;
  const barColor = checked && !allCorrect ? C.error : C.primary;

  if (total === 0) {
    return (
      <Screen onBack={onBack}>
        <div className="flex-1 flex items-center justify-center px-6 text-center" style={{ color: C.muted, fontSize: 14 }}>
          Bu darsda mashq yo'q
        </div>
      </Screen>
    );
  }

  return (
    <Screen onBack={onBack}>
      {/* Progress */}
      <div style={{ padding: '0 16px 10px' }}>
        <div style={{ height: 8, borderRadius: 8, background: '#fff', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress * 100}%`, background: barColor, transition: 'width 280ms ease-out, background 200ms' }} />
        </div>
        <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: checked ? (allCorrect ? C.deep : C.error) : C.muted }}>
          {checked ? `${correctCount} / ${total} to'g'ri` : `${placedCount} / ${total} to'ldirildi`}
        </div>
      </div>

      {/* Matn */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '0 16px 16px' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.ink }}>Bo'shliqlarni to'ldiring</div>
        <div style={{ marginTop: 4, fontSize: 13, color: C.muted }}>
          {checked ? "Natija pastda ko'rsatilgan" : "So'zni tanlang — qaytarish uchun bo'shliqni bosing"}
        </div>
        <div style={{
          marginTop: 14, background: '#fff', borderRadius: 18, padding: '20px 18px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
        }}>
          <p style={{ fontSize: 18, fontWeight: 600, color: C.ink, lineHeight: 2.1, whiteSpace: 'pre-wrap', margin: 0 }}>
            {segments.map((seg, k) => seg.blank === undefined
              ? <span key={k}>{seg.text}</span>
              : (
                <BlankBox
                  key={k}
                  word={wordAt(seg.blank)}
                  active={!checked && wordAt(seg.blank) == null && activeBlank === seg.blank}
                  state={!checked ? 'idle' : isCorrect(seg.blank) ? 'correct' : 'wrong'}
                  onTap={() => tapBlank(seg.blank)}
                />
              ))}
          </p>
        </div>
      </div>

      {/* Pastki panel: so'zlar banki yoki natija */}
      <div style={{
        background: '#fff', borderRadius: '22px 22px 0 0', padding: '14px 16px 16px',
        boxShadow: '0 -3px 16px rgba(0,0,0,0.07)',
      }}>
        {checked ? (
          <ResultPanel ok={allCorrect} correctCount={correctCount} total={total} segments={segments} blanks={blanks} />
        ) : (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: allFilled ? C.deep : C.muted }}>
              {allFilled ? "Hammasi to'ldirildi — tekshiring" : "Mos so'zni tanlang"}
            </div>
            <div className="flex flex-wrap" style={{ gap: 8, marginTop: 10 }}>
              {bank.map((w, i) => (
                <WordChip key={i} word={w} used={usedChips.has(i)} onTap={() => tapChip(i)} />
              ))}
            </div>
          </>
        )}
        <button
          type="button"
          disabled={!allFilled}
          onClick={checked ? finish : check}
          style={{
            marginTop: 14, width: '100%', height: 52, borderRadius: 14, border: 'none',
            background: !allFilled ? 'rgba(46,158,110,0.35)' : (checked && !allCorrect ? C.error : C.primary),
            color: '#fff', fontSize: 15, fontWeight: 700, cursor: allFilled ? 'pointer' : 'default',
          }}
        >
          {checked ? 'Yakunlash' : 'Tekshirish'}
        </button>
      </div>
    </Screen>
  );
}

// ── Ekran karkasi: status bar + app bar ──────────────────────

function Screen({ onBack, children }: { onBack?: () => void; children: React.ReactNode }) {
  return (
    <div className="h-full flex flex-col" style={{ background: C.bg, color: C.ink }}>
      {/* Status bar (notch ostidagi joy) */}
      <div style={{ height: 47, flexShrink: 0 }} />
      {/* AppBar */}
      <div className="flex items-center" style={{ height: 56, padding: '0 8px', flexShrink: 0 }}>
        <button
          type="button"
          onClick={onBack}
          title="Orqaga"
          className="flex items-center justify-center"
          style={{
            width: 40, height: 40, margin: 8, borderRadius: 12, background: '#fff', border: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)', cursor: onBack ? 'pointer' : 'default', color: '#333',
          }}
        >
          <ChevronLeft size={18} />
        </button>
        <div style={{ marginLeft: 8, fontSize: 15, fontWeight: 700, color: C.ink }}>Mashq</div>
      </div>
      {children}
    </div>
  );
}

// ── Bo'shliq ─────────────────────────────────────────────────
//  - bo'sh        → pastki chiziq (faol bo'lsa yashil, aks holda kulrang)
//  - to'ldirilgan → chip (oq, bosilsa qaytadi)
//  - tekshirilgan → yashil / qizil chip (xato — silkinadi)

function BlankBox({ word, active, state, onTap }: {
  word: string | null;
  active: boolean;
  state: 'idle' | 'correct' | 'wrong';
  onTap: () => void;
}) {
  if (word == null) {
    return (
      <span style={{
        display: 'inline-block', minWidth: 58, padding: '3px 8px', margin: '0 2px',
        verticalAlign: 'middle', lineHeight: 1.3, fontSize: 17, fontWeight: 800,
        background: active ? '#F1FAF5' : 'transparent',
        borderBottom: `2.5px solid ${active ? C.primary : '#CFCFCF'}`,
      }}>
        {' '}
      </span>
    );
  }
  const colors = state === 'idle'
    ? { bg: '#fff', border: '#BDBDBD', fg: C.ink }
    : state === 'correct'
      ? { bg: C.bg, border: C.primary, fg: C.deep }
      : { bg: C.errorBg, border: C.error, fg: C.error };
  return (
    <span
      role={state === 'idle' ? 'button' : undefined}
      onClick={state === 'idle' ? onTap : undefined}
      className={state === 'wrong' ? 'oz-shake' : undefined}
      style={{
        display: 'inline-block', minWidth: 58, padding: '3px 10px', margin: '0 2px',
        verticalAlign: 'middle', textAlign: 'center', lineHeight: 1.3, fontSize: 16, fontWeight: 800,
        background: colors.bg, color: colors.fg, border: `1.5px solid ${colors.border}`, borderRadius: 10,
        cursor: state === 'idle' ? 'pointer' : 'default', userSelect: 'none',
      }}
    >
      {word}
    </span>
  );
}

// ── Bankdagi so'z ────────────────────────────────────────────

function WordChip({ word, used, onTap }: { word: string; used: boolean; onTap: () => void }) {
  return (
    <button
      type="button"
      disabled={used}
      onClick={onTap}
      style={{
        padding: '10px 14px', borderRadius: 12, fontSize: 15, fontWeight: 700,
        background: used ? '#F2F2F2' : '#fff',
        border: `1.5px solid ${used ? '#EBEBEB' : '#DDDDDD'}`,
        boxShadow: used ? 'none' : '0 2.5px 0 #E0E0E0',
        // Ishlatilgan so'z o'rnida qoladi, lekin ko'rinmas (layout sakramaydi)
        color: used ? 'transparent' : C.deep,
        cursor: used ? 'default' : 'pointer', transition: 'all 150ms', userSelect: 'none',
      }}
    >
      {word}
    </button>
  );
}

// ── Tekshirishdan keyingi panel ──────────────────────────────

function ResultPanel({ ok, correctCount, total, segments, blanks }: {
  ok: boolean; correctCount: number; total: number; segments: Segment[]; blanks: BlankRef[];
}) {
  const color = ok ? C.deep : C.error;
  return (
    <div style={{ padding: 14, borderRadius: 14, background: ok ? C.bg : C.errorBg }}>
      <div className="flex items-center" style={{ gap: 8 }}>
        {ok ? <CircleCheck size={20} color={color} /> : <CircleX size={20} color={color} />}
        <div style={{ fontSize: 15, fontWeight: 800, color }}>
          {ok ? "Barakalla! Hammasi to'g'ri" : `${correctCount} / ${total} to'g'ri`}
        </div>
      </div>
      {!ok && (
        <>
          <div style={{ marginTop: 10, fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color }}>TO'G'RI JAVOB</div>
          {/* To'liq to'g'ri matn — to'g'ri so'zlar ajratib ko'rsatiladi */}
          <p style={{ marginTop: 4, fontSize: 14, fontWeight: 500, color: C.ink, lineHeight: 1.5, whiteSpace: 'pre-wrap', margin: '4px 0 0' }}>
            {segments.map((seg, k) => seg.blank === undefined
              ? <span key={k}>{seg.text}</span>
              : (
                <span key={k} style={{ fontWeight: 800, color: C.deep, textDecoration: 'underline', textDecorationColor: C.primary }}>
                  {blanks[seg.blank].correct}
                </span>
              ))}
          </p>
        </>
      )}
    </div>
  );
}

// ── Yakuniy natija (sinov) ───────────────────────────────────
// Mobil ilovada bu o'rinda CelebrationScreen (ball, yulduzlar, yutuqlar) chiqadi;
// adminda natija saqlanmaydi — faqat foiz ko'rsatiladi.

function ResultScreen({ correct, total, onRetry, onExit }: {
  correct: number; total: number; onRetry: () => void; onExit?: () => void;
}) {
  const pct = total === 0 ? 0 : Math.round((correct * 100) / total);
  const ok = correct === total;
  const color = ok ? C.deep : C.error;
  return (
    <Screen onBack={onExit}>
      <div className="flex-1 flex items-center justify-center" style={{ padding: '0 16px' }}>
        <div className="w-full text-center" style={{ background: '#fff', borderRadius: 18, padding: '28px 20px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
          <div className="flex justify-center">
            {ok ? <CircleCheck size={56} color={color} /> : <CircleX size={56} color={color} />}
          </div>
          <div style={{ marginTop: 12, fontSize: 40, fontWeight: 800, color }}>{pct}%</div>
          <div style={{ marginTop: 2, fontSize: 14, fontWeight: 600, color: C.muted }}>{correct} / {total} to'g'ri</div>
          <div style={{ marginTop: 16, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
            Sinov rejimi — natija saqlanmadi. Mobil ilovada bu yerda natija ekrani (ball, yulduzlar, yutuqlar) chiqadi.
          </div>
        </div>
      </div>
      <div style={{ padding: '0 16px 24px' }} className="flex flex-col" >
        <button type="button" onClick={onRetry} style={{
          width: '100%', height: 52, borderRadius: 14, border: 'none', background: C.primary,
          color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
        }}>
          Qayta o'ynash
        </button>
        <button type="button" onClick={onExit} style={{
          marginTop: 10, width: '100%', height: 48, borderRadius: 14, background: '#fff',
          border: '1.5px solid #DDDDDD', color: C.deep, fontSize: 15, fontWeight: 700, cursor: 'pointer',
        }}>
          Yopish
        </button>
      </div>
    </Screen>
  );
}
