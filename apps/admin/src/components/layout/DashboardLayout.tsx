import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import Feedback from '../ui/Feedback';

export default function DashboardLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* Mobil yuqori panel — keng ekranda yashirin */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-gray-200 bg-white px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Menyuni ochish"
          className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
        >
          <Menu size={20} />
        </button>
        <span className="font-bold text-gray-900">OAZIS</span>
      </header>

      <main className="p-4 sm:p-6 lg:ml-[260px]">
        <Outlet />
      </main>

      <Feedback />
    </div>
  );
}
