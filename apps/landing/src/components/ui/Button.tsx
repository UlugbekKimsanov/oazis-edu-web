import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'white' | 'outline' | 'outlineWhite';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-dark shadow-sm',
  white: 'bg-white text-primary hover:bg-gray-50 shadow-sm',
  outline: 'border-2 border-primary text-primary hover:bg-primary-light',
  outlineWhite: 'border-2 border-white text-white hover:bg-white/10',
};

export function Button({ variant = 'primary', children, className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-colors disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
