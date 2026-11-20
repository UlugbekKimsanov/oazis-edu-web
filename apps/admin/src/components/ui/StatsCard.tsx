import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';

interface Props {
  title: string;
  value: string | number;
  icon: LucideIcon;
  /** Ikonka rangi (urg'u). `to` eski gradient uchun qoldirilgan — ishlatilmaydi. */
  from?: string;
  to?: string;
  /** Qiymat ostidagi qo'shimcha izoh */
  hint?: string;
  onClick?: () => void;
}

/**
 * Statistik karta: oq fon, rangli ikonka. Bosiladigan bo'lsa — haqiqiy tugma
 * (klaviatura va ekran o'quvchi uchun).
 */
export default function StatsCard({ title, value, icon: Icon, from = '#2E9E6E', hint, onClick }: Props) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${from}1A`, color: from }}
        >
          <Icon size={22} />
        </div>
        {onClick && <ChevronRight size={16} className="mt-1 text-gray-300 transition-colors group-hover:text-gray-500" />}
      </div>
      <p className="mt-4 text-2xl font-bold tracking-tight text-gray-900">{value}</p>
      <p className="mt-0.5 text-sm font-medium text-gray-500">{title}</p>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </>
  );

  const base = 'rounded-xl border border-gray-200 bg-white p-5 text-left';

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`group w-full ${base} transition-shadow hover:border-gray-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40`}
      >
        {body}
      </button>
    );
  }
  return <div className={base}>{body}</div>;
}
