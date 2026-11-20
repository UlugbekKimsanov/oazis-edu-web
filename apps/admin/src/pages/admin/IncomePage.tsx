import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, RefreshCw, TrendingUp, X } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import DataTable from '../../components/ui/DataTable';
import { Skeleton } from '../../components/ui/States';
import api from '../../lib/api';
import { apiErrorMessage } from '../../lib/errors';
import { formatDateTime, formatMoney, formatNumber, parseServerDate } from '../../lib/format';
import { toast } from '../../stores/ui-store';

/** Backend: GET /admin/income — kitob savdolari (sale_records) + to'langan buyurtmalar (orders). */
interface IncomeItem {
  who?: string | null;
  operator?: string | null;
  product?: string | null;
  productType?: string | null; // COURSE | BOOK
  amount?: number | null;
  createdAt?: string | null; // zonasiz UTC
}

interface IncomeRow {
  /** Backend id bermaydi — yuklangan ro'yxatdagi tartib raqami (filtrda o'zgarmaydi) */
  id: number;
  who: string;
  product: string;
  type: 'COURSE' | 'BOOK';
  /** Normallashtirilgan operator kodi ('' — ko'rsatilmagan) */
  op: string;
  amount: number;
  createdAt: string | null;
  /** Mahalliy kun "2026-11-12" — sana filtri uchun ('' — sana yo'q) */
  day: string;
}

const PAGE_SIZE = 25;

const OPERATORS: Record<string, string> = {
  click: 'Click',
  payme: 'Payme',
  paynet: 'Paynet',
  uzumnasiya: 'Uzum Nasiya',
  alifnasiya: 'Alif Nasiya',
  card: 'Karta',
  free: 'Bepul',
};

const TYPE_LABEL: Record<IncomeRow['type'], string> = { COURSE: 'Kurs', BOOK: 'Kitob' };

/** "Uzum Nasiya" / "uzumnasiya" / "CLICK" — bitta kodga keltiriladi. */
function opCode(raw?: string | null): string {
  return (raw ?? '').toLowerCase().replace(/[\s_-]+/g, '');
}

