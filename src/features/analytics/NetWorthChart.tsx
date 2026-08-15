import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { SeriesPoint } from '@/core/analytics/series';

const eur = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const monthDay = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
});

const H = 260;
const padL = 60;
const padR = 10;
const padT = 10;
const padB = 24;

const niceStep = (rough: number): number => {
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / pow;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * pow;
};

export const NetWorthChart = ({ series }: { series: SeriesPoint[] }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  // Measure synchronously before paint so the first frame is drawn at the real
  // container width — otherwise the chart renders too wide and spills off / is
  // clipped until the ResizeObserver catches up.
  useLayoutEffect(() => {
    if (ref.current) setWidth(ref.current.clientWidth);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const geometry = useMemo(() => {
    if (series.length < 2) return null;
    const values = series.map((point) => point.value);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const step = niceStep((rawMax - rawMin || Math.abs(rawMax) || 1) / 3);
    const min = Math.floor(rawMin / step) * step;
    const max = Math.ceil(rawMax / step) * step;
    const span = max - min || 1;

    const innerW = Math.max(width - padL - padR, 10);
    const innerH = H - padT - padB;
    const x = (index: number) =>
      padL + (index / (series.length - 1)) * innerW;
    const y = (value: number) => padT + (1 - (value - min) / span) * innerH;

    const line = series
      .map((point, index) => `${x(index).toFixed(1)},${y(point.value).toFixed(1)}`)
      .join(' L');
    const area = `M${line} L${x(series.length - 1).toFixed(1)},${(
      padT + innerH
    ).toFixed(1)} L${x(0).toFixed(1)},${(padT + innerH).toFixed(1)} Z`;

    const ticks: number[] = [];
    for (let value = min; value <= max + 1e-6; value += step) ticks.push(value);

    return { x, y, line: `M${line}`, area, ticks, min, max };
  }, [series, width]);

  if (!geometry) {
    return (
      <p className="py-12 text-center text-sm text-[var(--text-muted)]">
        Not enough data for this period.
      </p>
    );
  }

  const { x, y, ticks } = geometry;
  const labelEvery = Math.max(1, Math.ceil(series.length / 6));
  const active = hover !== null ? series[hover] : null;

  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const relative = event.clientX - rect.left - padL;
    const innerW = Math.max(width - padL - padR, 10);
    const index = Math.round((relative / innerW) * (series.length - 1));
    setHover(Math.max(0, Math.min(series.length - 1, index)));
  };

  return (
    <div ref={ref} className="relative w-full" style={{ height: H }}>
      <svg
        width="100%"
        height={H}
        className="touch-none"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="networth" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
          </linearGradient>
        </defs>

        {ticks.map((value) => (
          <g key={value}>
            <line
              x1={padL}
              x2={width - padR}
              y1={y(value)}
              y2={y(value)}
              stroke="var(--text-muted)"
              strokeOpacity={0.12}
            />
            <text
              x={padL - 8}
              y={y(value)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={11}
              fill="var(--text-muted)"
            >
              {eur.format(value)}
            </text>
          </g>
        ))}

        {series.map((point, index) =>
          index % labelEvery === 0 ? (
            <text
              key={point.date + index}
              x={x(index)}
              y={H - 6}
              textAnchor="middle"
              fontSize={11}
              fill="var(--text-muted)"
            >
              {monthDay.format(new Date(point.date))}
            </text>
          ) : null,
        )}

        <path d={geometry.area} fill="url(#networth)" />
        <path
          d={geometry.line}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2}
        />

        {active && hover !== null && (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={padT}
              y2={H - padB}
              stroke="var(--accent)"
              strokeOpacity={0.4}
            />
            <circle
              cx={x(hover)}
              cy={y(active.value)}
              r={4}
              fill="var(--accent)"
              stroke="var(--surface-raised)"
              strokeWidth={2}
            />
          </g>
        )}
      </svg>

      {active && hover !== null && (
        <div
          className="pointer-events-none absolute top-2 rounded-[var(--radius-field)] neu-raised px-3 py-2 text-xs"
          style={{
            left: Math.min(Math.max(x(hover) - 50, 0), width - 120),
          }}
        >
          <p className="text-[var(--text-muted)]">
            {new Date(active.date).toLocaleDateString('en-GB')}
          </p>
          <p className="font-semibold tabular-nums text-[var(--text-strong)]">
            {eur.format(active.value)}
          </p>
        </div>
      )}
    </div>
  );
};
