import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { GoogleButton } from './GoogleButton';
import {
  GOOGLE_CLIENT_ID,
  apiErrorMessage,
  loginWithGoogle,
  loginWithOtp,
  loginWithPassword,
  registerAccount,
  sendOtp,
  type AuthUser,
} from '../../lib/auth';
import { formatUzPhone, isCompleteUzPhone } from '../../lib/phone';

type View = 'login' | 'register' | 'otp';

const OTP_LENGTH = 5;
const RESEND_SECONDS = 60;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const inputClass =
  'w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-50';

/**
 * Kirish / ro'yxatdan o'tish oynasi — mobil ilovadagi usullar bilan bir xil:
 * asosiy usul email (5 xonali kod yoki parol), qo'shimcha usul Google.
 * `reason` — nima uchun kirish so'ralayotganini tushuntiradi (masalan xarid).
 */
export function AuthModal({
  open,
  initialView = 'login',
  reason,
  onClose,
  onAuthenticated,
}: {
  open: boolean;
  initialView?: 'login' | 'register';
  reason?: string;
  onClose: () => void;
  onAuthenticated: (user: AuthUser) => void;
}) {
  if (!open) return null;
  // Har ochilishda holat toza boshlanishi uchun ichki komponent qayta mount bo'ladi.
  return (
    <AuthDialog
      initialView={initialView}
      reason={reason}
      onClose={onClose}
      onAuthenticated={onAuthenticated}
    />
  );
}

