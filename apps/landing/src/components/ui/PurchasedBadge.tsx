import { CheckCircle2 } from 'lucide-react';

/**
 * Xarid tugmasi o'rnida: foydalanuvchi bu mahsulotni allaqachon sotib olgan.
 * Faqat belgi — bosish butun kartada ishlaydi (karta ilovaga yo'naltiruvchi oynani ochadi).
 */
export function PurchasedBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-primary/30 bg-primary-light px-3 py-3 text-sm font-semibold text-primary ${className}`}
    >
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      Sotib olingan
    </span>
  );
}