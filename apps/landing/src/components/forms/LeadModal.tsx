import { useEffect } from 'react';
import { X } from 'lucide-react';
import { LeadForm } from './LeadForm';

export function LeadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
          aria-label="Yopish"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 id="lead-modal-title" className="pr-10 text-2xl font-bold text-gray-900">
          Siz bilan bog'lanamiz
        </h2>
        <p className="mb-6 mt-2 text-sm leading-6 text-gray-500">
          Telefon raqamingizni qoldiring. Mutaxassisimiz sizga kurslar haqida batafsil ma'lumot beradi.
        </p>
        <LeadForm />
      </div>
    </div>
  );
}
