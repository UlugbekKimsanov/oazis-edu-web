import { useEffect, useState } from 'react';
import { Send, Users as UsersIcon, GraduationCap, UserCheck, BookOpen, UserPlus } from 'lucide-react';
import Button from '../../components/ui/Button';
import api from '../../lib/api';
import type { Course, Language, User } from '../../lib/types';

type Target = 'ALL' | 'STUDENTS' | 'TEACHERS' | 'COURSE' | 'USERS';

const TARGETS: { key: Target; label: string; icon: typeof UsersIcon; desc: string }[] = [
  { key: 'ALL', label: 'Barchaga', icon: UsersIcon, desc: "O'quvchi va o'qituvchilar" },
  { key: 'STUDENTS', label: "O'quvchilar", icon: GraduationCap, desc: "Barcha o'quvchilar" },
  { key: 'TEACHERS', label: "O'qituvchilar", icon: UserCheck, desc: "Barcha o'qituvchilar" },
  { key: 'COURSE', label: 'Kurs', icon: BookOpen, desc: "Kurs o'quvchilari" },
  { key: 'USERS', label: 'Tanlab', icon: UserPlus, desc: 'Foydalanuvchilarni tanlash' },
];

export default function NotificationsPage() {
  const [target, setTarget] = useState<Target>('ALL');
  const [courses, setCourses] = useState<Course[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [courseId, setCourseId] = useState<number>(0);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [imgUploading, setImgUploading] = useState(false);

  useEffect(() => {
    api.get('/admin/courses').then((r) => setCourses(r.data.data ?? r.data ?? [])).catch(() => {});
    api.get('/admin/languages').then((r) => setLanguages(r.data.data ?? r.data ?? [])).catch(() => {});
    api.get('/admin/users').then((r) => setUsers(r.data.data ?? r.data ?? [])).catch(() => {});
  }, []);

  const langName = (id: number) => languages.find((l) => l.id === id)?.name || '';

  const toggleUser = (id: number) =>
    setSelectedUsers((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const canSend =
    title.trim() && body.trim() && !sending &&
    (target !== 'COURSE' || courseId > 0) &&
    (target !== 'USERS' || selectedUsers.length > 0);

  const uploadImage = async (file: File) => {
    setImgUploading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/admin/notifications/upload-image', fd);
      const url = res.data?.data?.url as string | undefined;
      if (url) setImage(url);
    } catch {
      setResult('Rasm yuklashda xatolik');
    } finally {
      setImgUploading(false);
    }
  };

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    setResult(null);
    try {
      const payload: Record<string, unknown> = { target, title: title.trim(), body: body.trim() };
      if (target === 'COURSE') payload.courseId = courseId;
      if (target === 'USERS') payload.userIds = selectedUsers;
      if (image) payload.image = image;
      const res = await api.post('/admin/notifications', payload);
      const sent = res.data?.data?.sent ?? 0;
      setResult(`${sent} ta foydalanuvchiga yuborildi`);
      setTitle('');
      setBody('');
      setSelectedUsers([]);
      setImage(null);
    } catch {
      setResult('Xatolik yuz berdi');
    } finally {
      setSending(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = userSearch.toLowerCase();
    return (
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q)
    );
  });

  const inputCls =
    'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]';

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bildirishnomalar</h1>
        <p className="text-sm text-gray-500 mt-1">Foydalanuvchilarga xabar yuborish</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {/* Kimga */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Kimga</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TARGETS.map((t) => {
              const active = target === t.key;
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => setTarget(t.key)}
                  className={
                    'flex items-start gap-2 p-3 rounded-xl border text-left transition-colors ' +
                    (active ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-gray-200 hover:bg-gray-50')
                  }
                >
                  <Icon size={18} className={active ? 'text-[var(--primary)]' : 'text-gray-400'} />
                  <div>
                    <p className={'text-sm font-medium ' + (active ? 'text-[var(--primary)]' : 'text-gray-800')}>{t.label}</p>
                    <p className="text-[11px] text-gray-400 leading-tight">{t.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Kurs tanlash */}
        {target === 'COURSE' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kurs</label>
            <select value={courseId} onChange={(e) => setCourseId(Number(e.target.value))} className={inputCls}>
              <option value={0}>— Kurs tanlang —</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{langName(c.languageId) ? ` (${langName(c.languageId)})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Foydalanuvchi tanlash */}
        {target === 'USERS' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Foydalanuvchilar <span className="text-gray-400">({selectedUsers.length} tanlandi)</span>
            </label>
            <input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Qidirish (ism, email, telefon)"
              className={inputCls + ' mb-2'}
            />
            <div className="max-h-60 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
              {filteredUsers.length === 0 ? (
                <p className="text-sm text-gray-400 p-3">Topilmadi</p>
              ) : (
                filteredUsers.map((u) => (
                  <label key={u.id} className="flex items-center gap-3 p-2.5 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(u.id)}
                      onChange={() => toggleUser(u.id)}
                      className="w-4 h-4 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{u.firstName} {u.lastName}</p>
                      <p className="text-xs text-gray-400 truncate">{u.email || u.phone} · {u.role}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
        )}

        {/* Sarlavha + matn */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sarlavha</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="Masalan: Yangilik" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Matn</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} className={inputCls} placeholder="Xabar matni..." />
        </div>

        {/* Rasm (ixtiyoriy) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rasm <span className="text-gray-400 font-normal">(ixtiyoriy)</span>
          </label>
          {image ? (
            <div className="relative inline-block">
              <img src={image} alt="" className="max-h-40 rounded-lg border border-gray-200" />
              <button
                type="button"
                onClick={() => setImage(null)}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center shadow hover:bg-red-600"
                title="Rasmni olib tashlash"
              >
                ✕
              </button>
            </div>
          ) : (
            <label className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-gray-600">
              {imgUploading ? 'Yuklanmoqda…' : '＋ Rasm tanlash'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={imgUploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadImage(f);
                  e.target.value = '';
                }}
              />
            </label>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          {result ? <span className="text-sm text-[var(--primary)] font-medium">{result}</span> : <span />}
          <Button onClick={send} disabled={!canSend}>
            <Send size={15} /> {sending ? 'Yuborilmoqda…' : 'Yuborish'}
          </Button>
        </div>
      </div>
    </div>
  );
}
