import { useMemo, useRef, useState, type PointerEvent } from 'react';
import type { PricePoint } from './api/usePositions';

export interface ChartTradeMarker {
  id: string;
  date: string;
  kind: 'buy' | 'sell';
  quantity: number;
  price: number;
  amount: number;
}

interface PointMarkerGroup {
  pointIndex: number;
  date: string;
  kind: 'buy' | 'sell' | 'mixed';
  totalQuantity: number;
  trades: ChartTradeMarker[];
}

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

const qtyFmt = new Intl.NumberFormat('en-GB', {
  maximumFractionDigits: 4,
});

export const PriceChart = ({
  points,
  currency = 'EUR',
  averagePrice,
  markers = [],
}: {
  points: PricePoint[];
  currency?: string;
  averagePrice?: number | null;
  markers?: ChartTradeMarker[];
}) => {
  const [active, setActive] = useState<number | null>(null);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  const markerGroups = useMemo<PointMarkerGroup[]>(() => {
    if (points.length < 2 || markers.length === 0) return [];
    const firstMs = new Date(points[0]!.date).getTime();
    const lastMs = new Date(points[points.length - 1]!.date).getTime();
    // Allow trades on the same calendar day as first/last point
    const minMs = firstMs - 86_400_000;
    const maxMs = lastMs + 86_400_000;

    const pointTimes = points.map((p) => new Date(p.date).getTime());
    const byIndex = new Map<number, ChartTradeMarker[]>();

    for (const marker of markers) {
      const tMs = new Date(marker.date).getTime();
      if (Number.isNaN(tMs) || tMs < minMs || tMs > maxMs) continue;
      let bestIdx = 0;
      let bestDiff = Infinity;
      for (let i = 0; i < pointTimes.length; i += 1) {
        const diff = Math.abs(pointTimes[i]! - tMs);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestIdx = i;
        }
      }
      const list = byIndex.get(bestIdx) ?? [];
      list.push(marker);
      byIndex.set(bestIdx, list);
    }

    return [...byIndex.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([pointIndex, trades]) => {
        const hasBuy = trades.some((t) => t.kind === 'buy');
        const hasSell = trades.some((t) => t.kind === 'sell');
        const kind: PointMarkerGroup['kind'] =
          hasBuy && hasSell ? 'mixed' : hasBuy ? 'buy' : 'sell';
        const totalQuantity = trades.reduce((acc, t) => acc + t.quantity, 0);
        return {
          pointIndex,
          date: points[pointIndex]!.date,
          kind,
          totalQuantity,
          trades,
        };
      });
  }, [points, markers]);

  if (points.length < 2) {
    return (
      <p className="py-8 text-center text-xs text-[var(--text-muted)]">
        Price history builds up as daily snapshots accumulate.
      </p>
    );
  }

  const values = points.map((p) => p.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);

  const hasValidAvg =
    typeof averagePrice === 'number' &&
    Number.isFinite(averagePrice) &&
    averagePrice > 0;
  // Include averagePrice in vertical scale when it sits within a reasonable band
  // of the visible history so the line isn't clipped just outside the range.
  const includeAvgInScale =
    showAnnotations &&
    hasValidAvg &&
    averagePrice >= rawMin * 0.55 &&
    averagePrice <= rawMax * 1.55;

  const min = includeAvgInScale ? Math.min(rawMin, averagePrice) : rawMin;
  const max = includeAvgInScale ? Math.max(rawMax, averagePrice) : rawMax;
  const span = max - min || 1;
  const width = 600;
  const height = 168;
  const padY = 12;

  const xOf = (i: number) => (i / (points.length - 1)) * width;
  const yOf = (value: number) =>
    height - padY - ((value - min) / span) * (height - 2 * padY);

  const coords = points.map(
    (p, i) => `${xOf(i).toFixed(1)},${yOf(p.value).toFixed(1)}`,
  );
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

  const avgY = hasValidAvg ? yOf(averagePrice) : null;
  const avgVisible =
    showAnnotations &&
    avgY !== null &&
    avgY >= padY - 4 &&
    avgY <= height - padY + 4;
  const avgFracY = avgY !== null ? avgY / height : 0;

  const vsAvgPct =
    hasValidAvg && averagePrice > 0
      ? (current.value - averagePrice) / averagePrice
      : null;

  const activeMarkerGroup =
    !showAnnotations || markerGroups.length === 0 || active === null
      ? null
      : (markerGroups.find((g) => g.pointIndex === active) ??
        markerGroups.find((g) => Math.abs(g.pointIndex - active) <= 1) ??
        null);

  const locate = (event: PointerEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const fraction = Math.min(
      1,
      Math.max(0, (event.clientX - rect.left) / rect.width),
    );
    setActive(Math.round(fraction * (points.length - 1)));
  };

  const hasAnyAnnotations = hasValidAvg || markerGroups.length > 0;
  const buyCount = markerGroups.reduce(
    (acc, g) => acc + g.trades.filter((t) => t.kind === 'buy').length,
    0,
  );
  const sellCount = markerGroups.reduce(
    (acc, g) => acc + g.trades.filter((t) => t.kind === 'sell').length,
    0,
  );

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2.5">
          <span className="text-lg font-bold tabular-nums text-[var(--text-strong)]">
            {fmt(current.value)}
          </span>
          {showAnnotations && vsAvgPct !== null && (
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums"
              style={{
                color: vsAvgPct >= 0 ? 'var(--positive)' : 'var(--negative)',
                background:
                  vsAvgPct >= 0
                    ? 'color-mix(in srgb, var(--positive) 14%, transparent)'
                    : 'color-mix(in srgb, var(--negative) 14%, transparent)',
              }}
            >
              {vsAvgPct >= 0 ? '+' : ''}
              {(vsAvgPct * 100).toFixed(1)}% vs avg
            </span>
          )}
        </div>
        <span className="text-xs tabular-nums text-[var(--text-muted)]">
          {readoutFmt.format(new Date(current.date))}
        </span>
      </div>

      {hasAnyAnnotations && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
          <div className="flex flex-wrap items-center gap-3">
            {hasValidAvg && (
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-0 w-3.5 border-t-2 border-dashed border-[var(--accent)]" />
                <span>
                  Avg buy <strong className="font-semibold text-[var(--text-2)]">{fmt(averagePrice)}</strong>
                </span>
              </span>
            )}
            {buyCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-[var(--positive)]" />
                <span>
                  {buyCount} {buyCount === 1 ? 'buy' : 'buys'}
                </span>
              </span>
            )}
            {sellCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-[var(--negative)]" />
                <span>
                  {sellCount} {sellCount === 1 ? 'sell' : 'sells'}
                </span>
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowAnnotations((prev) => !prev)}
            aria-pressed={showAnnotations}
            className="tap rounded-full border border-[var(--line)] bg-[var(--surface-sunken)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--text-2)] hover:text-[var(--text-strong)]"
          >
            {showAnnotations ? 'Hide markers' : 'Show markers'}
          </button>
        </div>
      )}

      {activeMarkerGroup && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-field)] border border-[var(--line)] bg-[var(--surface-sunken)] px-3 py-1.5 text-xs">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-extrabold text-black"
              style={{
                background:
                  activeMarkerGroup.kind === 'sell'
                    ? 'var(--negative)'
                    : 'var(--positive)',
              }}
            >
              {activeMarkerGroup.kind === 'sell' ? 'S' : 'B'}
            </span>
            <span className="font-semibold text-[var(--text-strong)]">
              {activeMarkerGroup.trades.map((t, idx) => (
                <span key={t.id}>
                  {idx > 0 ? ' · ' : ''}
                  {t.kind === 'buy' ? 'Bought' : 'Sold'}{' '}
                  {qtyFmt.format(t.quantity)} @ {fmt(t.price)}
                </span>
              ))}
            </span>
          </div>
          <span className="text-[11px] tabular-nums text-[var(--text-muted)]">
            {axisFmt.format(new Date(activeMarkerGroup.trades[0]!.date))}
          </span>
        </div>
      )}

      <div
        ref={ref}
        className="relative h-44 w-full touch-none select-none"
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
          {avgVisible && avgY !== null && (
            <line
              x1={0}
              x2={width}
              y1={avgY}
              y2={avgY}
              stroke="var(--accent)"
              strokeWidth="1.5"
              strokeDasharray="5 4"
              vectorEffect="non-scaling-stroke"
              opacity={0.85}
            />
          )}
          <path
            d={line}
            fill="none"
            stroke={stroke}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {avgVisible && hasValidAvg && (
          <div
            className="pointer-events-none absolute right-1.5 -translate-y-1/2 rounded bg-[var(--surface-raised)]/90 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-[var(--accent)] shadow-sm ring-1 ring-[var(--accent)]/30"
            style={{ top: `${avgFracY * 100}%` }}
          >
            Avg {fmt(averagePrice)}
          </div>
        )}

        {showAnnotations &&
          markerGroups.map((group) => {
            const pt = points[group.pointIndex]!;
            const mFracX = group.pointIndex / (points.length - 1);
            const mFracY = yOf(pt.value) / height;
            const isSell = group.kind === 'sell';
            const isSelected = activeMarkerGroup?.pointIndex === group.pointIndex;
            return (
              <button
                key={`${group.pointIndex}-${group.kind}`}
                type="button"
                aria-label={`${isSell ? 'Sell' : 'Buy'} ${qtyFmt.format(group.totalQuantity)} shares on ${axisFmt.format(new Date(group.date))}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setActive(group.pointIndex);
                }}
                style={{
                  left: `${mFracX * 100}%`,
                  top: `${mFracY * 100}%`,
                  background: isSell ? 'var(--negative)' : 'var(--positive)',
                }}
                className={` absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full border-2 border-[var(--bg)] text-[8px] font-extrabold text-black shadow-md transition-transform ${
                  isSelected ? 'z-20 h-5 w-5 scale-110' : 'z-10 h-4 w-4 hover:scale-110'
                }`}
              >
                {isSell ? 'S' : 'B'}
              </button>
            );
          })}

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
