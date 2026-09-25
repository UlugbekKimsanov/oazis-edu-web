import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, RefreshCw, Search, Trash2, UserRoundX, Users } from 'lucide-react';
import Button from '../../components/ui/Button';
import api, { API_ORIGIN } from '../../lib/api';
import type { LandingLead, LeadStats, LeadStatus } from '../../lib/types';

const LANDING_LEADS_URL = `${API_ORIGIN.replace(/\/+$/, '')}/api/admin/landing/leads`;
const EMPTY_STATS: LeadStats = { total: 0, newRequests: 0, purchased: 0, rejected: 0 };

function unwrapApiData(value: unknown): unknown {
  if (value !== null && typeof value === 'object' && !Array.isArray(value) && 'data' in value) {
    return (value as { data?: unknown }).data;
  }
  return value;
}

async function requestLeadData(signal?: AbortSignal): Promise<{
  leads: LandingLead[];
  stats: LeadStats;
}> {
  const [leadsResponse, statsResponse] = await Promise.all([
    api.get(LANDING_LEADS_URL, { signal }),
    api.get(`${LANDING_LEADS_URL}/stats`, { signal }),
  ]);

  const leadsPayload = unwrapApiData(leadsResponse.data);
  const statsPayload = unwrapApiData(statsResponse.data);
  return {
    leads: Array.isArray(leadsPayload) ? (leadsPayload as LandingLead[]) : [],
    stats:
      statsPayload !== null && typeof statsPayload === 'object'
        ? (statsPayload as LeadStats)
        : { ...EMPTY_STATS },
  };
}

const statusLabel: Record<LeadStatus, string> = {
  NEW: 'Yangi request',
  PURCHASED: 'Kurs sotib olgan',
  REJECTED: 'Rad etilgan',
};

