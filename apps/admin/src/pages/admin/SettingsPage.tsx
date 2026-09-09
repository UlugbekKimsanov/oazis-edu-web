import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Bot, CheckCircle2, Loader2, MessageSquareText, ShieldCheck } from 'lucide-react';
import Button from '../../components/ui/Button';
import api from '../../lib/api';

interface TelegramSettings {
  botUsername: string;
  pollingEnabled: boolean;
  tokenConfigured: boolean;
  tokenMasked: string;
  tokenSource: 'database' | 'environment' | 'none';
}

interface EskizSettings {
  emailConfigured: boolean;
  emailMasked: string;
  passwordConfigured: boolean;
  passwordMasked: string;
  from: string;
  credentialsSource: 'database' | 'environment' | 'none';
}

interface IntegrationSettings {
  telegram: TelegramSettings;
  eskiz: EskizSettings;
  updatedAt?: string;
}

interface SettingsForm {
  telegramBotUsername: string;
  telegramBotToken: string;
  telegramPollingEnabled: boolean;
  eskizEmail: string;
  eskizPassword: string;
  eskizFrom: string;
}

const emptyForm: SettingsForm = {
  telegramBotUsername: '',
  telegramBotToken: '',
  telegramPollingEnabled: true,
  eskizEmail: '',
  eskizPassword: '',
  eskizFrom: '4546',
};

const inputClass =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 disabled:bg-gray-50';

function sourceLabel(source: string) {
  if (source === 'database') return 'Admin paneldan sozlangan';
  if (source === 'environment') return 'Server konfiguratsiyasidan';
  return 'Sozlanmagan';
}

function errorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return "Sozlamalarni saqlab bo'lmadi. Qayta urinib ko'ring.";
}

