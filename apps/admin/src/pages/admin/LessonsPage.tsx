import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useRememberedSearch } from '../../hooks/useRememberedSearch';
import { Plus, Pencil, Trash2, BookOpen, FileQuestion, Dumbbell, MoreVertical, Search, Clock, PlayCircle, Upload, Image as ImageIcon, Headphones, GripVertical, Check, X, ArrowLeft, SquarePlay, Smartphone, ZoomIn, ZoomOut, GraduationCap } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Modal from '../../components/ui/Modal';
import PhoneFrame from '../../components/ui/PhoneFrame';
import ExercisePlayPreview from '../../components/ExercisePlayPreview';
import Button from '../../components/ui/Button';
import PageHeader from '../../components/ui/PageHeader';
import { EmptyState, ErrorState, LoadingState, Skeleton } from '../../components/ui/States';
import api, { fileUrl } from '../../lib/api';
import { apiErrorMessage } from '../../lib/errors';
import { parseYoutubeId, youtubeUrl } from '../../lib/youtube';
import { toast, confirmDialog, type ConfirmOptions } from '../../stores/ui-store';
import type { Course, Language, Lesson, Vocabulary, Question, Exercise, Audiobook } from '../../lib/types';

/** URL'da eslab qolinadigan parametrlar (yon menyudan qaytganda tiklanadi) */
const LESSONS_PARAMS = ['courseId'] as const;

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]';
const iconBtnCls = 'p-1.5 text-gray-400 disabled:opacity-40 disabled:cursor-not-allowed';

