import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, BookOpen, FileQuestion, Dumbbell, MoreVertical, Search, Clock, PlayCircle, Upload, Image as ImageIcon, Headphones, GripVertical, Check, X, ArrowLeft } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import api, { fileUrl } from '../../lib/api';
import type { Course, Language, Lesson, Vocabulary, Question, Exercise, Audiobook } from '../../lib/types';

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]';


export default function LessonsPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [menuId, setMenuId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Lesson | null>(null);
  const [form, setForm] = useState({ name: '', description: '', orderIndex: 1, durationSec: 300, videoUrl: '' });
  // Video + cover fayl yuklash
  const [pendingVideo, setPendingVideo] = useState<File | null>(null);
  const [pendingCover, setPendingCover] = useState<File | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);

  const [vocabModal, setVocabModal] = useState(false);
  const [questionsModal, setQuestionsModal] = useState(false);
  const [exercisesModal, setExercisesModal] = useState(false);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [vocabList, setVocabList] = useState<Vocabulary[]>([]);
  const [questionsList, setQuestionsList] = useState<Question[]>([]);
  const [exercisesList, setExercisesList] = useState<Exercise[]>([]);

  // Audio kitob (audio + ixtiyoriy PDF + nom + tavsif)
  const [audioModal, setAudioModal] = useState(false);
  const [audioList, setAudioList] = useState<Audiobook[]>([]);
  const [audioTitle, setAudioTitle] = useState('');
  const [audioDesc, setAudioDesc] = useState('');
  const [pendingAudio, setPendingAudio] = useState<File | null>(null);
  const [pendingPdf, setPendingPdf] = useState<File | null>(null);
  const [audioUploading, setAudioUploading] = useState(false);

  // Dars tafsiloti (video play + modul tugmalari)
  const [detailLesson, setDetailLesson] = useState<Lesson | null>(null);

  // Inline qo'shish formalari
  const [vocabForm, setVocabForm] = useState({ uz: '', target: '' });
  const [qForm, setQForm] = useState({ text: '', a: '', b: '', c: '', d: '', correct: 'A' });
  // Mashq: gap (_ = bo'sh joy) + 3 ta variant + to'g'risining indeksi
  const [exForm, setExForm] = useState({ sentence: '', opts: ['', '', ''], correctIdx: 0 });

  // Inline tahrirlash holatlari
  const [editVocabId, setEditVocabId] = useState<number | null>(null);
  const [vEdit, setVEdit] = useState({ uz: '', target: '' });
  const [editQId, setEditQId] = useState<number | null>(null);
  const [qEdit, setQEdit] = useState({ text: '', a: '', b: '', c: '', d: '', correct: 'A' });
  const [editExId, setEditExId] = useState<number | null>(null);
  const [exEdit, setExEdit] = useState({ sentence: '', opts: ['', '', ''], correctIdx: 0 });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const [searchParams] = useSearchParams();
  const requestedCourseId = Number(searchParams.get('courseId')) || 0;

  const fetchLessons = async (): Promise<Lesson[]> => {
    if (!selectedCourse) return [];
    try {
      const res = await api.get(`/admin/courses/${selectedCourse}/lessons`);
      const list: Lesson[] = res.data.data ?? res.data ?? [];
      setLessons(list);
      return list;
    } catch {
      setLessons([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Kebab menyuni tashqariga bosganda yopish
  useEffect(() => {
    const h = () => setMenuId(null);
    window.addEventListener('click', h);
    return () => window.removeEventListener('click', h);
  }, []);

  useEffect(() => {
    let active = true;
    api.get('/admin/languages')
      .then((res) => {
        if (active) setLanguages(res.data.data ?? res.data ?? []);
      })
      .catch(() => {});
    api.get('/admin/courses')
      .then((res) => {
        if (!active) return;
        const data: Course[] = res.data.data ?? res.data ?? [];
        setCourses(data);
        if (requestedCourseId && data.some((course) => course.id === requestedCourseId)) {
          setSelectedCourse(requestedCourseId);
        } else if (data.length > 0) {
          setSelectedCourse(data[0].id);
        } else {
          setSelectedCourse(0);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!active) return;
        setCourses([]);
        setSelectedCourse(0);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [requestedCourseId]);

  useEffect(() => {
    if (!selectedCourse) return;
    let active = true;
    api.get(`/admin/courses/${selectedCourse}/lessons`)
      .then((res) => {
        if (!active) return;
        const list: Lesson[] = res.data.data ?? res.data ?? [];
        setLessons(list);
      })
      .catch(() => {
        if (active) setLessons([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedCourse]);

  const openCreate = () => {
    setEditItem(null);
    setPendingVideo(null);
    setPendingCover(null);
    setForm({ name: '', description: '', orderIndex: lessons.length + 1, durationSec: 300, videoUrl: '' });
    setModalOpen(true);
  };

  const openEdit = (item: Lesson) => {
    setEditItem(item);
    setPendingVideo(null);
    setPendingCover(null);
    setForm({ name: item.name, description: item.description || '', orderIndex: item.orderIndex, durationSec: item.durationSec || 300, videoUrl: item.videoUrl || '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const payload = { ...form, courseId: selectedCourse };
    setVideoUploading(!!pendingVideo || !!pendingCover);
    try {
      let lessonId = editItem?.id;
      if (editItem) {
        await api.put(`/admin/lessons/${editItem.id}`, payload);
      } else {
        const res = await api.post('/admin/lessons', payload);
        const created: Lesson = res.data.data ?? res.data;
        lessonId = created?.id;
      }
      if (pendingVideo && lessonId) {
        const fd = new FormData();
        fd.append('file', pendingVideo);
        await api.post(`/admin/lessons/${lessonId}/upload-video`, fd).catch(() => {});
      }
      if (pendingCover && lessonId) {
        const fd = new FormData();
        fd.append('file', pendingCover);
        await api.post(`/admin/lessons/${lessonId}/upload-cover`, fd).catch(() => {});
      }
      setPendingVideo(null);
      setPendingCover(null);
      setModalOpen(false);
      const list = await fetchLessons();
      // Watch ko'rinishi ochiq bo'lsa — yangilangan dars bilan yangilaymiz
      if (detailLesson && lessonId) {
        const fresh = list.find((l) => l.id === lessonId);
        if (fresh) setDetailLesson(fresh);
      }
    } catch { /* silent */ }
    finally { setVideoUploading(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("O'chirishni tasdiqlaysizmi?")) return;
    await api.delete(`/admin/lessons/${id}`).catch(() => {});
    fetchLessons();
  };

  // ── Darslar tartibi (drag-and-drop) ──────────────────────
  const persistLessonOrder = (ordered: Lesson[]) => {
    const pos = new Map(ordered.map((l, i) => [l.id, i + 1]));
    setLessons((prev) =>
      prev
        .map((l) => (pos.has(l.id) ? { ...l, orderIndex: pos.get(l.id)! } : l))
        .sort((a, b) => a.orderIndex - b.orderIndex)
    );
    ordered.forEach((l, i) => {
      if (l.orderIndex !== i + 1) api.put(`/admin/lessons/${l.id}`, { ...l, orderIndex: i + 1 }).catch(() => {});
    });
  };

  const onLessonDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const list = visibleLessons;
    const from = list.findIndex((l) => l.id === active.id);
    const to = list.findIndex((l) => l.id === over.id);
    if (from < 0 || to < 0) return;
    persistLessonOrder(arrayMove(list, from, to));
  };

  // ── Lug'at ────────────────────────────────────────────────
  const openVocab = async (lesson: Lesson) => {
    setCurrentLesson(lesson);
    setVocabForm({ uz: '', target: '' });
    setEditVocabId(null);
    try {
      const res = await api.get(`/admin/lessons/${lesson.id}/vocabulary`);
      setVocabList(res.data.data ?? res.data ?? []);
    } catch { setVocabList([]); }
    setVocabModal(true);
  };

  const addVocab = async () => {
    if (!currentLesson || !vocabForm.uz || !vocabForm.target) return;
    await api.post(`/admin/lessons/${currentLesson.id}/vocabulary`, {
      translationUz: vocabForm.uz, translationTarget: vocabForm.target, orderIndex: vocabList.length + 1,
    }).catch(() => {});
    setVocabForm({ uz: '', target: '' });
    openVocab(currentLesson);
  };

  const saveVocabEdit = async () => {
    if (editVocabId == null) return;
    await api.put(`/admin/vocabulary/${editVocabId}`, {
      translationUz: vEdit.uz, translationTarget: vEdit.target,
    }).catch(() => {});
    setEditVocabId(null);
    if (currentLesson) openVocab(currentLesson);
  };

  const deleteVocab = async (id: number) => {
    await api.delete(`/admin/vocabulary/${id}`).catch(() => {});
    if (currentLesson) openVocab(currentLesson);
  };

  // ── Savollar (Test) ──────────────────────────────────────
  const openQuestions = async (lesson: Lesson) => {
    setCurrentLesson(lesson);
    setQForm({ text: '', a: '', b: '', c: '', d: '', correct: 'A' });
    setEditQId(null);
    try {
      const res = await api.get(`/admin/lessons/${lesson.id}/questions`);
      setQuestionsList(res.data.data ?? res.data ?? []);
    } catch { setQuestionsList([]); }
    setQuestionsModal(true);
  };

  const addQuestion = async () => {
    if (!currentLesson || !qForm.text || !qForm.a || !qForm.b || !qForm.c) return;
    await api.post(`/admin/lessons/${currentLesson.id}/questions`, {
      questionText: qForm.text, optionA: qForm.a, optionB: qForm.b,
      optionC: qForm.c, optionD: qForm.d, correctOption: qForm.correct,
      orderIndex: questionsList.length + 1,
    }).catch(() => {});
    setQForm({ text: '', a: '', b: '', c: '', d: '', correct: 'A' });
    openQuestions(currentLesson);
  };

  const saveQuestionEdit = async () => {
    if (editQId == null) return;
    await api.put(`/admin/questions/${editQId}`, {
      questionText: qEdit.text, optionA: qEdit.a, optionB: qEdit.b,
      optionC: qEdit.c, optionD: qEdit.d, correctOption: qEdit.correct,
    }).catch(() => {});
    setEditQId(null);
    if (currentLesson) openQuestions(currentLesson);
  };

  const deleteQuestion = async (id: number) => {
    await api.delete(`/admin/questions/${id}`).catch(() => {});
    if (currentLesson) openQuestions(currentLesson);
  };

  // ── Mashqlar ─────────────────────────────────────────────
  const openExercises = async (lesson: Lesson) => {
    setCurrentLesson(lesson);
    setExForm({ sentence: '', opts: ['', '', ''], correctIdx: 0 });
    setEditExId(null);
    try {
      const res = await api.get(`/admin/lessons/${lesson.id}/exercises`);
      setExercisesList(res.data.data ?? res.data ?? []);
    } catch { setExercisesList([]); }
    setExercisesModal(true);
  };

  // 3 ta variantdan to'g'risini ajratib, {options, correctAnswer} quradi
  const exPayload = (sentence: string, opts: string[], correctIdx: number) => {
    const clean = opts.map((s) => s.trim());
    return {
      sentence: sentence.trim(),
      options: clean.filter(Boolean).join(','),
      correctAnswer: clean[correctIdx] || '',
    };
  };
  const exValid = (sentence: string, opts: string[], correctIdx: number) =>
    sentence.trim() !== '' && opts.filter((s) => s.trim()).length >= 2 && (opts[correctIdx] || '').trim() !== '';

  const addExercise = async () => {
    if (!currentLesson || !exValid(exForm.sentence, exForm.opts, exForm.correctIdx)) return;
    await api.post(`/admin/lessons/${currentLesson.id}/exercises`, {
      ...exPayload(exForm.sentence, exForm.opts, exForm.correctIdx),
      name: 'Fill', orderIndex: exercisesList.length + 1,
    }).catch(() => {});
    setExForm({ sentence: '', opts: ['', '', ''], correctIdx: 0 });
    openExercises(currentLesson);
  };

  const saveExerciseEdit = async () => {
    if (editExId == null || !exValid(exEdit.sentence, exEdit.opts, exEdit.correctIdx)) return;
    await api.put(`/admin/exercises/${editExId}`, exPayload(exEdit.sentence, exEdit.opts, exEdit.correctIdx)).catch(() => {});
    setEditExId(null);
    if (currentLesson) openExercises(currentLesson);
  };

  const deleteExercise = async (id: number) => {
    await api.delete(`/admin/exercises/${id}`).catch(() => {});
    if (currentLesson) openExercises(currentLesson);
  };

  // ── Audio kitob ──────────────────────────────────────────
  const openAudiobooks = async (lesson: Lesson) => {
    setCurrentLesson(lesson);
    setAudioTitle('');
    setAudioDesc('');
    setPendingAudio(null);
    setPendingPdf(null);
    try {
      const res = await api.get(`/admin/lessons/${lesson.id}/audiobooks`);
      setAudioList(res.data.data ?? res.data ?? []);
    } catch { setAudioList([]); }
    setAudioModal(true);
  };

  const addAudiobook = async () => {
    if (!currentLesson || !pendingAudio) return;
    setAudioUploading(true);
    const fd = new FormData();
    fd.append('file', pendingAudio);
    if (pendingPdf) fd.append('pdf', pendingPdf);
    if (audioTitle.trim()) fd.append('title', audioTitle.trim());
    if (audioDesc.trim()) fd.append('description', audioDesc.trim());
    await api.post(`/admin/lessons/${currentLesson.id}/audiobooks`, fd).catch(() => {});
    setAudioUploading(false);
    setAudioTitle('');
    setAudioDesc('');
    setPendingAudio(null);
    setPendingPdf(null);
    openAudiobooks(currentLesson);
  };

  const deleteAudiobook = async (id: number) => {
    await api.delete(`/admin/audiobooks/${id}`).catch(() => {});
    if (currentLesson) openAudiobooks(currentLesson);
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

  const visibleLessons = lessons.filter((l) => l.name.toLowerCase().includes(search.toLowerCase()));
  const dragEnabled = search.trim() === '';
  const fmtDur = (s?: number) => {
    if (!s) return null;
    const m = Math.floor(s / 60), sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Tanlangan video fayldan davomiylikni avtomatik aniqlab formaga yozadi
  const detectVideoDuration = (file: File) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      if (Number.isFinite(video.duration) && video.duration > 0) {
        setForm((f) => ({ ...f, durationSec: Math.round(video.duration) }));
      }
    };
    video.onerror = () => URL.revokeObjectURL(url);
    video.src = url;
  };

  return (
    <div>
      {detailLesson ? (
        /* ===== Watch ko'rinishi — butun sahifaga yoyiladi (faqat yon menyu qoladi) ===== */
        <div>
          <button
            onClick={() => setDetailLesson(null)}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-[var(--primary)] mb-4"
          >
            <ArrowLeft size={18} /> Orqaga
          </button>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Asosiy: video + ma'lumot + modullar */}
            <div className="lg:col-span-2 space-y-4">
              {detailLesson.videoUrl ? (
                <video key={detailLesson.id} controls autoPlay className="w-full rounded-xl bg-black aspect-video"
                  src={fileUrl(detailLesson.videoUrl)} poster={fileUrl(detailLesson.coverImage)} />
              ) : (
                <div className="w-full aspect-video rounded-xl bg-gray-100 flex flex-col items-center justify-center text-gray-400">
                  <PlayCircle size={40} className="mb-2" />
                  <span className="text-sm">Video yuklanmagan</span>
                </div>
              )}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-gray-900">{detailLesson.name}</h2>
                  <p className="text-xs text-gray-400">#{detailLesson.orderIndex}-dars{detailLesson.durationSec ? ` · ${fmtDur(detailLesson.durationSec)}` : ''}</p>
                </div>
                <button onClick={() => openEdit(detailLesson)}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                  <Pencil size={14} /> Tahrirlash
                </button>
              </div>
              {detailLesson.description && (
                <p className="text-sm text-gray-600 leading-relaxed">{detailLesson.description}</p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <button onClick={() => openVocab(detailLesson)} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-colors">
                  <BookOpen size={20} className="text-green-600" />
                  <span className="text-xs font-medium text-gray-700">Lug'at</span>
                </button>
                <button onClick={() => openQuestions(detailLesson)} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors">
                  <FileQuestion size={20} className="text-blue-600" />
                  <span className="text-xs font-medium text-gray-700">Test</span>
                </button>
                <button onClick={() => openExercises(detailLesson)} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-colors">
                  <Dumbbell size={20} className="text-purple-600" />
                  <span className="text-xs font-medium text-gray-700">Mashq</span>
                </button>
                <button onClick={() => openAudiobooks(detailLesson)} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-200 hover:border-orange-300 hover:bg-orange-50 transition-colors">
                  <Headphones size={20} className="text-orange-600" />
                  <span className="text-xs font-medium text-gray-700">Audio kitob</span>
                </button>
              </div>
            </div>

            {/* Yon lenta: kursdagi qolgan darslar */}
            <div className="lg:col-span-1">
              <h3 className="text-sm font-semibold text-gray-700 mb-2 px-1">Kurs darslari</h3>
              <div className="space-y-2 lg:max-h-[calc(100vh-200px)] lg:overflow-y-auto pr-1">
                {lessons.map((l) => {
                  const active = l.id === detailLesson.id;
                  const c = fileUrl(l.coverImage);
                  const d = fmtDur(l.durationSec);
                  return (
                    <button
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
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Darslar</h1>
          <p className="text-sm text-gray-500 mt-1">Kartani bosib ko'ring · dastakdan sudrab tartiblang</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedCourse}
            onChange={(e) => {
              setLoading(true);
              setSelectedCourse(Number(e.target.value));
            }}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
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
          <Button onClick={openCreate}><Plus size={16} /> Yangi dars</Button>
        </div>
      </div>

      {/* Qidiruv */}
      <div className="relative mb-5 max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Dars nomi bo'yicha qidirish"
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
        />
      </div>

      {/* Darslar — YouTube uslubidagi 3 ustunli kichik kartalar (sudrab tartiblanadi) */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Yuklanmoqda...</div>
      ) : visibleLessons.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {search ? 'Hech narsa topilmadi' : 'Bu kursda darslar yo\'q'}
        </div>
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
                  onDelete={() => { setMenuId(null); handleDelete(l.id); }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      </>
      )}

      {/* Lesson create/edit — rasm, video, nom, tavsif */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? "Darsni tahrirlash" : "Yangi dars"}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nomi</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tavsif</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tartib raqami</label>
              <input type="number" value={form.orderIndex} onChange={(e) => setForm({ ...form, orderIndex: Number(e.target.value) })} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Davomiyligi (sek)</label>
              <input type="number" value={form.durationSec} onChange={(e) => setForm({ ...form, durationSec: Number(e.target.value) })} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Video (fayl)</label>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-[var(--primary)] cursor-pointer hover:bg-gray-50">
                <Upload size={15} /> Video tanlash
                <input type="file" accept="video/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPendingVideo(f); detectVideoDuration(f); } }} />
              </label>
              <span className="text-xs text-gray-500 truncate flex-1">
                {pendingVideo ? pendingVideo.name : (form.videoUrl ? 'Video yuklangan ✓' : 'Tanlanmagan')}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">MP4 va boshqa video formatlar. Saqlanganda yuklanadi.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Muqova rasmi — oboloshka (ixtiyoriy)</label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center shrink-0">
                {pendingCover
                  ? <img src={URL.createObjectURL(pendingCover)} alt="" className="w-full h-full object-cover" />
                  : (editItem?.coverImage
                      ? <img src={fileUrl(editItem.coverImage)} alt="" className="w-full h-full object-cover" />
                      : <PlayCircle size={22} className="text-gray-300" />)}
              </div>
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-[var(--primary)] cursor-pointer hover:bg-gray-50">
                <ImageIcon size={15} /> Rasm tanlash
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) setPendingCover(f); }} />
              </label>
            </div>
            <p className="text-xs text-gray-400 mt-1">Yuklansa, video oboloshkasi sifatida ko'rsatiladi.</p>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Bekor qilish</Button>
            <Button onClick={handleSave} disabled={videoUploading}>
              {videoUploading ? 'Yuklanmoqda…' : (editItem ? 'Saqlash' : 'Yaratish')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Lug'at modal — inline tahrirlash + qo'shish */}
      <Modal open={vocabModal} onClose={() => setVocabModal(false)} title={`Lug'at — ${currentLesson?.name || ''}`} maxWidth="max-w-2xl">
        {/* Yangi qo'shish (tepada) */}
        <div className="flex items-end gap-2 pb-3 mb-3 border-b border-gray-100">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">O'zbekcha</label>
            <input value={vocabForm.uz} onChange={(e) => setVocabForm({ ...vocabForm, uz: e.target.value })} className={inputCls} placeholder="Salom" />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Tarjimasi</label>
            <input value={vocabForm.target} onChange={(e) => setVocabForm({ ...vocabForm, target: e.target.value })}
              className={inputCls} placeholder="Hello" onKeyDown={(e) => e.key === 'Enter' && addVocab()} />
          </div>
          <Button size="sm" onClick={addVocab} disabled={!vocabForm.uz || !vocabForm.target}><Plus size={14} /> Qo'shish</Button>
        </div>
        <div className="space-y-2">
          {vocabList.length === 0 ? <p className="text-sm text-gray-500">Lug'at bo'sh</p> : vocabList.map((v) => (
            <div key={v.id} className="p-2.5 bg-gray-50 rounded-lg">
              {editVocabId === v.id ? (
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="block text-[11px] text-gray-500 mb-0.5">O'zbekcha</label>
                    <input value={vEdit.uz} onChange={(e) => setVEdit({ ...vEdit, uz: e.target.value })} className={inputCls} />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[11px] text-gray-500 mb-0.5">Tarjimasi</label>
                    <input value={vEdit.target} onChange={(e) => setVEdit({ ...vEdit, target: e.target.value })} className={inputCls}
                      onKeyDown={(e) => e.key === 'Enter' && saveVocabEdit()} />
                  </div>
                  <button onClick={saveVocabEdit} className="p-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200" title="Saqlash"><Check size={15} /></button>
                  <button onClick={() => setEditVocabId(null)} className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200" title="Bekor"><X size={15} /></button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-medium text-sm">{v.translationUz}</span>
                    <span className="mx-2 text-gray-300">&rarr;</span>
                    <span className="text-sm text-gray-600">{v.translationTarget}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => { setEditVocabId(v.id); setVEdit({ uz: v.translationUz, target: v.translationTarget }); }}
                      className="p-1.5 text-gray-400 hover:text-[var(--primary)]" title="Tahrirlash"><Pencil size={14} /></button>
                    <button onClick={() => deleteVocab(v.id)} className="p-1.5 text-gray-400 hover:text-red-500" title="O'chirish"><Trash2 size={14} /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Modal>

      {/* Test (savollar) modal — inline tahrirlash + qo'shish */}
      <Modal open={questionsModal} onClose={() => setQuestionsModal(false)} title={`Test — ${currentLesson?.name || ''}`} maxWidth="max-w-2xl">
        {/* Yangi qo'shish */}
        <div className="space-y-2 pb-3 mb-3 border-b border-gray-100">
          <input value={qForm.text} onChange={(e) => setQForm({ ...qForm, text: e.target.value })} className={inputCls} placeholder="Savol matni" />
          <div className="grid grid-cols-2 gap-2">
            <input value={qForm.a} onChange={(e) => setQForm({ ...qForm, a: e.target.value })} className={inputCls} placeholder="A variant" />
            <input value={qForm.b} onChange={(e) => setQForm({ ...qForm, b: e.target.value })} className={inputCls} placeholder="B variant" />
            <input value={qForm.c} onChange={(e) => setQForm({ ...qForm, c: e.target.value })} className={inputCls} placeholder="C variant" />
            <input value={qForm.d} onChange={(e) => setQForm({ ...qForm, d: e.target.value })} className={inputCls} placeholder="D variant (ixtiyoriy)" />
          </div>
          <div className="flex items-end gap-2">
            <div className="w-28">
              <label className="block text-xs text-gray-500 mb-1">To'g'ri javob</label>
              <select value={qForm.correct} onChange={(e) => setQForm({ ...qForm, correct: e.target.value })} className={inputCls}>
                <option>A</option><option>B</option><option>C</option><option>D</option>
              </select>
            </div>
            <Button size="sm" onClick={addQuestion} disabled={!qForm.text || !qForm.a || !qForm.b || !qForm.c}><Plus size={14} /> Qo'shish</Button>
          </div>
        </div>
        <div className="space-y-2">
          {questionsList.length === 0 ? <p className="text-sm text-gray-500">Savollar yo'q</p> : questionsList.map((q) => (
            <div key={q.id} className="p-3 bg-gray-50 rounded-lg">
              {editQId === q.id ? (
                <div className="space-y-2">
                  <input value={qEdit.text} onChange={(e) => setQEdit({ ...qEdit, text: e.target.value })} className={inputCls} placeholder="Savol matni" />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={qEdit.a} onChange={(e) => setQEdit({ ...qEdit, a: e.target.value })} className={inputCls} placeholder="A" />
                    <input value={qEdit.b} onChange={(e) => setQEdit({ ...qEdit, b: e.target.value })} className={inputCls} placeholder="B" />
                    <input value={qEdit.c} onChange={(e) => setQEdit({ ...qEdit, c: e.target.value })} className={inputCls} placeholder="C" />
                    <input value={qEdit.d} onChange={(e) => setQEdit({ ...qEdit, d: e.target.value })} className={inputCls} placeholder="D" />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="w-28">
                      <label className="block text-[11px] text-gray-500 mb-0.5">To'g'ri</label>
                      <select value={qEdit.correct} onChange={(e) => setQEdit({ ...qEdit, correct: e.target.value })} className={inputCls}>
                        <option>A</option><option>B</option><option>C</option><option>D</option>
                      </select>
                    </div>
                    <button onClick={saveQuestionEdit} className="p-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200"><Check size={15} /></button>
                    <button onClick={() => setEditQId(null)} className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200"><X size={15} /></button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between gap-2">
                    <p className="text-sm font-medium">{q.questionText}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => { setEditQId(q.id); setQEdit({ text: q.questionText, a: q.optionA, b: q.optionB, c: q.optionC, d: q.optionD || '', correct: q.correctOption }); }}
                        className="p-1 text-gray-400 hover:text-[var(--primary)]" title="Tahrirlash"><Pencil size={14} /></button>
                      <button onClick={() => deleteQuestion(q.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                    <span className={q.correctOption === 'A' ? 'text-green-600 font-bold' : ''}>A: {q.optionA}</span>
                    <span className={q.correctOption === 'B' ? 'text-green-600 font-bold' : ''}>B: {q.optionB}</span>
                    <span className={q.correctOption === 'C' ? 'text-green-600 font-bold' : ''}>C: {q.optionC}</span>
                    {q.optionD && <span className={q.correctOption === 'D' ? 'text-green-600 font-bold' : ''}>D: {q.optionD}</span>}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </Modal>

      {/* Mashqlar modal — inline tahrirlash + qo'shish */}
      <Modal open={exercisesModal} onClose={() => setExercisesModal(false)} title={`Mashq — ${currentLesson?.name || ''}`} maxWidth="max-w-2xl">
        {/* Yangi mashq — gap + 3 variant, to'g'risini radio bilan belgilash */}
        <div className="space-y-2 pb-3 mb-3 border-b border-gray-100">
          <input value={exForm.sentence} onChange={(e) => setExForm({ ...exForm, sentence: e.target.value })} className={inputCls} placeholder="Gap — tushib qolgan so'z o'rniga _ qo'ying" />
          <p className="text-[11px] text-gray-500">Variantlar — to'g'ri so'zni ⦿ bilan belgilang:</p>
          {exForm.opts.map((o, i) => (
            <label key={i} className="flex items-center gap-2">
              <input type="radio" name="exAddCorrect" checked={exForm.correctIdx === i}
                onChange={() => setExForm({ ...exForm, correctIdx: i })}
                className="w-4 h-4 text-[var(--primary)] focus:ring-[var(--primary)]" title="To'g'ri javob" />
              <input value={o} onChange={(e) => { const opts = [...exForm.opts]; opts[i] = e.target.value; setExForm({ ...exForm, opts }); }}
                className={inputCls} placeholder={`${i + 1}-variant`} />
            </label>
          ))}
          <Button size="sm" onClick={addExercise} disabled={!exValid(exForm.sentence, exForm.opts, exForm.correctIdx)}><Plus size={14} /> Qo'shish</Button>
        </div>
        <div className="space-y-2">
          {exercisesList.length === 0 ? <p className="text-sm text-gray-500">Mashqlar yo'q</p> : exercisesList.map((ex) => (
            <div key={ex.id} className="p-3 bg-gray-50 rounded-lg">
              {editExId === ex.id ? (
                <div className="space-y-2">
                  <input value={exEdit.sentence} onChange={(e) => setExEdit({ ...exEdit, sentence: e.target.value })} className={inputCls} placeholder="Gap — _ = bo'sh joy" />
                  <p className="text-[11px] text-gray-500">To'g'ri so'zni ⦿ bilan belgilang:</p>
                  {exEdit.opts.map((o, i) => (
                    <label key={i} className="flex items-center gap-2">
                      <input type="radio" name={`exEdit-${ex.id}`} checked={exEdit.correctIdx === i}
                        onChange={() => setExEdit({ ...exEdit, correctIdx: i })}
                        className="w-4 h-4 text-[var(--primary)] focus:ring-[var(--primary)]" title="To'g'ri javob" />
                      <input value={o} onChange={(e) => { const opts = [...exEdit.opts]; opts[i] = e.target.value; setExEdit({ ...exEdit, opts }); }}
                        className={inputCls} placeholder={`${i + 1}-variant`} />
                    </label>
                  ))}
                  <div className="flex gap-2">
                    <button onClick={saveExerciseEdit} className="p-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200"><Check size={15} /></button>
                    <button onClick={() => setEditExId(null)} className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200"><X size={15} /></button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between gap-2">
                    <p className="text-sm font-medium">{ex.sentence}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => {
                        setEditExId(ex.id);
                        const parts = ex.options.split(',').map((s) => s.trim());
                        const opts = [parts[0] || '', parts[1] || '', parts[2] || ''];
                        let idx = opts.findIndex((x) => x && x.toLowerCase() === ex.correctAnswer.trim().toLowerCase());
                        if (idx < 0) idx = 0;
                        setExEdit({ sentence: ex.sentence, opts, correctIdx: idx });
                      }}
                        className="p-1 text-gray-400 hover:text-[var(--primary)]" title="Tahrirlash"><Pencil size={14} /></button>
                      <button onClick={() => deleteExercise(ex.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {ex.options.split(',').map((opt, k) => {
                      const o = opt.trim();
                      const correct = o.toLowerCase() === ex.correctAnswer.trim().toLowerCase();
                      return (
                        <span key={k} className={`px-2.5 py-1 rounded-lg text-xs border ${correct ? 'bg-green-50 border-green-300 text-green-700 font-semibold' : 'bg-white border-gray-200 text-gray-600'}`}>
                          {o}{correct && ' ✓'}
                        </span>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </Modal>

      {/* Audio kitob modal */}
      <Modal open={audioModal} onClose={() => setAudioModal(false)} title={`Audio kitob — ${currentLesson?.name || ''}`} maxWidth="max-w-2xl">
        {/* Yangi audio kitob — nom + tavsif + audio (majburiy) + PDF (ixtiyoriy) */}
        <div className="space-y-2 pb-3 mb-3 border-b border-gray-100">
          <input value={audioTitle} onChange={(e) => setAudioTitle(e.target.value)} className={inputCls} placeholder="Nomi" />
          <textarea value={audioDesc} onChange={(e) => setAudioDesc(e.target.value)} rows={2} className={inputCls} placeholder="Tavsif (ixtiyoriy)" />
          <div className="grid grid-cols-2 gap-2">
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-[var(--primary)] cursor-pointer hover:bg-gray-50">
              <Upload size={15} /> Audio (majburiy)
              <input type="file" accept="audio/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setPendingAudio(f); }} />
            </label>
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-[var(--primary)] cursor-pointer hover:bg-gray-50">
              <BookOpen size={15} /> PDF (ixtiyoriy)
              <input type="file" accept="application/pdf,.pdf" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setPendingPdf(f); }} />
            </label>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 truncate flex-1">
              {pendingAudio ? `🎵 ${pendingAudio.name}` : 'Audio tanlanmagan'}{pendingPdf ? ` · 📄 ${pendingPdf.name}` : ''}
            </span>
            <Button size="sm" onClick={addAudiobook} disabled={!pendingAudio || audioUploading}>
              {audioUploading ? 'Yuklanmoqda…' : <><Plus size={14} /> Qo'shish</>}
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          {audioList.length === 0 ? <p className="text-sm text-gray-500">Audio kitob biriktirilmagan</p> : audioList.map((a) => (
            <div key={a.id} className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm flex items-center gap-2 min-w-0">
                  <Headphones size={15} className="text-orange-600 shrink-0" />
                  <span className="truncate">{a.title || 'Audio'}</span>
                  {a.pdfPath && <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-50 text-red-600 text-[10px] font-medium"><BookOpen size={10} /> PDF</span>}
                </span>
                <button onClick={() => deleteAudiobook(a.id)} className="p-1 text-gray-400 hover:text-red-500 shrink-0"><Trash2 size={14} /></button>
              </div>
              {a.description && <p className="text-xs text-gray-500 mt-1">{a.description}</p>}
              {a.filePath && <audio controls src={fileUrl(a.filePath)} className="w-full mt-2 h-9" />}
              {a.pdfPath && (
                <a href={fileUrl(a.pdfPath)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-2 text-xs text-[var(--primary)] hover:underline">
                  <BookOpen size={12} /> PDF'ni ochish
                </a>
              )}
            </div>
          ))}
        </div>
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
        'relative bg-white rounded-xl border ' +
        (isDragging ? 'border-[var(--primary)]/40 shadow-lg' : 'border-gray-100 hover:shadow-md transition-shadow')
      }
    >
      {/* Thumbnail (16:9) — bosilganda video play (detail). Faqat rasm kesiladi. */}
      <div onClick={onOpenDetail} className="relative aspect-video bg-gray-100 cursor-pointer group rounded-t-xl overflow-hidden" title="Ko'rish — video va modullar">
        {cover ? (
          <img src={cover} alt="" className="w-full h-full object-cover" />
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
          <p className="font-semibold text-gray-900 text-sm leading-snug line-clamp-1">{lesson.name}</p>
          {lesson.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{lesson.description}</p>}
        </div>
        <div className="relative shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleMenu(); }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <MoreVertical size={18} />
          </button>
          {menuOpen && (
            <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-9 z-20 w-40 bg-white rounded-xl shadow-lg border border-gray-100 py-1">
              <button onClick={onEdit} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                <Pencil size={15} /> Tahrirlash
              </button>
              <button onClick={onDelete} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                <Trash2 size={15} /> O'chirish
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
