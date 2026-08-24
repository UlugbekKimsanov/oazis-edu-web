import { NavLink, useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';

const adminLinks = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/users', icon: Users, label: 'Foydalanuvchilar' },
  { to: '/admin/languages', icon: Globe, label: 'Tillar' },
  { to: '/admin/courses', icon: GraduationCap, label: 'Kurslar' },
  { to: '/admin/lessons', icon: BookOpen, label: 'Darslar' },
  { to: '/admin/books', icon: Library, label: 'Kutubxona' },
  { to: '/admin/payment-methods', icon: CreditCard, label: "To'lov tizimlari" },
  { to: '/admin/notifications', icon: Bell, label: 'Bildirishnomalar' },
  { to: '/admin/break-music', icon: Music, label: 'Tanaffus musiqasi' },
  { to: '/admin/landing', icon: LayoutTemplate, label: 'Landing' },
  { to: '/admin/leads', icon: UserPlus, label: 'Yangi foydalanuvchilar' },
  { to: '/admin/reports', icon: BarChart3, label: 'Hisobotlar' },
  { to: '/admin/settings', icon: Settings, label: 'Sozlamalar' },
];

const teacherLinks = [
  { to: '/teacher', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/teacher/courses', icon: GraduationCap, label: 'Kurslarim' },
  { to: '/teacher/students', icon: Users, label: "O'quvchilarim" },
  { to: '/teacher/notifications', icon: Bell, label: 'Bildirishnomalar' },
  { to: '/teacher/chat', icon: MessageSquare, label: 'Chat' },
  { to: '/teacher/group-chat', icon: MessagesSquare, label: 'Guruh chat' },
];

export default function Sidebar() {
  const { user, role, logout } = useAuthStore();
  const navigate = useNavigate();
  const links = role === 'ADMIN' ? adminLinks : teacherLinks;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-[260px] bg-white border-r border-gray-200 flex flex-col z-50">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-100">
        <div className="w-8 h-8 rounded-lg bg-[var(--primary)] flex items-center justify-center">
          <span className="text-white font-bold text-sm">O</span>
        </div>
        <span className="ml-3 font-bold text-lg text-gray-900">OAZIS</span>
        <span className="ml-2 text-xs bg-[var(--primary-light)] text-[var(--primary)] px-2 py-0.5 rounded-full font-medium">
          {role === 'ADMIN' ? 'Admin' : 'Teacher'}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        <ul className="space-y-1">
          {links.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                end={link.to === '/admin' || link.to === '/teacher'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[var(--primary-light)] text-[var(--primary)]'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                <link.icon size={18} />
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* User info */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-[var(--primary)] flex items-center justify-center">
            <span className="text-white text-xs font-bold">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut size={16} />
          Chiqish
        </button>
      </div>
    </aside>
  );
}