const statusClass: Record<LeadStatus, string> = {
  NEW: 'bg-blue-50 text-blue-700',
  PURCHASED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-red-50 text-red-700',
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<LandingLead[]>([]);
  const [stats, setStats] = useState<LeadStats>(() => ({ ...EMPTY_STATS }));
  const [filter, setFilter] = useState<'ALL' | LeadStatus>('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await requestLeadData();
      setLeads(data.leads);
      setStats(data.stats);
    } catch {
      setError("Ma'lumotlarni yuklab bo'lmadi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void requestLeadData(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setLeads(data.leads);
        setStats(data.stats);
        setError('');
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("Ma'lumotlarni yuklab bo'lmadi.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('uz');
    return leads.filter((lead) => {
      if (filter !== 'ALL' && lead.status !== filter) return false;
      if (!query) return true;
      return `${lead.name ?? ''} ${lead.phone} ${lead.rejectionReason ?? ''}`
        .toLocaleLowerCase('uz')
        .includes(query);
    });
  }, [filter, leads, search]);

  async function updateStatus(lead: LandingLead, status: LeadStatus, rejectionReason?: string) {
    setSavingId(lead.id);
    setError('');
    try {
      const response = await api.patch(
        `${LANDING_LEADS_URL}/${lead.id}`,
        { status, rejectionReason },
      );
      const updated = (response.data?.data ?? response.data) as LandingLead;
      setLeads((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      setStats((current) => {
        const next = { ...current };
        if (lead.status === 'NEW') next.newRequests--;
        if (lead.status === 'PURCHASED') next.purchased--;
        if (lead.status === 'REJECTED') next.rejected--;
        if (updated.status === 'NEW') next.newRequests++;
        if (updated.status === 'PURCHASED') next.purchased++;
        if (updated.status === 'REJECTED') next.rejected++;
        return next;
      });
      setRejectingId(null);
      setReason('');
    } catch {
      setError("Holatni saqlab bo'lmadi.");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteLead(lead: LandingLead) {
    setSavingId(lead.id);
    setError('');
    try {
      await api.delete(`${LANDING_LEADS_URL}/${lead.id}`);
      setLeads((items) => items.filter((item) => item.id !== lead.id));
      setStats((current) => {
        const next = { ...current, total: Math.max(0, current.total - 1) };
        if (lead.status === 'NEW') next.newRequests = Math.max(0, next.newRequests - 1);
        if (lead.status === 'PURCHASED') next.purchased = Math.max(0, next.purchased - 1);
        if (lead.status === 'REJECTED') next.rejected = Math.max(0, next.rejected - 1);
        return next;
      });
      setDeletingId(null);
    } catch {
      setError("Zayavkani o'chirib bo'lmadi.");
    } finally {
      setSavingId(null);
    }
  }

  function onStatusChange(lead: LandingLead, status: LeadStatus) {
    if (status === 'REJECTED') {
      setRejectingId(lead.id);
      setReason(lead.rejectionReason ?? '');
      return;
    }
    updateStatus(lead, status);
  }

  const cards = [
    { label: 'Jami requestlar', value: stats.total, icon: Users, color: 'bg-violet-50 text-violet-700' },
    { label: 'Yangi requestlar', value: stats.newRequests, icon: Clock3, color: 'bg-blue-50 text-blue-700' },
    { label: 'Kurs sotib olganlar', value: stats.purchased, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-700' },
    { label: 'Rad etilganlar', value: stats.rejected, icon: UserRoundX, color: 'bg-red-50 text-red-700' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Yangi foydalanuvchilar</h1>
          <p className="mt-1 text-sm text-gray-500">Landing orqali kelgan requestlar va sotuv natijalari.</p>
        </div>
        <Button variant="secondary" onClick={load} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Yangilash
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-5">
            <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
              <Icon size={20} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="mt-1 text-sm text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {([
              ['ALL', 'Barchasi'],
              ['NEW', 'Yangi'],
              ['PURCHASED', 'Sotib olgan'],
              ['REJECTED', 'Rad etilgan'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  filter === value ? 'bg-[var(--primary)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="relative block w-full lg:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ism yoki telefon..."
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--primary)]"
            />
          </label>
        </div>

        {error && <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Foydalanuvchi</th>
                <th className="px-4 py-3">Telefon</th>
                <th className="px-4 py-3">Request sanasi</th>
                <th className="px-4 py-3">Holat</th>
                <th className="px-4 py-3">Rad etish sababi</th>
                <th className="px-4 py-3 text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((lead) => (
                <tr key={lead.id} className="align-top hover:bg-gray-50/70">
                  <td className="px-4 py-4 font-medium text-gray-900">{lead.name || 'Ism kiritilmagan'}</td>
                  <td className="px-4 py-4"><a className="text-[var(--primary)] hover:underline" href={`tel:${lead.phone.replace(/\s/g, '')}`}>{lead.phone}</a></td>
                  <td className="px-4 py-4 text-gray-500">{new Date(lead.createdAt).toLocaleString('uz-UZ')}</td>
                  <td className="px-4 py-4">
                    <select
                      value={lead.status}
                      disabled={savingId === lead.id}
                      onChange={(event) => onStatusChange(lead, event.target.value as LeadStatus)}
                      className={`rounded-lg border-0 px-3 py-2 text-xs font-semibold outline-none ${statusClass[lead.status]}`}
                    >
                      {(Object.keys(statusLabel) as LeadStatus[]).map((status) => <option key={status} value={status}>{statusLabel[status]}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-4 text-gray-600">
                    {rejectingId === lead.id ? (
                      <div className="w-72 space-y-2">
                        <textarea
                          autoFocus
                          rows={2}
                          maxLength={1000}
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                          placeholder="Rad etish sababini kiriting..."
                          className="w-full rounded-lg border border-gray-200 p-2 text-sm outline-none focus:border-red-400"
                        />
                        <div className="flex gap-2">
                          <button disabled={!reason.trim() || savingId === lead.id} onClick={() => updateStatus(lead, 'REJECTED', reason.trim())} className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Saqlash</button>
                          <button onClick={() => { setRejectingId(null); setReason(''); }} className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600">Bekor qilish</button>
                        </div>
                      </div>
                    ) : lead.rejectionReason ? lead.rejectionReason : '—'}
                  </td>
                  <td className="px-4 py-4 text-right">
                    {deletingId === lead.id ? (
                      <div className="inline-flex items-center gap-2">
                        <span className="text-xs text-gray-500">O'chirilsinmi?</span>
                        <button
                          disabled={savingId === lead.id}
                          onClick={() => deleteLead(lead)}
                          className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          Ha
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600"
                        >
                          Yo'q
                        </button>
                      </div>
                    ) : (
                      <button
                        title="Zayavkani o'chirish"
                        disabled={savingId === lead.id}
                        onClick={() => setDeletingId(lead.id)}
                        className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length === 0 && <div className="py-14 text-center text-sm text-gray-400">Requestlar topilmadi.</div>}
        {loading && <div className="py-14 text-center text-sm text-gray-400">Yuklanmoqda...</div>}
      </div>
    </div>
  );
}
