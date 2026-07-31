import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';

const controlClass =
  'w-full rounded-[var(--radius-neu-sm)] neu-sunken bg-transparent px-4 py-2.5 text-sm text-[var(--text-strong)] outline-none placeholder:text-[var(--text-muted)]';

interface LabelledProps {
  label: string;
  children: ReactNode;
}

export const Labelled = ({ label, children }: LabelledProps) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
      {label}
    </span>
    {children}
  </label>
);

export const TextInput = (props: InputHTMLAttributes<HTMLInputElement>) => (
  <input className={controlClass} {...props} />
);

export const Select = ({
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select className={controlClass} {...props}>
    {children}
  </select>
);
