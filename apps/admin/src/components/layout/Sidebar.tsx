import { NavLink, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  GraduationCap,
  Library,
  MessageSquare,
  MessagesSquare,
  BarChart3,
  Settings,
  LogOut,
  Globe,
  Bell,
  CreditCard,
  Music,
  LayoutTemplate,
  UserPlus,
  Wallet,
  X,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import { confirmDialog } from '../../stores/ui-store';

interface NavItem { to: string; icon: LucideIcon; label: string }
interface NavGroup { title?: string; items: NavItem[] }

const adminGroups: NavGroup[] = [
  {
    items: [
      { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/admin/users', icon: Users, label: 'Foydalanuvchilar' },
    ],
  },
  {
    title: 'Kontent',
    items: [
      { to: '/admin/languages', icon: Globe, label: 'Tillar' },
      { to: '/admin/courses', icon: GraduationCap, label: 'Kurslar' },
      { to: '/admin/lessons', icon: BookOpen, label: 'Darslar' },
      { to: '/admin/books', icon: Library, label: 'Kutubxona' },
      { to: '/admin/break-music', icon: Music, label: 'Tanaffus musiqasi' },
    ],
  },
  {
    title: 'Moliya',
    items: [
      { to: '/admin/income', icon: Wallet, label: 'Daromad' },
      { to: '/admin/payment-methods', icon: CreditCard, label: "To'lov tizimlari" },
      { to: '/admin/reports', icon: BarChart3, label: 'Hisobotlar' },
    ],
  },
  {
    title: 'Marketing',
    items: [
      { to: '/admin/notifications', icon: Bell, label: 'Bildirishnomalar' },
      { to: '/admin/landing', icon: LayoutTemplate, label: 'Landing' },
      { to: '/admin/leads', icon: UserPlus, label: 'Yangi foydalanuvchilar' },
    ],
  },
  {
    title: 'Tizim',
    items: [{ to: '/admin/settings', icon: Settings, label: 'Sozlamalar' }],
  },
];

const teacherGroups: NavGroup[] = [
  {
    items: [
      { to: '/teacher', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/teacher/courses', icon: GraduationCap, label: 'Kurslarim' },
      { to: '/teacher/students', icon: Users, label: "O'quvchilarim" },
      { to: '/teacher/notifications', icon: Bell, label: 'Bildirishnomalar' },
      { to: '/teacher/chat', icon: MessageSquare, label: 'Chat' },
      { to: '/teacher/group-chat', icon: MessagesSquare, label: 'Guruh chat' },
    ],
  },
];

interface Props {
  /** Mobil ekranda menyu ochiqmi (keng ekranda doim ko'rinadi) */
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ open = false, onClose }: Props) {
  const { user, role, logout } = useAuthStore();
  const navigate = useNavigate();
  const groups = role === 'ADMIN' ? adminGroups : teacherGroups;

  const handleLogout = async () => {
    const ok = await confirmDialog({
      title: 'Tizimdan chiqasizmi?',
      message: 'Qayta kirish uchun email va parol kerak bo\'ladi.',
      confirmText: 'Chiqish',
      danger: true,
    });
    if (!ok) return;
    logout();
    navigate('/login');
  };

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || '?';

  return (
    <>
      {/* Mobil: menyu ortidagi qoraytirilgan fon */}
      {open && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={onClose} />}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-[260px] flex-col border-r border-gray-200 bg-white transition-transform duration-200 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center border-b border-gray-100 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)]">
            <span className="text-sm font-bold text-white">O</span>
          </div>
          <span className="ml-3 text-lg font-bold text-gray-900">OAZIS</span>
          <span className="ml-2 rounded-full bg-[var(--primary-light)] px-2 py-0.5 text-xs font-medium text-[var(--primary)]">
            {role === 'ADMIN' ? 'Admin' : 'Ustoz'}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Menyuni yopish"
            className="ml-auto rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Asosiy menyu">
          {groups.map((group, gi) => (
            <div key={group.title ?? gi} className={gi > 0 ? 'mt-4' : ''}>
              {group.title && (
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{group.title}</p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((link) => (
                  <li key={link.to}>
                    <NavLink
                      to={link.to}
                      end={link.to === '/admin' || link.to === '/teacher'}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-[var(--primary-light)] text-[var(--primary)]'
                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                        }`
                      }
                    >
                      <link.icon size={18} className="shrink-0" />
                      <span className="truncate">{link.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* User info */}
        <div className="shrink-0 border-t border-gray-100 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]">
              <span className="text-xs font-bold text-white">{initials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="truncate text-xs text-gray-500">{user?.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
          >
            <LogOut size={16} />
            Chiqish
          </button>
        </div>
      </aside>
    </>
  );
}
