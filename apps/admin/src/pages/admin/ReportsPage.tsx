import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { BarChart3, GraduationCap, RefreshCw, Trophy, UserPlus, Wallet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/States';
import api from '../../lib/api';
import { apiErrorMessage } from '../../lib/errors';
import { formatDateTime, formatMoney, formatNumber, parseServerDate } from '../../lib/format';

// Backendda alohida "hisobot" endpointlari yo'q. Sahifa faqat mavjud, haqiqiy
// ma'lumot beradigan endpointlardan yig'iladi — hech qanday namunaviy (soxta) raqam ko'rsatilmaydi:
//   GET /admin/income            — to'lovlar (oylik daromad, to'lov usullari)
//   GET /admin/users?role=STUDENT — o'quvchilar (oylik ro'yxatdan o'tishlar)
//   GET /admin/courses           — kurslar (studentCount)
//   GET /rating/leaderboard      — ball bo'yicha top-50 o'quvchi

interface IncomeItem { operator?: string | null; amount?: number | null; createdAt?: string | null }
interface StudentItem { isGuest?: boolean | null; createdAt?: string | null }
interface CourseItem { id: number; name?: string | null; studentCount?: number | null }
interface LeaderEntry { rank?: number; name?: string | null; points?: number | null }

/** Bitta blok holati: data=null — hali yuklanmagan; error — oxirgi urinish xatosi. */
interface Block<T> { data: T | null; error: string | null }
const emptyBlock = { data: null, error: null };

const MONTHS_SHORT = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
const MONTHS_FULL = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];

const OPERATORS: Record<string, string> = {
  click: 'Click',
  payme: 'Payme',
  paynet: 'Paynet',
  uzumnasiya: 'Uzum Nasiya',
  alifnasiya: 'Alif Nasiya',
  card: 'Karta',
  free: 'Bepul',
};

const CHART_H = 'h-[250px]';
const BAR_COLOR = '#2E9E6E'; // --primary

interface MonthPoint { key: string; label: string; full: string; value: number }

/** Oxirgi `count` oy (joriy oy bilan) — mahalliy vaqt bo'yicha, qiymati 0 dan boshlanadi. */
function lastMonths(count: number): MonthPoint[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
    const m = d.getMonth();
    return {
      key: `${d.getFullYear()}-${m}`,
      // Yil almashganini ko'rsatish uchun birinchi ustun va yanvarda yil yoziladi
      label: i === 0 || m === 0 ? `${MONTHS_SHORT[m]} ${d.getFullYear()}` : MONTHS_SHORT[m],
      full: `${MONTHS_FULL[m]} ${d.getFullYear()}`,
      value: 0,
    };
  });
}

/** Yozuvlarni oylar bo'yicha yig'adi; davrdan tashqaridagilar tashlab yuboriladi. */
function byMonth<T>(items: T[], months: number, dateOf: (i: T) => string | null | undefined, valueOf: (i: T) => number): MonthPoint[] {
  const points = lastMonths(months);
  const index = new Map(points.map((p) => [p.key, p]));
  for (const item of items) {
    const d = parseServerDate(dateOf(item)); // server vaqti zonasiz UTC — mahalliy oyga o'tkaziladi
    if (!d) continue;
    const p = index.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (p) p.value += valueOf(item);
  }
  return points;
}

