import { useEffect, useState } from 'react';
import { Plus, Trash2, Save, LayoutTemplate, Users } from 'lucide-react';
import Button from '../../components/ui/Button';
import DataTable from '../../components/ui/DataTable';
import api from '../../lib/api';
import type {
  LandingContent,
  LandingLead,
  LandingTitleDesc,
} from '../../lib/types';

// Landing endpointlari /api/... ostida (asosiy `api` baseURL /api/v1).
// Shu sabab har so'rovda baseURL'ni '/api' ga override qilamiz —
// token interceptor (api.ts) baribir ishlaydi, qo'lda header qo'shmaymiz.
const LANDING_CFG = { baseURL: '/api' } as const;

const EMPTY_CONTENT: LandingContent = {
  stats: [],
  features: [],
  courseInfo: [],
  goals: [],
  testimonials: [],
  courses: [],
  bonusText: '',
  contacts: { phone: '', telegram: '', instagram: '', youtube: '' },
};

type TabKey = 'content' | 'leads';

export default function LandingPage() {
  const [tab, setTab] = useState<TabKey>('content');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Landing</h1>
        <p className="text-sm text-gray-500 mt-1">
          Oazis marketing sahifasi kontenti va ro'yxatdan o'tgan leadlar.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <TabButton
          active={tab === 'content'}
          onClick={() => setTab('content')}
          icon={<LayoutTemplate size={16} />}
          label="Kontent"
        />
        <TabButton
          active={tab === 'leads'}
          onClick={() => setTab('leads')}
          icon={<Users size={16} />}
          label="Ro'yxatdan o'tganlar"
        />
      </div>

      {tab === 'content' ? <ContentTab /> : <LeadsTab />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={
        'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ' +
        (active
          ? 'border-[var(--primary)] text-[var(--primary)]'
          : 'border-transparent text-gray-500 hover:text-gray-800')
      }
    >
      {icon}
      {label}
    </button>
  );
}

/* ============================ KONTENT TAB ============================ */

