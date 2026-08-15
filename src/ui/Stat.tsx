import type { ReactNode } from 'react';
import { Surface } from './Surface';

type Tone = 'default' | 'positive' | 'negative';

const toneColor: Record<Tone, string> = {
  default: 'var(--text-strong)',
  positive: 'var(--positive)',
  negative: 'var(--negative)',
};

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
  <Surface elevation="sunken" className="flex flex-col gap-1 p-4">
    <span className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
      {label}
    </span>
    <span
      className="text-xl font-bold tabular-nums"
      style={{ color: toneColor[tone] }}
    >
      {value}
    </span>
    {hint && (
      <span className="text-[11px] text-[var(--text-muted)]">{hint}</span>
    )}
  </Surface>
);
