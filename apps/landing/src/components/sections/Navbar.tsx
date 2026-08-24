import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Container } from '../ui/Container';
import { Button } from '../ui/Button';

const links = [
  { href: '#kurslar', label: 'Kurslar' },
  { href: '#biz-haqimizda', label: 'Biz haqimizda' },
  { href: '#fikrlar', label: 'Fikrlar' },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <a href="#top" className="text-xl font-extrabold tracking-tight text-primary">
          OAZIS
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-sm font-medium text-gray-600 hover:text-primary">
              {l.label}
            </a>
          ))}
          <a href="#royxatdan-otish">
            <Button>Ro'yxatdan o'tish</Button>
          </a>
        </nav>

        <button
          className="text-gray-700 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menyu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </Container>

      {open && (
        <div className="border-t border-gray-100 bg-white md:hidden">
          <Container className="flex flex-col gap-4 py-4">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="text-sm font-medium text-gray-700"
              >
                {l.label}
              </a>
            ))}
            <a href="#royxatdan-otish" onClick={() => setOpen(false)}>
              <Button className="w-full">Ro'yxatdan o'tish</Button>
            </a>
          </Container>
        </div>
      )}
    </header>
  );
}
