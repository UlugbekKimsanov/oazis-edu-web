import { useEffect } from 'react';
import { X } from 'lucide-react';
import { LeadForm } from './LeadForm';
import type { LandingContent } from '../../data/landing';

export function LeadModal({
  open,
  onClose,
  modal,
  cta,
  formCopy,
}: {
  open: boolean;
  onClose: () => void;
  modal: LandingContent['leadModal'];
  cta: LandingContent['cta'];
  formCopy: LandingContent['leadForm'];
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lead-modal-title"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          aria-label={modal.closeLabel}
        >
          <X className="h-5 w-5" />
        </button>
        <h2 id="lead-modal-title" className="pr-10 text-2xl font-bold text-gray-900">
          {modal.title}
        </h2>
        <p className="mb-6 mt-2 text-sm leading-6 text-gray-500">
          {modal.description}
        </p>
        <LeadForm
          nameLabel={cta.nameLabel}
          phoneLabel={cta.phoneLabel}
          submitLabel={cta.submitLabel}
          copy={formCopy}
        />
      </div>
    </div>
  );
}
