import { useEffect, useState } from 'react';
import { Truck, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { fetchCheckout, payCheckout, type CheckoutInfo } from '../../lib/api';

type Phase = 'loading' | 'ready' | 'error';

/**
 * Mobil ilovadan kelgan `?t=<token>` havolasi uchun to'liq ekran checkout oynasi.
 * Token bo'yicha mahsulot va to'lov usullarini ko'rsatadi, "To'lovga o'tish"
 * bosilganda provayderning checkoutUrl sahifasiga yo'naltiradi.
 */
export function CheckoutOverlay({ token, onClose }: { token: string; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [info, setInfo] = useState<CheckoutInfo | null>(null);
  const [method, setMethod] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Boshlang'ich holat 'loading'; komponent token bilan birga mount/unmount bo'ladi,
  // shuning uchun effektda holatni qayta tiklash shart emas.
  useEffect(() => {
    let active = true;
    fetchCheckout(token)
      .then((data) => {
        if (!active) return;
        setInfo(data);
        setMethod(data.methods?.[0]?.code ?? null);
        setPhase('ready');
      })
      .catch(() => {
        if (active) setPhase('error');
      });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handlePay = async () => {
    if (!method || paying) return;
    setPaying(true);
    setPayError(null);
    try {
      const url = await payCheckout(token, method);
      // Redirect boshlanguncha tugma "Yo'naltirilmoqda..." holatida qoladi.
      window.location.href = url;
    } catch {
      setPayError("To'lovni boshlab bo'lmadi. Qaytadan urinib ko'ring.");
      setPaying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-overlay-title"
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

        {phase === 'loading' && (
          <div className="flex flex-col items-center gap-4 py-10">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-light border-t-primary" />
            <p className="text-sm text-gray-500">Ma'lumotlar yuklanmoqda...</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-col items-center gap-5 py-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-2xl">
              !
            </div>
            <h2 id="checkout-overlay-title" className="text-xl font-bold text-gray-900">
              Havola yaroqsiz
            </h2>
            <p className="text-sm leading-6 text-gray-500">
              Havolaning muddati o'tgan. Ilovadan qaytadan "Sotib olish"ni bosing.
            </p>
            <Button variant="outline" className="w-full" onClick={onClose}>
              Yopish
            </Button>
          </div>
        )}

        {phase === 'ready' && info && (
          <div className="pr-6">
            {info.userName && (
              <p className="text-sm font-medium text-primary">Salom, {info.userName}!</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h2 id="checkout-overlay-title" className="text-xl font-bold text-gray-900">
                {info.title}
              </h2>
              <span className="rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary">
                {info.productType === 'book' ? 'Kitob' : 'Kurs'}
              </span>
            </div>
            <p className="mt-3 text-2xl font-bold text-primary">{info.priceLabel}</p>
            {info.deliveryLabel && (
              <p className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                <Truck className="h-4 w-4 shrink-0 text-primary" />
                {info.deliveryLabel}
              </p>
            )}

            <p className="mb-2 mt-6 text-sm font-semibold text-gray-700">To'lov usulini tanlang</p>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="To'lov usullari">
              {info.methods.map((m) => {
                const selected = method === m.code;
                return (
                  <button
                    key={m.code}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setMethod(m.code)}
                    disabled={paying}
                    className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-sm font-medium transition-colors disabled:opacity-60 ${
                      selected
                        ? 'border-primary bg-primary-light text-gray-900'
                        : 'border-gray-200 text-gray-700 hover:border-primary/40'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        selected ? 'border-primary' : 'border-gray-300'
                      }`}
                    >
                      {selected && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                    </span>
                    <span className="flex-1">{m.name}</span>
                    {m.isNasiya && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                        Nasiya
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {payError && <p className="mt-3 text-sm text-red-600">{payError}</p>}

            <Button
              className="mt-6 w-full"
              onClick={handlePay}
              disabled={paying || !method}
            >
              {paying ? "Yo'naltirilmoqda..." : "To'lovga o'tish"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
