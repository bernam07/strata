import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-neu-sm)] px-5 py-2.5 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 neu-flat';

const variantClass: Record<Variant, string> = {
  primary: 'text-[var(--accent)]',
  ghost: 'text-[var(--text-muted)]',
};

export const Button = ({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonProps) => (
  <button
    type={type}
    className={`${base} ${variantClass[variant]} ${className}`}
    {...props}
  />
);
