import { useState, type FormEvent } from 'react';
import { submitLead } from '../../lib/api';
import { Button } from '../ui/Button';

type Status = 'idle' | 'loading' | 'success' | 'error';

function formatUzPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  const local = (digits.startsWith('998') ? digits.slice(3) : digits).slice(0, 9);
  const parts = [local.slice(0, 2), local.slice(2, 5), local.slice(5, 7), local.slice(7, 9)]
    .filter(Boolean);
  return `+998${parts.length ? ` ${parts.join(' ')}` : ' '}`;
}

export function LeadForm({ onSuccess }: { onSuccess?: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+998 ');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!/^\+998 \d{2} \d{3} \d{2} \d{2}$/.test(phone)) {
      setStatus('error');
      setMessage("Telefon raqamini to'liq kiriting.");
      return;
    }

    setStatus('loading');
    setMessage('');
    try {
      await submitLead({ name: name.trim() || undefined, phone });
      setStatus('success');
      setMessage("Arizangiz qabul qilindi! Tez orada siz bilan bog'lanamiz.");
      setName('');
      setPhone('+998 ');
      onSuccess?.();
    } catch {
      setStatus('error');
      setMessage("Xatolik yuz berdi. Iltimos, keyinroq qayta urinib ko'ring.");
    }
  }

  const inputClass =
    'w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="space-y-1.5">
        <span className="text-sm font-semibold text-gray-700">Telefon raqami</span>
        <input
          autoFocus
          required
          className={inputClass}
          inputMode="tel"
          autoComplete="tel"
          aria-label="Telefon raqami"
          value={phone}
          onChange={(event) => setPhone(formatUzPhone(event.target.value))}
          placeholder="+998 XX XXX XX XX"
        />
      </label>
      <label className="space-y-1.5">
        <span className="text-sm font-semibold text-gray-700">
          Ism <span className="font-normal text-gray-400">(ixtiyoriy)</span>
        </span>
        <input
          className={inputClass}
          autoComplete="name"
          aria-label="Ism"
          value={name}
          maxLength={255}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ismingiz"
        />
      </label>
      <Button type="submit" disabled={status === 'loading'}>
        {status === 'loading' ? 'Yuborilmoqda...' : "Ma'lumot olish"}
      </Button>
      {message && (
        <p role="status" className={`text-sm ${status === 'success' ? 'text-primary' : 'text-red-600'}`}>
          {message}
        </p>
      )}
    </form>
  );
}