function AuthDialog({
  initialView,
  reason,
  onClose,
  onAuthenticated,
}: {
  initialView: 'login' | 'register';
  reason?: string;
  onClose: () => void;
  onAuthenticated: (user: AuthUser) => void;
}) {
  const [view, setView] = useState<View>(initialView);
  /** OTP qaysi oqim uchun yuborilgan: kirish yoki ro'yxatdan o'tish. */
  const [otpFor, setOtpFor] = useState<'login' | 'register'>(initialView);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('+998 ');
  const [otp, setOtp] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

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

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const switchView = (next: View) => {
    setView(next);
    setError(null);
    setInfo(null);
  };

  const normalizedEmail = email.trim().toLowerCase();

  async function run(action: () => Promise<void>, fallback: string) {
    if (loading) return;
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      await action();
    } catch (err) {
      setError(apiErrorMessage(err, fallback));
    } finally {
      setLoading(false);
    }
  }

  function requestOtp(target: 'login' | 'register') {
    return run(async () => {
      await sendOtp(normalizedEmail, target === 'login');
      setOtpFor(target);
      setOtp('');
      setResendIn(RESEND_SECONDS);
      setView('otp');
    }, "Tasdiqlash kodi yuborilmadi. Qayta urinib ko'ring.");
  }

  function handleLoginSubmit(event: FormEvent) {
    event.preventDefault();
    if (!EMAIL_RE.test(normalizedEmail)) {
      setError("Email manzilini to'g'ri kiriting");
      return;
    }
    if (usePassword) {
      if (!password) {
        setError('Parolni kiriting');
        return;
      }
      void run(async () => {
        onAuthenticated(await loginWithPassword(normalizedEmail, password));
      }, "Email yoki parol noto'g'ri");
      return;
    }
    void requestOtp('login');
  }

  function handleRegisterSubmit(event: FormEvent) {
    event.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError('Ism va familiyangizni kiriting');
      return;
    }
    if (!isCompleteUzPhone(phone)) {
      setError("Telefon raqamini to'liq kiriting");
      return;
    }
    if (!EMAIL_RE.test(normalizedEmail)) {
      setError("Email manzilini to'g'ri kiriting");
      return;
    }
    void requestOtp('register');
  }

  function handleOtpSubmit(event: FormEvent) {
    event.preventDefault();
    if (otp.length !== OTP_LENGTH) {
      setError(`${OTP_LENGTH} xonali kodni kiriting`);
      return;
    }
    void run(async () => {
      try {
        const user =
          otpFor === 'login'
            ? await loginWithOtp(normalizedEmail, otp)
            : await registerAccount({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                phone: `+${phone.replace(/\D/g, '')}`,
                email: normalizedEmail,
                otpCode: otp,
              });
        onAuthenticated(user);
      } catch (err) {
        setOtp('');
        throw err;
      }
    }, "Kod noto'g'ri. Qayta kiriting");
  }

  function handleResend() {
    if (resendIn > 0) return;
    void run(async () => {
      await sendOtp(normalizedEmail, otpFor === 'login');
      setOtp('');
      setResendIn(RESEND_SECONDS);
      setInfo('Tasdiqlash kodi qayta yuborildi');
    }, "Kod yuborilmadi. Qayta urinib ko'ring.");
  }

  const handleGoogle = useCallback(
    (idToken: string) => {
      setLoading(true);
      setError(null);
      setInfo(null);
      loginWithGoogle(idToken)
        .then(onAuthenticated)
        .catch((err: unknown) => {
          setError(apiErrorMessage(err, "Google orqali kirib bo'lmadi. Qayta urinib ko'ring."));
        })
        .finally(() => setLoading(false));
    },
    [onAuthenticated],
  );

  const title =
    view === 'otp' ? 'Kodni kiriting' : view === 'register' ? "Ro'yxatdan o'tish" : 'Kirish';

  const googleBlock = GOOGLE_CLIENT_ID ? (
    <>
      <div className="my-5 flex items-center gap-3 text-xs text-gray-400">
        <span className="h-px flex-1 bg-gray-200" />
        yoki
        <span className="h-px flex-1 bg-gray-200" />
      </div>
      <GoogleButton onCredential={handleGoogle} disabled={loading} />
    </>
  ) : null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-gray-950/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div className="relative my-auto w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Sarlavha qismi */}
        <div className="relative bg-gradient-to-br from-primary to-primary-dark px-6 pb-6 pt-7 text-white sm:px-8">
        <span className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10" />
        <span className="pointer-events-none absolute -bottom-12 -left-8 h-28 w-28 rounded-full bg-white/10" />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full p-2 text-white/80 transition hover:bg-white/15 hover:text-white"
          aria-label="Yopish"
        >
          <X className="h-5 w-5" />
        </button>

        {view === 'otp' && (
          <button
            type="button"
            onClick={() => switchView(otpFor)}
            className="relative mb-3 inline-flex items-center gap-1 text-sm font-medium text-white/80 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Orqaga
          </button>
        )}

        <h2 id="auth-modal-title" className="relative pr-10 text-2xl font-bold text-white">
          {title}
        </h2>
        <p className="relative mt-2 text-sm leading-6 text-white/85">
          {view === 'otp' ? (
            <>
              <span className="font-semibold text-white">{normalizedEmail}</span> manziliga{' '}
              {OTP_LENGTH} xonali tasdiqlash kodi yuborildi. Bir nechta xat kelgan bo'lsa, eng
              oxirgisidagi kodni kiriting.
            </>
          ) : (
            reason ||
            (view === 'register'
              ? "Hisob yarating — xaridlaringiz OAZIS ilovasida ham ochiladi."
              : 'OAZIS hisobingizga kiring.')
          )}
        </p>
        </div>

        <div className="px-6 pb-6 pt-5 sm:px-8 sm:pb-8">
        {view === 'login' && (
          <>
            <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4" noValidate>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-gray-700">Email</span>
                <input
                  autoFocus
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  className={inputClass}
                  value={email}
                  disabled={loading}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="email@example.com"
                />
              </label>
              {usePassword && (
                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-gray-700">Parol</span>
                  <input
                    type="password"
                    autoComplete="current-password"
                    className={inputClass}
                    value={password}
                    disabled={loading}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>
              )}
              <Button type="submit" disabled={loading}>
                {loading
                  ? usePassword
                    ? 'Yuklanmoqda...'
                    : 'Kod yuborilmoqda...'
                  : usePassword
                    ? 'Kirish'
                    : 'Kod yuborish'}
              </Button>
              <button
                type="button"
                className="self-center text-sm font-medium text-primary hover:underline"
                onClick={() => {
                  setUsePassword((v) => !v);
                  setPassword('');
                  setError(null);
                }}
              >
                {usePassword ? 'Emailga kod yuborish orqali kirish' : 'Parol bilan kirish'}
              </button>
            </form>
            {googleBlock}
          </>
        )}

        {view === 'register' && (
          <>
            <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-4" noValidate>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-gray-700">Ism</span>
                  <input
                    autoFocus
                    autoComplete="given-name"
                    className={inputClass}
                    value={firstName}
                    maxLength={100}
                    disabled={loading}
                    onChange={(event) => setFirstName(event.target.value)}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-semibold text-gray-700">Familiya</span>
                  <input
                    autoComplete="family-name"
                    className={inputClass}
                    value={lastName}
                    maxLength={100}
                    disabled={loading}
                    onChange={(event) => setLastName(event.target.value)}
                  />
                </label>
              </div>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-gray-700">Telefon raqam</span>
                <input
                  inputMode="tel"
                  autoComplete="tel"
                  className={inputClass}
                  value={phone}
                  disabled={loading}
                  onChange={(event) => setPhone(formatUzPhone(event.target.value))}
                  placeholder="+998 90 123 45 67"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-gray-700">Email</span>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  className={inputClass}
                  value={email}
                  disabled={loading}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="email@example.com"
                />
                <span className="block text-xs text-gray-400">
                  Tasdiqlash kodi shu emailga yuboriladi.
                </span>
              </label>
              <Button type="submit" disabled={loading}>
                {loading ? 'Kod yuborilmoqda...' : 'Kod yuborish'}
              </Button>
            </form>
            {googleBlock}
          </>
        )}

        {view === 'otp' && (
          <form onSubmit={handleOtpSubmit} className="flex flex-col gap-4" noValidate>
            <input
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-label="Tasdiqlash kodi"
              className={`${inputClass} text-center text-2xl font-bold tracking-[0.6em]`}
              value={otp}
              maxLength={OTP_LENGTH}
              disabled={loading}
              onChange={(event) => {
                setOtp(event.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH));
                setError(null);
              }}
              placeholder={'•'.repeat(OTP_LENGTH)}
            />
            <Button type="submit" disabled={loading || otp.length !== OTP_LENGTH}>
              {loading ? 'Tekshirilmoqda...' : 'Tasdiqlash'}
            </Button>
            <button
              type="button"
              disabled={resendIn > 0 || loading}
              onClick={handleResend}
              className="self-center text-sm font-medium text-primary hover:underline disabled:text-gray-400 disabled:no-underline"
            >
              {resendIn > 0 ? `Kodni qayta yuborish (${resendIn} s)` : 'Kodni qayta yuborish'}
            </button>
          </form>
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {error}
            {/* Ro'yxatdan o'tishda email band bo'lsa — shu emailni saqlagan holda kirishga o'tkazamiz. */}
            {view === 'register' && /email allaqachon ro'yxatdan o'tgan/i.test(error) && (
              <>
                {' '}
                <button
                  type="button"
                  onClick={() => switchView('login')}
                  className="font-semibold text-primary underline-offset-2 hover:underline"
                >
                  Kirish
                </button>
              </>
            )}
          </p>
        )}
        {info && !error && (
          <p role="status" className="mt-4 text-sm text-primary">
            {info}
          </p>
        )}

        {view !== 'otp' && (
          <p className="mt-6 text-center text-sm text-gray-500">
            {view === 'login' ? "Hisob yo'qmi? " : 'Hisobingiz bormi? '}
            <button
              type="button"
              className="font-semibold text-primary hover:underline"
              onClick={() => switchView(view === 'login' ? 'register' : 'login')}
            >
              {view === 'login' ? "Ro'yxatdan o'ting" : 'Kirish'}
            </button>
          </p>
        )}
        </div>
      </div>
    </div>
  );
}
