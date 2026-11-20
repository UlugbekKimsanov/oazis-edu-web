import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Props {
  title: string;
  description?: React.ReactNode;
  /** O'ng tomondagi tugmalar (Qo'shish, Yangilash ...) */
  actions?: React.ReactNode;
  /** Ota sahifaga qaytish havolasi */
  back?: { to: string; label: string };
}

/** Har bir sahifaning sarlavha qismi — bir xil joylashuv va o'lcham. */
export default function PageHeader({ title, description, actions, back }: Props) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {back && (
          <Link to={back.to} className="mb-1 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[var(--primary)]">
            <ArrowLeft size={14} /> {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
