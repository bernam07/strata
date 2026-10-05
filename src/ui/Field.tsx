import {
  useEffect,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';

const controlClass =
  'block w-full min-w-0 appearance-none rounded-[var(--radius-field)] neu-sunken px-3.5 py-2.5 text-sm text-[var(--text-strong)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]';

export const sanitizeAmount = (raw: string): string => {
  const dotted = raw.replace(',', '.').replace(/[^0-9.]/g, '');
  const [whole = '', ...rest] = dotted.split('.');
  return rest.length > 0 ? `${whole}.${rest.join('')}` : whole;
};

const hasMathOperator = (raw: string): boolean => /[+\-*/×÷−]/.test(raw);

export const sanitizeMoneyExpression = (raw: string): string => {
  if (!hasMathOperator(raw)) return sanitizeAmount(raw);
  const normalized = raw
    .replace(/,/g, '.')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/[^0-9.+\-*/ ]/g, '');
  // Sanitize each numeric segment so multiple dots inside one number collapse
  return normalized.replace(/[0-9.]+/g, (segment) => sanitizeAmount(segment));
};

export const evaluateMoneyExpression = (raw: string): number | null => {
  const cleaned = sanitizeMoneyExpression(raw).replace(/\s+/g, '');
  if (!cleaned) return null;
  // Strip any trailing operators while the user is mid-expression
  const trimmed = cleaned.replace(/[+\-*/.]+$/, '');
  if (!trimmed) return null;

  const tokens = trimmed.match(/(\d+(?:\.\d+)?|[+\-*/])/g);
  if (!tokens || tokens.length === 0) return null;

  // Pass 1: handle * and /
  const addSubStack: (number | '+' | '-')[] = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i]!;
    if (token === '+' || token === '-') {
      addSubStack.push(token);
      i += 1;
      continue;
    }
    if (token === '*' || token === '/') {
      const prev = addSubStack.pop();
      const nextRaw = tokens[i + 1];
      const nextVal = nextRaw !== undefined ? Number(nextRaw) : NaN;
      if (typeof prev === 'number' && Number.isFinite(nextVal)) {
        if (token === '/' && nextVal === 0) return null;
        const computed = token === '*' ? prev * nextVal : prev / nextVal;
        addSubStack.push(computed);
      } else if (typeof prev === 'number') {
        addSubStack.push(prev);
      }
      i += 2;
      continue;
    }
    const num = Number(token);
    if (Number.isFinite(num)) {
      addSubStack.push(num);
    }
    i += 1;
  }

  // Pass 2: handle + and -
  let total = 0;
  let currentOp: '+' | '-' = '+';
  for (const item of addSubStack) {
    if (item === '+' || item === '-') {
      currentOp = item;
    } else {
      total = currentOp === '+' ? total + item : total - item;
    }
  }

  if (!Number.isFinite(total)) return null;
  return Math.max(0, Math.round(total * 100) / 100);
};

interface LabelledProps {
  label: ReactNode;
  children: ReactNode;
}

export const Labelled = ({ label, children }: LabelledProps) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
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
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) => (
  <div className="relative w-full min-w-0">
    <select className={`${controlClass} pr-9 ${className}`} {...props}>
      {children}
    </select>
    <span
      aria-hidden="true"
      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
    >
      <svg
        viewBox="0 0 20 20"
        width="15"
        height="15"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5.5 7.5L10 12l4.5-4.5" />
      </svg>
    </span>
  </div>
);

interface MoneyInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'value' | 'onChange' | 'type'
  > {
  value: string;
  onChange: (value: string) => void;
  /** Hide the quick calculator strip on compact inline table inputs */
  showCalculator?: boolean;
}

export const MoneyInput = ({
  value,
  onChange,
  className = controlClass,
  showCalculator = true,
  onFocus,
  onBlur,
  onKeyDown,
  ...props
}: MoneyInputProps) => {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!hasMathOperator(draft)) {
      setDraft(value);
    } else {
      const evaluated = evaluateMoneyExpression(draft);
      const formatted = evaluated !== null ? String(evaluated) : '';
      if (value !== formatted && value !== draft) {
        setDraft(value);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const isExpression = hasMathOperator(draft);
  const evaluated = isExpression ? evaluateMoneyExpression(draft) : null;

  const handleChange = (raw: string) => {
    if (hasMathOperator(raw)) {
      const cleanExpr = sanitizeMoneyExpression(raw);
      setDraft(cleanExpr);
      const result = evaluateMoneyExpression(cleanExpr);
      if (result !== null) {
        onChange(String(result));
      }
    } else {
      const clean = sanitizeAmount(raw);
      setDraft(clean);
      onChange(clean);
    }
  };

  const commitExpression = () => {
    if (!hasMathOperator(draft)) return;
    const result = evaluateMoneyExpression(draft);
    const finalStr = result !== null && result > 0 ? String(result) : '';
    setDraft(finalStr);
    onChange(finalStr);
  };

  const appendOperator = (op: '+' | '-' | '*') => {
    const base = draft.trim() || value.trim();
    if (!base) return;
    const next = `${base.replace(/[+\-*/ ]+$/, '')}${op}`;
    setDraft(next);
  };

  const divideQuick = (divisor: number) => {
    const currentVal = isExpression
      ? (evaluateMoneyExpression(draft) ?? Number(value))
      : Number(value || draft);
    if (!Number.isFinite(currentVal) || currentVal <= 0) return;
    const divided = Math.round((currentVal / divisor) * 100) / 100;
    const nextStr = String(divided);
    setDraft(nextStr);
    onChange(nextStr);
  };

  const hasPositiveValue =
    (Number(value) > 0 || (evaluated !== null && evaluated > 0)) &&
    showCalculator;

  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5">
      <input
        className={className}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={focused ? draft : value}
        onFocus={(e) => {
          setFocused(true);
          setDraft(value);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          commitExpression();
          setFocused(false);
          onBlur?.(e);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && isExpression) {
            e.preventDefault();
            commitExpression();
          }
          onKeyDown?.(e);
        }}
        onChange={(event) => handleChange(event.target.value)}
        {...props}
      />
      {focused && hasPositiveValue && (
        <div
          className="flex flex-wrap items-center gap-1"
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            type="button"
            tabIndex={-1}
            onClick={() => appendOperator('+')}
            className="tap rounded-md neu-flat px-2 py-0.5 text-xs font-bold text-[var(--text-2)] hover:text-[var(--text-strong)]"
          >
            +
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => appendOperator('-')}
            className="tap rounded-md neu-flat px-2 py-0.5 text-xs font-bold text-[var(--text-2)] hover:text-[var(--text-strong)]"
          >
            −
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => appendOperator('*')}
            className="tap rounded-md neu-flat px-2 py-0.5 text-xs font-bold text-[var(--text-2)] hover:text-[var(--text-strong)]"
          >
            ×
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => divideQuick(2)}
            className="tap rounded-md neu-flat px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]"
          >
            ÷2
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => divideQuick(3)}
            className="tap rounded-md neu-flat px-2 py-0.5 text-[11px] font-semibold text-[var(--accent)]"
          >
            ÷3
          </button>
          {isExpression && evaluated !== null && (
            <button
              type="button"
              tabIndex={-1}
              onClick={commitExpression}
              className="tap ml-auto rounded-md bg-[var(--positive)]/15 px-2.5 py-0.5 text-xs font-bold tabular-nums text-[var(--positive)]"
            >
              = €{evaluated.toFixed(2)}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
