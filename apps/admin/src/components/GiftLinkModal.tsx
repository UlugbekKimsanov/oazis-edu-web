import { Check, Gift, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import Modal from './ui/Modal';

export interface GiftLinkItem {
  id: number;
  title: string;
  subtitle?: string;
  /** Chapdagi kichik rasm/emoji. */
  thumb?: ReactNode;
  /** Bo'sh bo'lmasa element tanlab bo'lmaydi va sababi ko'rsatiladi. */
  disabledReason?: string;
}

/**
 * Sovg'a bog'lanishlarini tanlash oynasi — ikki tomondan ishlatiladi:
 * kurs uchun kitoblar ro'yxati yoki kitob uchun kurslar ro'yxati.
 * Har bir bosish darhol saqlanadi (chaqiruvchi `onToggle`da API'ni chaqiradi).
 */
export default function GiftLinkModal({
  open,
  onClose,
  title,
  description,
  items,
  isSelected,
  isBusy,
  onToggle,
  loadError,
  emptyText,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: ReactNode;
  items: GiftLinkItem[];
  isSelected: (id: number) => boolean;
  isBusy: (id: number) => boolean;
  onToggle: (item: GiftLinkItem) => void;
  loadError?: string | null;
  emptyText: string;
}) {
  const selectedCount = items.filter((i) => isSelected(i.id)).length;
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-lg">
      <div className="space-y-4">
        <p className="flex items-start gap-2 rounded-lg bg-amber-100 px-3 py-2.5 text-xs leading-relaxed text-gray-700">
          <Gift size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <span>{description}</span>
        </p>

        {loadError ? (
          <p className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{loadError}</p>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">{emptyText}</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => {
              const selected = isSelected(item.id);
              const busy = isBusy(item.id);
              // Tanlangan bog'lanishni har doim olib tashlash mumkin (masalan kurs keyin bepul qilingan bo'lsa)
              const disabled = busy || (!!item.disabledReason && !selected);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onToggle(item)}
                    aria-pressed={selected}
                    title={!selected ? item.disabledReason : undefined}
                    className={
                      'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed ' +
                      (selected
                        ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                        : 'border-gray-200 hover:border-[var(--primary)]/40') +
                      (item.disabledReason && !selected ? ' opacity-50' : '')
                    }
                  >
                    <span
                      className={
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ' +
                        (selected ? 'border-[var(--primary)] bg-[var(--primary)] text-white' : 'border-gray-300')
                      }
                    >
                      {busy ? <Loader2 size={12} className="animate-spin" /> : selected ? <Check size={13} /> : null}
                    </span>
                    {item.thumb && (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 text-lg">
                        {item.thumb}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-gray-900" title={item.title}>
                        {item.title}
                      </span>
                      <span className="block truncate text-xs text-gray-500">
                        {item.disabledReason && !selected ? item.disabledReason : item.subtitle}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-xs text-gray-500">
          Tanlangan: <b>{selectedCount}</b> ta. O'zgarishlar darhol saqlanadi.
        </p>
      </div>
    </Modal>
  );
}
