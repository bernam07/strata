import type { ReactNode } from 'react';

type Tone = 'default' | 'positive' | 'negative';

const toneColor: Record<Tone, string> = {
  default: 'var(--text-strong)',
  positive: 'var(--positive)',
  negative: 'var(--negative)',
};

// A single figure in the same tile language as the expense categories: one
// card radius, one border, the label above and a quiet hint below. Every
// stat across the app renders through this so a row of them reads as one
// object rather than four separately-styled boxes.
export const Stat = ({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
}) => (
  <div className="flex min-h-[92px] flex-col justify-between gap-2 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface-flat)] p-4">
    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
      {label}
    </span>
    <span className="flex flex-col gap-0.5">
      <span
        className="text-[22px] font-extrabold leading-none tracking-[-0.01em] tabular-nums"
        style={{ color: toneColor[tone] }}
      >
        {value}
      </span>
      {hint && (
        <span className="text-[11px] text-[var(--text-muted)]">{hint}</span>
      )}
    </span>
  </div>
);
