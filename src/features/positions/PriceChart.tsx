import type { PricePoint } from './api/usePositions';

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
});

export const PriceChart = ({
  points,
  currency = 'EUR',
}: {
  points: PricePoint[];
  currency?: string;
}) => {
  if (points.length < 2) {
    return (
      <p className="py-8 text-center text-xs text-[var(--text-muted)]">
        Price history builds up as daily snapshots accumulate.
      </p>
    );
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 600;
  const height = 160;
  const step = width / (points.length - 1);

  const coords = points.map((p, i) => {
    const x = i * step;
    const y = height - ((p.value - min) / span) * (height - 12) - 6;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = `M${coords.join(' L')}`;
  const area = `${line} L${width},${height} L0,${height} Z`;
  const last = coords[coords.length - 1]!.split(',');

  const rising = values[values.length - 1]! >= values[0]!;
  const stroke = rising ? 'var(--positive)' : 'var(--negative)';

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(n);

  return (
    <div className="flex flex-col gap-1">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="price" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#price)" />
        <path d={line} fill="none" stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <circle cx={last[0]} cy={last[1]} r="3.5" fill={stroke} />
      </svg>
      <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
        <span>{dateFmt.format(new Date(points[0]!.date))}</span>
        <span className="tabular-nums">
          {fmt(min)} – {fmt(max)}
        </span>
        <span>{dateFmt.format(new Date(points[points.length - 1]!.date))}</span>
      </div>
    </div>
  );
};
