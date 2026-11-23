import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Bot, Eye, EyeOff, MessageSquareText, ShieldCheck, Smartphone } from 'lucide-react';
import Button from '../../components/ui/Button';
import PageHeader from '../../components/ui/PageHeader';
import { ErrorState, Skeleton } from '../../components/ui/States';
import api from '../../lib/api';
import { apiErrorMessage } from '../../lib/errors';
import { formatDateTime } from '../../lib/format';
import { confirmDialog, toast } from '../../stores/ui-store';

type SettingsSource = 'database' | 'environment' | 'none';

interface TelegramSettings {
  botUsername: string;
  pollingEnabled: boolean;
  tokenConfigured: boolean;
  tokenMasked: string;
  tokenSource: SettingsSource;
}

interface EskizSettings {
  emailConfigured: boolean;
  emailMasked: string;
  passwordConfigured: boolean;
  passwordMasked: string;
  from: string;
  credentialsSource: SettingsSource;
}

interface IntegrationSettings {
  telegram: TelegramSettings;
  eskiz: EskizSettings;
  updatedAt?: string | null;
}

interface SettingsForm {
  telegramBotUsername: string;
  telegramBotToken: string;
  telegramPollingEnabled: boolean;
  eskizEmail: string;
  eskizPassword: string;
  eskizFrom: string;
}

type FieldErrors = Partial<Record<keyof SettingsForm, string>>;

// Backend cheklovlari (UpdateIntegrationSettingsRequest + IntegrationSettingsService)
const USERNAME_RE = /^[A-Za-z0-9_]{5,64}$/;
const TOKEN_RE = /^\d+:[A-Za-z0-9_-]{20,}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SECRET = 255;
const MAX_SHORT = 64;

const inputClass =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 disabled:bg-gray-50';
const inputErrorClass = 'border-red-300 focus:border-red-400 focus:ring-red-200';

/** Backend kabi: bo'shliqlar olinadi, boshidagi "@" tashlanadi. */
function normalizeUsername(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith('@') ? trimmed.slice(1).trim() : trimmed;
}

/**
 * Serverdagi holatdan forma. Maxfiy maydonlar (token, email, parol) DOIM bo'sh boshlanadi:
 * server ularni qaytarmaydi, niqob ("********") esa hech qachon forma qiymatiga tushmaydi.
 */
function formFromSettings(data: IntegrationSettings): SettingsForm {
  return {
    telegramBotUsername: data.telegram.botUsername ?? '',
    telegramBotToken: '',
    telegramPollingEnabled: Boolean(data.telegram.pollingEnabled),
    eskizEmail: '',
    eskizPassword: '',
    eskizFrom: data.eskiz.from ?? '',
  };
}

/**
 * Faqat o'zgargan maydonlar yuboriladi. Backendda null/bo'sh qiymat "mavjudini saqla" degani,
 * shuning uchun tegilmagan maxfiy maydon serverdagi haqiqiy qiymatni hech qachon o'chirmaydi.
 */
function buildPayload(form: SettingsForm, base: SettingsForm): Partial<SettingsForm> {
  const payload: Partial<SettingsForm> = {};
  const username = normalizeUsername(form.telegramBotUsername);
  if (username !== base.telegramBotUsername) payload.telegramBotUsername = username;
  const token = form.telegramBotToken.trim();
  if (token) payload.telegramBotToken = token;
  if (form.telegramPollingEnabled !== base.telegramPollingEnabled) {
    payload.telegramPollingEnabled = form.telegramPollingEnabled;
  }
  const email = form.eskizEmail.trim();
  if (email) payload.eskizEmail = email;
  const password = form.eskizPassword.trim();
  if (password) payload.eskizPassword = password;
  const from = form.eskizFrom.trim();
  if (from !== base.eskizFrom) payload.eskizFrom = from;
  return payload;
}

