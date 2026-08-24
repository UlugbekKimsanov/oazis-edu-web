import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Image as ImageIcon } from 'lucide-react';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import api, { fileUrl } from '../../lib/api';
import type { Book, Language } from '../../lib/types';

// Kitoblar uchun emojilar (tanlash uchun)
const BOOK_EMOJIS = [
  '📚', '📖', '📕', '📗', '📘', '📙', '📔', '📓', '📒',
];

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]';

export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Book | null>(null);
  const [uploading, setUploading] = useState(false);
  // Yaratishda tanlangan (hali yuklanmagan) muqova rasmi
  const [pendingCover, setPendingCover] = useState<File | null>(null);
  const [pendingCoverUrl, setPendingCoverUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '', author: '', category: 'digital' as 'digital' | 'print',
    description: '', price: 0, isFree: false, emoji: '📚', pages: '', language: '',
    deliveryType: 'FREE' as 'FREE' | 'NEGOTIABLE' | 'PAID', deliveryPrice: 0,
  });


  const fetchBooks = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/books');
      setBooks(res.data.data ?? res.data ?? []);
    } catch { setBooks([]); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchBooks();
    api.get('/admin/languages').then((r) => setLanguages(r.data.data ?? r.data ?? [])).catch(() => {});
  }, []);

  const filtered = books.filter((b) => `${b.title} ${b.author}`.toLowerCase().includes(search.toLowerCase()));

  const clearPendingCover = () => {
    if (pendingCoverUrl) URL.revokeObjectURL(pendingCoverUrl);
    setPendingCover(null);
    setPendingCoverUrl(null);
  };

  const openCreate = () => {
    setEditItem(null);
    clearPendingCover();
    setForm({ title: '', author: '', category: 'digital', description: '', price: 0, isFree: false, emoji: '📚', pages: '', language: languages[0]?.name || '', deliveryType: 'FREE', deliveryPrice: 0 });
    setModalOpen(true);
  };

  const openEdit = (item: Book) => {
    setEditItem(item);
    clearPendingCover();
    setForm({
      title: item.title, author: item.author, category: item.category,
      description: item.description || '', price: item.price, isFree: item.isFree,
      emoji: item.emoji, pages: item.pages || '', language: item.language || '',
      deliveryType: item.deliveryType || 'FREE', deliveryPrice: item.deliveryPrice || 0,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      // Yetkazib berish faqat bosma kitoblar uchun; narx faqat 'PAID' bo'lsa
      const isPrint = form.category === 'print';
      const payload = {
        ...form,
        priceLabel: form.isFree ? 'Bepul' : `${form.price.toLocaleString()} so'm`,
        deliveryType: isPrint ? form.deliveryType : null,
        deliveryPrice: isPrint && form.deliveryType === 'PAID' ? form.deliveryPrice : null,
      };
      if (editItem) {
        await api.put(`/admin/books/${editItem.id}`, payload);
      } else {
        const res = await api.post('/admin/books', payload);
        const created: Book = res.data.data ?? res.data;
        // Yaratishda rasm tanlangan bo'lsa — yangi kitob id'siga yuklaymiz
        if (pendingCover && created?.id) {
          const fd = new FormData();
          fd.append('file', pendingCover);
          await api.post(`/admin/books/${created.id}/upload-cover`, fd).catch(() => {});
        }
      }
      clearPendingCover();
      setModalOpen(false);
      fetchBooks();
    } catch { /* handled silently */ }
  };

  // Tahrirlashda — darhol yuklash
  const uploadCover = async (file: File) => {
    if (!editItem) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post(`/admin/books/${editItem.id}/upload-cover`, fd);
      const updated: Book = res.data.data ?? res.data;
      setEditItem(updated);
      fetchBooks();
    } catch { /* ignore */ } finally {
      setUploading(false);
    }
  };

  // Yaratishda — faqat tanlash (preview), yuklash saqlashda bo'ladi
  const pickPendingCover = (file: File) => {
    if (pendingCoverUrl) URL.revokeObjectURL(pendingCoverUrl);
    setPendingCover(file);
    setPendingCoverUrl(URL.createObjectURL(file));
  };

  const handleDelete = async (id: number) => {
    if (!confirm("O'chirishni tasdiqlaysizmi?")) return;
    await api.delete(`/admin/books/${id}`);
    fetchBooks();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kutubxona</h1>
          <p className="text-sm text-gray-500 mt-1">Elektron va bosma kitoblarni boshqarish</p>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Yangi kitob</Button>
      </div>

      <DataTable
        columns={[
          { key: 'cover', label: '', width: '52px', render: (b) => (
            b.coverUrl
              ? <img src={fileUrl(b.coverUrl)} alt="" className="w-9 h-12 object-cover rounded" />
              : <span className="text-xl">{b.emoji}</span>
          )},
          { key: 'title', label: 'Nomi', render: (b) => (
            <div>
              <p className="font-medium">{b.title}</p>
              <p className="text-xs text-gray-500">{b.author}</p>
            </div>
          )},
          { key: 'category', label: 'Turi', render: (b) => (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${b.category === 'digital' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
              {b.category === 'digital' ? 'Elektron' : 'Bosma'}
            </span>
          )},
          { key: 'price', label: 'Narx', render: (b) => b.isFree ? <span className="text-green-600 font-medium">Bepul</span> : `${b.price.toLocaleString()} so'm` },
          { key: 'rating', label: 'Reyting', render: (b) => <span>⭐ {b.rating?.toFixed?.(1) ?? b.rating} <span className="text-xs text-gray-400">({b.reviewCount ?? 0})</span></span> },
        ]}
        data={filtered}
        searchValue={search}
        onSearchChange={setSearch}
        loading={loading}
        actions={(b) => (
          <>
            <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"><Pencil size={14} /></button>
            <button onClick={() => handleDelete(b.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
          </>
        )}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? "Kitobni tahrirlash" : "Yangi kitob"} maxWidth="max-w-xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nomi</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Muallif</label>
              <input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tavsif</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className={inputCls} />
          </div>

          {/* Emoji picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Emoji</label>
            <div className="flex flex-wrap gap-1.5 p-2 border border-gray-200 rounded-lg max-h-28 overflow-y-auto">
              {BOOK_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setForm({ ...form, emoji: em })}
                  className={
                    'w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-colors ' +
                    (form.emoji === em ? 'bg-[var(--primary)]/15 ring-2 ring-[var(--primary)]' : 'hover:bg-gray-100')
                  }
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Turi</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as 'digital' | 'print' })} className={inputCls}>
                <option value="digital">Elektron</option>
                <option value="print">Bosma</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sahifalar</label>
              <input value={form.pages} onChange={(e) => setForm({ ...form, pages: e.target.value })} className={inputCls} placeholder="380 bet" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Til</label>
              <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} className={inputCls}>
                <option value="">— Tanlang —</option>
                {languages.map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Narx (so'm)</label>
              <input type="number" value={form.price} disabled={form.isFree} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className={inputCls + (form.isFree ? ' opacity-50' : '')} />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isFree} onChange={(e) => setForm({ ...form, isFree: e.target.checked, price: e.target.checked ? 0 : form.price })} className="w-4 h-4 rounded" />
                <span className="text-sm text-gray-700">Bepul</span>
              </label>
            </div>
          </div>

          {/* Yetkazib berish — faqat bosma kitoblar uchun */}
          {form.category === 'print' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">📦 Yetkazib berish</label>
              <div className="grid grid-cols-2 gap-4">
                <select value={form.deliveryType}
                  onChange={(e) => setForm({ ...form, deliveryType: e.target.value as 'FREE' | 'NEGOTIABLE' | 'PAID' })}
                  className={inputCls}>
                  <option value="FREE">Bepul</option>
                  <option value="NEGOTIABLE">Kelishiladi</option>
                  <option value="PAID">Pullik</option>
                </select>
                {form.deliveryType === 'PAID' && (
                  <input type="number" min={0} value={form.deliveryPrice}
                    onChange={(e) => setForm({ ...form, deliveryPrice: Number(e.target.value) })}
                    className={inputCls} placeholder="Yetkazib berish narxi (so'm)" />
                )}
              </div>
              {form.deliveryType === 'PAID' && form.deliveryPrice > 0 && (
                <p className="text-xs text-gray-500 mt-1">To'lovда umumiy summaga qo'shiladi: +{form.deliveryPrice.toLocaleString()} so'm</p>
              )}
            </div>
          )}

          {/* Muqova rasmi (ixtiyoriy) — yaratishda ham, tahrirlashda ham */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Muqova rasmi (ixtiyoriy)</label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-20 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center shrink-0">
                {editItem?.coverUrl
                  ? <img src={fileUrl(editItem.coverUrl)} alt="" className="w-full h-full object-cover" />
                  : pendingCoverUrl
                      ? <img src={pendingCoverUrl} alt="" className="w-full h-full object-cover" />
                      : <span className="text-2xl">{form.emoji}</span>}
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-[var(--primary)] cursor-pointer hover:underline">
                <ImageIcon size={15} /> {uploading ? 'Yuklanmoqda…' : 'Rasm tanlash'}
                <input type="file" accept="image/*" className="hidden" disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (editItem) uploadCover(f); else pickPendingCover(f);
                  }} />
              </label>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {editItem ? "Yuklansa, foydalanuvchi kitob tafsilotida shu rasmni ko'radi." : "Saqlanganda rasm ham yuklanadi."}
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{editItem ? 'Yopish' : 'Bekor qilish'}</Button>
            <Button onClick={handleSave}>{editItem ? 'Saqlash' : 'Yaratish'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