function ContentTab() {
  const [content, setContent] = useState<LandingContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchContent = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get('/landing', LANDING_CFG);
      const data = (res.data?.data ?? res.data) as Partial<LandingContent>;
      // Bo'sh/yetishmagan maydonlarni default bilan to'ldiramiz.
      setContent({ ...EMPTY_CONTENT, ...data, contacts: { ...EMPTY_CONTENT.contacts, ...data?.contacts } });
    } catch {
      setError(true);
      setContent(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContent();
  }, []);

  const save = async () => {
    if (!content) return;
    setSaving(true);
    setMessage(null);
    try {
      await api.put('/admin/landing/content', content, LANDING_CFG);
      setMessage({ type: 'success', text: 'Kontent muvaffaqiyatli saqlandi' });
    } catch {
      setMessage({ type: 'error', text: 'Saqlashda xatolik yuz berdi' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-16 text-gray-400">Yuklanmoqda...</div>;
  }

  if (error || !content) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 mb-4">Kontentni yuklab bo'lmadi.</p>
        <Button variant="secondary" onClick={fetchContent}>
          Qayta urinish
        </Button>
      </div>
    );
  }

  // Yordamchi setter — content ichidagi bitta maydonni yangilaydi.
  const patch = (p: Partial<LandingContent>) => setContent((c) => (c ? { ...c, ...p } : c));

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Stats */}
      <Section
        title="Statistika"
        description="Sahifadagi raqamlar (masalan: O'quvchilar / 5000+)."
      >
        <ListEditor
          items={content.stats}
          onChange={(stats) => patch({ stats })}
          empty={{ label: '', value: '' }}
          addLabel="Statistika qo'shish"
          renderRow={(item, update) => (
            <>
              <Field
                placeholder="Nomi (label)"
                value={item.label}
                onChange={(label) => update({ label })}
              />
              <Field
                placeholder="Qiymati (value)"
                value={item.value}
                onChange={(value) => update({ value })}
              />
            </>
          )}
        />
      </Section>

      {/* Features */}
      <TitleDescSection
        title="Imkoniyatlar (Features)"
        items={content.features}
        onChange={(features) => patch({ features })}
      />

      {/* Course info */}
      <TitleDescSection
        title="Kurs haqida (Course info)"
        items={content.courseInfo}
        onChange={(courseInfo) => patch({ courseInfo })}
      />

      {/* Goals */}
      <TitleDescSection
        title="Maqsadlar (Goals)"
        items={content.goals}
        onChange={(goals) => patch({ goals })}
      />

      {/* Testimonials */}
      <Section title="Sharhlar (Testimonials)" description="Video sharhlar.">
        <ListEditor
          items={content.testimonials}
          onChange={(testimonials) => patch({ testimonials })}
          empty={{ name: '', videoUrl: '' }}
          addLabel="Sharh qo'shish"
          renderRow={(item, update) => (
            <>
              <Field placeholder="Ism" value={item.name} onChange={(name) => update({ name })} />
              <Field
                placeholder="Video URL"
                value={item.videoUrl}
                onChange={(videoUrl) => update({ videoUrl })}
              />
            </>
          )}
        />
      </Section>

      {/* Courses */}
      <Section title="Kurslar" description="Sahifada ko'rsatiladigan kurslar kartochkalari.">
        <ListEditor
          items={content.courses}
          onChange={(courses) => patch({ courses })}
          empty={{ flag: '', title: '', students: 0, price: '', rating: 0 }}
          addLabel="Kurs qo'shish"
          renderRow={(item, update) => (
            <>
              <Field
                placeholder="🏳️"
                value={item.flag}
                onChange={(flag) => update({ flag })}
                className="w-16"
              />
              <Field placeholder="Nomi" value={item.title} onChange={(title) => update({ title })} />
              <Field
                placeholder="O'quvchilar"
                type="number"
                value={String(item.students ?? '')}
                onChange={(v) => update({ students: Number(v) || 0 })}
                className="w-28"
              />
              <Field
                placeholder="Narx"
                value={item.price}
                onChange={(price) => update({ price })}
                className="w-28"
              />
              <Field
                placeholder="Reyting"
                type="number"
                value={String(item.rating ?? '')}
                onChange={(v) => update({ rating: Number(v) || 0 })}
                className="w-24"
              />
            </>
          )}
        />
      </Section>

      {/* Bonus text */}
      <Section title="Bonus matni">
        <textarea
          value={content.bonusText}
          onChange={(e) => patch({ bonusText: e.target.value })}
          rows={3}
          placeholder="Bonus haqida matn..."
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
        />
      </Section>

      {/* Contacts */}
      <Section title="Aloqa (Contacts)">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Labeled label="Telefon">
            <Field
              value={content.contacts.phone}
              onChange={(phone) => patch({ contacts: { ...content.contacts, phone } })}
              placeholder="+998 ..."
            />
          </Labeled>
          <Labeled label="Telegram">
            <Field
              value={content.contacts.telegram}
              onChange={(telegram) => patch({ contacts: { ...content.contacts, telegram } })}
              placeholder="@username"
            />
          </Labeled>
          <Labeled label="Instagram">
            <Field
              value={content.contacts.instagram}
              onChange={(instagram) => patch({ contacts: { ...content.contacts, instagram } })}
              placeholder="@username"
            />
          </Labeled>
          <Labeled label="YouTube">
            <Field
              value={content.contacts.youtube}
              onChange={(youtube) => patch({ contacts: { ...content.contacts, youtube } })}
              placeholder="URL"
            />
          </Labeled>
        </div>
      </Section>

      {/* Save bar */}
      <div className="sticky bottom-0 bg-white/90 backdrop-blur border-t border-gray-200 py-3 flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          <Save size={16} />
          {saving ? 'Saqlanmoqda...' : 'Saqlash'}
        </Button>
        {message && (
          <span
            className={
              'text-sm font-medium ' +
              (message.type === 'success' ? 'text-green-600' : 'text-red-600')
            }
          >
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}

/* ============================ LEADS TAB ============================ */

function LeadsTab() {
  const [leads, setLeads] = useState<LandingLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchLeads = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get('/admin/landing/leads', LANDING_CFG);
      setLeads((res.data?.data ?? res.data ?? []) as LandingLead[]);
    } catch {
      setError(true);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 mb-4">Leadlarni yuklab bo'lmadi.</p>
        <Button variant="secondary" onClick={fetchLeads}>
          Qayta urinish
        </Button>
      </div>
    );
  }

  const fmtDate = (iso: string) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('uz-UZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-500">Jami: {leads.length}</span>
      </div>
      <DataTable<LandingLead>
        columns={[
          { key: 'name', label: 'Ism', render: (l) => <span className="font-medium">{l.name || '—'}</span> },
          { key: 'phone', label: 'Telefon' },
          { key: 'createdAt', label: 'Sana', render: (l) => fmtDate(l.createdAt) },
        ]}
        data={leads}
        loading={loading}
      />
    </div>
  );
}

/* ============================ Yordamchi komponentlar ============================ */

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-500 mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function Field({
  value,
  onChange,
  placeholder,
  type = 'text',
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={
        'flex-1 min-w-0 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] ' +
        className
      }
    />
  );
}

// Umumiy title/description ro'yxati bo'limi.
function TitleDescSection({
  title,
  items,
  onChange,
}: {
  title: string;
  items: LandingTitleDesc[];
  onChange: (items: LandingTitleDesc[]) => void;
}) {
  return (
    <Section title={title}>
      <ListEditor
        items={items}
        onChange={onChange}
        empty={{ title: '', description: '' }}
        addLabel="Qo'shish"
        renderRow={(item, update) => (
          <>
            <Field placeholder="Sarlavha" value={item.title} onChange={(t) => update({ title: t })} />
            <Field
              placeholder="Tavsif"
              value={item.description}
              onChange={(d) => update({ description: d })}
            />
          </>
        )}
      />
    </Section>
  );
}

// Umumiy ro'yxat muharriri: qo'shish/o'chirish + har element uchun qatorni chizadi.
function ListEditor<T>({
  items,
  onChange,
  empty,
  addLabel,
  renderRow,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  empty: T;
  addLabel: string;
  renderRow: (item: T, update: (patch: Partial<T>) => void) => React.ReactNode;
}) {
  const updateAt = (index: number, patch: Partial<T>) => {
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };
  const removeAt = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };
  const add = () => onChange([...items, { ...empty }]);

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          {renderRow(item, (patch) => updateAt(i, patch))}
          <button
            onClick={() => removeAt(i)}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
            title="O'chirish"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <Button variant="secondary" size="sm" onClick={add}>
        <Plus size={14} />
        {addLabel}
      </Button>
    </div>
  );
}
