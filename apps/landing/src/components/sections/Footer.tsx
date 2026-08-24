import { Send, Instagram, Youtube, Phone } from 'lucide-react';
import type { Contacts } from '../../data/landing';
import { Container } from '../ui/Container';

export function Footer({ contacts }: { contacts: Contacts }) {
  const socials = [
    { icon: Send, label: 'Telegram', href: contacts.telegram },
    { icon: Instagram, label: 'Instagram', href: contacts.instagram },
    { icon: Youtube, label: 'YouTube', href: contacts.youtube },
  ];

  return (
    <footer className="bg-primary-dark text-white">
      <Container className="py-12">
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <div className="text-xl font-extrabold">OAZIS</div>
            <p className="mt-3 text-sm font-semibold text-white/70">Bizning ijtimoiy sahifalar</p>
            <div className="mt-3 flex gap-3">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={s.label}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
                >
                  <s.icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          <div className="sm:text-right">
            <p className="text-sm font-semibold text-white/70">Yagona aloqa markazi</p>
            <a
              href={`tel:${contacts.phone.replace(/\s/g, '')}`}
              className="mt-3 inline-flex items-center gap-2 text-lg font-bold sm:justify-end"
            >
              <Phone className="h-5 w-5" />
              {contacts.phone}
            </a>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-center text-sm text-white/60">
          Oazis Company
        </div>
      </Container>
    </footer>
  );
}
