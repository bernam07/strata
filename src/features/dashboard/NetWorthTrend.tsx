import type { ReactNode } from 'react';
import { pct1 as percent } from '@/ui/format';
import { formatEur, money } from '@/core/money/money';
import type { SeriesPoint } from '@/core/analytics/series';
import { Card } from '@/ui/Card';

const Sparkline = ({ series }: { series: SeriesPoint[] }) => {
  if (series.length < 2) {
    return (
      <p className="py-6 text-center text-xs text-[var(--text-muted)]">
        Net worth history builds up as you record activity.
      </p>
    );
  }
  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 300;
  const height = 64;
  const step = width / (series.length - 1);
  const points = values.map((value, index) => {
    const x = index * step;
    const y = height - ((value - min) / span) * (height - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = `M${points.join(' L')}`;
  const area = `${line} L${width},${height} L0,${height} Z`;
  const rising = values[values.length - 1]! >= values[0]!;
  const stroke = rising ? 'var(--positive)' : 'var(--negative)';
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-16 w-full"
    >
      <defs>
        <linearGradient id="trend" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.3" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#trend)" />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

export const NetWorthTrend = ({
  series = [],
  basisLabel,
  control,
  footer,
}: {
  series?: SeriesPoint[];
  basisLabel?: string;
  control?: ReactNode;
  footer?: ReactNode;
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
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[var(--text-muted)]">
            Trend
          </p>
          {change !== null ? (
            <p
              className="mt-0.5 text-sm font-semibold tabular-nums"
              style={{ color: up ? 'var(--positive)' : 'var(--negative)' }}
            >
              {up ? '▲' : '▼'} {formatEur(money(Math.abs(change)))}
              {changePct !== null && ` · ${percent.format(changePct)}`}
              {basisLabel && (
                <span className="ml-1 font-normal text-[var(--text-muted)]">
                  {basisLabel}
                </span>
              )}
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">
              over the period
            </p>
          )}
        </div>
        {control}
      </div>
      <Sparkline series={series} />
      {footer}
    </Card>
  );
};
