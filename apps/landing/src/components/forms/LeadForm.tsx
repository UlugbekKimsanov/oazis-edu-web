import { useState, type FormEvent } from 'react';
import { submitLead } from '../../lib/api';
import type { LandingContent } from '../../data/landing';
import { Button } from '../ui/Button';
import { formatUzPhone, isCompleteUzPhone } from '../../lib/phone';

type Status = 'idle' | 'loading' | 'success' | 'error';

export function LeadForm({
  onSuccess,
  nameLabel,
  phoneLabel,
  submitLabel,
  copy,
  autoFocusPhone = false,
}: {
  onSuccess?: () => void;
  nameLabel: string;
  phoneLabel: string;
  submitLabel: string;
  copy: LandingContent['leadForm'];
  /** Telefon inputiga avtomatik fokus — faqat modal kontekstida yoqiladi,
   * inline formada sahifa ochilishida pastga sakrab ketmasligi uchun o'chiq. */
  autoFocusPhone?: boolean;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+998 ');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isCompleteUzPhone(phone)) {
      setStatus('error');
      setMessage(copy.invalidPhoneMessage);
      return;
    }

    setStatus('loading');
    setMessage('');
    try {
      await submitLead({ name: name.trim() || undefined, phone });
      setStatus('success');
      setMessage(copy.successMessage);
      setName('');
      setPhone('+998 ');
      onSuccess?.();
    } catch {
      setStatus('error');
      setMessage(copy.errorMessage);
    }
  }

  const inputClass =
    'w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="space-y-1.5">
        <span className="text-sm font-semibold text-gray-700">{phoneLabel}</span>
        <input
          autoFocus={autoFocusPhone}
          required
          className={inputClass}
          inputMode="tel"
          autoComplete="tel"
          aria-label={phoneLabel}
          value={phone}
          onChange={(event) => setPhone(formatUzPhone(event.target.value))}
          placeholder={copy.phonePlaceholder}
        />
      </label>
      <label className="space-y-1.5">
        <span className="text-sm font-semibold text-gray-700">
          {nameLabel} <span className="font-normal text-gray-400">({copy.optionalLabel})</span>
        </span>
        <input
          className={inputClass}
          autoComplete="name"
          aria-label={nameLabel}
          value={name}
          maxLength={255}
          onChange={(event) => setName(event.target.value)}
          placeholder={copy.namePlaceholder}
        />
      </label>
      <Button type="submit" disabled={status === 'loading'}>
        {status === 'loading' ? copy.loadingLabel : submitLabel}
      </Button>
      {message && (
        <p role="status" className={`text-sm ${status === 'success' ? 'text-primary' : 'text-red-600'}`}>
          {message}
        </p>
      )}
    </form>
  );
}
