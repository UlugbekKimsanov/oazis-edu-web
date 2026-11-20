import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { useUiStore } from '../../stores/ui-store';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
  /** Saqlash/yuklash davomida tasodifan yopilib ketmasligi uchun */
  closeDisabled?: boolean;
}

// Bir vaqtda bir nechta modal ochiq bo'lishi mumkin — scroll faqat oxirgisi yopilganda qaytadi.
let openCount = 0;

export default function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg', closeDisabled = false }: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const closeDisabledRef = useRef(closeDisabled);

  useEffect(() => {
    onCloseRef.current = onClose;
    closeDisabledRef.current = closeDisabled;
  });

  useEffect(() => {
    if (!open) return;
    openCount += 1;
    document.body.style.overflow = 'hidden';
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || closeDisabledRef.current) return;
      // Tasdiqlash oynasi ochiq bo'lsa Esc faqat uni yopadi — ostidagi modal joyida qoladi
      if (useUiStore.getState().confirmState) return;
      // Faqat eng ustki modal yopiladi
      const dialogs = document.querySelectorAll('[data-modal-panel]');
      if (dialogs[dialogs.length - 1] === panelRef.current) onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      openCount -= 1;
      if (openCount <= 0) {
        openCount = 0;
        document.body.style.overflow = '';
      }
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const requestClose = () => { if (!closeDisabled) onClose(); };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={requestClose} />
      <div
        ref={panelRef}
        data-modal-panel
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative bg-white rounded-xl shadow-2xl w-full ${maxWidth} mx-4 max-h-[90vh] flex flex-col outline-none`}
      >
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-100">
          <h2 id={titleId} className="min-w-0 truncate text-lg font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={requestClose}
            disabled={closeDisabled}
            aria-label="Yopish"
            className="shrink-0 p-1 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X size={18} className="text-gray-400" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
