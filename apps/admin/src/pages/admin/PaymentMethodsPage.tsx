import { useEffect, useRef, useState } from 'react';
import { Info, AlertTriangle } from 'lucide-react';
import DataTable from '../../components/ui/DataTable';
import PageHeader from '../../components/ui/PageHeader';
import api from '../../lib/api';
import { apiErrorMessage } from '../../lib/errors';
import { confirmDialog, toast } from '../../stores/ui-store';
import type { PaymentMethod } from '../../lib/types';

// Hozircha faqat Click to'liq sozlangan. Qolgan usullarni yoqish o'quvchiga
// ishlamaydigan to'lov tugmasini ko'rsatadi, shuning uchun ularni bu yerdan yoqib bo'lmaydi.
const READY_CODES = new Set(['click']);

function parseMethods(payload: unknown): PaymentMethod[] {
  const body = payload as { data?: unknown } | null;
  const list = body?.data ?? payload;
  if (!Array.isArray(list)) return [];
  // Backend order_index bo'yicha beradi; mobil ilovadagi tartib ham shu
  return [...(list as PaymentMethod[])].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
}

export default function PaymentMethodsPage() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<number>>(new Set());
  // State kechikib yangilanadi — tez ikki marta bosilganda ikkinchi so'rov ketmasligi uchun
  const pendingRef = useRef(new Set<number>());

  useEffect(() => {
    let active = true;
    api.get('/admin/payment-methods')
      .then((res) => {
        if (!active) return;
        setMethods(parseMethods(res.data));
        setError(null);
      })
      .catch((err) => {
        // Xatoda bo'sh ro'yxat emas, xabar ko'rsatiladi — "to'lov usuli yo'q" degan taassurot qolmasin
        if (active) setError(apiErrorMessage(err, "To'lov tizimlarini yuklab bo'lmadi."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const retry = () => {
    setLoading(true);
    setError(null);
    setAttempt((n) => n + 1);
  };

  const setEnabledLocal = (id: number, enabled: boolean) =>
    setMethods((prev) => prev.map((x) => (x.id === id ? { ...x, enabled } : x)));

  const toggle = async (m: PaymentMethod) => {
    if (pendingRef.current.has(m.id)) return;
    const next = !m.enabled;
    // So'rov tugaguncha qator band — tasdiqlash oynasi ochiq turganda ham
    pendingRef.current.add(m.id);
    setPendingIds(new Set(pendingRef.current));

    try {
      if (!next) {
        const othersEnabled = methods.some((x) => x.id !== m.id && x.enabled);
        if (!othersEnabled) {
          const ok = await confirmDialog({
            title: "Oxirgi to'lov usuli o'chirilsinmi?",
            message: `«${m.name}» — hozir yoqilgan yagona to'lov usuli. Uni o'chirsangiz, o'quvchilar mobil ilovada kurs va kitoblar uchun umuman to'lov qila olmaydi.`,
            confirmText: "Baribir o'chirish",
            danger: true,
          });
          if (!ok) return;
        }
      }

      setEnabledLocal(m.id, next); // optimistik
      try {
        const res = await api.patch(`/admin/payment-methods/${m.id}/status`, null, { params: { enabled: next } });
        const saved = (res.data?.data ?? res.data) as Partial<PaymentMethod> | null;
        if (typeof saved?.enabled === 'boolean') setEnabledLocal(m.id, saved.enabled);
        toast.success(next ? `«${m.name}» yoqildi — mobil ilovada ko'rinadi` : `«${m.name}» o'chirildi — mobil ilovada ko'rinmaydi`);
      } catch (err) {
        setEnabledLocal(m.id, !next); // qaytarish
        toast.error(apiErrorMessage(err, `«${m.name}» holatini o'zgartirib bo'lmadi.`));
      }
    } finally {
      pendingRef.current.delete(m.id);
      setPendingIds(new Set(pendingRef.current));
    }
  };

  const enabledCount = methods.filter((m) => m.enabled).length;
  const loaded = !loading && !error;

  return (
    <div>
      <PageHeader
        title="To'lov tizimlari"
        description="O'quvchilar mobil ilovada kurs va kitob sotib olayotganda qaysi to'lov usullarini ko'rishini boshqaring."
        actions={
          loaded && methods.length > 0 ? (
            <span
              className={
                'rounded-full px-3 py-1 text-sm font-medium ' +
                (enabledCount > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')
              }
            >
              {enabledCount} / {methods.length} yoqilgan
            </span>
          ) : undefined
        }
      />

      {loaded && methods.length > 0 && enabledCount === 0 && (
        <div role="alert" className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <p>
            <span className="font-semibold">Hech qaysi to'lov usuli yoqilmagan.</span>{' '}
            O'quvchilar hozir mobil ilovada to'lov qila olmaydi. Kamida bitta usulni yoqing.
          </p>
        </div>
      )}

      <div className="mb-4 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm text-gray-700">
        <Info size={18} className="mt-0.5 shrink-0 text-blue-500" />
        <ul className="list-disc space-y-1 pl-4">
          <li><span className="font-medium">Yoqilgan</span> usul o'quvchiga to'lov sahifasida tanlash uchun ko'rinadi.</li>
          <li><span className="font-medium">O'chirilgan</span> usul ilovada ko'rinmaydi; avval qilingan to'lovlarga ta'sir qilmaydi.</li>
          <li>O'zgarish darhol kuchga kiradi — o'quvchi to'lov sahifasini qayta ochganda yangi ro'yxatni ko'radi.</li>
          <li>«Nasiya» — bo'lib to'lash usuli, ilovada alohida bo'limda chiqadi. «Tez kunda» belgili usullar hali ulanmagan.</li>
        </ul>
      </div>

      <DataTable
        columns={[
          { key: 'order', label: '№', width: '56px', render: (m: PaymentMethod) => (
            <span className="text-gray-400">{m.orderIndex ?? '—'}</span>
          )},
          { key: 'name', label: 'Nomi', render: (m: PaymentMethod) => (
            <div className="min-w-[8rem]">
              <div className="font-medium text-gray-900">{m.name}</div>
              <div className="font-mono text-xs text-gray-400">{m.code}</div>
            </div>
          )},
          { key: 'type', label: 'Turi', render: (m: PaymentMethod) => (
            m.isNasiya
              ? <span className="whitespace-nowrap text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Nasiya</span>
              : <span className="whitespace-nowrap text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Bir to'lov</span>
          )},
          { key: 'status', label: 'Holat', render: (m: PaymentMethod) => (
            <span className={
              'inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-full text-xs font-medium ' +
              (m.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')
            }>
              {m.enabled ? 'Yoqilgan' : "O'chirilgan"}
            </span>
          )},
        ]}
        data={methods}
        loading={loading}
        error={error}
        onRetry={retry}
        emptyTitle="To'lov tizimlari topilmadi"
        emptyDescription="To'lov usullari tizimda oldindan yaratiladi. Ro'yxat bo'sh bo'lsa, dasturchiga murojaat qiling."
        actions={(m: PaymentMethod) => {
          const pending = pendingIds.has(m.id);
          // Ulanmagan usulni yoqib bo'lmaydi; lekin u yoqilgan holda qolgan bo'lsa — o'chirish mumkin.
          if (!READY_CODES.has(m.code) && !m.enabled) {
            return <span className="whitespace-nowrap text-xs font-medium text-gray-400">Tez kunda</span>;
          }
          return (
            <button
              type="button"
              onClick={() => void toggle(m)}
              disabled={pending}
              role="switch"
              aria-checked={!!m.enabled}
              aria-busy={pending || undefined}
              aria-label={`${m.name}: ${m.enabled ? "o'chirish" : 'yoqish'}`}
              className={
                'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-50 ' +
                (m.enabled ? 'bg-green-500' : 'bg-gray-300')
              }
              title={m.enabled ? "O'chirish" : 'Yoqish'}
            >
              <span className={
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform ' +
                (m.enabled ? 'translate-x-6' : 'translate-x-1')
              } />
            </button>
          );
        }}
      />
    </div>
  );
}
