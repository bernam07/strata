import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';

const controlClass =
  'w-full rounded-[var(--radius-field)] neu-sunken px-3.5 py-2.5 text-sm text-[var(--text-strong)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]';

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
