import { useRef, useState, type PointerEvent } from 'react';
import type { PricePoint } from './api/usePositions';

const axisFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: '2-digit',
});

const readoutFmt = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export const PriceChart = ({
  points,
  currency = 'EUR',
}: {
  points: PricePoint[];
  currency?: string;
}) => {
  const [active, setActive] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

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
  const padY = 8;

  const xOf = (i: number) => (i / (points.length - 1)) * width;
  const yOf = (value: number) =>
    height - padY - ((value - min) / span) * (height - 2 * padY);

  const coords = points.map((p, i) => `${xOf(i).toFixed(1)},${yOf(p.value).toFixed(1)}`);
  const line = `M${coords.join(' L')}`;
  const area = `${line} L${width},${height} L0,${height} Z`;

  const rising = values[values.length - 1]! >= values[0]!;
  const stroke = rising ? 'var(--positive)' : 'var(--negative)';

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(n);

  const index = active ?? points.length - 1;
  const current = points[index]!;
  const fracX = index / (points.length - 1);
  const fracY = yOf(current.value) / height;

  const locate = (event: PointerEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    setActive(Math.round(fraction * (points.length - 1)));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-lg font-bold tabular-nums text-[var(--text-strong)]">
          {fmt(current.value)}
        </span>
        <span className="text-xs tabular-nums text-[var(--text-muted)]">
          {readoutFmt.format(new Date(current.date))}
        </span>
      </div>

      <div
        ref={ref}
        className="relative h-40 w-full touch-none select-none"
        onPointerDown={locate}
        onPointerMove={locate}
        onPointerLeave={() => setActive(null)}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-full w-full"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="price" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#price)" />
          <path
            d={line}
            fill="none"
            stroke={stroke}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <div
          className="pointer-events-none absolute inset-y-0"
          style={{ left: `${fracX * 100}%` }}
        >
          <div className="absolute inset-y-0 w-px bg-[var(--line)]" />
          <div
            className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
            style={{
              top: `${fracY * 100}%`,
              borderColor: stroke,
              background: 'var(--bg)',
            }}
          />
        </div>
      </div>

      <div className="flex justify-between text-[10px] tabular-nums text-[var(--text-muted)]">
        <span>{axisFmt.format(new Date(points[0]!.date))}</span>
        <span>
          {fmt(min)} – {fmt(max)}
        </span>
        <span>{axisFmt.format(new Date(points[points.length - 1]!.date))}</span>
      </div>
    </div>
  );
};