function validate(form: SettingsForm, base: SettingsForm): FieldErrors {
  const errors: FieldErrors = {};

  const username = normalizeUsername(form.telegramBotUsername);
  if (!username && base.telegramBotUsername) {
    // Backend bo'sh qiymatni "eskisini saqla" deb tushunadi — o'chirib bo'lmaydi
    errors.telegramBotUsername = "Username'ni bo'sh qoldirib bo'lmaydi — yangisini kiriting.";
  } else if (username && !USERNAME_RE.test(username)) {
    errors.telegramBotUsername = "5–64 ta lotin harfi, raqam yoki pastki chiziq (_) bo'lishi kerak.";
  }

  const token = form.telegramBotToken.trim();
  if (token.length > MAX_SECRET) {
    errors.telegramBotToken = `Token ${MAX_SECRET} belgidan oshmasligi kerak.`;
  } else if (token && !TOKEN_RE.test(token)) {
    errors.telegramBotToken =
      "Token formati noto'g'ri. BotFather bergan tokenni to'liq nusxalang (123456:ABC... ko'rinishida).";
  }

  const email = form.eskizEmail.trim();
  if (email.length > MAX_SECRET) {
    errors.eskizEmail = `Email ${MAX_SECRET} belgidan oshmasligi kerak.`;
  } else if (email && !EMAIL_RE.test(email)) {
    errors.eskizEmail = "Email manzili noto'g'ri.";
  }

  if (form.eskizPassword.trim().length > MAX_SECRET) {
    errors.eskizPassword = `Parol ${MAX_SECRET} belgidan oshmasligi kerak.`;
  }

  const from = form.eskizFrom.trim();
  if (!from && base.eskizFrom) {
    errors.eskizFrom = "Jo'natuvchini bo'sh qoldirib bo'lmaydi — yangisini kiriting.";
  } else if (from.length > MAX_SHORT) {
    errors.eskizFrom = `Jo'natuvchi ${MAX_SHORT} belgidan oshmasligi kerak.`;
  }

  return errors;
}

function sourceHint(source: SettingsSource | undefined) {
  if (source === 'database') return 'Hozirgi qiymat admin paneldan kiritilgan.';
  if (source === 'environment') {
    return "Hozir server konfiguratsiyasidagi qiymat ishlatilmoqda; bu yerda kiritilgani undan ustun bo'ladi.";
  }
  return 'Hali sozlanmagan.';
}

function StatusBadge({ ok, okText, warnText }: { ok: boolean; okText: string; warnText: string }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
        ok ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
      }`}
    >
      {ok ? okText : warnText}
    </span>
  );
}

function SectionCard({
  icon: Icon,
  iconClass,
  title,
  description,
  badge,
  children,
}: {
  icon: LucideIcon;
  iconClass: string;
  title: string;
  description: string;
  badge: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={`shrink-0 rounded-lg p-2 ${iconClass}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
            <p className="mt-0.5 text-xs text-gray-500">{description}</p>
          </div>
        </div>
        {badge}
      </div>
      {children}
    </section>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>
      )}
    </div>
  );
}

/** Maxfiy qiymat: sukut bo'yicha yashirin, ko'z tugmasi faqat admin O'ZI yozgan matnni ko'rsatadi. */
function SecretInput({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  invalid,
  maxLength,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled: boolean;
  invalid: boolean;
  maxLength: number;
}) {
  const [visible, setVisible] = useState(false);
  // Maydon bo'shaganda (masalan, saqlangandan keyin) yana yashirin holatga qaytadi
  const shown = visible && value !== '';
  return (
    <div className="relative">
      <input
        id={id}
        // Brauzer/parol menejeri adminning o'z login-parolini bu yerga to'ldirib yubormasligi uchun
        name={`oazis-${id}`}
        type={shown ? 'text' : 'password'}
        value={value}
        onChange={(event) => {
          if (event.target.value === '') setVisible(false);
          onChange(event.target.value);
        }}
        placeholder={placeholder}
        className={`${inputClass} pr-10 ${invalid ? inputErrorClass : ''}`}
        autoComplete="new-password"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        data-lpignore="true"
        data-1p-ignore="true"
        maxLength={maxLength}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        disabled={disabled || value === ''}
        aria-label={shown ? 'Yashirish' : "Ko'rsatish"}
        title={shown ? 'Yashirish' : "Ko'rsatish"}
        aria-pressed={shown}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="max-w-3xl space-y-6" role="status" aria-label="Sozlamalar yuklanmoqda">
      {[0, 1].map((card) => (
        <div key={card} className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-2 h-3 w-56 max-w-full" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
          <Skeleton className="mt-5 h-12 w-full" />
        </div>
      ))}
    </div>
  );
}

