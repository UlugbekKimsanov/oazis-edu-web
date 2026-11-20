import { Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { EmptyState, ErrorState, Skeleton } from './States';

interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  width?: string;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  actions?: (item: T) => React.ReactNode;
  loading?: boolean;
  headerRight?: React.ReactNode;
  /** Yuklashda xato — jadval o'rnida xabar va "Qayta urinish" ko'rsatiladi */
  error?: string | null;
  onRetry?: () => void;
  /** Ro'yxat bo'sh bo'lgandagi matn (qidiruvsiz) */
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
}

export default function DataTable<T extends { id: number }>({
  columns,
  data,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Qidirish...",
  page = 1,
  totalPages = 1,
  onPageChange,
  actions,
  loading,
  headerRight,
  error,
  onRetry,
  emptyTitle = "Ma'lumot topilmadi",
  emptyDescription,
  emptyAction,
}: Props<T>) {
  const colSpan = columns.length + (actions ? 1 : 0);
  const searching = !!searchValue?.trim();

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      {(onSearchChange || headerRight) && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-gray-100">
          {onSearchChange && (
            <div className="relative w-full sm:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={searchValue ?? ''}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] [&::-webkit-search-cancel-button]:hidden"
              />
              {searching && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  aria-label="Qidiruvni tozalash"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}
          {headerRight && <div className="flex flex-wrap items-center gap-2">{headerRight}</div>}
        </div>
      )}

      {/* Table */}
      {error && !loading ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 whitespace-nowrap"
                    style={{ width: col.width }}
                  >
                    {col.label}
                  </th>
                ))}
                {actions && <th scope="col" className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Amallar</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, r) => (
                  <tr key={r} className="border-b border-gray-50">
                    {Array.from({ length: colSpan }).map((__, c) => (
                      <td key={c} className="px-4 py-3.5">
                        <Skeleton className={`h-4 ${c === 0 ? 'w-40' : 'w-20'}`} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={colSpan}>
                    {searching ? (
                      <EmptyState
                        icon={Search}
                        title="Hech narsa topilmadi"
                        description={`"${searchValue}" bo'yicha natija yo'q. Boshqa so'z bilan urinib ko'ring.`}
                      />
                    ) : (
                      <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
                    )}
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr key={item.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3 text-sm text-gray-700">
                        {col.render ? col.render(item) : (item as Record<string, unknown>)[col.key] as string}
                      </td>
                    ))}
                    {actions && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">{actions(item)}</div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <span className="text-sm text-gray-500">
            Sahifa {page} / {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              aria-label="Oldingi sahifa"
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              aria-label="Keyingi sahifa"
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
