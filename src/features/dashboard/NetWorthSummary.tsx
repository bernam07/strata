import type { ReactNode } from 'react';
import { formatEur, money } from '@/core/money/money';
import type { NetWorth } from '@/core/networth/netWorth';
import type { SeriesPoint } from '@/core/analytics/series';

const percent = new Intl.NumberFormat('en-GB', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const Sparkline = ({ series }: { series: SeriesPoint[] }) => {
  if (series.length < 2) return null;
  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 300;
  const height = 44;
  const step = width / (series.length - 1);
  const points = values.map((value, index) => {
    const x = index * step;
    const y = height - ((value - min) / span) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = `M${points.join(' L')}`;
  const area = `${line} L${width},${height} L0,${height} Z`;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-11 w-full"
    >
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" />
    </svg>
  );
};

export const NetWorthSummary = ({
  netWorth,
  series = [],
  control,
}: {
  netWorth: NetWorth;
  series?: SeriesPoint[];
  control?: ReactNode;
}) => {
  const first = series[0]?.value ?? null;
  const last = series[series.length - 1]?.value ?? null;
  const change =
    first !== null && last !== null && series.length >= 2 ? last - first : null;
  const changePct =
    change !== null && first !== null && first !== 0
      ? change / Math.abs(first)
      : null;
  const up = change !== null && change >= 0;

  return (
    <section className="relative overflow-hidden rounded-[var(--radius-card)] neu-raised p-6">
      <div
        className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full opacity-60 blur-3xl"
        style={{
          background:
            'radial-gradient(circle, var(--accent-soft), transparent 70%)',
        }}
      />
      <div className="relative flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Net worth
            </p>
            <p className="mt-1.5 text-[42px] font-extrabold leading-none tracking-tight text-[var(--text-strong)]">
              {formatEur(netWorth.net)}
            </p>
            {change !== null && (
              <p
                className="mt-2 text-sm font-semibold tabular-nums"
                style={{ color: up ? 'var(--positive)' : 'var(--negative)' }}
              >
                {up ? '▲' : '▼'} {formatEur(money(Math.abs(change)))}
                {changePct !== null && ` · ${percent.format(changePct)}`}
              </p>
            )}
          </div>
          {control}
        </div>

        <Sparkline series={series} />

        <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[var(--radius-field)] neu-sunken p-4">
          <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
            Assets
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums text-[var(--positive)]">
            {formatEur(netWorth.totalAssets)}
          </p>
        </div>
        <div className="rounded-[var(--radius-field)] neu-sunken p-4">
          <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
            Liabilities
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums text-[var(--negative)]">
            {formatEur(netWorth.totalLiabilities)}
          </p>
          </div>
        </div>
      </div>
    </section>
  );
};
