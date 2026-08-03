import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';

const controlClass =
  'block w-full min-w-0 appearance-none rounded-[var(--radius-field)] neu-sunken px-3.5 py-2.5 text-sm text-[var(--text-strong)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]';

export const sanitizeAmount = (raw: string): string => {
  const dotted = raw.replace(',', '.').replace(/[^0-9.]/g, '');
  const [whole = '', ...rest] = dotted.split('.');
  return rest.length > 0 ? `${whole}.${rest.join('')}` : whole;
};

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

interface MoneyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: string;
  onChange: (value: string) => void;
}

export const MoneyInput = ({
  value,
  onChange,
  className = controlClass,
  ...props
}: MoneyInputProps) => (
  <input
    className={className}
    type="text"
    inputMode="decimal"
    autoComplete="off"
    value={value}
    onChange={(event) => onChange(sanitizeAmount(event.target.value))}
    {...props}
  />
);
