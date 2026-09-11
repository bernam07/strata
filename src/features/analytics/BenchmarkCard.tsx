import { useMemo, useState } from 'react';
import { pct1 as percent } from '@/ui/format';
import { useInvestmentsHistory } from '@/features/dashboard/api/useNetWorthHistory';
import { useQuote } from '@/features/search/api/useMarket';
import { Card } from '@/ui/Card';

interface Point {
  date: string;
  pct: number;
}

const benchmarks = [
  { label: 'S&P 500', symbol: '^GSPC' },
  { label: 'Nasdaq 100', symbol: '^NDX' },
  { label: 'MSCI World', symbol: 'URTH' },
] as const;

const ranges = [
  { label: '3M', value: '3mo', days: 91 },
  { label: '6M', value: '6mo', days: 182 },
  { label: '1Y', value: '1y', days: 365 },
  { label: '5Y', value: '5y', days: 1825 },
] as const;

const rebase = (points: { date: string; value: number }[]): Point[] => {
  const base = points.find((point) => point.value > 0)?.value;
  if (!base) return [];
  return points.map((point) => ({ date: point.date, pct: point.value / base - 1 }));
};

const DualLine = ({ mine, index }: { mine: Point[]; index: Point[] }) => {
  const all = [...mine, ...index];
  if (all.length < 2) return null;
  const times = all.map((p) => Date.parse(p.date));
  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const pcts = all.map((p) => p.pct).concat(0);
  const minP = Math.min(...pcts);
  const maxP = Math.max(...pcts);
  const spanP = maxP - minP || 1;
  const W = 600;
  const H = 170;
  const pad = 10;
  const x = (t: number) => ((t - minT) / (maxT - minT || 1)) * W;
  const y = (p: number) => H - pad - ((p - minP) / spanP) * (H - 2 * pad);
  const path = (series: Point[]) =>
    series.length < 2
      ? ''
      : `M${series
          .map((pt) => `${x(Date.parse(pt.date)).toFixed(1)},${y(pt.pct).toFixed(1)}`)
          .join(' L')}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full" preserveAspectRatio="none">
      <line
        x1="0"
        x2={W}
        y1={y(0)}
        y2={y(0)}
        stroke="var(--line)"
        strokeWidth="1"
        strokeDasharray="4 4"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={path(index)}
        fill="none"
        stroke="var(--text-muted)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={path(mine)}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

export const BenchmarkCard = () => {
  const [benchmark, setBenchmark] = useState<(typeof benchmarks)[number]>(
    benchmarks[0],
  );
  const [range, setRange] = useState<(typeof ranges)[number]>(ranges[2]);
  const { data: snapshots = [] } = useInvestmentsHistory();
  const { data: quote } = useQuote(benchmark.symbol, range.value);

  const model = useMemo(() => {
    const cutoff = new Date(Date.now() - range.days * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const mine = rebase(snapshots.filter((point) => point.date >= cutoff));
    const index = rebase(quote?.history ?? []);
    return {
      mine,
      index,
      myReturn: mine.length > 0 ? mine[mine.length - 1]!.pct : null,
      indexReturn: index.length > 0 ? index[index.length - 1]!.pct : null,
    };
  }, [snapshots, quote, range.days]);

  const signed = (value: number | null) =>
    value === null ? '—' : `${value >= 0 ? '+' : ''}${percent.format(value)}`;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-[var(--text-strong)]">
          Your portfolio vs the market
        </h2>
        <div className="flex gap-2">
          <div className="flex gap-1 rounded-[var(--radius-field)] neu-sunken p-1">
            {benchmarks.map((option) => (
              <button
                key={option.symbol}
                type="button"
                onClick={() => setBenchmark(option)}
                className={`tap rounded-[var(--radius-field)] px-2.5 py-1 text-xs font-semibold ${
                  benchmark.symbol === option.symbol
                    ? 'neu-flat text-[var(--accent)]'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 rounded-[var(--radius-field)] neu-sunken p-1">
            {ranges.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRange(option)}
                className={`tap rounded-[var(--radius-field)] px-2 py-1 text-xs font-semibold ${
                  range.value === option.value
                    ? 'neu-flat text-[var(--accent)]'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {model.mine.length < 2 ? (
        <p className="py-6 text-center text-sm text-[var(--text-muted)]">
          Not enough investment history yet. Use “Reconstruct history” above, or
          it fills in daily.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-8 gap-y-1">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[var(--accent)]">
                You
              </p>
              <p className="text-lg font-bold tabular-nums text-[var(--text-strong)]">
                {signed(model.myReturn)}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                {benchmark.label}
              </p>
              <p className="text-lg font-bold tabular-nums text-[var(--text-2)]">
                {signed(model.indexReturn)}
              </p>
            </div>
          </div>
          <DualLine mine={model.mine} index={model.index} />
          <p className="text-[11px] text-[var(--text-muted)]">
            Indexed to the start of the period. Buys and sells move your line,
            so this is a rough comparison, not pure performance.
          </p>
        </>
      )}
    </Card>
  );
};
