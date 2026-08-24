import { useEffect, useState } from 'react';
import DataTable from '../../components/ui/DataTable';
import api from '../../lib/api';
import type { PaymentMethod } from '../../lib/types';

export default function PaymentMethodsPage() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const fetchMethods = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/payment-methods');
      setMethods(res.data.data ?? res.data ?? []);
    } catch {
      setMethods([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMethods(); }, []);

  const toggle = async (m: PaymentMethod) => {
    const next = !m.enabled;
    setBusyId(m.id);
    setMethods((prev) => prev.map((x) => (x.id === m.id ? { ...x, enabled: next } : x)));
    try {
      await api.patch(`/admin/payment-methods/${m.id}/status`, null, { params: { enabled: next } });
    } catch {
      setMethods((prev) => prev.map((x) => (x.id === m.id ? { ...x, enabled: !next } : x)));
    } finally {
      setBusyId(null);
    }
  };

  const enabledCount = methods.filter((m) => m.enabled).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">To'lov tizimlari</h1>
          <p className="text-sm text-gray-500 mt-1">
            Mobil ilovada faqat yoqilgan to'lov usullari ko'rinadi.
          </p>
        </div>
        <span className="text-sm font-medium text-gray-500">
          {enabledCount} / {methods.length} yoqilgan
        </span>
      </div>

      <DataTable
        columns={[
          { key: 'name', label: 'Nomi', render: (m: PaymentMethod) => <span className="font-medium">{m.name}</span> },
          { key: 'type', label: 'Turi', render: (m: PaymentMethod) => (
            m.isNasiya
              ? <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Nasiya</span>
              : <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Bir to'lov</span>
          )},
          { key: 'status', label: 'Holat', render: (m: PaymentMethod) => (
            <span className={
              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' +
              (m.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')
            }>
              {m.enabled ? 'Yoqilgan' : "O'chirilgan"}
            </span>
          )},
        ]}
        data={methods}
        loading={loading}
        actions={(m: PaymentMethod) => (
          // Faqat Click sozlangan — uni yoqish/o'chirish mumkin.
          // Qolganlari hali implement qilinmagan, shuning uchun switch yo'q.
          m.code === 'click' ? (
            <button
              onClick={() => toggle(m)}
              disabled={busyId === m.id}
              role="switch"
              aria-checked={!!m.enabled}
              className={
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ' +
                (m.enabled ? 'bg-green-500' : 'bg-gray-300')
              }
              title={m.enabled ? "O'chirish" : 'Yoqish'}
            >
              <span className={
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform ' +
                (m.enabled ? 'translate-x-6' : 'translate-x-1')
              } />
            </button>
          ) : (
            <span className="text-xs font-medium text-gray-400">Tez kunda</span>
          )
        )}
      />
    </div>
  );
}