export default function SettingsPage() {
  const [form, setForm] = useState<SettingsForm>(emptyForm);
  const [settings, setSettings] = useState<IntegrationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    api
      .get('/admin/settings')
      .then((response) => {
        if (!active) return;
        const data = (response.data.data ?? response.data) as IntegrationSettings;
        setSettings(data);
        setForm((current) => ({
          ...current,
          telegramBotUsername: data.telegram.botUsername ?? '',
          telegramPollingEnabled: data.telegram.pollingEnabled,
          eskizFrom: data.eskiz.from || '4546',
        }));
      })
      .catch((error) => {
        if (active) setMessage({ type: 'error', text: errorMessage(error) });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const updateForm = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const response = await api.put('/admin/settings', form);
      const data = (response.data.data ?? response.data) as IntegrationSettings;
      setSettings(data);
      setForm((current) => ({
        ...current,
        telegramBotToken: '',
        eskizEmail: '',
        eskizPassword: '',
        telegramBotUsername: data.telegram.botUsername ?? current.telegramBotUsername,
        telegramPollingEnabled: data.telegram.pollingEnabled,
        eskizFrom: data.eskiz.from || current.eskizFrom,
      }));
      setMessage({
        type: 'success',
        text: 'Sozlamalar saqlandi. Telegram bot yangi sozlama bilan qayta ishga tushdi.',
      });
    } catch (error) {
      setMessage({ type: 'error', text: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center text-sm text-gray-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Sozlamalar yuklanmoqda...
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Integratsiya sozlamalari</h1>
        <p className="mt-1 text-sm text-gray-500">
          Telegram bot va SMS yuborish xizmatini serverni qayta deploy qilmasdan boshqaring.
        </p>
      </div>

      {message && (
        <div
          role="alert"
          className={`mb-5 flex max-w-3xl items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {message.type === 'success' && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="max-w-3xl space-y-6">
        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-sky-50 p-2 text-sky-600">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Telegram bot</h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  Token o'zgarsa long polling avtomatik qayta ulanadi.
                </p>
              </div>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                settings?.telegram.tokenConfigured
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {settings?.telegram.tokenConfigured ? 'Token sozlangan' : 'Token kiritilmagan'}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="telegram-username" className="mb-1 block text-sm font-medium text-gray-700">
                Bot username
              </label>
              <input
                id="telegram-username"
                value={form.telegramBotUsername}
                onChange={(event) => updateForm('telegramBotUsername', event.target.value)}
                placeholder="oazis_support_bot"
                className={inputClass}
                disabled={saving}
              />
            </div>
            <div>
              <label htmlFor="telegram-token" className="mb-1 block text-sm font-medium text-gray-700">
                Bot token
              </label>
              <input
                id="telegram-token"
                type="password"
                value={form.telegramBotToken}
                onChange={(event) => updateForm('telegramBotToken', event.target.value)}
                placeholder={settings?.telegram.tokenMasked || 'BotFather tokenini kiriting'}
                className={inputClass}
                autoComplete="new-password"
                disabled={saving}
              />
              <p className="mt-1 text-xs text-gray-400">
                Bo'sh qoldirilsa mavjud token saqlanadi. {sourceLabel(settings?.telegram.tokenSource ?? 'none')}.
              </p>
            </div>
          </div>

          <label className="mt-5 flex cursor-pointer items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
            <span>
              <span className="block text-sm font-medium text-gray-700">Long polling</span>
              <span className="block text-xs text-gray-500">Bot Telegram xabarlarini qabul qilsin</span>
            </span>
            <input
              type="checkbox"
              checked={form.telegramPollingEnabled}
              onChange={(event) => updateForm('telegramPollingEnabled', event.target.checked)}
              className="h-4 w-4 accent-[var(--primary)]"
              disabled={saving}
            />
          </label>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-violet-50 p-2 text-violet-600">
                <MessageSquareText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">SMS (Eskiz)</h2>
                <p className="mt-0.5 text-xs text-gray-500">OTP kodlarini yuborish uchun Eskiz kabineti.</p>
              </div>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                settings?.eskiz.emailConfigured && settings?.eskiz.passwordConfigured
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {settings?.eskiz.emailConfigured && settings?.eskiz.passwordConfigured
                ? 'Credentials sozlangan'
                : "To'liq sozlanmagan"}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="eskiz-email" className="mb-1 block text-sm font-medium text-gray-700">
                Eskiz email
              </label>
              <input
                id="eskiz-email"
                type="email"
                value={form.eskizEmail}
                onChange={(event) => updateForm('eskizEmail', event.target.value)}
                placeholder={settings?.eskiz.emailMasked || 'account@example.com'}
                className={inputClass}
                autoComplete="off"
                disabled={saving}
              />
            </div>
            <div>
              <label htmlFor="eskiz-password" className="mb-1 block text-sm font-medium text-gray-700">
                Eskiz parol
              </label>
              <input
                id="eskiz-password"
                type="password"
                value={form.eskizPassword}
                onChange={(event) => updateForm('eskizPassword', event.target.value)}
                placeholder={settings?.eskiz.passwordMasked || 'Parolni kiriting'}
                className={inputClass}
                autoComplete="new-password"
                disabled={saving}
              />
            </div>
            <div>
              <label htmlFor="eskiz-from" className="mb-1 block text-sm font-medium text-gray-700">
                SMS sender
              </label>
              <input
                id="eskiz-from"
                value={form.eskizFrom}
                onChange={(event) => updateForm('eskizFrom', event.target.value)}
                placeholder="4546"
                className={inputClass}
                disabled={saving}
              />
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
            <span>
              Email va parol API orqali ochiq qaytarilmaydi. Maydonlar bo'sh qolsa mavjud credentials saqlanadi.{' '}
              {sourceLabel(settings?.eskiz.credentialsSource ?? 'none')}.
            </span>
          </div>
        </section>

        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-gray-400">
            {settings?.updatedAt
              ? `Oxirgi o'zgarish: ${new Date(settings.updatedAt).toLocaleString('uz-UZ')}`
              : "Hali admin paneldan o'zgartirilmagan"}
          </span>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </Button>
        </div>
      </form>
    </div>
  );
}