// Video uchun maksimal hajm — 2 GB. Backend (FileStorageService.MAX_VIDEO_BYTES)
// va nginx (client_max_body_size) bilan bir xil bo'lishi shart.
const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;
const fmtBytes = (b: number) =>
  b >= 1024 * 1024 * 1024 ? `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;
// Ba'zi fayllarda (masalan .mkv) brauzer MIME turini bermaydi — kengaytma bo'yicha ham qabul qilinadi
const VIDEO_EXT_RE = /\.(mp4|m4v|mov|mkv|webm|avi|wmv|flv|mpe?g|3gp)$/i;
const AUDIO_EXT_RE = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|wma)$/i;

const NO_LESSONS: Lesson[] = [];

type LessonForm = { name: string; description: string; durationSec: number; videoUrl: string; youtube: string };
const EMPTY_LESSON_FORM: LessonForm = { name: '', description: '', durationSec: 0, videoUrl: '', youtube: '' };

/** Frontend'ning o'zi aniqlagan xato (backend javobidan emas) — matni to'g'ridan-to'g'ri ko'rsatiladi */
class LocalError extends Error {}

/** Ro'yxat oxiriga qo'shish uchun tartib raqami (o'chirilganlardan keyin ham takrorlanmaydi) */
const nextOrder = (list: { orderIndex?: number }[]) =>
  list.reduce((max, x) => Math.max(max, x.orderIndex || 0), 0) + 1;

// ── Test savoli yordamchilari ────────────────────────────────────
type QForm = { text: string; a: string; b: string; c: string; d: string; correct: string };
const EMPTY_Q_FORM: QForm = { text: '', a: '', b: '', c: '', d: '', correct: 'A' };
/** Savol formasidagi birinchi kamchilik (yo'q bo'lsa null) */
const qProblem = (f: QForm): string | null => {
  if (!f.text.trim()) return 'Savol matnini kiriting';
  if (!f.a.trim() || !f.b.trim() || !f.c.trim()) return "A, B va C variantlarni to'ldiring";
  if (f.correct === 'D' && !f.d.trim()) return "To'g'ri javob D deb belgilangan, lekin D variant bo'sh";
  const opts = [f.a, f.b, f.c, f.d].map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (new Set(opts).size !== opts.length) return 'Variantlar bir-biridan farq qilishi kerak';
  return null;
};
const qPayload = (f: QForm) => ({
  questionText: f.text.trim(), optionA: f.a.trim(), optionB: f.b.trim(),
  optionC: f.c.trim(), optionD: f.d.trim(), correctOption: f.correct,
});

// ── Mashq (ko'p bo'shliqli) yordamchilari ────────────────────────
/** Forma holati: gap, har bo'shliq uchun to'g'ri so'z, chalg'ituvchilar (vergul bilan) */
type ExFormState = { sentence: string; answers: string[]; distractors: string };
const BLANK_RE = /_+/g;
/** Gapdagi bo'shliqlar soni — '_' ketma-ketligi 1 ta bo'shliq */
const countBlanks = (s?: string | null) => ((s ?? '').match(BLANK_RE) || []).length;
/** Vergul bilan yozilgan chalg'ituvchilarni tozalaydi: trim, bo'shlarni va to'g'ri javoblarga tenglarini tashlaydi */
const parseDistractors = (raw: string, answers: string[]) => {
  const ans = new Set(answers.map((a) => a.trim().toLowerCase()).filter(Boolean));
  const seen = new Set<string>();
  return raw.split(',').map((s) => s.trim()).filter((s) => {
    const k = s.toLowerCase();
    if (!s || ans.has(k) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};
/** Gap o'zgarganda javob inputlari sonini bo'shliqlar soniga moslaydi (kiritilganlar saqlanadi) */
const syncAnswers = (sentence: string, prev: string[]) => {
  const n = countBlanks(sentence);
  return Array.from({ length: n }, (_, i) => prev[i] ?? '');
};
/**
 * Mashq formasidagi birinchi kamchilik (yo'q bo'lsa null): gap bor, kamida 1 bo'shliq,
 * har bo'shliqqa so'z, kamida 1 chalg'ituvchi. Backend (ExerciseAdminService.validate) bilan mos.
 */
const exProblem = (f: ExFormState): string | null => {
  if (f.sentence.trim() === '') return 'Gapni kiriting';
  const n = countBlanks(f.sentence);
  if (n === 0) return "Gapda _ yo'q — tushib qolgan so'z o'rniga _ qo'ying";
  if (f.answers.length !== n || f.answers.some((a) => a.trim() === '')) return "Har bo'shliq uchun to'g'ri so'zni kiriting";
  // Eski mobil versiyalar variantlarni vergul bilan ajratilgan satrdan o'qiydi
  if (f.answers.some((a) => a.includes(','))) return "To'g'ri so'zda vergul bo'lmasligi kerak";
  if (parseDistractors(f.distractors, f.answers).length < 1) return "Kamida 1 ta chalg'ituvchi so'z kiriting (to'g'ri javoblardan farqli)";
  return null;
};

/** Mashq formasi maydonlari — qo'shish va tahrirlashda bir xil */
function ExerciseFormFields({ form, onChange, setSentence, onEnter }: {
  form: ExFormState;
  onChange: (f: ExFormState) => void;
  setSentence: (f: ExFormState, s: string) => ExFormState;
  /** Enter bosilganda (qo'shish/saqlash) */
  onEnter?: () => void;
}) {
  const blanks = countBlanks(form.sentence);
  const distractors = parseDistractors(form.distractors, form.answers);
  const problem = exProblem(form);
  const enter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') onEnter?.(); };
  return (
    <>
      <input value={form.sentence} onChange={(e) => onChange(setSentence(form, e.target.value))} onKeyDown={enter} className={inputCls}
        aria-label="Gap" placeholder="Gap — har tushib qolgan so'z o'rniga _ qo'ying (bir nechta bo'lishi mumkin)" />
      {blanks > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-gray-500">Har bo'shliq uchun to'g'ri so'z:</p>
          {/* Javoblar bo'shliq o'rni (pozitsiya) bilan aniqlanadi — indeks bu yerda barqaror kalit */}
          {form.answers.map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-6 h-6 shrink-0 rounded-full bg-green-50 border border-green-300 text-green-700 text-[11px] font-semibold flex items-center justify-center">{i + 1}</span>
              <input value={a} onChange={(e) => { const answers = [...form.answers]; answers[i] = e.target.value; onChange({ ...form, answers }); }}
                onKeyDown={enter} className={inputCls} aria-label={`${i + 1}-bo'shliq — to'g'ri so'z`} placeholder={`${i + 1}-bo'shliq — to'g'ri so'z`} />
            </div>
          ))}
        </div>
      )}
      <div className="space-y-1.5">
        <p className="text-[11px] text-gray-500">Chalg'ituvchi so'zlar — vergul bilan:</p>
        <input value={form.distractors} onChange={(e) => onChange({ ...form, distractors: e.target.value })} onKeyDown={enter}
          className={inputCls} aria-label="Chalg'ituvchi so'zlar" placeholder="we, they, me" />
        {distractors.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {distractors.map((d) => (
              <span key={d.toLowerCase()} className="px-2.5 py-1 rounded-lg text-xs border bg-white border-gray-200 text-gray-600">{d}</span>
            ))}
          </div>
        )}
      </div>
      {/* Nima yetishmayotgani — tugma nega bosilmayotgani tushunarli bo'lsin */}
      {form.sentence.trim() !== '' && problem && (
        <p className="text-[11px] text-amber-600">{problem}</p>
      )}
    </>
  );
}

/** Ro'yxatda gap — bo'shliqlar o'rnida yashil chip ichida to'g'ri javob */
function ExerciseSentencePreview({ ex }: { ex: Exercise }) {
  const parts = ex.sentence.split(BLANK_RE);
  const blanks = [...(ex.blanks ?? [])].sort((a, b) => a.position - b.position);
  const chipCls = 'inline-block mx-0.5 px-2 py-0.5 rounded-lg text-xs border bg-green-50 border-green-300 text-green-700 font-semibold align-middle';
  // Eski ma'lumot: '_' javoblardan kam bo'lsa, qolgan javoblar gap oxirida ko'rsatiladi (mobil ilova ham shunday)
  const extra = blanks.slice(parts.length - 1);
  return (
    <p className="text-sm font-medium leading-7 min-w-0 break-words">
      {/* Gap bo'laklari o'z o'rni bilan aniqlanadi — indeks barqaror kalit */}
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <span className={chipCls}>{blanks[i]?.correctAnswer || '?'}</span>
          )}
        </span>
      ))}
      {extra.map((b) => (
        <span key={b.id} className={chipCls}>{b.correctAnswer || '?'}</span>
      ))}
    </p>
  );
}

/** Test savoli maydonlari — qo'shish va tahrirlashda bir xil */
function QuestionFormFields({ form, onChange, onEnter }: {
  form: QForm;
  onChange: (f: QForm) => void;
  onEnter?: () => void;
}) {
  const enter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') onEnter?.(); };
  const problem = qProblem(form);
  const touched = [form.text, form.a, form.b, form.c, form.d].some((s) => s.trim() !== '');
  const opt = (key: 'a' | 'b' | 'c' | 'd', label: string) => (
    <input value={form[key]} onChange={(e) => onChange({ ...form, [key]: e.target.value })} onKeyDown={enter}
      className={inputCls} aria-label={label} placeholder={label} />
  );
  return (
    <>
      <input value={form.text} onChange={(e) => onChange({ ...form, text: e.target.value })} onKeyDown={enter}
        className={inputCls} aria-label="Savol matni" placeholder="Savol matni" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {opt('a', 'A variant')}
        {opt('b', 'B variant')}
        {opt('c', 'C variant')}
        {opt('d', 'D variant (ixtiyoriy)')}
      </div>
      <div className="w-28">
        <label className="block text-xs text-gray-500 mb-1">
          To'g'ri javob
          <select value={form.correct} onChange={(e) => onChange({ ...form, correct: e.target.value })} className={`${inputCls} mt-1`}>
            <option>A</option><option>B</option><option>C</option>
            <option disabled={!form.d.trim() && form.correct !== 'D'}>D</option>
          </select>
        </label>
      </div>
      {touched && problem && <p className="text-[11px] text-amber-600">{problem}</p>}
    </>
  );
}

/** Modul oynasidagi ro'yxat holati: yuklanmoqda / xato (qayta urinish bilan) / bo'sh / ro'yxat */
function SubList({ loading, error, onRetry, empty, emptyText, children }: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  empty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (empty) return <p className="text-sm text-gray-500 py-2">{emptyText}</p>;
  return <div className="space-y-2">{children}</div>;
}


export default function LessonsPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [coursesTick, setCoursesTick] = useState(0);
  // Darslar + ular qaysi kursga tegishli ekani (kurs almashganda eski ro'yxat ko'rinib qolmasin)
  const [lessonsRaw, setLessonsRaw] = useState<Lesson[]>([]);
  const [lessonsCourseId, setLessonsCourseId] = useState(0);
  const [lessonsError, setLessonsError] = useState<{ courseId: number; message: string } | null>(null);
  const [lessonsTick, setLessonsTick] = useState(0);
  const [reordering, setReordering] = useState(false);
  const [menuId, setMenuId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Lesson | null>(null);
  // orderIndex formada yo'q: yangi darsda ro'yxat oxiriga qo'shiladi, keyin
  // faqat sudrab tartiblash (drag-and-drop) orqali o'zgaradi.
  // youtube — admin kiritgan xom matn (URL yoki ID); saqlashda parseYoutubeId bilan ID'ga aylanadi
  const [form, setForm] = useState<LessonForm>(EMPTY_LESSON_FORM);
  // Forma ochilgandagi holat — saqlanmagan o'zgarish borligini aniqlash uchun
  const [initialForm, setInitialForm] = useState<LessonForm>(EMPTY_LESSON_FORM);
  const [nameError, setNameError] = useState<string | null>(null);
  // Video + cover fayl yuklash
  const [pendingVideo, setPendingVideo] = useState<File | null>(null);
  const [pendingCover, setPendingCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState('');
  const coverUrlRef = useRef('');
  // Serverdagi muqovani olib tashlash jarayoni
  const [coverRemoving, setCoverRemoving] = useState(false);
  // Butun saqlash jarayoni (PUT/POST + video + muqova) — ikki marta bosishdan himoya
  const [saving, setSaving] = useState(false);
  // Fayl tanlashdagi xato (hajm/tur) — tuzatilmaguncha saqlash bloklanadi
  const [videoError, setVideoError] = useState<string | null>(null);
  // Video yuklashdagi xato — bloklamaydi, «Saqlash» qayta urinadi
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Dars saqlash (PUT/POST) xatosi — modal ichida banner sifatida ko'rsatiladi
  const [saveError, setSaveError] = useState<string | null>(null);
  const [durationDetecting, setDurationDetecting] = useState(false);
  const durationToken = useRef(0);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const uploadAbort = useRef<AbortController | null>(null);

  const [vocabModal, setVocabModal] = useState(false);
  const [questionsModal, setQuestionsModal] = useState(false);
  const [exercisesModal, setExercisesModal] = useState(false);
  // Mashqni o'quvchi sifatida sinab ko'rish (mobil o'yin preview)
  const [playModal, setPlayModal] = useState(false);
  const [playZoom, setPlayZoom] = useState(0.75);
  /** O'ynaladigan mashqlar: butun dars (mobil kabi bitta matn) yoki bitta mashq alohida */
  const [playExercises, setPlayExercises] = useState<Exercise[]>([]);
  const openPlay = (list: Exercise[]) => { setPlayExercises(list); setPlayModal(true); };
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [vocabList, setVocabList] = useState<Vocabulary[]>([]);
  const [questionsList, setQuestionsList] = useState<Question[]>([]);
  const [exercisesList, setExercisesList] = useState<Exercise[]>([]);
  // Modul (lug'at/test/mashq/audio) oynalari uchun umumiy holat — bir vaqtda faqat bittasi ochiq
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);
  /** Bajarilayotgan amal kaliti ('vocab-add', 'q-del-5' ...) — tugmalar bloklanadi */
  const [busy, setBusy] = useState<string | null>(null);
  const subReq = useRef(0);
  /** Inline tahrirlash boshlangandagi forma — o'zgargan-o'zgarmaganini bilish uchun */
  const [editSnap, setEditSnap] = useState('');
  const closeGuard = useRef(false);

  // Audio kitob (audio + ixtiyoriy PDF + nom + tavsif)
  const [audioModal, setAudioModal] = useState(false);
  const [audioList, setAudioList] = useState<Audiobook[]>([]);
  const [audioTitle, setAudioTitle] = useState('');
  const [audioDesc, setAudioDesc] = useState('');
  const [pendingAudio, setPendingAudio] = useState<File | null>(null);
  const [pendingPdf, setPendingPdf] = useState<File | null>(null);
  const [audioUploading, setAudioUploading] = useState(false);
  const [audioPct, setAudioPct] = useState<number | null>(null);

  // Inline qo'shish formalari
  const [vocabForm, setVocabForm] = useState({ uz: '', target: '' });
  const vocabUzRef = useRef<HTMLInputElement>(null);
  const [qForm, setQForm] = useState<QForm>(EMPTY_Q_FORM);
  // Mashq: gap (har '_' = bo'sh joy, bir nechta bo'lishi mumkin) +
  // har bo'shliq uchun to'g'ri so'z + chalg'ituvchi so'zlar (vergul bilan)
  const [exForm, setExForm] = useState<ExFormState>({ sentence: '', answers: [], distractors: '' });

  // Inline tahrirlash holatlari
  const [editVocabId, setEditVocabId] = useState<number | null>(null);
  const [vEdit, setVEdit] = useState({ uz: '', target: '' });
  const [editQId, setEditQId] = useState<number | null>(null);
  const [qEdit, setQEdit] = useState<QForm>(EMPTY_Q_FORM);
  const [editExId, setEditExId] = useState<number | null>(null);
  const [exEdit, setExEdit] = useState<ExFormState>({ sentence: '', answers: [], distractors: '' });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const [searchParams, setSearchParams] = useSearchParams();
  useRememberedSearch(LESSONS_PARAMS);
  const requestedCourseId = Number(searchParams.get('courseId')) || 0;
  const requestedLessonId = Number(searchParams.get('lessonId')) || 0;

  // Qidiruv — URL'dagi `q` bilan birga yuradi (refresh'da saqlanadi). Input lokal holatdan
  // o'qiydi: URL yangilanishi kechiksa ham yozish silliq bo'ladi.
  const [search, setSearchState] = useState(() => searchParams.get('q') ?? '');
  const setSearch = (value: string) => {
    setSearchState(value);
    const next = new URLSearchParams(searchParams);
    if (value.trim()) next.set('q', value); else next.delete('q');
    setSearchParams(next, { replace: true });
  };

  // Tanlangan kurs — URL'dan (yo'q yoki noto'g'ri bo'lsa birinchi kurs).
  // Holat URL'da bo'lgani uchun refresh, orqaga/oldinga va sahifalar aro o'tish joyni yo'qotmaydi.
  const selectedCourse = courses.length === 0
    ? 0
    : (requestedCourseId && courses.some((c) => c.id === requestedCourseId) ? requestedCourseId : courses[0].id);
  const selectedCourseRef = useRef(selectedCourse);
  useEffect(() => { selectedCourseRef.current = selectedCourse; });

  // Faqat tanlangan kursning darslari — boshqa kursniki (hali yangilanmagan) ko'rsatilmaydi
  const lessons = lessonsCourseId === selectedCourse ? lessonsRaw : NO_LESSONS;
  const lessonsErrorText = lessonsError && lessonsError.courseId === selectedCourse ? lessonsError.message : null;
  const loading = coursesLoading || (selectedCourse !== 0 && lessonsCourseId !== selectedCourse && !lessonsErrorText);

  // Ochilgan dars ("watch" ko'rinishi) — URL'dagi lessonId bo'yicha
  const detailLesson = lessons.find((l) => l.id === requestedLessonId) ?? null;
  const setDetailLesson = (lesson: Lesson | null) => {
    const next = new URLSearchParams(searchParams);
    if (lesson) next.set('lessonId', String(lesson.id)); else next.delete('lessonId');
    if (selectedCourse) next.set('courseId', String(selectedCourse));
    // O'sha dars qayta o'rnatilsa tarixga yozilmaydi
    setSearchParams(next, { replace: next.get('lessonId') === searchParams.get('lessonId') });
  };

  /** Amaldan keyin ro'yxatni yangilash. Bu orada kurs almashgan bo'lsa javob tashlab yuboriladi. */
  const refreshLessons = async () => {
    const courseId = selectedCourse;
    if (!courseId) return;
    try {
      const res = await api.get(`/admin/courses/${courseId}/lessons`);
      if (selectedCourseRef.current !== courseId) return;
      setLessonsRaw(res.data.data ?? res.data ?? []);
      setLessonsCourseId(courseId);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Darslar ro'yxatini yangilab bo'lmadi. Sahifani yangilang."));
    }
  };

  // Kebab menyuni tashqariga bosganda yopish
  useEffect(() => {
    const h = () => setMenuId(null);
    window.addEventListener('click', h);
    return () => window.removeEventListener('click', h);
  }, []);

  // Tillar va kurslar; tanlangan kurs URL'dan hisoblanadi (yuqorida)
  useEffect(() => {
    let active = true;
    // Tillar faqat kurslarni guruhlash uchun — yuklanmasa kurslar «Boshqa» guruhida chiqadi
    api.get('/admin/languages')
      .then((res) => {
        if (active) setLanguages(res.data.data ?? res.data ?? []);
      })
      .catch(() => {});
    api.get('/admin/courses')
      .then((res) => {
        if (!active) return;
        setCourses(res.data.data ?? res.data ?? []);
        setCoursesError(null);
      })
      .catch((err) => {
        if (active) setCoursesError(apiErrorMessage(err, "Kurslarni yuklab bo'lmadi."));
      })
      .finally(() => {
        if (active) setCoursesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [coursesTick]);

  useEffect(() => {
    if (!selectedCourse) return;
    let active = true;
    api.get(`/admin/courses/${selectedCourse}/lessons`)
      .then((res) => {
        if (!active) return;
        setLessonsRaw(res.data.data ?? res.data ?? []);
        setLessonsCourseId(selectedCourse);
        setLessonsError(null);
      })
      .catch((err) => {
        if (active) setLessonsError({ courseId: selectedCourse, message: apiErrorMessage(err, "Darslarni yuklab bo'lmadi.") });
      });
    return () => {
      active = false;
    };
  }, [selectedCourse, lessonsTick]);

  const retryCourses = () => {
    setCoursesLoading(true);
    setCoursesError(null);
    setCoursesTick((t) => t + 1);
  };
  const retryLessons = () => {
    setLessonsError(null);
    setLessonsCourseId(0);
    setLessonsTick((t) => t + 1);
  };

  // Fayl yuklanayotganda tab yopilsa/yangilansa — brauzer ogohlantiradi
  useEffect(() => {
    if (!saving && !audioUploading) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [saving, audioUploading]);

  // Muqova preview'i uchun object URL — almashtirilganda va sahifadan chiqqanda bo'shatiladi
  const setCover = (file: File | null) => {
    if (coverUrlRef.current) URL.revokeObjectURL(coverUrlRef.current);
    coverUrlRef.current = file ? URL.createObjectURL(file) : '';
    setCoverPreview(coverUrlRef.current);
    setPendingCover(file);
  };
  useEffect(() => () => {
    if (coverUrlRef.current) URL.revokeObjectURL(coverUrlRef.current);
  }, []);

  /**
   * Tasdiq oynasi. U ochiq turganda bosilgan Esc ostidagi modalga ham yetib boradi —
   * modal yopilib (yoki ikkinchi tasdiq ochilib) ketmasligi uchun shu vaqt ichida
   * modalni yopish urinishlari e'tiborsiz qoldiriladi (closeGuard).
   */
  const ask = async (opts: ConfirmOptions) => {
    if (closeGuard.current) return false;
    closeGuard.current = true;
    const ok = await confirmDialog(opts);
    setTimeout(() => { closeGuard.current = false; }, 0);
    return ok;
  };

  /** «Saqlanmagan o'zgarishlar» tasdig'i */
  const confirmDiscard = () => ask({
    title: "O'zgarishlar saqlanmagan",
    message: "Oyna yopilsa, kiritilgan ma'lumotlar yo'qoladi.",
    confirmText: 'Yopish',
    cancelText: 'Davom etish',
    danger: true,
  });

  const resetVideoState = () => {
    setPendingVideo(null);
    setCover(null);
    setVideoError(null);
    setUploadError(null);
    setSaveError(null);
    setNameError(null);
    durationToken.current += 1;
    setDurationDetecting(false);
    setUploadPct(null);
  };

  const openLessonForm = (item: Lesson | null) => {
    const next: LessonForm = item
      ? {
          name: item.name,
          description: item.description || '',
          durationSec: item.durationSec || 0,
          videoUrl: item.videoUrl || '',
          // Tahrirda mavjud ID qisqa havola ko'rinishida ko'rsatiladi
          youtube: item.youtubeId ? youtubeUrl(item.youtubeId) : '',
        }
      : EMPTY_LESSON_FORM;
    setEditItem(item);
    resetVideoState();
    setForm(next);
    setInitialForm(next);
    setModalOpen(true);
  };
  const openCreate = () => openLessonForm(null);
  const openEdit = (item: Lesson) => openLessonForm(item);

  const lessonDirty = !!pendingVideo || !!pendingCover
    || form.name !== initialForm.name
    || form.description !== initialForm.description
    || form.youtube !== initialForm.youtube;

  const closeLessonModal = async () => {
    if (saving || closeGuard.current) return;
    if (lessonDirty && !(await confirmDiscard())) return;
    resetVideoState();
    setModalOpen(false);
  };

  /** Davom etayotgan video yuklashni to'xtatish (dars ma'lumotlari allaqachon saqlangan) */
  const cancelUpload = async () => {
    if (!uploadAbort.current) return;
    const ok = await ask({
      title: "Yuklash to'xtatilsinmi?",
      message: "Video yuklanishi bekor qilinadi. Darsning boshqa ma'lumotlari saqlangan — videoni keyinroq qayta yuklashingiz mumkin.",
      confirmText: "To'xtatish",
      cancelText: 'Davom etish',
      danger: true,
    });
    if (ok) uploadAbort.current?.abort();
  };

  // YouTube havola holati: bo'sh emas-u, ID ajratib bo'lmasa — tushunarsiz
  const youtubeInvalid = form.youtube.trim() !== '' && !parseYoutubeId(form.youtube);

  const handleSave = async () => {
    if (saving || durationDetecting || videoError || !selectedCourse) return;
    const name = form.name.trim();
    if (!name) {
      setNameError('Dars nomini kiriting');
      return;
    }
    if (youtubeInvalid) {
      toast.error("YouTube havolasi tushunarsiz — tuzating yoki maydonni bo'sh qoldiring.");
      return;
    }
    const creating = !editItem;
    const youtubeId = parseYoutubeId(form.youtube);
    const payload: Record<string, unknown> = {
      name,
      description: form.description.trim(),
      videoUrl: form.videoUrl,
      // YouTube: yangi darsda bo'sh — null. Tahrirda backend null'ni «o'zgarmasin» deb
      // tushunadi, biriktiruvni olib tashlash uchun bo'sh satr yuborilishi shart.
      youtubeId: creating ? youtubeId : (youtubeId ?? ''),
      courseId: selectedCourse,
    };
    // Davomiylik faqat aniqlangan bo'lsa yuboriladi — aks holda serverdagi
    // qiymat (ffprobe natijasi) nolga almashtirilib ketmasligi uchun.
    if (form.durationSec > 0) payload.durationSec = form.durationSec;
    // Tartib raqami: yangi dars ro'yxat oxiriga. Tahrirlashda umuman
    // yuborilmaydi — dars qayerda turgan bo'lsa, shu joyida qoladi.
    if (creating) payload.orderIndex = nextOrder(lessons);

    setSaveError(null);
    setUploadError(null);
    setSaving(true);
    try {
      let lessonId = editItem?.id;
      // 1) Dars ma'lumotlari
      try {
        if (editItem) {
          await api.put(`/admin/lessons/${editItem.id}`, payload);
        } else {
          const res = await api.post('/admin/lessons', payload);
          const created: Lesson | undefined = res.data?.data ?? res.data;
          if (!created?.id) throw new Error('Yaratilgan dars qaytmadi');
          lessonId = created.id;
          // Dars yaratildi: fayl yuklash muvaffaqiyatsiz bo'lib, «Saqlash» qayta bosilsa
          // ikkinchi (dublikat) dars yaratilmasin — forma tahrirlash rejimiga o'tadi.
          setEditItem(created);
        }
        setInitialForm(form);
      } catch (err) {
        // Xatoni yutmaymiz — admin saqlanmaganini bilishi shart
        setSaveError(apiErrorMessage(err, "Saqlashda xatolik yuz berdi. Internetni tekshirib qayta urinib ko'ring."));
        return;
      }

      // 2) Video (ixtiyoriy)
      if (pendingVideo && lessonId) {
        const fd = new FormData();
        fd.append('file', pendingVideo);
        const ctrl = new AbortController();
        uploadAbort.current = ctrl;
        setUploadPct(0);
        try {
          await api.post(`/admin/lessons/${lessonId}/upload-video`, fd, {
            // 2 GB yuklash soatlab ketishi mumkin — standart 60s timeout o'chiriladi.
            timeout: 0,
            signal: ctrl.signal,
            onUploadProgress: (e) => {
              if (e.total) setUploadPct(Math.round((e.loaded / e.total) * 100));
            },
          });
          setPendingVideo(null);
        } catch (err) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          const savedNote = "Darsning boshqa ma'lumotlari saqlandi — videoni qayta yuklash uchun «Saqlash»ni bosing.";
          setUploadError(
            axios.isCancel(err)
              ? `Video yuklash to'xtatildi. ${savedNote}`
              : status === 413
                ? `${apiErrorMessage(err, 'Video hajmi juda katta.')} Server bu hajmdagi faylni qabul qilmadi. ${savedNote}`
                : status
                  ? `${apiErrorMessage(err, "Videoni yuklab bo'lmadi.")} ${savedNote}`
                  // Javobsiz uzilish: internet yoki server (nginx) hajm chegarasi — brauzer farqini ko'rsatmaydi
                  : `Videoni yuklab bo'lmadi: aloqa uzildi yoki server bu hajmdagi faylni qabul qilmadi. ${savedNote}`
          );
          void refreshLessons();
          return;
        } finally {
          uploadAbort.current = null;
          setUploadPct(null);
        }
      }

      // 3) Muqova (ixtiyoriy)
      if (pendingCover && lessonId) {
        const fd = new FormData();
        fd.append('file', pendingCover);
        try {
          await api.post(`/admin/lessons/${lessonId}/upload-cover`, fd);
        } catch (err) {
          setSaveError(`Dars saqlandi, lekin muqova rasmi yuklanmadi: ${apiErrorMessage(err, "qayta urinib ko'ring.")}`);
          void refreshLessons();
          return;
        }
      }

      toast.success(creating ? 'Dars yaratildi' : 'Dars saqlandi');
      resetVideoState();
      setModalOpen(false);
      await refreshLessons();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (lesson: Lesson) => {
    const ok = await ask({
      title: "Dars o'chirilsinmi?",
      message: `«${lesson.name}» darsi o'chiriladi. Bu amalni qaytarib bo'lmaydi.`,
      confirmText: "O'chirish",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/admin/lessons/${lesson.id}`);
      toast.success("Dars o'chirildi");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Darsni o'chirib bo'lmadi."));
    }
    await refreshLessons();
  };

  // ── Darslar tartibi (drag-and-drop) ──────────────────────
  const persistLessonOrder = async (ordered: Lesson[]) => {
    const changed = ordered
      .map((l, i) => ({ id: l.id, orderIndex: i + 1, was: l.orderIndex }))
      .filter((c) => c.was !== c.orderIndex);
    if (changed.length === 0) return;
    const pos = new Map(ordered.map((l, i) => [l.id, i + 1]));
    // Optimistik: ro'yxat darhol yangi tartibda ko'rinadi
    setLessonsRaw((prev) =>
      prev
        .map((l) => (pos.has(l.id) ? { ...l, orderIndex: pos.get(l.id)! } : l))
        .sort((a, b) => a.orderIndex - b.orderIndex)
    );
    setReordering(true);
    // Faqat orderIndex yuboriladi (PUT qisman yangilaydi) — eskirgan nom/tavsif ustiga yozilmaydi
    const results = await Promise.allSettled(
      changed.map((c) => api.put(`/admin/lessons/${c.id}`, { orderIndex: c.orderIndex }))
    );
    setReordering(false);
    if (results.some((r) => r.status === 'rejected')) {
      toast.error("Tartibni to'liq saqlab bo'lmadi — ro'yxat serverdagi holatga qaytarildi.");
      await refreshLessons();
    }
  };

  const onLessonDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id || reordering) return;
    const list = visibleLessons;
    const from = list.findIndex((l) => l.id === active.id);
    const to = list.findIndex((l) => l.id === over.id);
    if (from < 0 || to < 0) return;
    void persistLessonOrder(arrayMove(list, from, to));
  };

  // ── Modul oynalari uchun umumiy yordamchilar ─────────────
  /**
   * Modul ro'yxatini yuklaydi. Eskirgan javob (bu orada boshqa dars/oyna ochilgan)
   * e'tiborsiz qoldiriladi. `silent` — amaldan keyingi yangilash: ro'yxat o'rnida qoladi.
   */
  const loadSub = async <T,>(url: string, apply: (list: T[]) => void, silent = false) => {
    const req = ++subReq.current;
    if (!silent) {
      setSubLoading(true);
      setSubError(null);
    }
    try {
      const res = await api.get(url);
      if (req !== subReq.current) return;
      apply(res.data.data ?? res.data ?? []);
      setSubError(null);
    } catch (err) {
      if (req !== subReq.current) return;
      if (silent) toast.error(apiErrorMessage(err, "Ro'yxatni yangilab bo'lmadi."));
      else setSubError(apiErrorMessage(err, "Ma'lumotni yuklab bo'lmadi."));
    } finally {
      if (req === subReq.current) setSubLoading(false);
    }
  };

  /** Modul amali (qo'shish/saqlash/o'chirish): band holati + xato toast. true — muvaffaqiyatli. */
  const runSub = async (key: string, fn: () => Promise<unknown>, fallback: string) => {
    if (busy) return false;
    setBusy(key);
    try {
      await fn();
      return true;
    } catch (err) {
      toast.error(err instanceof LocalError ? err.message : apiErrorMessage(err, fallback));
      return false;
    } finally {
      setBusy(null);
    }
  };

  /** Modul oynasini yopish — saqlanmagan kiritma bo'lsa tasdiq so'raladi */
  const closeSub = async (dirty: boolean, close: () => void) => {
    if (busy || closeGuard.current) return;
    if (dirty && !(await confirmDiscard())) return;
    subReq.current += 1;
    close();
  };

  const confirmDeleteItem = (what: string) => ask({
    title: "O'chirilsinmi?",
    message: `${what} o'chiriladi. Bu amalni qaytarib bo'lmaydi.`,
    confirmText: "O'chirish",
    danger: true,
  });

  /** Modul qo'shish formalari ro'yxat yuklanmaguncha bloklanadi (tartib raqami ro'yxatdan olinadi) */
  const subBlocked = subLoading || !!subError || !!busy;

  // ── Lug'at ────────────────────────────────────────────────
  const loadVocab = (lessonId: number, silent = false) =>
    loadSub<Vocabulary>(`/admin/lessons/${lessonId}/vocabulary`, setVocabList, silent);

  const openVocab = (lesson: Lesson) => {
    setCurrentLesson(lesson);
    setVocabForm({ uz: '', target: '' });
    setEditVocabId(null);
    setVocabList([]);
    setVocabModal(true);
    void loadVocab(lesson.id);
  };

  const vocabDirty = vocabForm.uz.trim() !== '' || vocabForm.target.trim() !== ''
    || (editVocabId != null && JSON.stringify(vEdit) !== editSnap);

  const addVocab = async () => {
    const uz = vocabForm.uz.trim();
    const target = vocabForm.target.trim();
    if (!currentLesson || !uz || !target || subBlocked) return;
    const lessonId = currentLesson.id;
    const ok = await runSub('vocab-add', () => api.post(`/admin/lessons/${lessonId}/vocabulary`, {
      translationUz: uz, translationTarget: target, orderIndex: nextOrder(vocabList),
    }), "So'zni qo'shib bo'lmadi.");
    if (!ok) return;
    setVocabForm({ uz: '', target: '' });
    // Ketma-ket kiritish qulay bo'lishi uchun kursor birinchi maydonga qaytadi
    vocabUzRef.current?.focus();
    await loadVocab(lessonId, true);
  };

  const startVocabEdit = (v: Vocabulary) => {
    const f = { uz: v.translationUz, target: v.translationTarget };
    setEditVocabId(v.id);
    setVEdit(f);
    setEditSnap(JSON.stringify(f));
  };

  const saveVocabEdit = async () => {
    if (editVocabId == null) return;
    const uz = vEdit.uz.trim();
    const target = vEdit.target.trim();
    if (!uz || !target) {
      toast.error("Ikkala maydonni ham to'ldiring");
      return;
    }
    const ok = await runSub('vocab-save', () => api.put(`/admin/vocabulary/${editVocabId}`, {
      translationUz: uz, translationTarget: target,
    }), "So'zni saqlab bo'lmadi.");
    if (!ok) return;
    setEditVocabId(null);
    toast.success('Saqlandi');
    if (currentLesson) await loadVocab(currentLesson.id, true);
  };

  const deleteVocab = async (v: Vocabulary) => {
    if (busy || !(await confirmDeleteItem(`«${v.translationUz} → ${v.translationTarget}» so'zi`))) return;
    const ok = await runSub(`vocab-del-${v.id}`, () => api.delete(`/admin/vocabulary/${v.id}`), "So'zni o'chirib bo'lmadi.");
    if (ok) toast.success("O'chirildi");
    if (currentLesson) await loadVocab(currentLesson.id, true);
  };

  // ── Savollar (Test) ──────────────────────────────────────
  const loadQuestions = (lessonId: number, silent = false) =>
    loadSub<Question>(`/admin/lessons/${lessonId}/questions`, setQuestionsList, silent);

  const openQuestions = (lesson: Lesson) => {
    setCurrentLesson(lesson);
    setQForm(EMPTY_Q_FORM);
    setEditQId(null);
    setQuestionsList([]);
    setQuestionsModal(true);
    void loadQuestions(lesson.id);
  };

  const questionsDirty = [qForm.text, qForm.a, qForm.b, qForm.c, qForm.d].some((s) => s.trim() !== '')
    || (editQId != null && JSON.stringify(qEdit) !== editSnap);

  const addQuestion = async () => {
    if (!currentLesson || qProblem(qForm) || subBlocked) return;
    const lessonId = currentLesson.id;
    const ok = await runSub('q-add', async () => {
      const res = await api.post(`/admin/lessons/${lessonId}/questions`, {
        ...qPayload(qForm), orderIndex: nextOrder(questionsList),
      });
      // Darsning testi topilmasa backend xatosiz bo'sh javob qaytaradi — savol saqlanmagan bo'ladi
      const saved = res.data?.data ?? res.data;
      if (!saved || typeof saved !== 'object') {
        throw new LocalError("Savol saqlanmadi: bu dars uchun test topilmadi. Dasturchiga murojaat qiling.");
      }
    }, "Savolni qo'shib bo'lmadi.");
    if (!ok) return;
    setQForm(EMPTY_Q_FORM);
    await loadQuestions(lessonId, true);
  };

  const startQuestionEdit = (q: Question) => {
    const f: QForm = { text: q.questionText, a: q.optionA, b: q.optionB, c: q.optionC, d: q.optionD || '', correct: q.correctOption };
    setEditQId(q.id);
    setQEdit(f);
    setEditSnap(JSON.stringify(f));
  };

  const saveQuestionEdit = async () => {
    if (editQId == null) return;
    const problem = qProblem(qEdit);
    if (problem) {
      toast.error(problem);
      return;
    }
    const ok = await runSub('q-save', () => api.put(`/admin/questions/${editQId}`, qPayload(qEdit)), "Savolni saqlab bo'lmadi.");
    if (!ok) return;
    setEditQId(null);
    toast.success('Saqlandi');
    if (currentLesson) await loadQuestions(currentLesson.id, true);
  };

  const deleteQuestion = async (q: Question) => {
    if (busy || !(await confirmDeleteItem(`«${q.questionText}» savoli`))) return;
    const ok = await runSub(`q-del-${q.id}`, () => api.delete(`/admin/questions/${q.id}`), "Savolni o'chirib bo'lmadi.");
    if (ok) toast.success("O'chirildi");
    if (currentLesson) await loadQuestions(currentLesson.id, true);
  };

  // ── Mashqlar ─────────────────────────────────────────────
  const emptyExForm = (): ExFormState => ({ sentence: '', answers: [], distractors: '' });

  const loadExercises = (lessonId: number, silent = false) =>
    loadSub<Exercise>(`/admin/lessons/${lessonId}/exercises`, setExercisesList, silent);

  const openExercises = (lesson: Lesson) => {
    setCurrentLesson(lesson);
    setExForm(emptyExForm());
    setEditExId(null);
    setExercisesList([]);
    setExercisesModal(true);
    void loadExercises(lesson.id);
  };

  const exercisesDirty = exForm.sentence.trim() !== '' || exForm.distractors.trim() !== ''
    || (editExId != null && JSON.stringify(exEdit) !== editSnap);

  // Gap o'zgarganda — bo'shliqlar soniga mos javob inputlari
  const setExSentence = (f: ExFormState, sentence: string): ExFormState =>
    ({ ...f, sentence, answers: syncAnswers(sentence, f.answers) });

  // {sentence, options (faqat chalg'ituvchilar), correctAnswers (bo'shliqlar tartibida)}
  const exPayload = (f: ExFormState) => {
    const correctAnswers = f.answers.map((s) => s.trim());
    return {
      sentence: f.sentence.trim(),
      options: parseDistractors(f.distractors, correctAnswers).join(','),
      correctAnswers,
    };
  };

  const addExercise = async () => {
    if (!currentLesson || exProblem(exForm) || subBlocked) return;
    const lessonId = currentLesson.id;
    const ok = await runSub('ex-add', () => api.post(`/admin/lessons/${lessonId}/exercises`, {
      ...exPayload(exForm),
      name: 'Fill', orderIndex: nextOrder(exercisesList),
    }), "Mashqni qo'shib bo'lmadi.");
    if (!ok) return;
    setExForm(emptyExForm());
    await loadExercises(lessonId, true);
  };

  const saveExerciseEdit = async () => {
    if (editExId == null || exProblem(exEdit)) return;
    const ok = await runSub('ex-save', () => api.put(`/admin/exercises/${editExId}`, exPayload(exEdit)), "Mashqni saqlab bo'lmadi.");
    if (!ok) return;
    setEditExId(null);
    toast.success('Saqlandi');
    if (currentLesson) await loadExercises(currentLesson.id, true);
  };

  // Tahrirlashga ochish — blanks va chalg'ituvchilar formaga tushadi
  const startExerciseEdit = (ex: Exercise) => {
    const blanks = [...(ex.blanks ?? [])].sort((a, b) => a.position - b.position);
    const answers = syncAnswers(ex.sentence, blanks.map((b) => b.correctAnswer));
    const distractors = (ex.options || '').split(',').map((s) => s.trim()).filter(Boolean).join(', ');
    const f: ExFormState = { sentence: ex.sentence, answers, distractors };
    setEditExId(ex.id);
    setExEdit(f);
    setEditSnap(JSON.stringify(f));
  };

  const deleteExercise = async (ex: Exercise) => {
    if (busy || !(await confirmDeleteItem(`«${ex.sentence}» mashqi`))) return;
    const ok = await runSub(`ex-del-${ex.id}`, () => api.delete(`/admin/exercises/${ex.id}`), "Mashqni o'chirib bo'lmadi.");
    if (ok) toast.success("O'chirildi");
    if (currentLesson) await loadExercises(currentLesson.id, true);
  };

  // ── Audio kitob ──────────────────────────────────────────
  const loadAudiobooks = (lessonId: number, silent = false) =>
    loadSub<Audiobook>(`/admin/lessons/${lessonId}/audiobooks`, setAudioList, silent);

  const resetAudioForm = () => {
    setAudioTitle('');
    setAudioDesc('');
    setPendingAudio(null);
    setPendingPdf(null);
  };

  const openAudiobooks = (lesson: Lesson) => {
    setCurrentLesson(lesson);
    resetAudioForm();
    setAudioList([]);
    setAudioModal(true);
    void loadAudiobooks(lesson.id);
  };

  const audioDirty = audioTitle.trim() !== '' || audioDesc.trim() !== '' || !!pendingAudio || !!pendingPdf;

  const onAudioSelected = (file: File) => {
    if (!file.type.startsWith('audio/') && !AUDIO_EXT_RE.test(file.name)) {
      toast.error('Audio fayl tanlang (MP3, M4A, WAV, OGG...).');
      return;
    }
    setPendingAudio(file);
  };
  const onPdfSelected = (file: File) => {
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      toast.error('Faqat PDF fayl tanlang.');
      return;
    }
    setPendingPdf(file);
  };

  const addAudiobook = async () => {
    if (!currentLesson || !pendingAudio || audioUploading || subBlocked) return;
    const lessonId = currentLesson.id;
    const fd = new FormData();
    fd.append('file', pendingAudio);
    if (pendingPdf) fd.append('pdf', pendingPdf);
    if (audioTitle.trim()) fd.append('title', audioTitle.trim());
    if (audioDesc.trim()) fd.append('description', audioDesc.trim());
    setAudioUploading(true);
    setAudioPct(0);
    try {
      await api.post(`/admin/lessons/${lessonId}/audiobooks`, fd, {
        // Katta audio sekin internetda 60 soniyaga sig'maydi — timeout o'chiriladi
        timeout: 0,
        onUploadProgress: (e) => {
          if (e.total) setAudioPct(Math.round((e.loaded / e.total) * 100));
        },
      });
    } catch (err) {
      // Forma va tanlangan fayllar saqlanib qoladi — admin qayta urinishi mumkin
      toast.error(apiErrorMessage(err, "Audio kitobni yuklab bo'lmadi: aloqa uzildi yoki fayl hajmi juda katta."));
      return;
    } finally {
      setAudioUploading(false);
      setAudioPct(null);
    }
    resetAudioForm();
    toast.success("Audio kitob qo'shildi");
    await loadAudiobooks(lessonId, true);
  };

  const deleteAudiobook = async (a: Audiobook) => {
    if (busy || !(await confirmDeleteItem(`«${a.title || 'Audio'}» audio kitobi`))) return;
    const ok = await runSub(`audio-del-${a.id}`, () => api.delete(`/admin/audiobooks/${a.id}`), "Audio kitobni o'chirib bo'lmadi.");
    if (ok) toast.success("O'chirildi");
    if (currentLesson) await loadAudiobooks(currentLesson.id, true);
  };

  // ── Dars tafsiloti ───────────────────────────────────────
  const openDetail = (lesson: Lesson) => setDetailLesson(lesson);

  // Kurslarni til bo'yicha guruhlash
  const courseGroups = languages
    .map((lang) => ({
      lang,
      items: courses.filter((c) => c.languageId === lang.id).sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter((g) => g.items.length > 0);
  const ungrouped = courses.filter((c) => !languages.some((l) => l.id === c.languageId)).sort((a, b) => a.name.localeCompare(b.name));

  const searchTerm = search.trim().toLowerCase();
  const visibleLessons = searchTerm ? lessons.filter((l) => l.name.toLowerCase().includes(searchTerm)) : lessons;
  const dragEnabled = searchTerm === '' && !reordering;
  const fmtDur = (s?: number) => {
    if (!s) return null;
    const m = Math.floor(s / 60), sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  /**
   * Tanlangan video fayldan davomiylikni brauzerda aniqlaydi (1-qadam).
   * Fayl to'liq o'qilmaydi — faqat `preload="metadata"` bilan sarlavha o'qiladi,
   * shuning uchun 2 GB fayl ham bir zumda aniqlanadi.
   *
   * Brauzer kodekni tushunmasa (masalan .mkv, .avi), bu yerda aniqlanmaydi —
   * u holda server tomonda ffprobe aniqlab beradi (2-qadam, upload-video
   * endpointida). Ya'ni davomiylik qo'lda kiritilmaydi.
   */
  const detectVideoDuration = (file: File) => {
    // Token: boshqa fayl tanlansa yoki forma yopilsa, eski natija formaga yozilmaydi
    const token = ++durationToken.current;
    setDurationDetecting(true);
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    const done = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      if (token === durationToken.current) setDurationDetecting(false);
    };
    video.onloadedmetadata = () => {
      if (token === durationToken.current && Number.isFinite(video.duration) && video.duration > 0) {
        setForm((f) => ({ ...f, durationSec: Math.round(video.duration) }));
      }
      done();
    };
    video.onerror = done;
    video.src = url;
  };

  // Video tanlanganda: tur va hajmni tekshirish + davomiylikni aniqlash
  const onVideoSelected = (file: File) => {
    setUploadError(null);
    if (!file.type.startsWith('video/') && !VIDEO_EXT_RE.test(file.name)) {
      setPendingVideo(null);
      setVideoError(`«${file.name}» video fayl emas. MP4, MOV, MKV, WEBM kabi video tanlang.`);
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setPendingVideo(null);
      setVideoError(`Video hajmi 2 GB dan oshmasligi kerak (tanlangan: ${fmtBytes(file.size)}).`);
      return;
    }
    setVideoError(null);
    setPendingVideo(file);
    // Eski videoning davomiyligi yangi faylga tegishli emas
    setForm((f) => ({ ...f, durationSec: 0 }));
    detectVideoDuration(file);
  };

  const clearPendingVideo = () => {
    durationToken.current += 1;
    setDurationDetecting(false);
    setPendingVideo(null);
    setVideoError(null);
    setUploadError(null);
    setForm((f) => ({ ...f, durationSec: initialForm.durationSec }));
  };

  const onCoverSelected = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Muqova uchun rasm fayl tanlang (JPG, PNG, WEBP).');
      return;
    }
    setCover(file);
  };

  // Serverga yuklangan muqovani olib tashlash (faqat mavjud darsni tahrirlashda)
  const removeLessonCover = async () => {
    const target = editItem;
    if (!target?.coverImage || saving || coverRemoving) return;
    const ok = await ask({
      title: 'Muqova rasmi olib tashlansinmi?',
      message: `«${target.name}» darsining muqova rasmi serverdan o'chiriladi. Bu amalni qaytarib bo'lmaydi.`,
      confirmText: 'Olib tashlash',
      danger: true,
    });
    if (!ok) return;
    setCoverRemoving(true);
    try {
      const res = await api.delete(`/admin/lessons/${target.id}/cover`);
      const updated = (res.data?.data ?? null) as Partial<Lesson> | null;
      setEditItem((cur) => (cur && cur.id === target.id ? { ...cur, ...(updated ?? {}), coverImage: undefined } : cur));
      toast.success('Muqova rasmi olib tashlandi');
      void refreshLessons();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Muqovani olib tashlab bo'lmadi. Qayta urinib ko'ring."));
    } finally {
      setCoverRemoving(false);
    }
  };

  const detailYoutubeId = detailLesson?.youtubeId || '';

  return (
    <div>
      {detailLesson ? (
        /* ===== Watch ko'rinishi — butun sahifaga yoyiladi (faqat yon menyu qoladi) ===== */
        <div>
          <button
            type="button"
            onClick={() => setDetailLesson(null)}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-[var(--primary)] mb-4"
          >
            <ArrowLeft size={18} /> Orqaga
          </button>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Asosiy: video + ma'lumot + modullar */}
            <div className="lg:col-span-2 space-y-4 min-w-0">
              {/* Mobil ilova kabi: YouTube ID bo'lsa u ustun, aks holda yuklangan fayl */}
              {detailYoutubeId ? (
                <iframe key={`yt-${detailLesson.id}`} className="w-full rounded-xl bg-black aspect-video"
                  src={`https://www.youtube.com/embed/${detailYoutubeId}`} title={detailLesson.name}
                  allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen />
              ) : detailLesson.videoUrl ? (
                <video key={detailLesson.id} controls autoPlay className="w-full rounded-xl bg-black aspect-video"
                  src={fileUrl(detailLesson.videoUrl)} poster={fileUrl(detailLesson.coverImage)} />
              ) : (
                <div className="w-full aspect-video rounded-xl bg-gray-100 flex flex-col items-center justify-center text-gray-400">
                  <PlayCircle size={40} className="mb-2" />
                  <span className="text-sm">Video yuklanmagan</span>
                </div>
              )}
              {detailYoutubeId && (
                <p className="text-xs text-gray-500">
                  O'quvchilar bu darsni YouTube pleyerda ko'radi{detailLesson.videoUrl ? ' (video fayl ham yuklangan, lekin YouTube ustun turadi)' : ''}.
                </p>
              )}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-gray-900 break-words">{detailLesson.name}</h2>
                  <p className="text-xs text-gray-400">#{detailLesson.orderIndex}-dars{detailLesson.durationSec ? ` · ${fmtDur(detailLesson.durationSec)}` : ''}</p>
                </div>
                <button type="button" onClick={() => openEdit(detailLesson)}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                  <Pencil size={14} /> Tahrirlash
                </button>
              </div>
              {detailLesson.description && (
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line break-words">{detailLesson.description}</p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <button type="button" onClick={() => openVocab(detailLesson)} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-colors">
                  <BookOpen size={20} className="text-green-600" />
                  <span className="text-xs font-medium text-gray-700">Lug'at</span>
                </button>
                <button type="button" onClick={() => openQuestions(detailLesson)} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors">
                  <FileQuestion size={20} className="text-blue-600" />
                  <span className="text-xs font-medium text-gray-700">Test</span>
                </button>
                <button type="button" onClick={() => openExercises(detailLesson)} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors">
                  <Dumbbell size={20} className="text-purple-600" />
                  <span className="text-xs font-medium text-gray-700">Mashq</span>
                </button>
                <button type="button" onClick={() => openAudiobooks(detailLesson)} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition-colors">
                  <Headphones size={20} className="text-orange-600" />
                  <span className="text-xs font-medium text-gray-700">Audio kitob</span>
                </button>
              </div>
            </div>

            {/* Yon lenta: kursdagi qolgan darslar */}
            <div className="lg:col-span-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-700 mb-2 px-1">Kurs darslari</h3>
              <div className="space-y-2 lg:max-h-[calc(100vh-200px)] lg:overflow-y-auto pr-1">
                {lessons.map((l) => {
                  const active = l.id === detailLesson.id;
                  const c = fileUrl(l.coverImage);
                  const d = fmtDur(l.durationSec);
                  return (
                    <button
                      type="button"
                      key={l.id}
                      onClick={() => setDetailLesson(l)}
                      className={`flex gap-2.5 w-full text-left p-1.5 rounded-lg transition-colors ${active ? 'bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30' : 'hover:bg-gray-50'}`}
                    >
                      <div className="relative w-32 aspect-video rounded-md overflow-hidden bg-gray-100 shrink-0">
                        {c ? (
                          <img src={c} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--primary)]/15 to-gray-100">
                            <PlayCircle size={20} className="text-[var(--primary)]/60" />
                          </div>
                        )}
                        <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/65 text-white text-[10px] font-semibold">#{l.orderIndex}</span>
                        {d && <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/80 text-white text-[10px]">{d}</span>}
                      </div>
                      <div className="min-w-0 flex-1 py-0.5">
                        <p className={`text-sm font-medium leading-snug line-clamp-2 ${active ? 'text-[var(--primary)]' : 'text-gray-900'}`}>{l.name}</p>
                        {active && <span className="text-[11px] text-[var(--primary)] font-medium">▶ Hozir ko'rilmoqda</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
      <>
      <PageHeader
        title="Darslar"
        description="Kartani bosib ko'ring · dastakdan sudrab tartiblang"
        actions={
          <>
            {courses.length > 0 && (
              <select
                aria-label="Kurs"
                value={selectedCourse}
                onChange={(e) => {
                  const next = new URLSearchParams(searchParams);
                  next.set('courseId', e.target.value);
                  next.delete('lessonId');
                  setSearchParams(next, { replace: true });
                }}
                className="min-w-0 max-w-[16rem] px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              >
                {courseGroups.map((g) => (
                  <optgroup key={g.lang.id} label={g.lang.name}>
                    {g.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                ))}
                {ungrouped.length > 0 && (
                  <optgroup label="Boshqa">
                    {ungrouped.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                )}
              </select>
            )}
            <Button onClick={openCreate} disabled={!selectedCourse || loading || !!lessonsErrorText}><Plus size={16} /> Yangi dars</Button>
          </>
        }
      />

      {/* Qidiruv */}
      <div className="flex items-center gap-3 flex-wrap mb-5">
        <div className="relative flex-1 min-w-[12rem] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            aria-label="Dars nomi bo'yicha qidirish"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Dars nomi bo'yicha qidirish"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
          />
        </div>
        {!loading && !coursesError && !lessonsErrorText && lessons.length > 0 && (
          <p className="text-xs text-gray-500">
            {searchTerm
              ? `${visibleLessons.length} / ${lessons.length} ta dars · qidiruv paytida tartiblash o'chiq`
              : `${lessons.length} ta dars`}
            {reordering && ' · tartib saqlanmoqda…'}
          </p>
        )}
      </div>

      {/* Darslar — YouTube uslubidagi 3 ustunli kichik kartalar (sudrab tartiblanadi) */}
      {coursesError ? (
        <ErrorState message={coursesError} onRetry={retryCourses} />
      ) : loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4" role="status" aria-label="Yuklanmoqda">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <Skeleton className="aspect-video w-full rounded-none" />
              <div className="p-2.5 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="Kurslar yo'q"
          description="Dars qo'shish uchun avval «Kurslar» bo'limida kurs yarating."
          action={<Link to="/admin/courses" className="text-sm font-medium text-[var(--primary)] hover:underline">Kurslar bo'limiga o'tish</Link>}
        />
      ) : lessonsErrorText ? (
        <ErrorState message={lessonsErrorText} onRetry={retryLessons} />
      ) : lessons.length === 0 ? (
        <EmptyState
          icon={PlayCircle}
          title="Bu kursda darslar yo'q"
          description="Birinchi darsni qo'shing — lug'at, test, mashq va audio kitobni keyin dars ichidan biriktirasiz."
          action={<Button onClick={openCreate}><Plus size={16} /> Yangi dars</Button>}
        />
      ) : visibleLessons.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Hech narsa topilmadi"
          description={`«${search.trim()}» bo'yicha bu kursda dars yo'q.`}
          action={<Button variant="secondary" size="sm" onClick={() => setSearch('')}>Qidiruvni tozalash</Button>}
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onLessonDragEnd}>
          <SortableContext items={visibleLessons.map((l) => l.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleLessons.map((l) => (
                <SortableLessonCard
                  key={l.id}
                  lesson={l}
                  cover={fileUrl(l.coverImage)}
                  dur={fmtDur(l.durationSec)}
                  dragEnabled={dragEnabled}
                  menuOpen={menuId === l.id}
                  onToggleMenu={() => setMenuId(menuId === l.id ? null : l.id)}
                  onOpenDetail={() => openDetail(l)}
                  onEdit={() => { setMenuId(null); openEdit(l); }}
                  onDelete={() => { setMenuId(null); void handleDelete(l); }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      </>
      )}

      {/* Lesson create/edit — rasm, video, nom, tavsif */}
      <Modal open={modalOpen} onClose={closeLessonModal} closeDisabled={saving} title={editItem ? "Darsni tahrirlash" : "Yangi dars"}>
        <div className="space-y-4">
          <div>
            <label htmlFor="lesson-name" className="block text-sm font-medium text-gray-700 mb-1">Nomi <span className="text-red-500">*</span></label>
            <input id="lesson-name" value={form.name} maxLength={255} disabled={saving}
              onChange={(e) => { setForm({ ...form, name: e.target.value }); if (nameError) setNameError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSave(); }}
              aria-invalid={!!nameError}
              className={`${inputCls} ${nameError ? 'border-red-300 focus:border-red-400 focus:ring-red-200' : ''}`} />
            {nameError && <p className="text-xs text-red-600 mt-1">{nameError}</p>}
          </div>
          <div>
            <label htmlFor="lesson-desc" className="block text-sm font-medium text-gray-700 mb-1">Tavsif</label>
            <textarea id="lesson-desc" value={form.description} disabled={saving} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className={inputCls} />
          </div>
          {/* Tartib raqami va davomiylik qo'lda kiritilmaydi — faqat ko'rsatiladi */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="block text-sm font-medium text-gray-700 mb-1">Tartib raqami</p>
              <div className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-gray-50 border border-gray-200 text-gray-600">
                <GripVertical size={14} className="text-gray-400 shrink-0" />
                <span className="font-medium">{editItem ? editItem.orderIndex : nextOrder(lessons)}</span>
                <span className="text-xs text-gray-400 truncate">
                  {editItem ? '· sudrab o\'zgartiriladi' : '· ro\'yxat oxiriga'}
                </span>
              </div>
            </div>
            <div>
              <p className="block text-sm font-medium text-gray-700 mb-1">Davomiyligi</p>
              <div className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-gray-50 border border-gray-200 text-gray-600">
                <Clock size={14} className="text-gray-400 shrink-0" />
                {durationDetecting ? (
                  <span className="text-xs text-gray-400">Aniqlanmoqda…</span>
                ) : form.durationSec > 0 ? (
                  <>
                    <span className="font-medium">{fmtDur(form.durationSec)}</span>
                    <span className="text-xs text-gray-400">· avtomatik</span>
                  </>
                ) : (
                  <span className="text-xs text-gray-400">Video yuklangach aniqlanadi</span>
                )}
              </div>
            </div>
          </div>
          <div>
            <p className="block text-sm font-medium text-gray-700 mb-1">Video (fayl)</p>
            <div className="flex items-center gap-3">
              <label className={`shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-[var(--primary)] ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}`}>
                <Upload size={15} /> Video tanlash
                <input type="file" accept="video/*,.mkv,.avi,.mov" className="hidden" disabled={saving}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    // Qiymat tozalanadi — o'sha faylni qayta tanlaganda ham onChange ishlaydi
                    e.target.value = '';
                    if (f) onVideoSelected(f);
                  }} />
              </label>
              <span className="text-xs text-gray-500 truncate flex-1 min-w-0" title={pendingVideo?.name}>
                {pendingVideo
                  ? `${pendingVideo.name} · ${fmtBytes(pendingVideo.size)}`
                  : (form.videoUrl ? 'Video yuklangan ✓' : 'Tanlanmagan')}
              </span>
              {(pendingVideo || videoError) && !saving && (
                <button type="button" onClick={clearPendingVideo} className={`${iconBtnCls} hover:text-red-500 shrink-0`}
                  title="Tanlovni bekor qilish" aria-label="Video tanlovini bekor qilish"><X size={15} /></button>
              )}
            </div>
            {uploadPct !== null && (
              <div className="mt-2">
                <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={uploadPct}>
                  <div className="h-full bg-[var(--primary)] transition-all" style={{ width: `${uploadPct}%` }} />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {uploadPct >= 100
                    ? 'Fayl yuborildi — server saqlamoqda, biroz kuting…'
                    : `Yuklanmoqda — ${uploadPct}%. Oynani yopmang.`}
                </p>
              </div>
            )}
            {videoError ? (
              <p role="alert" className="text-xs text-red-600 mt-1">{videoError}</p>
            ) : uploadError ? (
              <p role="alert" className="text-xs text-red-600 mt-1">{uploadError}</p>
            ) : (
              <p className="text-xs text-gray-400 mt-1">
                MP4 va boshqa video formatlar · maksimal 2 GB. Saqlanganda yuklanadi
                {pendingVideo && form.videoUrl ? ' va avvalgi video o\'rnini bosadi' : ''}.
              </p>
            )}
          </div>
          {/* YouTube havola — fayl yuklashga qo'shimcha (o'rnini bosmaydi) */}
          <div>
            <label htmlFor="lesson-youtube" className="block text-sm font-medium text-gray-700 mb-1">YouTube havola (ixtiyoriy)</label>
            <div className="relative">
              <SquarePlay size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500 pointer-events-none" />
              <input
                id="lesson-youtube"
                value={form.youtube}
                disabled={saving}
                onChange={(e) => setForm({ ...form, youtube: e.target.value })}
                placeholder="https://youtu.be/… yoki video ID"
                aria-invalid={youtubeInvalid}
                className={`${inputCls} pl-9 ${youtubeInvalid ? 'border-red-300 focus:border-red-400 focus:ring-red-200' : ''}`}
              />
            </div>
            {youtubeInvalid ? (
              <p className="text-xs text-red-600 mt-1">Havola tushunarsiz — YouTube havolasi yoki 11 belgili video ID kiriting (yoki maydonni bo'sh qoldiring).</p>
            ) : form.youtube.trim() !== '' && (pendingVideo || form.videoUrl) ? (
              <p className="text-xs text-amber-600 mt-1">Video fayl ham, YouTube ham bor — mobil ilova YouTube videoni ko'rsatadi.</p>
            ) : form.youtube.trim() === '' && initialForm.youtube !== '' ? (
              <p className="text-xs text-amber-600 mt-1">Saqlanganda YouTube video darsdan olib tashlanadi.</p>
            ) : (
              <p className="text-xs text-gray-400 mt-1">YouTube'dagi unlisted video havolasi. Kiritilsa, mobil ilova videoni YouTube pleyerda ko'rsatadi.</p>
            )}
          </div>
          <div>
            <p className="block text-sm font-medium text-gray-700 mb-1">Muqova rasmi — oboloshka (ixtiyoriy)</p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center shrink-0">
                {coverPreview
                  ? <img src={coverPreview} alt="" className="w-full h-full object-cover" />
                  : (editItem?.coverImage
                      ? <img src={fileUrl(editItem.coverImage)} alt="" className="w-full h-full object-cover" />
                      : <PlayCircle size={22} className="text-gray-300" />)}
              </div>
              <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-[var(--primary)] ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}`}>
                <ImageIcon size={15} /> Rasm tanlash
                <input type="file" accept="image/*" className="hidden" disabled={saving}
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onCoverSelected(f); }} />
              </label>
              {!pendingCover && editItem?.coverImage && (
                <button type="button" onClick={() => void removeLessonCover()} disabled={saving || coverRemoving}
                  className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline">
                  <Trash2 size={14} /> {coverRemoving ? 'Olib tashlanmoqda…' : 'Olib tashlash'}
                </button>
              )}
              {pendingCover && !saving && (
                <button type="button" onClick={() => setCover(null)} className={`${iconBtnCls} hover:text-red-500`}
                  title="Tanlangan rasmni bekor qilish" aria-label="Tanlangan rasmni bekor qilish"><X size={15} /></button>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">Yuklansa, video oboloshkasi sifatida ko'rsatiladi.</p>
          </div>
          {saveError && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {saveError}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4 flex-wrap">
            {saving && uploadPct !== null ? (
              <Button variant="secondary" onClick={cancelUpload}>Yuklashni to'xtatish</Button>
            ) : (
              <Button variant="secondary" onClick={closeLessonModal} disabled={saving}>Bekor qilish</Button>
            )}
            <Button onClick={handleSave} loading={saving} disabled={!!videoError || durationDetecting || youtubeInvalid}>
              {saving
                ? (uploadPct !== null ? `Yuklanmoqda… ${uploadPct}%` : 'Saqlanmoqda…')
                : (editItem ? 'Saqlash' : 'Yaratish')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Lug'at modal — inline tahrirlash + qo'shish */}
      <Modal open={vocabModal} onClose={() => closeSub(vocabDirty, () => setVocabModal(false))} closeDisabled={!!busy}
        title={`Lug'at — ${currentLesson?.name || ''}`} maxWidth="max-w-2xl">
        {/* Yangi qo'shish (tepada) */}
        <div className="flex items-end gap-2 flex-wrap pb-3 mb-3 border-b border-gray-100">
          <div className="flex-1 min-w-[9rem]">
            <label htmlFor="vocab-uz" className="block text-xs text-gray-500 mb-1">O'zbekcha</label>
            <input id="vocab-uz" ref={vocabUzRef} value={vocabForm.uz} onChange={(e) => setVocabForm({ ...vocabForm, uz: e.target.value })}
              className={inputCls} placeholder="Salom" onKeyDown={(e) => { if (e.key === 'Enter') void addVocab(); }} />
          </div>
          <div className="flex-1 min-w-[9rem]">
            <label htmlFor="vocab-target" className="block text-xs text-gray-500 mb-1">Tarjimasi</label>
            <input id="vocab-target" value={vocabForm.target} onChange={(e) => setVocabForm({ ...vocabForm, target: e.target.value })}
              className={inputCls} placeholder="Hello" onKeyDown={(e) => { if (e.key === 'Enter') void addVocab(); }} />
          </div>
          <Button size="sm" onClick={addVocab} loading={busy === 'vocab-add'}
            disabled={subBlocked || !vocabForm.uz.trim() || !vocabForm.target.trim()}><Plus size={14} /> Qo'shish</Button>
        </div>
        {!subLoading && !subError && vocabList.length > 0 && (
          <p className="text-xs text-gray-500 mb-2">So'zlar: <span className="font-semibold text-gray-700">{vocabList.length}</span></p>
        )}
        <SubList loading={subLoading} error={subError} onRetry={() => { if (currentLesson) void loadVocab(currentLesson.id); }}
          empty={vocabList.length === 0} emptyText="Lug'at bo'sh — yuqoridagi maydonlar orqali birinchi so'zni qo'shing.">
          {vocabList.map((v) => (
            <div key={v.id} className="p-2.5 bg-gray-50 rounded-lg">
              {editVocabId === v.id ? (
                <div className="flex items-end gap-2 flex-wrap">
                  <div className="flex-1 min-w-[8rem]">
                    <label className="block text-[11px] text-gray-500 mb-0.5">
                      O'zbekcha
                      <input value={vEdit.uz} onChange={(e) => setVEdit({ ...vEdit, uz: e.target.value })} className={inputCls}
                        onKeyDown={(e) => { if (e.key === 'Enter') void saveVocabEdit(); }} />
                    </label>
                  </div>
                  <div className="flex-1 min-w-[8rem]">
                    <label className="block text-[11px] text-gray-500 mb-0.5">
                      Tarjimasi
                      <input value={vEdit.target} onChange={(e) => setVEdit({ ...vEdit, target: e.target.value })} className={inputCls}
                        onKeyDown={(e) => { if (e.key === 'Enter') void saveVocabEdit(); }} />
                    </label>
                  </div>
                  <button type="button" onClick={saveVocabEdit} disabled={!!busy} className="p-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-40" title="Saqlash" aria-label="Saqlash"><Check size={15} /></button>
                  <button type="button" onClick={() => setEditVocabId(null)} disabled={!!busy} className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-40" title="Bekor qilish" aria-label="Bekor qilish"><X size={15} /></button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 break-words">
                    <span className="font-medium text-sm">{v.translationUz}</span>
                    <span className="mx-2 text-gray-300">&rarr;</span>
                    <span className="text-sm text-gray-600">{v.translationTarget}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => startVocabEdit(v)} disabled={!!busy}
                      className={`${iconBtnCls} hover:text-[var(--primary)]`} title="Tahrirlash" aria-label="Tahrirlash"><Pencil size={14} /></button>
                    <button type="button" onClick={() => deleteVocab(v)} disabled={!!busy}
                      className={`${iconBtnCls} hover:text-red-500`} title="O'chirish" aria-label="O'chirish"><Trash2 size={14} /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </SubList>
      </Modal>

      {/* Test (savollar) modal — inline tahrirlash + qo'shish */}
      <Modal open={questionsModal} onClose={() => closeSub(questionsDirty, () => setQuestionsModal(false))} closeDisabled={!!busy}
        title={`Test — ${currentLesson?.name || ''}`} maxWidth="max-w-2xl">
        {/* Yangi qo'shish */}
        <div className="space-y-2 pb-3 mb-3 border-b border-gray-100">
          <QuestionFormFields form={qForm} onChange={setQForm} onEnter={addQuestion} />
          <Button size="sm" onClick={addQuestion} loading={busy === 'q-add'} disabled={subBlocked || !!qProblem(qForm)}><Plus size={14} /> Qo'shish</Button>
        </div>
        {!subLoading && !subError && questionsList.length > 0 && (
          <p className="text-xs text-gray-500 mb-2">Savollar: <span className="font-semibold text-gray-700">{questionsList.length}</span></p>
        )}
        <SubList loading={subLoading} error={subError} onRetry={() => { if (currentLesson) void loadQuestions(currentLesson.id); }}
          empty={questionsList.length === 0} emptyText="Savollar yo'q — yuqorida birinchi savolni qo'shing.">
          {questionsList.map((q) => (
            <div key={q.id} className="p-3 bg-gray-50 rounded-lg">
              {editQId === q.id ? (
                <div className="space-y-2">
                  <QuestionFormFields form={qEdit} onChange={setQEdit} onEnter={saveQuestionEdit} />
                  <div className="flex gap-2">
                    <button type="button" onClick={saveQuestionEdit} disabled={!!busy || !!qProblem(qEdit)} className="p-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-40" title="Saqlash" aria-label="Saqlash"><Check size={15} /></button>
                    <button type="button" onClick={() => setEditQId(null)} disabled={!!busy} className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-40" title="Bekor qilish" aria-label="Bekor qilish"><X size={15} /></button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between gap-2">
                    <p className="text-sm font-medium min-w-0 break-words">{q.questionText}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={() => startQuestionEdit(q)} disabled={!!busy}
                        className={`${iconBtnCls} hover:text-[var(--primary)]`} title="Tahrirlash" aria-label="Tahrirlash"><Pencil size={14} /></button>
                      <button type="button" onClick={() => deleteQuestion(q)} disabled={!!busy}
                        className={`${iconBtnCls} hover:text-red-500`} title="O'chirish" aria-label="O'chirish"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
                    <span className={q.correctOption === 'A' ? 'text-green-600 font-bold' : ''}>A: {q.optionA}</span>
                    <span className={q.correctOption === 'B' ? 'text-green-600 font-bold' : ''}>B: {q.optionB}</span>
                    <span className={q.correctOption === 'C' ? 'text-green-600 font-bold' : ''}>C: {q.optionC}</span>
                    {q.optionD && <span className={q.correctOption === 'D' ? 'text-green-600 font-bold' : ''}>D: {q.optionD}</span>}
                  </div>
                  {/* To'g'ri javob mavjud variantga to'g'ri kelmasa — o'quvchi hech qachon to'g'ri javob bera olmaydi */}
                  {(!['A', 'B', 'C', 'D'].includes(q.correctOption) || (q.correctOption === 'D' && !q.optionD)) && (
                    <p className="text-[11px] text-red-600 mt-1">To'g'ri javob belgilanmagan yoki bo'sh variantga qo'yilgan — tahrirlab tuzating.</p>
                  )}
                </>
              )}
            </div>
          ))}
        </SubList>
      </Modal>

      {/* Mashqlar modal — inline tahrirlash + qo'shish */}
      <Modal open={exercisesModal} onClose={() => closeSub(exercisesDirty, () => setExercisesModal(false))} closeDisabled={!!busy}
        title={`Mashq — ${currentLesson?.name || ''}`} maxWidth="max-w-2xl">
        {/* Yangi mashq — gap (ko'p '_' bo'lishi mumkin) + har bo'shliqqa to'g'ri so'z + chalg'ituvchilar */}
        <div className="space-y-2 pb-3 mb-3 border-b border-gray-100">
          <ExerciseFormFields form={exForm} onChange={setExForm} setSentence={setExSentence} onEnter={addExercise} />
          <Button size="sm" onClick={addExercise} loading={busy === 'ex-add'} disabled={subBlocked || !!exProblem(exForm)}><Plus size={14} /> Qo'shish</Button>
        </div>
        {/* Ro'yxat sarlavhasi + o'quvchi ko'rinishida sinab ko'rish */}
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <p className="text-xs text-gray-500">
            Mashqlar: <span className="font-semibold text-gray-700">{exercisesList.length}</span>
            <span className="hidden sm:inline"> — mobil ilovada birma-bir chiqadi (har mashq alohida qadam)</span>
          </p>
          <Button size="sm" variant="secondary" onClick={() => openPlay(exercisesList)} disabled={exercisesList.length === 0}
            title="Mobil ilovadagi o'yin bilan bir xil — natija saqlanmaydi">
            <Smartphone size={14} /> O'quvchi sifatida sinab ko'rish
          </Button>
        </div>
        <SubList loading={subLoading} error={subError} onRetry={() => { if (currentLesson) void loadExercises(currentLesson.id); }}
          empty={exercisesList.length === 0} emptyText="Mashqlar yo'q — yuqorida birinchi mashqni qo'shing.">
          {exercisesList.map((ex) => (
            <div key={ex.id} className="p-3 bg-gray-50 rounded-lg">
              {editExId === ex.id ? (
                <div className="space-y-2">
                  <ExerciseFormFields form={exEdit} onChange={setExEdit} setSentence={setExSentence} onEnter={saveExerciseEdit} />
                  <div className="flex gap-2">
                    <button type="button" onClick={saveExerciseEdit} disabled={!!busy || !!exProblem(exEdit)} className="p-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-40" title="Saqlash" aria-label="Saqlash"><Check size={15} /></button>
                    <button type="button" onClick={() => setEditExId(null)} disabled={!!busy} className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-40" title="Bekor qilish" aria-label="Bekor qilish"><X size={15} /></button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between gap-2">
                    <ExerciseSentencePreview ex={ex} />
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={() => openPlay([ex])} disabled={!!busy}
                        className={`${iconBtnCls} hover:text-[var(--primary)]`} title="Shu mashqni o'quvchi sifatida sinab ko'rish" aria-label="Shu mashqni o'quvchi sifatida sinab ko'rish"><Smartphone size={14} /></button>
                      <button type="button" onClick={() => startExerciseEdit(ex)} disabled={!!busy}
                        className={`${iconBtnCls} hover:text-[var(--primary)]`} title="Tahrirlash" aria-label="Tahrirlash"><Pencil size={14} /></button>
                      <button type="button" onClick={() => deleteExercise(ex)} disabled={!!busy}
                        className={`${iconBtnCls} hover:text-red-500`} title="O'chirish" aria-label="O'chirish"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  {/* Chalg'ituvchi so'zlar */}
                  {(ex.options || '').trim() !== '' && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className="text-[11px] text-gray-400 mr-1">Chalg'ituvchilar:</span>
                      {/* Backend chalg'ituvchilarni takrorsiz qaytaradi — so'zning o'zi kalit */}
                      {ex.options.split(',').map((s) => s.trim()).filter(Boolean).map((o) => (
                        <span key={o.toLowerCase()} className="px-2.5 py-1 rounded-lg text-xs border bg-white border-gray-200 text-gray-600">{o}</span>
                      ))}
                    </div>
                  )}
                  {/* Bo'shliq/javob mos kelmasa mobil ilovada mashq noto'g'ri chiqadi yoki o'tkazib yuboriladi */}
                  {(ex.blanks ?? []).length !== countBlanks(ex.sentence)
                    // Eski ko'rinish ('_' yo'q, bitta javob — bo'shliq gap oxirida) yaroqli
                    && !(countBlanks(ex.sentence) === 0 && (ex.blanks ?? []).length === 1) && (
                    <p className="text-[11px] text-red-600 mt-1">Gapdagi bo'shliqlar soni javoblar soniga mos emas — tahrirlab tuzating.</p>
                  )}
                </>
              )}
            </div>
          ))}
        </SubList>
      </Modal>

      {/* Mashq — o'quvchi ko'rinishi: mobil ilovadagi o'yin bilan bir xil (sinov, natija saqlanmaydi) */}
      <Modal open={playModal} onClose={() => setPlayModal(false)} title={playExercises.length === 1
          ? `O'quvchi ko'rinishi — ${playExercises[0].orderIndex}-mashq`
          : `O'quvchi ko'rinishi — ${currentLesson?.name || ''}`} maxWidth="max-w-lg">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <p className="text-xs text-gray-500">
            {playExercises.length === 1
              ? "Faqat shu mashq — mobil ilovadagi bitta qadam. Sinov — natija saqlanmaydi."
              : "Mobil ilovadagi o'yin bilan bir xil: mashqlar birma-bir. Sinov — natija saqlanmaydi."}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPlayZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600" title="Kichraytirish" aria-label="Kichraytirish">
              <ZoomOut size={16} />
            </button>
            <span className="text-sm text-gray-600 w-12 text-center">{Math.round(playZoom * 100)}%</span>
            <button type="button" onClick={() => setPlayZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(2)))}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600" title="Kattalashtirish" aria-label="Kattalashtirish">
              <ZoomIn size={16} />
            </button>
          </div>
        </div>
        {/* iPhone 12 Pro (390 × 844) — zoom butun qurilmani kattalashtiradi */}
        <div className="overflow-auto" style={{ maxHeight: '64vh' }}>
          <div style={{ height: 844 * playZoom }} className="flex justify-center">
            <div style={{ transform: `scale(${playZoom})`, transformOrigin: 'top center' }}>
              <PhoneFrame>
                <ExercisePlayPreview exercises={playExercises} onExit={() => setPlayModal(false)} />
              </PhoneFrame>
            </div>
          </div>
        </div>
      </Modal>

      {/* Audio kitob modal */}
      <Modal open={audioModal} onClose={() => closeSub(audioDirty, () => setAudioModal(false))} closeDisabled={audioUploading || !!busy}
        title={`Audio kitob — ${currentLesson?.name || ''}`} maxWidth="max-w-2xl">
        {/* Yangi audio kitob — nom + tavsif + audio (majburiy) + PDF (ixtiyoriy) */}
        <div className="space-y-2 pb-3 mb-3 border-b border-gray-100">
          <input value={audioTitle} onChange={(e) => setAudioTitle(e.target.value)} disabled={audioUploading} className={inputCls}
            aria-label="Nomi" placeholder="Nomi (bo'sh qolsa — fayl nomi)" />
          <textarea value={audioDesc} onChange={(e) => setAudioDesc(e.target.value)} disabled={audioUploading} rows={2} className={inputCls}
            aria-label="Tavsif" placeholder="Tavsif (ixtiyoriy)" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-[var(--primary)] ${audioUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}`}>
              <Upload size={15} /> Audio (majburiy)
              <input type="file" accept="audio/*" className="hidden" disabled={audioUploading}
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onAudioSelected(f); }} />
            </label>
            <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-[var(--primary)] ${audioUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}`}>
              <BookOpen size={15} /> PDF (ixtiyoriy)
              <input type="file" accept="application/pdf,.pdf" className="hidden" disabled={audioUploading}
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onPdfSelected(f); }} />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 truncate flex-1 min-w-0">
              {pendingAudio ? `🎵 ${pendingAudio.name} · ${fmtBytes(pendingAudio.size)}` : 'Audio tanlanmagan'}{pendingPdf ? ` · 📄 ${pendingPdf.name}` : ''}
            </span>
            {pendingPdf && !audioUploading && (
              <button type="button" onClick={() => setPendingPdf(null)} className="text-xs text-gray-500 hover:text-red-500 shrink-0">PDF'ni olib tashlash</button>
            )}
            <Button size="sm" onClick={addAudiobook} loading={audioUploading} disabled={!pendingAudio || subBlocked}>
              {audioUploading
                ? (audioPct !== null && audioPct < 100 ? `Yuklanmoqda… ${audioPct}%` : 'Saqlanmoqda…')
                : <><Plus size={14} /> Qo'shish</>}
            </Button>
          </div>
        </div>
        <SubList loading={subLoading} error={subError} onRetry={() => { if (currentLesson) void loadAudiobooks(currentLesson.id); }}
          empty={audioList.length === 0} emptyText="Audio kitob biriktirilmagan — yuqorida audio fayl tanlab qo'shing.">
          {audioList.map((a) => (
            <div key={a.id} className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm flex items-center gap-2 min-w-0">
                  <Headphones size={15} className="text-orange-600 shrink-0" />
                  <span className="truncate" title={a.title || 'Audio'}>{a.title || 'Audio'}</span>
                  {a.pdfPath && <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-50 text-red-600 text-[10px] font-medium"><BookOpen size={10} /> PDF</span>}
                </span>
                <button type="button" onClick={() => deleteAudiobook(a)} disabled={!!busy || audioUploading}
                  className={`${iconBtnCls} hover:text-red-500 shrink-0`} title="O'chirish" aria-label="O'chirish"><Trash2 size={14} /></button>
              </div>
              {a.description && <p className="text-xs text-gray-500 mt-1 break-words">{a.description}</p>}
              {a.filePath && <audio controls preload="none" src={fileUrl(a.filePath)} className="w-full mt-2 h-9" />}
              {a.pdfPath && (
                <a href={fileUrl(a.pdfPath)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-2 text-xs text-[var(--primary)] hover:underline">
                  <BookOpen size={12} /> PDF'ni ochish
                </a>
              )}
            </div>
          ))}
        </SubList>
      </Modal>
    </div>
  );
}

// ── Sudraladigan dars kartasi (@dnd-kit) ─────────────────────────────────────
function SortableLessonCard({
  lesson, cover, dur, dragEnabled, menuOpen, onToggleMenu, onOpenDetail, onEdit, onDelete,
}: {
  lesson: Lesson;
  cover: string;
  dur: string | null;
  dragEnabled: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onOpenDetail: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lesson.id, disabled: !dragEnabled });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Menyu ochilganda yoki sudralganda kartani yuqoriga ko'taramiz (menyu kesilmasin)
    zIndex: isDragging ? 30 : menuOpen ? 20 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={
        'relative bg-white rounded-xl border min-w-0 ' +
        (isDragging ? 'border-[var(--primary)]/40 shadow-lg' : 'border-gray-100 hover:shadow-md transition-shadow')
      }
    >
      {/* Thumbnail (16:9) — bosilganda video play (detail). Faqat rasm kesiladi. */}
      <div
        role="button"
        tabIndex={0}
        onClick={onOpenDetail}
        onKeyDown={(e) => {
          // Faqat kartaning o'zida (ichidagi dastak tugmasida emas) Enter/Space — ochish
          if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpenDetail(); }
        }}
        aria-label={`${lesson.name} — ko'rish`}
        className="relative aspect-video bg-gray-100 cursor-pointer group rounded-t-xl overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40"
        title="Ko'rish — video va modullar"
      >
        {cover ? (
          <img src={cover} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[var(--primary)]/15 to-gray-100">
            <PlayCircle size={36} className="text-[var(--primary)]/60" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
          <PlayCircle size={40} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
        </div>
        {/* Sudrash dastagi */}
        {dragEnabled && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            className="absolute top-2 left-2 p-1 rounded-md bg-black/55 text-white/90 hover:bg-black/75 cursor-grab active:cursor-grabbing touch-none"
            title="Sudrab tartiblang"
            aria-label="Tartiblash"
          >
            <GripVertical size={15} />
          </button>
        )}
        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/65 text-white text-xs font-semibold">#{lesson.orderIndex}</span>
        {dur && (
          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white text-[11px] font-medium flex items-center gap-1">
            <Clock size={11} /> {dur}
          </span>
        )}
      </div>

      {/* Pastki qism: nom + kebab (Tahrirlash / O'chirish) */}
      <div className="p-2.5 flex items-start gap-1.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="font-semibold text-gray-900 text-sm leading-snug line-clamp-1 min-w-0" title={lesson.name}>{lesson.name}</p>
            {lesson.youtubeId && (
              <span
                title="YouTube video biriktirilgan"
                className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-50 text-red-600 text-[10px] font-medium"
              >
                <SquarePlay size={10} /> <span className="hidden sm:inline">YouTube</span>
              </span>
            )}
          </div>
          {lesson.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1" title={lesson.description}>{lesson.description}</p>}
        </div>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleMenu(); }}
            aria-label="Amallar"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <MoreVertical size={18} />
          </button>
          {menuOpen && (
            <div role="menu" onClick={(e) => e.stopPropagation()} className="absolute right-0 top-9 z-20 w-40 bg-white rounded-xl shadow-lg border border-gray-100 py-1">
              <button type="button" role="menuitem" onClick={onEdit} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                <Pencil size={15} /> Tahrirlash
              </button>
              <button type="button" role="menuitem" onClick={onDelete} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                <Trash2 size={15} /> O'chirish
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
