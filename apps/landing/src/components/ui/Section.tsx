import type { ReactNode } from 'react';
import { Container } from './Container';

interface SectionProps {
  id?: string;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  dark?: boolean;
}

export function Section({ id, title, subtitle, children, className = '', dark = false }: SectionProps) {
  return (
    <section id={id} className={`py-16 sm:py-20 ${className}`}>
      <Container>
        {title && (
          <div className="mb-10 text-center sm:mb-14">
            <h2 className={`text-2xl font-bold sm:text-3xl md:text-4xl ${dark ? 'text-white' : 'text-gray-900'}`}>
              {title}
            </h2>
            {subtitle && (
              <p className={`mx-auto mt-3 max-w-2xl text-sm sm:text-base ${dark ? 'text-white/80' : 'text-gray-500'}`}>
                {subtitle}
              </p>
            )}
          </div>
        )}
        {children}
      </Container>
    </section>
  );
}
