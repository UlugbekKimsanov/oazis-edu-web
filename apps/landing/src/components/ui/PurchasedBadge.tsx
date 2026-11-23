import { CheckCircle2 } from 'lucide-react';

/** Xarid tugmasi o'rnida: foydalanuvchi bu mahsulotni allaqachon sotib olgan. */
export function PurchasedBadge({
  className = '',
  onClick,
}: {
  className?: string;
  /** Bosilganda mahsulot ilovada qanday ochilishi tushuntiriladi. */
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-primary/30 bg-primary-light px-3 py-3 text-sm font-semibold text-primary transition-colors hover:border-primary ${className}`}
      title="Bu mahsulot hisobingizda bor — OAZIS ilovasida ochiq"
    >
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      Sotib olingan
    </button>
  );
}
