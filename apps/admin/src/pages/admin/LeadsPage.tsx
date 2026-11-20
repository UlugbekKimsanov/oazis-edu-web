import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Clock3, Copy, Pencil, RefreshCw, Search, Trash2, UserRoundX, Users, X } from 'lucide-react';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import PageHeader from '../../components/ui/PageHeader';
import StatsCard from '../../components/ui/StatsCard';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States';
import api, { API_ORIGIN } from '../../lib/api';
import { apiErrorMessage } from '../../lib/errors';
import { formatDateTime, formatNumber } from '../../lib/format';
import { confirmDialog, toast } from '../../stores/ui-store';
import type { LandingLead, LeadStatus } from '../../lib/types';

// Bu endpointlar /api/v1 ostida emas — to'liq manzil bilan chaqiriladi.
const LANDING_LEADS_URL = `${API_ORIGIN.replace(/\/+$/, '')}/api/admin/landing/leads`;
// Backend: LeadUpdateRequest.rejectionReason @Size(max = 1000)
const REASON_MAX = 1000;

type Filter = 'ALL' | LeadStatus;

function unwrapApiData(value: unknown): unknown {
  if (value !== null && typeof value === 'object' && !Array.isArray(value) && 'data' in value) {
    return (value as { data?: unknown }).data;
  }
  return value;
}

const STATUSES: LeadStatus[] = ['NEW', 'PURCHASED', 'REJECTED'];

const statusLabel: Record<LeadStatus, string> = {
  NEW: "Yangi so'rov",
  PURCHASED: 'Kurs sotib olgan',
  REJECTED: 'Rad etilgan',
};

const statusClass: Record<LeadStatus, string> = {
  NEW: 'bg-blue-50 text-blue-700',
  PURCHASED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-red-50 text-red-700',
};

const FILTERS: [Filter, string][] = [
  ['ALL', 'Barchasi'],
  ['NEW', 'Yangi'],
  ['PURCHASED', 'Sotib olgan'],
  ['REJECTED', 'Rad etilgan'],
];

const leadName = (lead: LandingLead) => lead.name?.trim() || 'Ism kiritilmagan';
const digitsOf = (value: string) => value.replace(/\D/g, '');

