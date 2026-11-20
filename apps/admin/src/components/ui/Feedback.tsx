import { useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useUiStore } from '../../stores/ui-store';
import Button from './Button';

const TOAST_STYLE = {
  success: { icon: CheckCircle2, cls: 'border-green-200 text-green-800', iconCls: 'text-green-600' },
  error: { icon: XCircle, cls: 'border-red-200 text-red-800', iconCls: 'text-red-600' },
  info: { icon: Info, cls: 'border-gray-200 text-gray-800', iconCls: 'text-gray-500' },
} as const;

/** Toast'lar va tasdiqlash oynasi — layout'da bir marta joylanadi. */
export default function Feedback() {
  const { toasts, dismissToast, confirmState, closeConfirm } = useUiStore();
  const confirmBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!confirmState) return;
    confirmBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeConfirm(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmState, closeConfirm]);

  return (
    <>
      <div className="fixed bottom-4 right-4 z-[200] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => {
          const s = TOAST_STYLE[t.type];
          return (
            <div
              key={t.id}
              role={t.type === 'error' ? 'alert' : 'status'}
              className={`flex items-start gap-3 rounded-xl border bg-white px-4 py-3 text-sm shadow-lg ${s.cls}`}
            >
              <s.icon size={18} className={`mt-0.5 shrink-0 ${s.iconCls}`} />
              <span className="flex-1 break-words">{t.text}</span>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                aria-label="Yopish"
                className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {confirmState && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => closeConfirm(false)} />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  confirmState.danger ? 'bg-red-50 text-red-600' : 'bg-[var(--primary-light)] text-[var(--primary)]'
                }`}
              >
                <AlertTriangle size={20} />
              </div>
              <div className="min-w-0">
                <h2 id="confirm-title" className="text-base font-semibold text-gray-900">{confirmState.title}</h2>
                {confirmState.message && (
                  <p className="mt-1 break-words text-sm text-gray-500">{confirmState.message}</p>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => closeConfirm(false)}>
                {confirmState.cancelText ?? 'Bekor qilish'}
              </Button>
              <Button ref={confirmBtn} variant={confirmState.danger ? 'danger' : 'primary'} onClick={() => closeConfirm(true)}>
                {confirmState.confirmText ?? (confirmState.danger ? "O'chirish" : 'Tasdiqlash')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
