import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { APP_QR_URL, APP_STORE_URL, PLAY_STORE_URL } from '../../lib/appLinks';

/** Google Play belgisi (to'rt rangli uchburchak). */
export function GooglePlayIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path fill="#00C3FF" d="M3.2 1.6v20.8L13.4 12 3.2 1.6z" />
      <path fill="#00F076" d="M3.2 1.6 13.4 12l3.3-3.4L4.5 1.5c-.5-.3-1-.2-1.3.1z" />
      <path fill="#FFD500" d="M16.7 8.6 13.4 12l3.3 3.4 4.2-2.4c.9-.5.9-1.5 0-2l-4.2-2.4z" />
      <path fill="#FF3A44" d="M3.2 22.4c.3.3.8.4 1.3.1l12.2-7.1-3.3-3.4L3.2 22.4z" />
    </svg>
  );
}

/** Apple belgisi. */
export function AppleIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

/** Do'kon tugmasining umumiy klassi (qora "badge"). */
export const storeBadge =
  'group flex w-full items-center gap-3 rounded-2xl bg-gray-900 px-4 py-2.5 text-left text-white shadow-sm transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';

export function StoreBadgeLabel({ caption, name }: { caption: string; name: string }) {
  return (
    <span className="flex min-w-0 flex-col leading-tight">
      <span className="text-[11px] font-medium text-white/70">{caption}</span>
      <span className="truncate text-base font-semibold">{name}</span>
    </span>
  );
}

/**
 * Google Play + App Store tugmalari. App Store havolasi hali bo'lmasa (iOS ilova
 * chiqmagan) tugma bosilganda "tez kunda" xabari ko'rsatiladi.
 * `soonTone` — xabar qaysi fonda turishiga qarab rangi ('light' — yashil/qorong'i fon).
 */
export function StoreBadges({
  className = '',
  soonTone = 'default',
  stacked = false,
}: {
  className?: string;
  soonTone?: 'default' | 'light';
  /** Tugmalar doim ustma-ust (tor kartada). */
  stacked?: boolean;
}) {
  const [appStoreSoon, setAppStoreSoon] = useState(false);
  return (
    <div className={className}>
      <div className={`grid gap-3 ${stacked ? '' : 'sm:grid-cols-2'}`}>
        <a href={PLAY_STORE_URL} target="_blank" rel="noreferrer" className={storeBadge}>
          <GooglePlayIcon className="h-7 w-7 shrink-0" />
          <StoreBadgeLabel caption="Yuklab oling" name="Google Play" />
        </a>
        {APP_STORE_URL ? (
          <a href={APP_STORE_URL} target="_blank" rel="noreferrer" className={storeBadge}>
            <AppleIcon className="h-7 w-7 shrink-0" />
            <StoreBadgeLabel caption="Yuklab oling" name="App Store" />
          </a>
        ) : (
          <button type="button" onClick={() => setAppStoreSoon(true)} className={storeBadge}>
            <AppleIcon className="h-7 w-7 shrink-0" />
            <StoreBadgeLabel caption="Yuklab oling" name="App Store" />
          </button>
        )}
      </div>
      {appStoreSoon && (
        <p
          role="status"
          className={
            soonTone === 'light'
              ? 'mt-3 rounded-xl bg-white/15 px-4 py-2 text-center text-sm font-medium text-white'
              : 'mt-3 rounded-xl bg-amber-50 px-4 py-2.5 text-center text-sm font-medium text-amber-800'
          }
        >
          Ilova tez kunda App Store'da chiqadi.
        </p>
      )}
    </div>
  );
}

/**
 * Hero'dagi telefon maketi yonidagi karta: QR kod (telefon kamerasi bilan
 * skanerlab Google Play'dan yuklash) va do'kon tugmalari.
 * QR faqat kompyuterda ma'noli — telefonda faqat tugmalar ko'rsatiladi.
 */
export function AppDownloadCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`w-full max-w-[15rem] rounded-3xl bg-white/10 p-4 text-center ring-1 ring-white/20 backdrop-blur-sm ${className}`}
    >
      <div className="hidden lg:block">
        <div className="mx-auto w-fit rounded-2xl bg-white p-3 shadow-lg">
          <QRCodeSVG
            value={APP_QR_URL}
            size={148}
            level="M"
            marginSize={0}
            title="OAZIS ilovasini yuklab olish uchun QR kod"
          />
        </div>
        <p className="mt-3 text-sm font-semibold leading-snug text-white">
          Telefon kamerasi bilan skanerlang
        </p>
        <p className="mt-1 text-xs text-white/70">va ilovani yuklab oling</p>
      </div>
      <p className="text-sm font-semibold text-white lg:hidden">Ilovani yuklab oling</p>
      <StoreBadges className="mt-4" soonTone="light" stacked />
    </div>
  );
}
