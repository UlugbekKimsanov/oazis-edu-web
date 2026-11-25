import { useState } from 'react';
import { LogOut, Menu, UserRound, X } from 'lucide-react';
import type { LandingContent } from '../../data/landing';
import { displayName, type AuthUser } from '../../lib/auth';
import { Container } from '../ui/Container';
import { Button } from '../ui/Button';

export function Navbar({
  navbar,
  user,
  onLogin,
  onLogout,
}: {
  navbar: LandingContent['navbar'];
  user: AuthUser | null;
  onLogin: () => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { logo, links, ctaLabel, menuLabel } = navbar;

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <a href="#top" className="text-xl font-extrabold tracking-tight text-primary">
          {logo}
        </a>

        <nav className="hidden items-center gap-6 md:flex lg:gap-8">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-sm font-medium text-gray-600 hover:text-primary">
              {l.label}
            </a>
          ))}
          {user ? (
            <div className="flex items-center gap-2">
              <span
                className="inline-flex max-w-40 items-center gap-2 rounded-xl bg-primary-light px-3 py-2 text-sm font-semibold text-primary"
                title={user.email}
              >
                <UserRound className="h-4 w-4 shrink-0" />
                <span className="truncate">{displayName(user)}</span>
              </span>
              <button
                type="button"
                onClick={onLogout}
                className="rounded-xl p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
                aria-label="Chiqish"
                title="Chiqish"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <Button variant="outline" className="px-5 py-2.5" onClick={onLogin} attention>
              Kirish
            </Button>
          )}
          {/* Ariza formasi kirgan foydalanuvchiga ko'rsatilmaydi — unga olib boruvchi tugma ham. */}
          {!user && (
            <a href="#royxatdan-otish">
              <Button attention>{ctaLabel}</Button>
            </a>
          )}
        </nav>

        <button
          className="text-gray-700 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={menuLabel}
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
            {user ? (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-primary-light px-4 py-3">
                <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-primary">
                  <UserRound className="h-4 w-4 shrink-0" />
                  <span className="truncate">{displayName(user)}</span>
                </span>
                <button
                  type="button"
                  className="shrink-0 text-sm font-semibold text-gray-600"
                  onClick={() => {
                    setOpen(false);
                    onLogout();
                  }}
                >
                  Chiqish
                </button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setOpen(false);
                  onLogin();
                }}
              >
                Kirish
              </Button>
            )}
            {!user && (
              <a href="#royxatdan-otish" onClick={() => setOpen(false)}>
                <Button className="w-full">{ctaLabel}</Button>
              </a>
            )}
          </Container>
        </div>
      )}
    </header>
  );
}
