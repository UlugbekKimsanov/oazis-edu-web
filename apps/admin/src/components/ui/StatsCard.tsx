import type { LucideIcon } from 'lucide-react';

interface Props {
  title: string;
  value: string | number;
  icon: LucideIcon;
  /** Gradient boshlanish/tugash ranglari */
  from?: string;
  to?: string;
  onClick?: () => void;
}

export default function StatsCard({ title, value, icon: Icon, from = '#2E9E6E', to = '#1F7A55', onClick }: Props) {
  return (
    <div
      onClick={onClick}
      className={
        'relative overflow-hidden rounded-2xl p-5 text-white shadow-lg transition-transform ' +
        (onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-xl' : '')
      }
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      {/* Dekorativ doiralar */}
      <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/10" />
      <div className="absolute -bottom-10 -right-2 w-20 h-20 rounded-full bg-white/10" />

      <div className="relative">
        <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4">
          <Icon size={22} className="text-white" />
        </div>
        <p className="text-2xl font-extrabold tracking-tight">{value}</p>
        <p className="text-sm text-white/85 mt-1 font-medium">{title}</p>
      </div>
    </div>
  );
}