function opName(code: string): string {
  if (!code) return '—';
  return OPERATORS[code] ?? code;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Mahalliy (brauzer) kun: 2026-11-12 — <input type="date"> qiymati bilan bir xil format. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toRows(list: IncomeItem[]): IncomeRow[] {
  return list.map((i, idx) => {
    const d = parseServerDate(i.createdAt);
    const amount = Number(i.amount ?? 0);
    return {
      id: idx,
      who: (i.who ?? '').trim() || "Noma'lum",
      product: (i.product ?? '').trim(),
      type: String(i.productType ?? '').toUpperCase() === 'COURSE' ? 'COURSE' : 'BOOK',
      op: opCode(i.operator),
      amount: Number.isFinite(amount) ? amount : 0,
      createdAt: i.createdAt ?? null,
      day: d ? dayKey(d) : '',
    };
  });
}

/** CSV katagi: qo'shtirnoq ichida; formula sifatida ochilmasligi uchun =,+,-,@ oldiga ' qo'yiladi. */
function csvCell(value: string): string {
  const s = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${s.replace(/"/g, '""')}"`;
}

function downloadCsv(rows: IncomeRow[]) {
  // Ajratgich ";" — Excel (ru/uz mintaqa sozlamasi) ustunlarga to'g'ri bo'ladi.
  const lines = [
    ['Sana', 'Kim', 'Mahsulot', 'Turi', 'Operator', "Summa (so'm)"].map(csvCell).join(';'),
    ...rows.map((r) =>
      [
        csvCell(formatDateTime(r.createdAt, '').replace(',', '')),
        csvCell(r.who),
        csvCell(r.product),
        csvCell(TYPE_LABEL[r.type]),
        csvCell(r.op ? opName(r.op) : ''),
        String(Math.round(r.amount)),
      ].join(';'),
    ),
  ];
  // BOM — Excel faylni UTF-8 deb o'qishi uchun (o', g' va kirill buzilmaydi)
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `daromad_${dayKey(new Date())}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const selectCls =
  'rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20';

export default function IncomePage() {
  const [rows, setRows] = useState<IncomeRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);
  const loaded = useRef(false);

  const [search, setSearch] = useState('');
  const [type, setType] = useState<'' | IncomeRow['type']>('');
  const [operator, setOperator] = useState(''); // '' — hammasi, '-' — ko'rsatilmagan
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setRefreshing(true);
    try {
      const r = await api.get('/admin/income');
      if (id !== requestId.current) return; // eskirgan javob
      const list = r.data?.data ?? r.data;
      setRows(toRows(Array.isArray(list) ? list : []));
      setError(null);
      loaded.current = true;
    } catch (err) {
      if (id !== requestId.current) return;
      const msg = apiErrorMessage(err, "Daromad ro'yxatini yuklab bo'lmadi.");
      setError(msg);
      // Oldin yuklangan ro'yxat bo'lsa u ekranda qoladi — faqat xabar beramiz
      if (loaded.current) toast.error(msg);
    } finally {
      if (id === requestId.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- birinchi yuklash
    void load();
  }, [load]);

  const all = useMemo(() => rows ?? [], [rows]);

  /** Operator filtri variantlari — faqat ro'yxatda haqiqatan uchraganlari. */
  const operatorOptions = useMemo(() => {
    const codes = new Set(all.map((r) => r.op));
    const named = [...codes].filter(Boolean).sort((a, b) => opName(a).localeCompare(opName(b)));
    return { named, hasEmpty: codes.has('') };
  }, [all]);

  // "dan" > "gacha" kiritilsa — oraliq almashtirib talqin qilinadi
  const [dayFrom, dayTo] = from && to && from > to ? [to, from] : [from, to];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((r) => {
      if (type && r.type !== type) return false;
      if (operator && (operator === '-' ? r.op !== '' : r.op !== operator)) return false;
      if (dayFrom && (!r.day || r.day < dayFrom)) return false;
      if (dayTo && (!r.day || r.day > dayTo)) return false;
      if (q && !r.who.toLowerCase().includes(q) && !r.product.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [all, search, type, operator, dayFrom, dayTo]);

  const totals = useMemo(() => {
    let sum = 0, course = 0, book = 0;
    for (const r of filtered) {
      sum += r.amount;
      if (r.type === 'COURSE') course += r.amount; else book += r.amount;
    }
    return { sum, course, book };
  }, [filtered]);

  const filtersActive = !!(type || operator || from || to);
  const narrowed = filtersActive || !!search.trim();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Filtr o'zgarsa 1-sahifaga qaytiladi
  const setRange = (f: string, t: string) => { setFrom(f); setTo(t); setPage(1); };
  const clearFilters = () => { setType(''); setOperator(''); setRange('', ''); };

  const now = new Date();
  const today = dayKey(now);
  const presets: { label: string; from: string; to: string }[] = [
    { label: 'Bugun', from: today, to: today },
    { label: '7 kun', from: dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)), to: today },
    { label: 'Shu oy', from: dayKey(new Date(now.getFullYear(), now.getMonth(), 1)), to: today },
  ];

  const firstLoad = rows === null && error === null;
  const loadFailed = rows === null && error !== null;

  return (
    <div>
      <PageHeader
        title="Daromad"
        description="Kurs va kitob to'lovlari — yangidan eskiga"
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => downloadCsv(filtered)}
              disabled={filtered.length === 0}
              title={narrowed ? "Tanlangan to'lovlarni CSV faylga yuklab olish" : "Barcha to'lovlarni CSV faylga yuklab olish"}
            >
              <Download size={14} /> CSV
            </Button>
            <Button variant="secondary" onClick={() => void load()} loading={refreshing && !firstLoad} disabled={firstLoad}>
              {!(refreshing && !firstLoad) && <RefreshCw size={14} />} Yangilash
            </Button>
          </>
        }
      />

      {/* Jami — faol filtrlarga mos */}
      {!loadFailed && (
        <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-amber-50">
              <TrendingUp size={22} className="text-amber-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-500">{narrowed ? "Tanlangan to'lovlar jami" : 'Jami daromad'}</p>
              {rows === null ? (
                <Skeleton className="mt-1 h-8 w-44" />
              ) : (
                <p className="break-words text-2xl font-bold text-gray-900">{formatMoney(totals.sum)}</p>
              )}
            </div>
          </div>
          {rows !== null && (
            <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm sm:ml-auto">
              <div>
                <dt className="text-gray-400">Kurslar</dt>
                <dd className="font-semibold text-gray-800">{formatMoney(totals.course)}</dd>
              </div>
              <div>
                <dt className="text-gray-400">Kitoblar</dt>
                <dd className="font-semibold text-gray-800">{formatMoney(totals.book)}</dd>
              </div>
              <div>
                <dt className="text-gray-400">To'lovlar soni</dt>
                <dd className="font-semibold text-gray-800">
                  {formatNumber(filtered.length)} ta
                  {narrowed && <span className="font-normal text-gray-400"> / {formatNumber(all.length)}</span>}
                </dd>
              </div>
            </dl>
          )}
        </div>
      )}

      <DataTable<IncomeRow>
        data={pageRows}
        loading={firstLoad}
        error={loadFailed ? error : null}
        onRetry={() => void load()}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Qidirish (kim, mahsulot)"
        page={safePage}
        totalPages={totalPages}
        onPageChange={setPage}
        emptyTitle={filtersActive ? "Bu filtrlar bo'yicha to'lov yo'q" : "Hali to'lov yo'q"}
        emptyDescription={
          filtersActive
            ? "Sana oralig'i yoki filtrlarni o'zgartirib ko'ring."
            : "Kurs yoki kitob uchun to'lov qilinsa, shu yerda ko'rinadi."
        }
        emptyAction={filtersActive ? <Button variant="secondary" size="sm" onClick={clearFilters}>Filtrlarni tozalash</Button> : undefined}
        headerRight={
          <>
            <select
              value={type}
              onChange={(e) => { setType(e.target.value as '' | IncomeRow['type']); setPage(1); }}
              aria-label="Mahsulot turi"
              className={selectCls}
            >
              <option value="">Barcha turlar</option>
              <option value="COURSE">Kurs</option>
              <option value="BOOK">Kitob</option>
            </select>
            <select
              value={operator}
              onChange={(e) => { setOperator(e.target.value); setPage(1); }}
              aria-label="Operator"
              className={selectCls}
            >
              <option value="">Barcha operatorlar</option>
              {operatorOptions.named.map((c) => <option key={c} value={c}>{opName(c)}</option>)}
              {operatorOptions.hasEmpty && <option value="-">Ko'rsatilmagan</option>}
            </select>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => setRange(e.target.value, to)}
                aria-label="Sanadan"
                title="Sanadan"
                className={selectCls}
              />
              <span className="text-gray-400">—</span>
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setRange(from, e.target.value)}
                aria-label="Sanagacha"
                title="Sanagacha"
                className={selectCls}
              />
            </div>
            <div className="flex items-center gap-1">
              {presets.map((p) => {
                const active = from === p.from && to === p.to;
                return (
                  <button
                    key={p.label}
                    type="button"
                    aria-pressed={active}
                    onClick={() => (active ? setRange('', '') : setRange(p.from, p.to))}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                      active ? 'bg-[var(--primary)] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
              {filtersActive && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                >
                  <X size={12} /> Tozalash
                </button>
              )}
            </div>
          </>
        }
        columns={[
          {
            key: 'who',
            label: 'Kim',
            render: (r) => (
              <span className="block max-w-[14rem] truncate font-medium text-gray-800" title={r.who}>{r.who}</span>
            ),
          },
          {
            key: 'product',
            label: 'Nima uchun',
            render: (r) => (
              <span className="flex items-center gap-2">
                <span className="max-w-[16rem] truncate" title={r.product || undefined}>{r.product || '—'}</span>
                <span
                  className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs ${
                    r.type === 'COURSE' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {TYPE_LABEL[r.type]}
                </span>
              </span>
            ),
          },
          { key: 'op', label: 'Operator', render: (r) => opName(r.op) },
          {
            key: 'amount',
            label: 'Summa',
            render: (r) => <span className="whitespace-nowrap font-semibold text-[var(--primary)]">{formatMoney(r.amount)}</span>,
          },
          {
            key: 'createdAt',
            label: 'Sana',
            render: (r) => <span className="whitespace-nowrap text-xs text-gray-500">{formatDateTime(r.createdAt)}</span>,
          },
        ]}
      />

      {rows !== null && filtered.length > 0 && (
        <p className="mt-3 text-xs text-gray-400">
          {formatNumber((safePage - 1) * PAGE_SIZE + 1)}–{formatNumber((safePage - 1) * PAGE_SIZE + pageRows.length)} / {formatNumber(filtered.length)} ta to'lov ko'rsatilmoqda
        </p>
      )}
    </div>
  );
}
