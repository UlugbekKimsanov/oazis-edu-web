import { useEffect, useState } from 'react';
import { Image as ImageIcon, Music, Trash2, Plus } from 'lucide-react';
import api, { fileUrl } from '../../lib/api';
import type { BreakGroup } from '../../lib/types';

export default function BreakMusicPage() {
  const [groups, setGroups] = useState<BreakGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);


  const fetchGroups = async () => {
    try {
      const res = await api.get('/admin/break-groups');
      setGroups(res.data.data ?? res.data ?? []);
    } catch { setGroups([]); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    let active = true;
    api.get('/admin/break-groups')
      .then((res) => {
        if (active) setGroups(res.data.data ?? res.data ?? []);
      })
      .catch(() => {
        if (active) setGroups([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const uploadBg = async (groupId: number, file: File) => {
    setBusy(`bg-${groupId}`);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post(`/admin/break-groups/${groupId}/upload-bg`, fd);
      fetchGroups();
    } catch { /* ignore */ } finally { setBusy(null); }
  };

  const uploadTrack = async (groupId: number, file: File) => {
    setBusy(`track-${groupId}`);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post(`/admin/break-groups/${groupId}/tracks`, fd);
      fetchGroups();
    } catch { /* ignore */ } finally { setBusy(null); }
  };

  const deleteTrack = async (trackId: number) => {
    if (!confirm("Musiqani o'chirishni tasdiqlaysizmi?")) return;
    await api.delete(`/admin/break-tracks/${trackId}`).catch(() => {});
    fetchGroups();
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tanaffus musiqasi</h1>
        <p className="text-sm text-gray-500 mt-1">
          Har bir guruh uchun fon rasmi va musiqalar to'plamini sozlang. Mobil ilovada dam olish vaqtida ishlatiladi.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Yuklanmoqda...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {groups.map((g) => (
            <div key={g.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {/* Header — fon rasmi */}
              <div className="relative h-28 bg-gray-100">
                {g.backgroundImage
                  ? <img src={fileUrl(g.backgroundImage)} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-gradient-to-br from-[var(--primary)]/15 to-gray-100" />}
                <div className="absolute inset-0 bg-black/25 flex items-center gap-2 px-4">
                  <span className="text-2xl">{g.icon}</span>
                  <span className="text-white font-bold text-lg">{g.name}</span>
                </div>
                <label className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/90 text-xs font-medium text-gray-700 cursor-pointer hover:bg-white">
                  <ImageIcon size={13} /> {busy === `bg-${g.id}` ? 'Yuklanmoqda…' : 'Fon rasmi'}
                  <input type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadBg(g.id, f); }} />
                </label>
              </div>

              {/* Tracklar */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                    <Music size={15} className="text-[var(--primary)]" /> Musiqalar ({g.tracks?.length ?? 0})
                  </span>
                  <label className="inline-flex items-center gap-1.5 text-sm text-[var(--primary)] cursor-pointer hover:underline">
                    <Plus size={15} /> {busy === `track-${g.id}` ? 'Yuklanmoqda…' : "Musiqa qo'shish"}
                    <input type="file" accept="audio/*" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadTrack(g.id, f); }} />
                  </label>
                </div>
                {(!g.tracks || g.tracks.length === 0) ? (
                  <p className="text-xs text-gray-400 py-2">Musiqa yo'q</p>
                ) : (
                  <div className="space-y-1.5">
                    {g.tracks.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                        <Music size={14} className="text-gray-400 shrink-0" />
                        <span className="text-sm text-gray-700 truncate flex-1">{t.title || `Track ${t.id}`}</span>
                        <audio src={fileUrl(t.filePath)} controls preload="none" className="h-7 w-40" />
                        <button onClick={() => deleteTrack(t.id)} className="p-1 text-gray-400 hover:text-red-600 shrink-0">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
