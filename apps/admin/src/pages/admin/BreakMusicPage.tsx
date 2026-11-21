import { useCallback, useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Music, Trash2, Plus, RefreshCw, Loader2, Pencil } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States';
import api, { fileUrl } from '../../lib/api';
import { apiErrorMessage } from '../../lib/errors';
import { confirmDialog, toast } from '../../stores/ui-store';
import type { BreakGroup, BreakTrack } from '../../lib/types';

// Backend bu fayllar uchun tur/hajmni tekshirmaydi — noto'g'ri fayl serverga
// tushib, mobil ilovada ijro etilmay qolmasligi uchun shu yerda tekshiramiz.
const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus', 'flac'];
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
const AUDIO_ACCEPT = AUDIO_EXTENSIONS.map((e) => `.${e}`).join(',') + ',audio/*';
const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
const MAX_AUDIO_MB = 50;
const MAX_IMAGE_MB = 10;
const MB = 1024 * 1024;
// break_tracks.title — VARCHAR(150)
const MAX_TITLE_LENGTH = 150;
// Guruh nomi va ikonkasi chegaralari — server ham shuni tekshiradi
const MAX_GROUP_NAME = 60;
const MAX_GROUP_ICON = 8;

const inputCls =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]';
const inputErrCls = ' border-red-300 focus:border-red-400 focus:ring-red-200';
const headerIconBtnCls =
  'p-1.5 rounded-lg bg-white/90 text-gray-700 hover:bg-white disabled:opacity-70 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/60';

const extensionOf = (name: string) => {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
};

/** Fayl nomidan audio kengaytmasini olib tashlaydi: "yomgir.mp3" -> "yomgir". */
const stripExtension = (name: string) => {
  const ext = extensionOf(name);
  return ext && AUDIO_EXTENSIONS.includes(ext) ? name.slice(0, -(ext.length + 1)) : name;
};

const trackTitle = (t: BreakTrack) => stripExtension(t.title?.trim() ?? '') || `Musiqa #${t.id}`;

const formatSize = (bytes: number) => `${(bytes / MB).toFixed(1)} MB`;

/** Muammo bo'lsa — sababi (matn), aks holda null. */
function audioProblem(file: File): string | null {
  if (!AUDIO_EXTENSIONS.includes(extensionOf(file.name))) {
    return `audio fayl emas (ruxsat etilgan: ${AUDIO_EXTENSIONS.join(', ')})`;
  }
  if (file.size === 0) return "fayl bo'sh";
  if (file.size > MAX_AUDIO_MB * MB) return `hajmi ${formatSize(file.size)} — ${MAX_AUDIO_MB} MB dan oshmasligi kerak`;
  return null;
}

function imageProblem(file: File): string | null {
  if (!IMAGE_EXTENSIONS.includes(extensionOf(file.name))) return 'Faqat JPG, PNG yoki WEBP rasm yuklash mumkin.';
  if (file.size === 0) return "Rasm fayli bo'sh.";
  if (file.size > MAX_IMAGE_MB * MB) return `Rasm hajmi ${formatSize(file.size)} — ${MAX_IMAGE_MB} MB dan oshmasligi kerak.`;
  return null;
}

interface UploadProgress { current: number; total: number; percent: number }

function parseGroups(payload: unknown): BreakGroup[] {
  const body = payload as { data?: unknown } | null;
  const list = body?.data ?? payload;
  return Array.isArray(list) ? (list as BreakGroup[]) : [];
}

/** Javobdan bitta guruhni ajratadi; entity kelmagan bo'lsa null. */
function parseGroup(payload: unknown): BreakGroup | null {
  const body = payload as { data?: unknown } | null;
  const g = (body?.data ?? payload) as Partial<BreakGroup> | null;
  return g && typeof g === 'object' && typeof g.id === 'number' ? (g as BreakGroup) : null;
}

interface GroupForm { name: string; icon: string }
interface GroupFormErrors { name?: string; icon?: string }

