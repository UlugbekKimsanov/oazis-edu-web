import type { LucideIcon } from 'lucide-react';
import { AlertCircle, Inbox, RefreshCw } from 'lucide-react';
import Button from './Button';

// Yuklanish / xato / bo'sh holatlar — butun panelda bir xil ko'rinadi.

/** Kulrang "skelet" blok. O'lchamni className orqali bering: "h-4 w-32". */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-gray-200/80 ${className}`} />;
}

export function LoadingState({ label = 'Yuklanmoqda...', className = '' }: { label?: string; className?: string }) {
  return (
    <div role="status" className={`flex flex-col items-center justify-center gap-3 py-16 text-sm text-gray-400 ${className}`}>
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-gray-200 border-t-[var(--primary)]" />
      {label}
    </div>
  );
}

interface ErrorProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

/** Ma'lumot yuklanmadi — sababi va "Qayta urinish" tugmasi bilan. */
export function ErrorState({ message = "Ma'lumotni yuklab bo'lmadi.", onRetry, className = '' }: ErrorProps) {
  return (
    <div role="alert" className={`flex flex-col items-center justify-center gap-3 py-14 text-center ${className}`}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
        <AlertCircle size={24} />
      </div>
      <p className="max-w-md px-4 text-sm text-gray-600">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw size={14} /> Qayta urinish
        </Button>
      )}
    </div>
  );
}

interface EmptyProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Odatda "Qo'shish" tugmasi */
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, className = '' }: EmptyProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-14 text-center ${className}`}>
      <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
        <Icon size={24} />
      </div>
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {description && <p className="max-w-md px-4 text-sm text-gray-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
