import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import api from '../../lib/api';

interface IncomeItem {
  who: string;
  operator?: string;
  product?: string;
  productType?: string; // COURSE | BOOK
  amount?: number;
  createdAt?: string | null;
}

const OPERATORS: Record<string, string> = {
  click: 'Click',
  payme: 'Payme',
  paynet: 'Paynet',
  uzumnasiya: 'Uzum Nasiya',
  alifnasiya: 'Alif Nasiya',
  free: 'Bepul',
};

function opName(c?: string): string {
  if (!c) return '—';
  return OPERATORS[c.toLowerCase()] ?? c;
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU');
}

export default function IncomePage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<IncomeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/income')
      .then((r) => setItems(r.data.data ?? r.data ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const total = items.reduce((s, i) => s + (i.amount ?? 0), 0);

  return (
    <div>
      <div className="mb-6">
        <button onClick={() => navigate('/admin')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-[var(--primary)] mb-1">
          <ArrowLeft size={14} /> Dashboard
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Daromad</h1>
        <p className="text-sm text-gray-500 mt-1">Barcha to'lovlar — yangidan eskiga</p>
      </div>

      {/* Jami */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-amber-50">
          <TrendingUp size={22} className="text-amber-500" />
        </div>
        <div>
          <p className="text-sm text-gray-500">Jami daromad</p>
          <p className="text-2xl font-bold text-gray-900">{total.toLocaleString('ru-RU')} so'm</p>
        </div>
        <span className="ml-auto text-sm text-gray-400">{items.length} ta to'lov</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              {['Kim', 'Nima uchun', 'Operator', 'Summa', 'Sana'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">Yuklanmoqda...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">Hali daromad yo'q</td></tr>
            ) : (
              items.map((i, idx) => (
                <tr key={idx} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{i.who}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {i.product || '—'}
                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      {i.productType === 'COURSE' ? 'Kurs' : 'Kitob'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{opName(i.operator)}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-[var(--primary)]">{(i.amount ?? 0).toLocaleString('ru-RU')} so'm</td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(i.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
