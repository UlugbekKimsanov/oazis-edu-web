import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Smartphone, Truck, X } from 'lucide-react';
import { APP_STORE_URL, PLAY_STORE_URL, detectPlatform } from '../../lib/appLinks';
import { AppleIcon, GooglePlayIcon, StoreBadgeLabel, storeBadge } from './StoreBadges';

export interface AppDownloadInfo {
  /** 'success' — yakunlangan amal, 'info' — tushuntirish, 'warning' — amal bajarilmadi. */
  tone: 'success' | 'info' | 'warning';
  title: string;
  text: string;
  /** Foydalanuvchi saytda kirganmi — qadamlar matni shunga qarab o'zgaradi. */
  hasAccount: boolean;
  /**
   * 'app' (standart) — ilovani yuklashga yo'naltiradi (qadamlar va do'kon tugmalari);
   * 'delivery' — bosma kitob: operator yetkazib berish bo'yicha bog'lanadi;
   * 'message' — oddiy xabar (faqat "Tushunarli" tugmasi).
   */
  mode?: 'app' | 'delivery' | 'message';
  /**
   * Mobil ilovani ochadigan deep link (oazis://...). Telefonda berilsa, oynada
   * asosiy tugma "Ilovaga qaytish" bo'ladi — ilova o'rnatilgan foydalanuvchi
   * do'kon tugmalari o'rniga to'g'ridan-to'g'ri ilovaga qaytadi.
   */
  returnToApp?: string;
}

const toneStyles = {
  success: { band: 'from-primary to-primary-dark', Icon: CheckCircle2 },
  info: { band: 'from-primary to-primary-dark', Icon: Smartphone },
  warning: { band: 'from-amber-500 to-orange-600', Icon: AlertCircle },
} as const;

/**
 * Sayt oynalarining umumiy ko'rinishi: rangli sarlavha qismi (belgi + sarlavha) va
 * oq tana. Rejimga qarab: ilovani yuklashga yo'naltiradi (qurilmaga mos do'kon —
 * iPhone/iPad → App Store, Android → Google Play, kompyuterda ikkalasi), bosma kitob
 * yetkazib berilishini aytadi yoki oddiy xabar ko'rsatadi.
 */
export function AppDownloadDialog({ info, onClose }: { info: AppDownloadInfo; onClose: () => void }) {
  // App Store havolasi hali yo'q bo'lsa, tugma bosilganda shu xabar ko'rsatiladi.
  const [appStoreSoon, setAppStoreSoon] = useState(false);

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

  const mode = info.mode ?? 'app';
  const platform = detectPlatform();
  const mobile = platform !== 'other';
  const showReturn = Boolean(info.returnToApp) && mobile;
  const showPlay = platform !== 'ios';
  const showAppStore = platform !== 'android';
  const { band } = toneStyles[info.tone];
  const Icon = mode === 'delivery' ? Truck : toneStyles[info.tone].Icon;

  const steps = [
    'OAZIS ilovasini yuklab oling.',
    info.hasAccount
      ? 'Saytdagi hisobingiz bilan (shu email orqali) kiring.'
      : "Email orqali ro'yxatdan o'ting yoki hisobingizga kiring.",
    'Darslarni ilovada davom ettiring.',
  ];

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-gray-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-download-title"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div className="relative my-auto w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Sarlavha qismi */}
        <div className={`relative bg-gradient-to-br ${band} px-6 pb-7 pt-8 text-center text-white sm:px-8`}>
          <span className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10" />
          <span className="pointer-events-none absolute -bottom-12 -left-8 h-28 w-28 rounded-full bg-white/10" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full p-2 text-white/80 transition hover:bg-white/15 hover:text-white"
            aria-label="Yopish"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/30">
            <Icon className="h-8 w-8" />
          </div>
          <h2 id="app-download-title" className="relative mt-4 text-2xl font-bold leading-tight">
            {info.title}
          </h2>
        </div>

        {/* Tana */}
        <div className="px-6 pb-6 pt-5 sm:px-8 sm:pb-8">
          <p className="text-center text-sm leading-6 text-gray-600">{info.text}</p>

          {showReturn ? (
            <>
              <a
                href={info.returnToApp}
                className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
              >
                Ilovaga qaytish
              </a>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 w-full rounded-xl py-2 text-sm font-medium text-gray-500 transition hover:text-gray-800"
              >
                Yopish
              </button>
            </>
          ) : mode === 'app' ? (
            <>
              <ol className="mt-5 space-y-3">
                {steps.map((step, index) => (
                  <li key={step} className="flex items-start gap-3 text-sm text-gray-700">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary">
                      {index + 1}
                    </span>
                    <span className="pt-0.5 leading-5">{step}</span>
                  </li>
                ))}
              </ol>

              <div className={`mt-6 grid gap-3 ${showPlay && showAppStore ? 'sm:grid-cols-2' : ''}`}>
                {showPlay && (
                  <a href={PLAY_STORE_URL} target="_blank" rel="noreferrer" className={storeBadge}>
                    <GooglePlayIcon className="h-7 w-7 shrink-0" />
                    <StoreBadgeLabel caption="Yuklab oling" name="Google Play" />
                  </a>
                )}
                {showAppStore &&
                  (APP_STORE_URL ? (
                    <a href={APP_STORE_URL} target="_blank" rel="noreferrer" className={storeBadge}>
                      <AppleIcon className="h-7 w-7 shrink-0" />
                      <StoreBadgeLabel caption="Yuklab oling" name="App Store" />
                    </a>
                  ) : (
                    <button type="button" onClick={() => setAppStoreSoon(true)} className={storeBadge}>
                      <AppleIcon className="h-7 w-7 shrink-0" />
                      <StoreBadgeLabel caption="Yuklab oling" name="App Store" />
                    </button>
                  ))}
              </div>

              {appStoreSoon && (
                <p
                  role="status"
                  className="mt-3 rounded-xl bg-amber-50 px-4 py-2.5 text-center text-sm font-medium text-amber-800"
                >
                  Ilova tez kunda App Store'da chiqadi.
                </p>
              )}

              <button
                type="button"
                onClick={onClose}
                className="mt-4 w-full rounded-xl py-2 text-sm font-medium text-gray-500 transition hover:text-gray-800"
              >
                Keyinroq
              </button>
            </>
          ) : (
            <button
              type="button"
              autoFocus
              onClick={onClose}
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              Tushunarli
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