const amountOf = (i: IncomeItem) => {
  const n = Number(i.amount ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** O'q uchun ixcham son: 1 500 000 → "1,5 mln". */
function compact(n: number): string {
  const trim = (v: number) => v.toFixed(1).replace(/\.0$/, '').replace('.', ',');
  if (n >= 1e9) return `${trim(n / 1e9)} mlrd`;
  if (n >= 1e6) return `${trim(n / 1e6)} mln`;
  if (n >= 1e4) return `${trim(n / 1e3)} ming`;
  return formatNumber(n);
}

function unwrap(res: { data?: { data?: unknown } | unknown }): unknown {
  const body = res.data as { data?: unknown } | undefined;
  return body && typeof body === 'object' && 'data' in body ? body.data : body;
}

function Card({ title, hint, summary, children }: { title: string; hint?: string; summary?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
        </div>
        {summary && <div className="text-right text-sm font-semibold text-gray-900">{summary}</div>}
      </div>
      {children}
    </section>
  );
}

/** Blok tanasi: skelet (grafik o'lchamida) → xato → kontent. Yangilash xatosida eski ma'lumot qoladi. */
function BlockBody<T>({ block, onRetry, children }: { block: Block<T>; onRetry: () => void; children: (data: T) => React.ReactNode }) {
  if (block.data === null) {
    return block.error
      ? <ErrorState message={block.error} onRetry={onRetry} className="min-h-[250px]" />
      : <Skeleton className={`${CHART_H} w-full`} />;
  }
  return (
    <>
      {block.error && (
        <p role="alert" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
          Yangilab bo'lmadi: {block.error} Oxirgi yuklangan ma'lumot ko'rsatilgan.
        </p>
      )}
      {children(block.data)}
    </>
  );
}

function MonthlyBars({ data, unit, format, emptyIcon, emptyTitle }: {
  data: MonthPoint[];
  unit: string;
  format: (n: number) => string;
  emptyIcon: LucideIcon;
  emptyTitle: string;
}) {
  if (data.every((p) => p.value === 0)) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} description="Tanlangan davrda ma'lumot yo'q." className="min-h-[250px]" />;
  }
  return (
    <div className={CHART_H}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="#f0f0f0" />
          <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} tick={{ fill: '#6b7280' }} minTickGap={8} />
          <YAxis fontSize={12} tickLine={false} axisLine={false} tick={{ fill: '#6b7280' }} width={64} allowDecimals={false} tickFormatter={(v) => compact(Number(v))} />
          <Tooltip
            cursor={{ fill: 'rgba(46, 158, 110, 0.08)' }}
            formatter={(v) => [format(Number(v)), unit]}
            labelFormatter={(_, payload) => (payload?.[0]?.payload as MonthPoint | undefined)?.full ?? ''}
            contentStyle={{ borderRadius: 8, borderColor: '#e5e7eb', fontSize: 12 }}
          />
          <Bar dataKey="value" fill={BAR_COLOR} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Nomi + gorizontal ustun + qiymat — toifalar soni ko'p bo'lganda doiraviy diagrammadan o'qilishi oson. */
function RankBars({ rows }: { rows: { key: string; name: string; value: number; text: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-gray-700" title={r.name}>{r.name}</span>
            <span className="shrink-0 font-medium text-gray-900">{r.text}</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100">
            <div className="h-2 rounded-full bg-[var(--primary)]" style={{ width: `${Math.max(r.value > 0 ? 2 : 0, (r.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const TOP_COURSES = 8;
const TOP_STUDENTS = 10;

export default function ReportsPage() {
  const [income, setIncome] = useState<Block<IncomeItem[]>>(emptyBlock);
  const [students, setStudents] = useState<Block<StudentItem[]>>(emptyBlock);
  const [courses, setCourses] = useState<Block<CourseItem[]>>(emptyBlock);
  const [leaders, setLeaders] = useState<Block<LeaderEntry[]>>(emptyBlock);
  const [months, setMonths] = useState(6);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setRefreshing(true);

    // So'rovlar mustaqil: biri yiqilsa qolgan bloklar ko'rsatiladi.
    const [incomeRes, studentsRes, coursesRes, leadersRes] = await Promise.allSettled([
      api.get('/admin/income'),
      api.get('/admin/users', { params: { role: 'STUDENT' } }),
      api.get('/admin/courses'),
      api.get('/rating/leaderboard'),
    ]);
    if (id !== requestId.current) return; // eskirgan javob

    // Xatoda eski ma'lumot saqlanadi (soxta yoki bo'sh ko'rsatkich chiqmaydi) — faqat xato matni qo'yiladi
    function apply<T>(
      res: PromiseSettledResult<{ data?: unknown }>,
      set: React.Dispatch<React.SetStateAction<Block<T[]>>>,
      pick: (payload: unknown) => unknown,
      fallback: string,
    ) {
      if (res.status === 'fulfilled') {
        const list = pick(unwrap(res.value));
        set({ data: Array.isArray(list) ? (list as T[]) : [], error: null });
      } else {
        const error = apiErrorMessage(res.reason, fallback);
        set((prev) => ({ data: prev.data, error }));
      }
    }

    apply(incomeRes, setIncome, (p) => p, "Daromad ma'lumotini yuklab bo'lmadi.");
    apply(studentsRes, setStudents, (p) => p, "O'quvchilar ro'yxatini yuklab bo'lmadi.");
    apply(coursesRes, setCourses, (p) => p, "Kurslarni yuklab bo'lmadi.");
    apply(leadersRes, setLeaders, (p) => (p as { entries?: unknown } | null)?.entries, "Reytingni yuklab bo'lmadi.");

    if ([incomeRes, studentsRes, coursesRes, leadersRes].some((r) => r.status === 'fulfilled')) {
      setUpdatedAt(new Date().toISOString());
    }
    setRefreshing(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- birinchi yuklash
    void load();
  }, [load]);

  const retry = () => void load();

  const incomeByMonth = useMemo(
    () => (income.data ? byMonth(income.data, months, (i) => i.createdAt, amountOf) : []),
    [income.data, months],
  );
  const incomeTotal = incomeByMonth.reduce((s, p) => s + p.value, 0);

  // Mehmon akkauntlar hisobga olinmaydi (Dashboard'dagi "Jami o'quvchilar" bilan bir xil qoida)
  const signupsByMonth = useMemo(
    () => (students.data ? byMonth(students.data.filter((u) => !u.isGuest), months, (u) => u.createdAt, () => 1) : []),
    [students.data, months],
  );
  const signupsTotal = signupsByMonth.reduce((s, p) => s + p.value, 0);

  /** Tanlangan davrdagi to'lovlar — to'lov usuli bo'yicha summa. */
  const byOperator = useMemo(() => {
    if (!income.data) return [];
    const keys = new Set(lastMonths(months).map((p) => p.key));
    const sums = new Map<string, number>();
    for (const i of income.data) {
      const d = parseServerDate(i.createdAt);
      if (!d || !keys.has(`${d.getFullYear()}-${d.getMonth()}`)) continue;
      const code = (i.operator ?? '').toLowerCase().replace(/[\s_-]+/g, '');
      sums.set(code, (sums.get(code) ?? 0) + amountOf(i));
    }
    const total = [...sums.values()].reduce((s, v) => s + v, 0);
    return [...sums.entries()]
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([code, value]) => ({
        key: code || '-',
        name: code ? OPERATORS[code] ?? code : "Ko'rsatilmagan",
        value,
        text: `${formatMoney(value)} · ${total > 0 ? Math.round((value / total) * 100) : 0}%`,
      }));
  }, [income.data, months]);

  const courseRows = useMemo(() => {
    const list = (courses.data ?? [])
      .map((c) => ({ key: String(c.id), name: (c.name ?? '').trim() || `Kurs #${c.id}`, value: Number(c.studentCount ?? 0) || 0 }))
      .sort((a, b) => b.value - a.value);
    return {
      top: list.slice(0, TOP_COURSES).map((c) => ({ ...c, text: `${formatNumber(c.value)} ta` })),
      rest: Math.max(0, list.length - TOP_COURSES),
      enrolled: list.reduce((s, c) => s + c.value, 0),
    };
  }, [courses.data]);

  const topStudents = useMemo(
    () => (leaders.data ?? []).filter((e) => Number(e.points ?? 0) > 0).slice(0, TOP_STUDENTS),
    [leaders.data],
  );

  const firstLoad = refreshing && !updatedAt && !income.error && !students.error && !courses.error && !leaders.error;
  const periodLabel = `oxirgi ${months} oy`;

  return (
    <div>
      <PageHeader
        title="Hisobotlar"
        description={
          updatedAt
            ? `Platformaning analitik ko'rsatkichlari · yangilandi ${formatDateTime(updatedAt)}`
            : "Platformaning analitik ko'rsatkichlari"
        }
        actions={
          <>
            <select
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              aria-label="Davr"
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
            >
              <option value={6}>Oxirgi 6 oy</option>
              <option value={12}>Oxirgi 12 oy</option>
              <option value={24}>Oxirgi 24 oy</option>
            </select>
            <Button variant="secondary" onClick={retry} loading={refreshing && !firstLoad} disabled={firstLoad}>
              {!(refreshing && !firstLoad) && <RefreshCw size={14} />} Yangilash
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card
          title="Oylik daromad"
          hint="Kurs va kitob to'lovlari"
          summary={income.data && <>{formatMoney(incomeTotal)} <span className="block text-xs font-normal text-gray-400">{periodLabel}</span></>}
        >
          <BlockBody block={income} onRetry={retry}>
            {() => <MonthlyBars data={incomeByMonth} unit="Daromad" format={formatMoney} emptyIcon={Wallet} emptyTitle="To'lovlar yo'q" />}
          </BlockBody>
        </Card>

        <Card
          title="Oylik ro'yxatdan o'tishlar"
          hint="Hozir mavjud o'quvchi akkauntlari bo'yicha (mehmonlarsiz)"
          summary={students.data && <>{formatNumber(signupsTotal)} ta <span className="block text-xs font-normal text-gray-400">{periodLabel}</span></>}
        >
          <BlockBody block={students} onRetry={retry}>
            {() => (
              <MonthlyBars
                data={signupsByMonth}
                unit="Yangi o'quvchilar"
                format={(n) => `${formatNumber(n)} ta`}
                emptyIcon={UserPlus}
                emptyTitle="Yangi o'quvchilar yo'q"
              />
            )}
          </BlockBody>
        </Card>

        <Card
          title="Kurslar bo'yicha o'quvchilar"
          hint="Kursga yozilganlar soni (hozirgi holat)"
          summary={courses.data && courses.data.length > 0 && <>{formatNumber(courseRows.enrolled)} ta <span className="block text-xs font-normal text-gray-400">jami yozilish</span></>}
        >
          <BlockBody block={courses} onRetry={retry}>
            {(list) =>
              list.length === 0 ? (
                <EmptyState
                  icon={GraduationCap}
                  title="Hali kurs yo'q"
                  description="Kurs qo'shilgach, o'quvchilar taqsimoti shu yerda ko'rinadi."
                  action={<Link to="/admin/courses" className="text-sm font-medium text-[var(--primary)] hover:underline">Kurslarga o'tish</Link>}
                  className="min-h-[250px]"
                />
              ) : (
                <>
                  <RankBars rows={courseRows.top} />
                  {courseRows.rest > 0 && (
                    <p className="mt-3 text-xs text-gray-400">
                      Yana {formatNumber(courseRows.rest)} ta kurs —{' '}
                      <Link to="/admin/courses" className="text-[var(--primary)] hover:underline">hammasini ko'rish</Link>
                    </p>
                  )}
                </>
              )
            }
          </BlockBody>
        </Card>

        <Card title="To'lov usullari" hint={`Daromad ulushi — ${periodLabel}`}>
          <BlockBody block={income} onRetry={retry}>
            {() =>
              byOperator.length === 0 ? (
                <EmptyState icon={BarChart3} title="To'lovlar yo'q" description="Tanlangan davrda ma'lumot yo'q." className="min-h-[250px]" />
              ) : (
                <RankBars rows={byOperator} />
              )
            }
          </BlockBody>
        </Card>

        <div className="lg:col-span-2">
          <Card title="Eng faol o'quvchilar" hint="Jami to'plangan ball bo'yicha (butun davr)">
            <BlockBody block={leaders} onRetry={retry}>
              {() =>
                topStudents.length === 0 ? (
                  <EmptyState
                    icon={Trophy}
                    title="Hali ball to'plagan o'quvchi yo'q"
                    description="O'quvchilar dars va mashqlarni bajarganda reyting shu yerda ko'rinadi."
                    className="min-h-[250px]"
                  />
                ) : (
                  <ol className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                    {topStudents.map((s, i) => {
                      const name = (s.name ?? '').trim() || 'Ismsiz';
                      return (
                        <li key={`${s.rank ?? i}-${name}`} className="flex items-center gap-3 border-b border-gray-50 py-2.5">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--primary-light)] text-xs font-bold text-[var(--primary)]">
                            {s.rank ?? i + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900" title={name}>{name}</span>
                          <span className="shrink-0 text-sm font-semibold text-gray-700">{formatNumber(s.points)} ball</span>
                        </li>
                      );
                    })}
                  </ol>
                )
              }
            </BlockBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