export default function LeadsPage() {
  const [leads, setLeads] = useState<LandingLead[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');
  // Bir vaqtda bir nechta qator saqlanishi mumkin — har biri alohida bloklanadi
  const [busyIds, setBusyIds] = useState<Set<number>>(() => new Set());
  const [rejecting, setRejecting] = useState<LandingLead | null>(null);
  const [reason, setReason] = useState('');
  const [reasonSaving, setReasonSaving] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const response = await api.get(LANDING_LEADS_URL);
      if (id !== requestId.current) return; // eskirgan javob
      const payload = unwrapApiData(response.data);
      if (!Array.isArray(payload)) throw new Error('unexpected payload');
      setLeads(payload as LandingLead[]);
      setLoadError(null);
    } catch (err) {
      if (id !== requestId.current) return;
      setLoadError(apiErrorMessage(err, "So'rovlar ro'yxatini yuklab bo'lmadi."));
    } finally {
      if (id === requestId.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- birinchi yuklash; setState faqat javob kelgach chaqiriladi
    void load();
  }, [load]);

  const refresh = () => {
    setRefreshing(true);
    void load();
  };

  const setBusy = (id: number, busy: boolean) =>
    setBusyIds((current) => {
      const next = new Set(current);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });

  // Statistika ro'yxatning o'zidan hisoblanadi (ro'yxat to'liq keladi) — shuning uchun
  // holat o'zgarganda yoki o'chirilganda raqamlar hech qachon ro'yxatdan ajralib qolmaydi.
  const stats = useMemo(() => {
    const result = { total: 0, NEW: 0, PURCHASED: 0, REJECTED: 0 };
    for (const lead of leads ?? []) {
      result.total++;
      if (lead.status in result) result[lead.status]++;
    }
    return result;
  }, [leads]);

  const searched = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('uz');
    if (!query) return leads ?? [];
    const queryDigits = digitsOf(query);
    return (leads ?? []).filter((lead) => {
      const text = `${lead.name ?? ''} ${lead.phone ?? ''} ${lead.rejectionReason ?? ''}`.toLocaleLowerCase('uz');
      if (text.includes(query)) return true;
      // "901234567" yozilsa "+998 90 123-45-67" ham topilsin
      return queryDigits.length >= 3 && digitsOf(lead.phone ?? '').includes(queryDigits);
    });
  }, [leads, search]);

  const filterCounts = useMemo(() => {
    const counts: Record<Filter, number> = { ALL: searched.length, NEW: 0, PURCHASED: 0, REJECTED: 0 };
    for (const lead of searched) if (lead.status in counts) counts[lead.status]++;
    return counts;
  }, [searched]);

  const filtered = useMemo(
    () => (filter === 'ALL' ? searched : searched.filter((lead) => lead.status === filter)),
    [filter, searched],
  );

  /** Holatni saqlaydi. Muvaffaqiyatli bo'lsa true. */
  async function updateStatus(lead: LandingLead, status: LeadStatus, rejectionReason?: string): Promise<boolean> {
    setBusy(lead.id, true);
    try {
      const response = await api.patch(`${LANDING_LEADS_URL}/${lead.id}`, { status, rejectionReason });
      const updated = unwrapApiData(response.data) as LandingLead | null | undefined;
      if (updated && typeof updated === 'object' && updated.id === lead.id) {
        setLeads((items) => (items ?? []).map((item) => (item.id === lead.id ? updated : item)));
      } else {
        // Kutilmagan javob — haqiqiy holatni serverdan qayta o'qiymiz
        void load();
      }
      toast.success(
        status === lead.status ? 'Rad etish sababi saqlandi' : `${leadName(lead)}: holat «${statusLabel[status]}» ga o'zgartirildi`,
      );
      return true;
    } catch (err) {
      toast.error(apiErrorMessage(err, "Holatni saqlab bo'lmadi."));
      return false;
    } finally {
      setBusy(lead.id, false);
    }
  }

  async function onStatusChange(lead: LandingLead, status: LeadStatus) {
    if (status === lead.status) return;
    if (status === 'REJECTED') {
      openReject(lead);
      return;
    }
    // Rad etilgan so'rov boshqa holatga o'tsa backend sababni o'chiradi — ogohlantiramiz
    if (lead.status === 'REJECTED' && lead.rejectionReason) {
      const ok = await confirmDialog({
        title: "Holat o'zgartirilsinmi?",
        message: `${leadName(lead)} so'rovi «${statusLabel[status]}» holatiga o'tadi va yozilgan rad etish sababi o'chiriladi.`,
        confirmText: "O'zgartirish",
      });
      if (!ok) return;
    }
    await updateStatus(lead, status);
  }

  function openReject(lead: LandingLead) {
    setRejecting(lead);
    setReason(lead.rejectionReason ?? '');
  }

  function closeReject() {
    if (reasonSaving) return;
    setRejecting(null);
    setReason('');
  }

  async function submitReject(event: React.FormEvent) {
    event.preventDefault();
    const clean = reason.trim();
    if (!rejecting || reasonSaving || !clean) return;
    setReasonSaving(true);
    const ok = await updateStatus(rejecting, 'REJECTED', clean);
    setReasonSaving(false);
    if (ok) {
      setRejecting(null);
      setReason('');
    }
  }

  async function deleteLead(lead: LandingLead) {
    if (busyIds.has(lead.id)) return;
    const ok = await confirmDialog({
      title: "So'rov o'chirilsinmi?",
      message: `${leadName(lead)} (${lead.phone}) so'rovi butunlay o'chiriladi. Bu amalni qaytarib bo'lmaydi.`,
      danger: true,
    });
    if (!ok) return;
    setBusy(lead.id, true);
    try {
      await api.delete(`${LANDING_LEADS_URL}/${lead.id}`);
      setLeads((items) => (items ?? []).filter((item) => item.id !== lead.id));
      toast.success("So'rov o'chirildi");
    } catch (err) {
      toast.error(apiErrorMessage(err, "So'rovni o'chirib bo'lmadi."));
    } finally {
      setBusy(lead.id, false);
    }
  }

  async function copyPhone(phone: string) {
    try {
      await navigator.clipboard.writeText(phone);
      toast.success('Telefon raqami nusxalandi');
    } catch {
      toast.error("Nusxalab bo'lmadi. Raqamni qo'lda belgilab nusxalang.");
    }
  }

  const hasQuery = search.trim() !== '' || filter !== 'ALL';
  const resetFilters = () => {
    setSearch('');
    setFilter('ALL');
  };

  const cards: { label: string; value: number; icon: typeof Users; color: string; filter: Filter }[] = [
    { label: "Jami so'rovlar", value: stats.total, icon: Users, color: '#7C3AED', filter: 'ALL' },
    { label: "Yangi so'rovlar", value: stats.NEW, icon: Clock3, color: '#2563EB', filter: 'NEW' },
    { label: 'Kurs sotib olganlar', value: stats.PURCHASED, icon: CheckCircle2, color: '#059669', filter: 'PURCHASED' },
    { label: 'Rad etilganlar', value: stats.REJECTED, icon: UserRoundX, color: '#DC2626', filter: 'REJECTED' },
  ];

  return (
    <div>
      <PageHeader
        title="Yangi foydalanuvchilar"
        description="Landing sahifasi orqali qoldirilgan so'rovlar va sotuv natijalari."
        actions={
          <Button variant="secondary" onClick={refresh} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Yangilash
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {leads === null && !loadError
          ? cards.map((card) => (
              <div key={card.label} className="rounded-xl border border-gray-200 bg-white p-5">
                <Skeleton className="h-11 w-11 rounded-xl" />
                <Skeleton className="mt-4 h-7 w-16" />
                <Skeleton className="mt-2 h-4 w-28" />
              </div>
            ))
          : cards.map((card) => (
              <StatsCard
                key={card.label}
                title={card.label}
                value={leads === null ? '—' : formatNumber(card.value)}
                icon={card.icon}
                from={card.color}
                onClick={() => setFilter(card.filter)}
              />
            ))}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Holat bo'yicha filtr">
            {FILTERS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 ${
                  filter === value ? 'bg-[var(--primary)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label}
                {leads !== null && (
                  <span className={`ml-1.5 text-xs ${filter === value ? 'text-white/80' : 'text-gray-400'}`}>
                    {formatNumber(filterCounts[value])}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="relative w-full lg:w-72">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ism, telefon yoki sabab..."
              aria-label="So'rovlarni qidirish"
              className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-9 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 [&::-webkit-search-cancel-button]:hidden"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Qidiruvni tozalash"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Ro'yxat bor, lekin yangilash muvaffaqiyatsiz — eski ma'lumot ko'rinib turadi */}
        {loadError && leads !== null && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-2 border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            <span className="min-w-0 break-words">{loadError} Ko'rsatilayotgan ro'yxat eskirgan bo'lishi mumkin.</span>
            <Button variant="secondary" size="sm" onClick={refresh} loading={refreshing}>Qayta urinish</Button>
          </div>
        )}

        {leads === null ? (
          loadError ? (
            <ErrorState message={loadError} onRetry={refresh} />
          ) : (
            <div className="space-y-3 p-4" role="status" aria-label="Yuklanmoqda">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )
        ) : filtered.length === 0 ? (
          leads.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Hali so'rovlar yo'q"
              description="Landing sahifasida kimdir telefon raqamini qoldirsa, so'rov shu yerda paydo bo'ladi."
            />
          ) : (
            <EmptyState
              icon={Search}
              title="Mos so'rov topilmadi"
              description="Qidiruv so'zini yoki holat filtrini o'zgartirib ko'ring."
              action={hasQuery ? <Button variant="secondary" size="sm" onClick={resetFilters}>Filtrni tozalash</Button> : undefined}
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Foydalanuvchi</th>
                  <th className="px-4 py-3">Telefon</th>
                  <th className="px-4 py-3">So'rov sanasi</th>
                  <th className="px-4 py-3">Holat</th>
                  <th className="px-4 py-3">Rad etish sababi</th>
                  <th className="px-4 py-3 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((lead) => {
                  const busy = busyIds.has(lead.id);
                  const phone = lead.phone ?? '';
                  return (
                    <tr key={lead.id} className={`align-top hover:bg-gray-50/70 ${busy ? 'opacity-60' : ''}`}>
                      <td className="max-w-[220px] px-4 py-4 font-medium text-gray-900">
                        <span className={`block truncate ${lead.name?.trim() ? '' : 'font-normal text-gray-400'}`} title={leadName(lead)}>
                          {leadName(lead)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4">
                        <span className="inline-flex items-center gap-1">
                          <a className="text-[var(--primary)] hover:underline" href={`tel:${phone.replace(/[^\d+]/g, '')}`}>{phone}</a>
                          <button
                            type="button"
                            onClick={() => void copyPhone(phone)}
                            title="Raqamni nusxalash"
                            aria-label={`${phone} raqamini nusxalash`}
                            className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                          >
                            <Copy size={14} />
                          </button>
                        </span>
                      </td>
                      <td
                        className="whitespace-nowrap px-4 py-4 text-gray-500"
                        title={lead.updatedAt && lead.updatedAt !== lead.createdAt ? `Oxirgi o'zgarish: ${formatDateTime(lead.updatedAt)}` : undefined}
                      >
                        {formatDateTime(lead.createdAt)}
                      </td>
                      <td className="px-4 py-4">
                        <select
                          value={lead.status}
                          disabled={busy}
                          aria-label={`${leadName(lead)} holati`}
                          onChange={(event) => void onStatusChange(lead, event.target.value as LeadStatus)}
                          className={`rounded-lg border-0 px-3 py-2 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 disabled:cursor-not-allowed ${statusClass[lead.status] ?? 'bg-gray-100 text-gray-700'}`}
                        >
                          {STATUSES.map((status) => <option key={status} value={status}>{statusLabel[status]}</option>)}
                        </select>
                      </td>
                      <td className="max-w-[280px] px-4 py-4 text-gray-600">
                        {lead.status === 'REJECTED' ? (
                          <div className="flex items-start gap-1">
                            <span className="line-clamp-3 min-w-0 whitespace-pre-line break-words" title={lead.rejectionReason ?? undefined}>
                              {lead.rejectionReason || '—'}
                            </span>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => openReject(lead)}
                              title="Sababni tahrirlash"
                              aria-label="Rad etish sababini tahrirlash"
                              className="shrink-0 rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
                            >
                              <Pencil size={13} />
                            </button>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          title="So'rovni o'chirish"
                          aria-label={`${leadName(lead)} so'rovini o'chirish`}
                          disabled={busy}
                          onClick={() => void deleteLead(lead)}
                          className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {leads !== null && filtered.length > 0 && (
          <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-400">
            {formatNumber(filtered.length)} ta so'rov ko'rsatilmoqda{hasQuery ? ` (jami ${formatNumber(leads.length)} tadan)` : ''}
          </div>
        )}
      </div>

      <Modal
        open={rejecting !== null}
        onClose={closeReject}
        title="So'rovni rad etish"
        maxWidth="max-w-md"
        closeDisabled={reasonSaving}
      >
        {rejecting && (
          <form onSubmit={submitReject} className="space-y-4">
            <p className="break-words text-sm text-gray-600">
              <span className="font-medium text-gray-900">{leadName(rejecting)}</span> · {rejecting.phone}
            </p>
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label htmlFor="lead-reject-reason" className="block text-sm font-medium text-gray-700">
                  Rad etish sababi <span className="text-red-500">*</span>
                </label>
                <span className="text-xs text-gray-400">{reason.length}/{REASON_MAX}</span>
              </div>
              <textarea
                id="lead-reject-reason"
                autoFocus
                required
                rows={4}
                maxLength={REASON_MAX}
                value={reason}
                disabled={reasonSaving}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Masalan: narx to'g'ri kelmadi, telefonga javob bermadi..."
                className="w-full rounded-lg border border-gray-200 p-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 disabled:bg-gray-50"
              />
              <p className="mt-1 text-xs text-gray-400">Sabab majburiy — keyinroq tahlil qilish uchun saqlanadi.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={closeReject} disabled={reasonSaving}>Bekor qilish</Button>
              <Button type="submit" variant="danger" loading={reasonSaving} disabled={!reason.trim()}>
                {rejecting.status === 'REJECTED' ? 'Saqlash' : 'Rad etish'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
