import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const base =
  'tap inline-flex items-center justify-center gap-2 rounded-[var(--radius-field)] px-4 py-2.5 text-sm font-semibold active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';

const variantClass: Record<Variant, string> = {
  primary:
    'bg-[var(--accent)] text-[var(--accent-ink)] hover:brightness-105 shadow-[0_8px_20px_-12px_var(--accent)]',
  ghost:
    'neu-flat text-[var(--text-2)] hover:text-[var(--text-strong)]',
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