const CONFIGURED_PLACEHOLDER = '•••••••• (saqlangan)';

export default function SettingsPage() {
  const [settings, setSettings] = useState<IntegrationSettings | null>(null);
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Saqlangandan keyin maxfiy maydonlarni qayta yaratish (ko'rsatish holati ham tozalanadi)
  const [formVersion, setFormVersion] = useState(0);
  const requestId = useRef(0);
  const savingRef = useRef(false);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setLoadError(null);
    try {
      const response = await api.get('/admin/settings');
      if (id !== requestId.current) return; // eskirgan javob
      const data = (response.data?.data ?? response.data) as IntegrationSettings | undefined;
      if (!data?.telegram || !data?.eskiz) throw new Error('unexpected settings response');
      setSettings(data);
      setForm(formFromSettings(data));
      setFormVersion((version) => version + 1);
    } catch (error) {
      if (id !== requestId.current) return;
      // Xatoda forma ko'rsatilmaydi: bo'sh forma "hech narsa sozlanmagan" degan noto'g'ri taassurot beradi
      setLoadError(apiErrorMessage(error, "Sozlamalarni yuklab bo'lmadi. Qayta urinib ko'ring."));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- birinchi yuklash
    void load();
  }, [load]);

  const base = settings ? formFromSettings(settings) : null;
  const payload = form && base ? buildPayload(form, base) : {};
  const dirty = Object.keys(payload).length > 0;
  const errors = form && base ? validate(form, base) : {};

  // Saqlanmagan o'zgarish bilan sahifani yopish/yangilashdan oldin brauzer ogohlantiradi
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const updateForm = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  };

  const handleReset = () => {
    if (!settings) return;
    setForm(formFromSettings(settings));
    setFormVersion((version) => version + 1);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form || !base || !dirty || savingRef.current) return;

    const firstError = Object.values(errors)[0];
    if (firstError) {
      toast.error(firstError);
      return;
    }

    // Tasdiqlash oynasi ochiq turganda ham ikkinchi submit o'tmasin
    savingRef.current = true;
    try {
      if (payload.telegramPollingEnabled === false) {
        const ok = await confirmDialog({
          title: "Long polling o'chirilsinmi?",
          message:
            "Bot Telegram'dan kelgan xabarlarni qabul qilmay qo'yadi. Keyinroq shu sahifadan qayta yoqishingiz mumkin.",
          confirmText: "O'chirish",
          danger: true,
        });
        if (!ok) return;
      }

      setSaving(true);
      const telegramChanged =
        'telegramBotToken' in payload || 'telegramBotUsername' in payload || 'telegramPollingEnabled' in payload;
      const response = await api.put('/admin/settings', payload);
      const data = (response.data?.data ?? response.data) as IntegrationSettings | undefined;
      if (data?.telegram && data?.eskiz) {
        setSettings(data);
        setForm(formFromSettings(data)); // maxfiy maydonlar tozalanadi
        setFormVersion((version) => version + 1);
      } else {
        void load();
      }
      toast.success(
        telegramChanged
          ? 'Sozlamalar saqlandi. Telegram bot yangi sozlama bilan qayta ulanmoqda.'
          : 'Sozlamalar saqlandi.',
      );
    } catch (error) {
      // Forma va kiritilgan qiymatlar joyida qoladi
      toast.error(apiErrorMessage(error, "Sozlamalarni saqlab bo'lmadi. Qayta urinib ko'ring."));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const header = (
    <PageHeader
      title="Integratsiya sozlamalari"
      description="Telegram bot va SMS yuborish xizmatini serverni qayta deploy qilmasdan boshqaring."
    />
  );

  if (loadError && !loading) {
    return (
      <div>
        {header}
        <div className="max-w-3xl rounded-xl border border-gray-200 bg-white">
          <ErrorState message={loadError} onRetry={() => void load()} />
        </div>
      </div>
    );
  }

  if (loading || !settings || !form) {
    return (
      <div>
        {header}
        <SettingsSkeleton />
      </div>
    );
  }

  const { telegram, eskiz } = settings;
  const eskizReady = eskiz.emailConfigured && eskiz.passwordConfigured;

  return (
    <div>
      {header}

      <form onSubmit={handleSave} noValidate autoComplete="off" className="max-w-3xl space-y-6">
        <SectionCard
          icon={Bot}
          iconClass="bg-sky-50 text-sky-600"
          title="Telegram bot"
          description="O'quvchilar bilan Telegram orqali ishlaydigan bot. Token yoki username o'zgarsa bot avtomatik qayta ulanadi."
          badge={<StatusBadge ok={telegram.tokenConfigured} okText="Token sozlangan" warnText="Token kiritilmagan" />}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="telegram-username"
              label="Bot username"
              error={errors.telegramBotUsername}
              hint="Botga havola (t.me/username) yasash uchun. @ belgisi bilan ham, usiz ham yozish mumkin."
            >
              <input
                id="telegram-username"
                name="oazis-telegram-username"
                value={form.telegramBotUsername}
                onChange={(event) => updateForm('telegramBotUsername', event.target.value)}
                placeholder="oazis_support_bot"
                className={`${inputClass} ${errors.telegramBotUsername ? inputErrorClass : ''}`}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                maxLength={MAX_SHORT + 1}
                disabled={saving}
                aria-invalid={errors.telegramBotUsername ? true : undefined}
                aria-describedby={errors.telegramBotUsername ? 'telegram-username-error' : undefined}
              />
            </Field>
            <Field
              id="telegram-token"
              label="Bot token"
              error={errors.telegramBotToken}
              hint={
                telegram.tokenConfigured
                  ? `Token saqlangan. Bo'sh qoldirilsa o'zgarmaydi; almashtirish uchun yangisini kiriting. ${sourceHint(telegram.tokenSource)}`
                  : 'BotFather bergan token. Usiz bot ishlamaydi.'
              }
            >
              <SecretInput
                key={`telegram-token-${formVersion}`}
                id="telegram-token"
                value={form.telegramBotToken}
                onChange={(value) => updateForm('telegramBotToken', value)}
                placeholder={telegram.tokenConfigured ? CONFIGURED_PLACEHOLDER : 'BotFather tokenini kiriting'}
                disabled={saving}
                invalid={Boolean(errors.telegramBotToken)}
                maxLength={MAX_SECRET + 1}
              />
            </Field>
          </div>

          <label
            htmlFor="telegram-polling"
            className="mt-5 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium text-gray-700">Long polling</span>
              <span className="block text-xs text-gray-500">
                Yoqilgan bo'lsa bot Telegram xabarlarini qabul qiladi. O'chirilsa bot javob bermaydi.
              </span>
            </span>
            <input
              id="telegram-polling"
              type="checkbox"
              checked={form.telegramPollingEnabled}
              onChange={(event) => updateForm('telegramPollingEnabled', event.target.checked)}
              className="h-4 w-4 shrink-0 accent-[var(--primary)]"
              disabled={saving}
            />
          </label>
        </SectionCard>

        <SectionCard
          icon={MessageSquareText}
          iconClass="bg-violet-50 text-violet-600"
          title="SMS (Eskiz)"
          description="Telefon raqamiga tasdiqlash (OTP) kodlarini yuboradigan Eskiz.uz kabineti."
          badge={<StatusBadge ok={eskizReady} okText="Kirish ma'lumotlari sozlangan" warnText="To'liq sozlanmagan" />}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="eskiz-email"
              label="Eskiz email"
              error={errors.eskizEmail}
              hint={
                eskiz.emailConfigured
                  ? "Email saqlangan. Bo'sh qoldirilsa o'zgarmaydi."
                  : 'Eskiz kabinetiga kirish emaili.'
              }
            >
              <input
                id="eskiz-email"
                name="oazis-eskiz-account"
                type="text"
                inputMode="email"
                value={form.eskizEmail}
                onChange={(event) => updateForm('eskizEmail', event.target.value)}
                placeholder={eskiz.emailConfigured ? CONFIGURED_PLACEHOLDER : 'account@example.com'}
                className={`${inputClass} ${errors.eskizEmail ? inputErrorClass : ''}`}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                data-lpignore="true"
                data-1p-ignore="true"
                maxLength={MAX_SECRET + 1}
                disabled={saving}
                aria-invalid={errors.eskizEmail ? true : undefined}
                aria-describedby={errors.eskizEmail ? 'eskiz-email-error' : undefined}
              />
            </Field>
            <Field
              id="eskiz-password"
              label="Eskiz parol"
              error={errors.eskizPassword}
              hint={
                eskiz.passwordConfigured
                  ? "Parol saqlangan. Bo'sh qoldirilsa o'zgarmaydi."
                  : 'Eskiz kabinetiga kirish paroli.'
              }
            >
              <SecretInput
                key={`eskiz-password-${formVersion}`}
                id="eskiz-password"
                value={form.eskizPassword}
                onChange={(value) => updateForm('eskizPassword', value)}
                placeholder={eskiz.passwordConfigured ? CONFIGURED_PLACEHOLDER : 'Parolni kiriting'}
                disabled={saving}
                invalid={Boolean(errors.eskizPassword)}
                maxLength={MAX_SECRET + 1}
              />
            </Field>
            <Field
              id="eskiz-from"
              label="SMS jo'natuvchi (sender)"
              error={errors.eskizFrom}
              hint="SMS kimdan kelgani ko'rinadigan nom yoki raqam. Eskiz'da tasdiqlangan bo'lishi kerak (standart: 4546)."
            >
              <input
                id="eskiz-from"
                name="oazis-eskiz-from"
                value={form.eskizFrom}
                onChange={(event) => updateForm('eskizFrom', event.target.value)}
                placeholder="4546"
                className={`${inputClass} ${errors.eskizFrom ? inputErrorClass : ''}`}
                autoComplete="off"
                spellCheck={false}
                maxLength={MAX_SHORT + 1}
                disabled={saving}
                aria-invalid={errors.eskizFrom ? true : undefined}
                aria-describedby={errors.eskizFrom ? 'eskiz-from-error' : undefined}
              />
            </Field>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
            <span>
              Token, email va parol saqlangandan keyin bu sahifada qayta ko'rsatilmaydi.{' '}
              {sourceHint(eskiz.credentialsSource)}
            </span>
          </div>
        </SectionCard>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-gray-400">
            {dirty ? (
              <span className="font-medium text-amber-600">Saqlanmagan o'zgarishlar bor</span>
            ) : settings.updatedAt ? (
              `Oxirgi o'zgarish: ${formatDateTime(settings.updatedAt)}`
            ) : (
              "Hali admin paneldan o'zgartirilmagan"
            )}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {dirty && (
              <Button variant="secondary" onClick={handleReset} disabled={saving}>
                Bekor qilish
              </Button>
            )}
            <Button type="submit" loading={saving} disabled={!dirty}>
              {saving ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
          </div>
        </div>
      </form>

      <AppVersionCard />
    </div>
  );
}


/* ───────────────────────── Mobil ilova versiyasi ──────────────────────── */

interface AppVersionData {
  latestBuild: number;
  latestVersion?: string | null;
  message?: string | null;
  storeUrl?: string | null;
  updatedAt?: string | null;
}

/**
 * Yangi build chiqarilganda shu yerdan build raqami oshiriladi — undan past
 * buildli ilovalar kirishda ixtiyoriy yangilanish oynasini ko'radi
 * (yangilamaguncha har kirishda chiqadi). Yuqoridagi formadan alohida saqlanadi.
 */
function AppVersionCard() {
  const [data, setData] = useState<AppVersionData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState({ latestBuild: '', latestVersion: '', message: '', storeUrl: '' });
  const [saving, setSaving] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);

  const apply = (v: AppVersionData) => {
    setData(v);
    setForm({
      latestBuild: String(v.latestBuild ?? ''),
      latestVersion: v.latestVersion ?? '',
      message: v.message ?? '',
      storeUrl: v.storeUrl ?? '',
    });
  };

  const load = useCallback(async () => {
    try {
      const res = await api.get('/app-version');
      const v = (res.data?.data ?? null) as AppVersionData | null;
      if (v) {
        apply(v);
        setLoadError(null);
      } else {
        setLoadError("Versiya ma'lumoti topilmadi.");
      }
    } catch (e) {
      setLoadError(apiErrorMessage(e, "Ilova versiyasini yuklab bo'lmadi."));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- birinchi yuklash
    void load();
  }, [load]);

  const dirty =
    data !== null &&
    (form.latestBuild !== String(data.latestBuild ?? '') ||
      form.latestVersion !== (data.latestVersion ?? '') ||
      form.message !== (data.message ?? '') ||
      form.storeUrl !== (data.storeUrl ?? ''));

  const handleSave = async () => {
    const build = Number(form.latestBuild);
    if (!Number.isInteger(build) || build < 1) {
      setBuildError('Build raqami 1 dan katta butun son bo\'lishi kerak.');
      return;
    }
    if (form.storeUrl.trim() && !form.storeUrl.trim().startsWith('https://')) {
      toast.error("Do'kon havolasi https:// bilan boshlanishi kerak.");
      return;
    }
    if (data && build < data.latestBuild) {
      const ok = await confirmDialog({
        title: 'Build raqami kamaytirilsinmi?',
        message: `Hozirgi qiymat ${data.latestBuild}. Kichikroq (${build}) qiymat yangilanish oynasini o'chirib qo'yishi mumkin.`,
        confirmText: 'Saqlash',
      });
      if (!ok) return;
    }
    setBuildError(null);
    setSaving(true);
    try {
      const res = await api.put('/admin/app-version', {
        latestBuild: build,
        latestVersion: form.latestVersion.trim(),
        message: form.message.trim(),
        storeUrl: form.storeUrl.trim(),
      });
      const v = (res.data?.data ?? null) as AppVersionData | null;
      if (v) apply(v);
      toast.success("Ilova versiyasi saqlandi — eski buildlarda yangilanish oynasi chiqadi");
    } catch (e) {
      toast.error(apiErrorMessage(e, "Saqlab bo'lmadi. Qayta urinib ko'ring."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard
      icon={Smartphone}
      iconClass="bg-[var(--primary)]/10 text-[var(--primary)]"
      title="Mobil ilova versiyasi"
      description="Yangi build chiqarilganda raqamni oshiring — eski ilovalar kirishda yangilanish oynasini ko'radi (yangilash ixtiyoriy, lekin har kirishda chiqadi)."
      badge={
        data ? (
          <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
            Joriy: build {data.latestBuild}
          </span>
        ) : null
      }
    >
      {loadError ? (
        <div className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {loadError}{' '}
          <button type="button" className="font-semibold underline" onClick={() => void load()}>
            Qayta urinish
          </button>
        </div>
      ) : !data ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="app-build"
              label="So'nggi build raqami"
              hint="pubspec'dagi + dan keyingi raqam (masalan 1.0.1+16 dagi 16)"
              error={buildError ?? undefined}
            >
              <input
                id="app-build"
                type="number"
                min={1}
                step={1}
                value={form.latestBuild}
                disabled={saving}
                onChange={(e) => {
                  setForm((f) => ({ ...f, latestBuild: e.target.value }));
                  setBuildError(null);
                }}
                className={`${inputClass}${buildError ? ` ${inputErrorClass}` : ''}`}
              />
            </Field>
            <Field id="app-version-name" label="Versiya nomi" hint="Oynada ko'rsatiladi (masalan 1.0.1)">
              <input
                id="app-version-name"
                value={form.latestVersion}
                maxLength={20}
                disabled={saving}
                onChange={(e) => setForm((f) => ({ ...f, latestVersion: e.target.value }))}
                className={inputClass}
              />
            </Field>
          </div>
          <div className="mt-4">
            <Field id="app-update-message" label="Oynadagi xabar">
              <textarea
                id="app-update-message"
                rows={2}
                maxLength={1000}
                value={form.message}
                disabled={saving}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                className={inputClass}
              />
            </Field>
          </div>
          <div className="mt-4">
            <Field id="app-store-url" label="Do'kon havolasi" hint="Google Play sahifasi (https://...)">
              <input
                id="app-store-url"
                value={form.storeUrl}
                maxLength={500}
                disabled={saving}
                onChange={(e) => setForm((f) => ({ ...f, storeUrl: e.target.value }))}
                className={inputClass}
              />
            </Field>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-xs text-gray-400">
              {data.updatedAt ? `Oxirgi o'zgarish: ${formatDateTime(data.updatedAt)}` : ''}
            </span>
            <Button onClick={() => void handleSave()} loading={saving} disabled={!dirty}>
              {saving ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
          </div>
        </>
      )}
    </SectionCard>
  );
}