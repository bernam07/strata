import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const base =
  'tap inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-field)] font-semibold active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';

const sizeClass: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-3.5 py-2 text-sm',
};

const variantClass: Record<Variant, string> = {
  primary:
    'bg-[var(--accent)] text-[var(--accent-ink)] hover:brightness-105 shadow-[0_8px_20px_-12px_var(--accent)]',
  ghost:
    'neu-flat text-[var(--text-2)] hover:text-[var(--text-strong)]',
};

export const Button = ({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}: ButtonProps) => (
  <button
    type={type}
    className={`${base} ${sizeClass[size]} ${variantClass[variant]} ${className}`}
    {...props}
  />
);