interface CardProps {
  group: BreakGroup;
  bgBusy: boolean;
  /** Guruh o'chirilmoqda — karta bloklanadi */
  removing: boolean;
  upload?: UploadProgress;
  deletingIds: ReadonlySet<number>;
  onPickBg: (group: BreakGroup, file: File) => void;
  onPickTracks: (group: BreakGroup, files: File[]) => void;
  onDeleteTrack: (group: BreakGroup, track: BreakTrack) => void;
  onPlay: (el: HTMLAudioElement) => void;
  onEdit: (group: BreakGroup) => void;
  onDelete: (group: BreakGroup) => void;
}

function GroupCard({
  group: g, bgBusy, removing, upload, deletingIds, onPickBg, onPickTracks, onDeleteTrack, onPlay, onEdit, onDelete,
}: CardProps) {
  const bgInput = useRef<HTMLInputElement>(null);
  const trackInput = useRef<HTMLInputElement>(null);
  // Rasm yuklanmasa (fayl serverdan o'chgan) — singan ikonka o'rniga gradient qoladi
  const [brokenBg, setBrokenBg] = useState<string | null>(null);
  const tracks = g.tracks ?? [];
  const bgSrc = g.backgroundImage && g.backgroundImage !== brokenBg ? fileUrl(g.backgroundImage) : '';

  return (
    <div
      className={`bg-white rounded-2xl border border-gray-100 overflow-hidden min-w-0 ${removing ? 'opacity-60 pointer-events-none' : ''}`}
      aria-busy={removing || undefined}
    >
      {/* Header — fon rasmi */}
      <div className="relative h-28 bg-gradient-to-br from-[var(--primary)]/40 to-gray-300">
        {bgSrc && (
          <img
            src={bgSrc}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setBrokenBg(g.backgroundImage ?? null)}
          />
        )}
        <div className="absolute inset-0 bg-black/25 flex items-center gap-2 pl-4 pr-20 pb-6">
          {g.icon && <span className="text-2xl shrink-0" aria-hidden="true">{g.icon}</span>}
          <span className="text-white font-bold text-lg truncate" title={g.name}>{g.name}</span>
        </div>
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(g)}
            disabled={removing}
            aria-label={`«${g.name}» guruhini tahrirlash`}
            title="Tahrirlash"
            className={headerIconBtnCls}
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(g)}
            disabled={removing}
            aria-label={`«${g.name}» guruhini o'chirish`}
            title="O'chirish"
            className={`${headerIconBtnCls} hover:text-red-600`}
          >
            {removing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        </div>
        <input
          ref={bgInput}
          type="file"
          accept={IMAGE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = ''; // shu faylni qayta tanlash mumkin bo'lsin
            if (f) onPickBg(g, f);
          }}
        />
        <button
          type="button"
          disabled={bgBusy}
          onClick={() => bgInput.current?.click()}
          className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/90 text-xs font-medium text-gray-700 hover:bg-white disabled:opacity-70 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/60"
        >
          {bgBusy ? <Loader2 size={13} className="animate-spin" /> : <ImageIcon size={13} />}
          {bgBusy ? 'Yuklanmoqda…' : g.backgroundImage ? 'Fonni almashtirish' : 'Fon rasmi yuklash'}
        </button>
      </div>

      {/* Tracklar */}
      <div className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <span className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
            <Music size={15} className="text-[var(--primary)]" /> Musiqalar ({tracks.length})
          </span>
          <input
            ref={trackInput}
            type="file"
            accept={AUDIO_ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = '';
              if (files.length) onPickTracks(g, files);
            }}
          />
          <Button variant="secondary" size="sm" loading={!!upload} onClick={() => trackInput.current?.click()}>
            {!upload && <Plus size={14} />}
            {upload
              ? `Yuklanmoqda ${upload.total > 1 ? `${upload.current}/${upload.total} · ` : ''}${upload.percent}%`
              : "Musiqa qo'shish"}
          </Button>
        </div>

        {upload && (
          <div
            className="mb-2 h-1 overflow-hidden rounded-full bg-gray-100"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={upload.percent}
            aria-label="Musiqa yuklanishi"
          >
            <div className="h-full bg-[var(--primary)] transition-all" style={{ width: `${upload.percent}%` }} />
          </div>
        )}

        {tracks.length === 0 ? (
          <p className="rounded-lg bg-gray-50 px-3 py-3 text-xs text-gray-500">
            Bu guruhda hali musiqa yo'q. «Musiqa qo'shish» orqali bir yoki bir nechta audio fayl
            yuklang (har biri {MAX_AUDIO_MB} MB gacha).
          </p>
        ) : (
          <ul className="space-y-1.5">
            {tracks.map((t) => {
              const title = trackTitle(t);
              const deleting = deletingIds.has(t.id);
              return (
                <li
                  key={t.id}
                  className={`flex flex-wrap items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 ${deleting ? 'opacity-50' : ''}`}
                >
                  <Music size={14} className="text-gray-400 shrink-0" />
                  <span className="text-sm text-gray-700 truncate flex-1 min-w-0" title={title}>{title}</span>
                  <button
                    type="button"
                    onClick={() => onDeleteTrack(g, t)}
                    disabled={deleting}
                    aria-label={`«${title}» musiqasini o'chirish`}
                    title="O'chirish"
                    className="p-1 rounded text-gray-400 hover:text-red-600 shrink-0 disabled:cursor-not-allowed sm:order-last"
                  >
                    {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                  {t.filePath ? (
                    <audio
                      src={fileUrl(t.filePath)}
                      controls
                      preload="none"
                      onPlay={(e) => onPlay(e.currentTarget)}
                      aria-label={`${title} — tinglash`}
                      className="h-8 w-full sm:w-56"
                    />
                  ) : (
                    <span className="w-full text-xs text-red-500 sm:w-auto">Fayl topilmadi</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function BreakMusicPage() {
  const [groups, setGroups] = useState<BreakGroup[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [bgBusy, setBgBusy] = useState<ReadonlySet<number>>(new Set());
  const [uploads, setUploads] = useState<Record<number, UploadProgress>>({});
  const [deletingIds, setDeletingIds] = useState<ReadonlySet<number>>(new Set());
  // Guruh yaratish / tahrirlash oynasi
  const [formOpen, setFormOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<BreakGroup | null>(null);
  const [form, setForm] = useState<GroupForm>({ name: '', icon: '' });
  const [formErrors, setFormErrors] = useState<GroupFormErrors>({});
  const [savingGroup, setSavingGroup] = useState(false);
  const [removingGroups, setRemovingGroups] = useState<ReadonlySet<number>>(new Set());
  const requestId = useRef(0);
  // Bir guruhga ikki marta parallel yuklash boshlanib ketmasligi uchun (state kechikib yangilanadi)
  const uploadingGroups = useRef(new Set<number>());
  const playing = useRef<HTMLAudioElement | null>(null);

  /** silent=true — ro'yxat joyida qoladi, xato faqat toast bilan aytiladi. */
  const load = useCallback(async (silent = false) => {
    const id = ++requestId.current;
    try {
      const res = await api.get('/admin/break-groups');
      if (id !== requestId.current) return; // eskirgan javob
      setGroups(parseGroups(res.data));
      setLoadError(null);
    } catch (err) {
      if (id !== requestId.current) return;
      const message = apiErrorMessage(err, "Tanaffus guruhlarini yuklab bo'lmadi.");
      if (silent) toast.error(message);
      else setLoadError(message);
    } finally {
      if (id === requestId.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const ids = requestId;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- birinchi yuklash (state faqat javob kelgach o'zgaradi)
    void load();
    return () => {
      ids.current++; // sahifadan chiqilgach kelgan javob e'tiborga olinmaydi
    };
  }, [load]);

  const retry = () => {
    setLoadError(null);
    setGroups(null);
    void load();
  };

  const refresh = () => {
    setRefreshing(true);
    void load(true);
  };

  const patchGroup = (groupId: number, fn: (g: BreakGroup) => BreakGroup) =>
    setGroups((prev) => prev?.map((g) => (g.id === groupId ? fn(g) : g)) ?? prev);

  const uploadBg = async (group: BreakGroup, file: File) => {
    const problem = imageProblem(file);
    if (problem) { toast.error(problem); return; }
    setBgBusy((prev) => new Set(prev).add(group.id));
    try {
      const fd = new FormData();
      fd.append('file', file);
      // Sekin internetda 60 soniyalik umumiy timeout yetmasligi mumkin
      const res = await api.post(`/admin/break-groups/${group.id}/upload-bg`, fd, { timeout: 0 });
      const saved = (res.data?.data ?? res.data) as Partial<BreakGroup> | null;
      if (saved?.backgroundImage) {
        patchGroup(group.id, (g) => ({ ...g, backgroundImage: saved.backgroundImage }));
      } else {
        void load(true);
      }
      toast.success(`«${group.name}» fon rasmi yangilandi`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Fon rasmini yuklab bo'lmadi."));
    } finally {
      setBgBusy((prev) => { const next = new Set(prev); next.delete(group.id); return next; });
    }
  };

  const uploadTracks = async (group: BreakGroup, files: File[]) => {
    if (uploadingGroups.current.has(group.id)) return; // bu guruhga yuklash allaqachon ketmoqda

    const valid: File[] = [];
    for (const f of files) {
      const problem = audioProblem(f);
      if (problem) toast.error(`«${f.name}»: ${problem}`);
      else valid.push(f);
    }
    if (valid.length === 0) return;

    const setProgress = (current: number, percent: number) =>
      setUploads((prev) => ({ ...prev, [group.id]: { current, total: valid.length, percent } }));

    uploadingGroups.current.add(group.id);
    let uploaded = 0;
    let needsReload = false;
    // Ketma-ket yuklaymiz — fayllar tanlangan tartibda qo'shiladi
    for (let i = 0; i < valid.length; i++) {
      const file = valid[i];
      setProgress(i + 1, 0);
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await api.post(`/admin/break-groups/${group.id}/tracks`, fd, {
          // Sarlavha query orqali beriladi (backend @RequestParam). Berilmasa backend
          // fayl nomini kengaytmasi bilan yozadi va 150 belgidan uzun nom saqlanmay qoladi.
          params: { title: stripExtension(file.name).trim().slice(0, MAX_TITLE_LENGTH) || undefined },
          timeout: 0,
          onUploadProgress: (e) => {
            if (e.total) setProgress(i + 1, Math.min(99, Math.round((e.loaded / e.total) * 100)));
          },
        });
        const saved = (res.data?.data ?? res.data) as BreakTrack | null;
        if (saved && typeof saved.id === 'number') {
          patchGroup(group.id, (g) => ({
            ...g,
            tracks: [...(g.tracks ?? []).filter((t) => t.id !== saved.id), saved],
          }));
        } else {
          needsReload = true;
        }
        uploaded++;
      } catch (err) {
        toast.error(`«${file.name}»: ${apiErrorMessage(err, "yuklab bo'lmadi.")}`);
      }
    }

    uploadingGroups.current.delete(group.id);
    setUploads((prev) => {
      const next = { ...prev };
      delete next[group.id];
      return next;
    });
    if (needsReload) void load(true);
    if (uploaded > 0) {
      toast.success(
        uploaded === 1
          ? `«${group.name}» guruhiga musiqa qo'shildi`
          : `«${group.name}» guruhiga ${uploaded} ta musiqa qo'shildi`,
      );
    }
  };

  const deleteTrack = async (group: BreakGroup, track: BreakTrack) => {
    if (deletingIds.has(track.id)) return;
    const title = trackTitle(track);
    const ok = await confirmDialog({
      title: "Musiqa o'chirilsinmi?",
      message: `«${title}» «${group.name}» guruhidan o'chiriladi va mobil ilovada boshqa ijro etilmaydi. Bu amalni qaytarib bo'lmaydi.`,
      confirmText: "O'chirish",
      danger: true,
    });
    if (!ok) return;
    setDeletingIds((prev) => new Set(prev).add(track.id));
    try {
      await api.delete(`/admin/break-tracks/${track.id}`);
      patchGroup(group.id, (g) => ({ ...g, tracks: (g.tracks ?? []).filter((t) => t.id !== track.id) }));
      toast.success(`«${title}» o'chirildi`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Musiqani o'chirib bo'lmadi."));
    } finally {
      setDeletingIds((prev) => { const next = new Set(prev); next.delete(track.id); return next; });
    }
  };

  const openCreate = () => {
    setEditGroup(null);
    setForm({ name: '', icon: '' });
    setFormErrors({});
    setFormOpen(true);
  };

  const openEdit = (group: BreakGroup) => {
    setEditGroup(group);
    setForm({ name: group.name ?? '', icon: group.icon ?? '' });
    setFormErrors({});
    setFormOpen(true);
  };

  const closeForm = () => { if (!savingGroup) setFormOpen(false); };

  const setFormField = (key: keyof GroupForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFormErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const saveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingGroup) return;
    const name = form.name.trim();
    const icon = form.icon.trim();
    const errs: GroupFormErrors = {};
    if (!name) errs.name = 'Guruh nomini kiriting';
    else if (name.length > MAX_GROUP_NAME) errs.name = `Nom ${MAX_GROUP_NAME} belgidan oshmasin`;
    if (icon.length > MAX_GROUP_ICON) errs.icon = 'Ikonka juda uzun — bitta emoji kiriting';
    setFormErrors(errs);
    if (errs.name || errs.icon) return;

    const target = editGroup;
    setSavingGroup(true);
    try {
      if (target) {
        const res = await api.put(`/admin/break-groups/${target.id}`, { name, icon });
        const saved = parseGroup(res.data);
        // Javobda tracks kelmasligi mumkin — mavjud musiqalar saqlab qolinadi
        patchGroup(target.id, (g) => ({ ...g, ...(saved ?? { name, icon }), tracks: saved?.tracks ?? g.tracks }));
        toast.success('Guruh saqlandi');
      } else {
        const res = await api.post('/admin/break-groups', icon ? { name, icon } : { name });
        const saved = parseGroup(res.data);
        if (saved) {
          setGroups((prev) => [...(prev ?? []).filter((g) => g.id !== saved.id), { ...saved, tracks: saved.tracks ?? [] }]);
        } else {
          void load(true);
        }
        toast.success(`«${name}» guruhi qo'shildi`);
      }
      setFormOpen(false);
    } catch (err) {
      toast.error(apiErrorMessage(err, target ? "Guruhni saqlab bo'lmadi." : "Guruhni qo'shib bo'lmadi."));
    } finally {
      setSavingGroup(false);
    }
  };

  const deleteGroup = async (group: BreakGroup) => {
    if (removingGroups.has(group.id)) return;
    if (uploadingGroups.current.has(group.id) || bgBusy.has(group.id)) {
      toast.info('Bu guruhga fayl yuklanmoqda — tugashini kuting.');
      return;
    }
    const count = group.tracks?.length ?? 0;
    const ok = await confirmDialog({
      title: "Guruh o'chirilsinmi?",
      message:
        (count > 0
          ? `«${group.name}» guruhi, undagi ${count} ta musiqa va barcha fayllari butunlay o'chiriladi.`
          : `«${group.name}» guruhi butunlay o'chiriladi (ichida musiqa yo'q).`) +
        " Guruh mobil ilovadan ham yo'qoladi. Bu amalni qaytarib bo'lmaydi.",
      confirmText: "O'chirish",
      danger: true,
    });
    if (!ok) return;
    setRemovingGroups((prev) => new Set(prev).add(group.id));
    try {
      await api.delete(`/admin/break-groups/${group.id}`);
      // O'chirilgan guruh musiqasi ijro etilayotgan bo'lsa — to'xtatiladi
      playing.current?.pause();
      setGroups((prev) => prev?.filter((g) => g.id !== group.id) ?? prev);
      toast.success(`«${group.name}» guruhi o'chirildi`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Guruhni o'chirib bo'lmadi."));
    } finally {
      setRemovingGroups((prev) => { const next = new Set(prev); next.delete(group.id); return next; });
    }
  };

  // Bir vaqtda faqat bitta musiqa ijro etiladi
  const handlePlay = (el: HTMLAudioElement) => {
    if (playing.current && playing.current !== el) playing.current.pause();
    playing.current = el;
  };

  const totalTracks = groups?.reduce((sum, g) => sum + (g.tracks?.length ?? 0), 0) ?? 0;

  return (
    <div>
      <PageHeader
        title="Tanaffus musiqasi"
        description={
          <>
            Har bir guruh uchun fon rasmi va musiqalar to'plamini sozlang. Mobil ilovada dam olish vaqtida ishlatiladi.
            {groups && groups.length > 0 && ` Jami: ${groups.length} ta guruh, ${totalTracks} ta musiqa.`}
          </>
        }
        actions={
          <>
            <Button variant="secondary" onClick={refresh} loading={refreshing} disabled={groups === null}>
              {!refreshing && <RefreshCw size={14} />} Yangilash
            </Button>
            <Button onClick={openCreate} disabled={groups === null}>
              <Plus size={15} /> Guruh qo'shish
            </Button>
          </>
        }
      />

      {loadError ? (
        <div className="rounded-2xl border border-gray-100 bg-white">
          <ErrorState message={loadError} onRetry={retry} />
        </div>
      ) : groups === null ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5" role="status" aria-label="Yuklanmoqda">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
              <Skeleton className="h-28 w-full rounded-none" />
              <div className="space-y-2 p-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white">
          <EmptyState
            icon={Music}
            title="Tanaffus guruhlari yo'q"
            description="Birinchi guruhni qo'shing (masalan: Okean, O'rmon), so'ng unga fon rasmi va musiqalar yuklang."
            action={<Button onClick={openCreate}><Plus size={15} /> Guruh qo'shish</Button>}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {groups.map((g) => (
            <GroupCard
              key={g.id}
              group={g}
              bgBusy={bgBusy.has(g.id)}
              removing={removingGroups.has(g.id)}
              upload={uploads[g.id]}
              deletingIds={deletingIds}
              onPickBg={uploadBg}
              onPickTracks={uploadTracks}
              onDeleteTrack={deleteTrack}
              onPlay={handlePlay}
              onEdit={openEdit}
              onDelete={deleteGroup}
            />
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={closeForm}
        closeDisabled={savingGroup}
        maxWidth="max-w-md"
        title={editGroup ? 'Guruhni tahrirlash' : "Guruh qo'shish"}
      >
        <form onSubmit={saveGroup} noValidate className="space-y-4">
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label htmlFor="break-group-name" className="block text-sm font-medium text-gray-700">
                Nomi <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <span className="text-xs text-gray-400">{form.name.trim().length}/{MAX_GROUP_NAME}</span>
            </div>
            <input
              id="break-group-name"
              value={form.name}
              maxLength={MAX_GROUP_NAME}
              onChange={(e) => setFormField('name', e.target.value)}
              disabled={savingGroup}
              aria-invalid={!!formErrors.name}
              className={inputCls + (formErrors.name ? inputErrCls : '')}
              placeholder="Masalan: Okean"
            />
            {formErrors.name && <p role="alert" className="mt-1 text-xs text-red-600">{formErrors.name}</p>}
          </div>
          <div>
            <label htmlFor="break-group-icon" className="mb-1 block text-sm font-medium text-gray-700">
              Ikonka <span className="font-normal text-gray-400">(ixtiyoriy)</span>
            </label>
            <input
              id="break-group-icon"
              value={form.icon}
              onChange={(e) => setFormField('icon', e.target.value)}
              disabled={savingGroup}
              aria-invalid={!!formErrors.icon}
              className={inputCls + ' max-w-[8rem] text-lg' + (formErrors.icon ? inputErrCls : '')}
              placeholder="🌊"
            />
            {formErrors.icon
              ? <p role="alert" className="mt-1 text-xs text-red-600">{formErrors.icon}</p>
              : <p className="mt-1 text-xs text-gray-400">Bitta emoji — guruh nomi yonida ko'rsatiladi.</p>}
          </div>
          {!editGroup && (
            <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
              Fon rasmi va musiqalar guruh yaratilgach, uning kartasidan yuklanadi.
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={closeForm} disabled={savingGroup}>Bekor qilish</Button>
            <Button type="submit" loading={savingGroup}>{editGroup ? 'Saqlash' : "Qo'shish"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
