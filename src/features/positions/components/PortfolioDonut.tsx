import { useMemo, useRef, useState, type PointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { toNumber } from '@/core/money/money';
import type { Position } from '@/core/positions/derivePositions';
import type { CryptoHolding } from '@/features/crypto/api/useCrypto';
import { CoinIcon } from '@/features/crypto/CoinIcon';
import { AmountInline } from '@/ui/Amount';
import { pctMax1 as percent } from '@/ui/format';
import type { InstrumentMeta } from '../api/usePositions';
import { StockAvatar } from './StockAvatar';

const palette = [
  '#e0a44a',
  '#5aa9c9',
  '#4fb286',
  '#7c8bff',
  '#c4708f',
  '#5b6ee1',
  '#d0567b',
  '#2fa27a',
  '#e27d60',
  '#85cdca',
];

const TWO_PI = Math.PI * 2;

type DonutMode = 'holding' | 'class' | 'sector';

interface PortfolioSegment {
  id: string;
  name: string;
  ticker?: string;
  isin?: string | null;
  cryptoImage?: string | null;
  isCrypto?: boolean;
  value: number;
  weight: number;
  color: string;
  to: string;
}

export const PortfolioDonut = ({
  positions,
  instruments,
  crypto,
  freeCash,
}: {
  positions: Position[];
  instruments: Map<string, InstrumentMeta>;
  crypto: CryptoHolding[];
  freeCash: number;
}) => {
  const ref = useRef<SVGSVGElement>(null);
  const [mode, setMode] = useState<DonutMode>('holding');
  const [active, setActive] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  const segments = useMemo<PortfolioSegment[]>(() => {
    const raw: Omit<PortfolioSegment, 'weight' | 'color'>[] = [];

    if (mode === 'holding') {
      for (const pos of positions) {
        const val = toNumber(pos.marketValue ?? pos.costBasis);
        if (val <= 0) continue;
        const meta = instruments.get(pos.instrumentId);
        raw.push({
          id: `stock-${pos.instrumentId}`,
          name: meta?.name ?? meta?.ticker ?? 'Instrument',
          ticker: meta?.ticker ?? pos.instrumentId,
          isin: meta?.isin,
          value: val,
          to: `/positions/${pos.instrumentId}`,
        });
      }
      for (const coin of crypto) {
        if (coin.valueEur <= 0) continue;
        raw.push({
          id: `crypto-${coin.symbol}`,
          name: coin.name,
          ticker: coin.symbol,
          cryptoImage: coin.imageUrl,
          isCrypto: true,
          value: coin.valueEur,
          to: '/crypto',
        });
      }
      if (freeCash > 0) {
        raw.push({
          id: 'broker-cash',
          name: 'Broker Cash',
          value: freeCash,
          to: '/accounts',
        });
      }
    } else if (mode === 'class') {
      const stocksVal = positions.reduce(
        (acc, p) => acc + toNumber(p.marketValue ?? p.costBasis),
        0,
      );
      const cryptoVal = crypto.reduce((acc, c) => acc + c.valueEur, 0);
      if (stocksVal > 0) {
        raw.push({
          id: 'class-stocks',
          name: `Stocks & ETFs (${positions.length})`,
          value: stocksVal,
          to: '/positions',
        });
      }
      if (cryptoVal > 0) {
        raw.push({
          id: 'class-crypto',
          name: `Crypto (${crypto.length})`,
          value: cryptoVal,
          to: '/crypto',
        });
      }
      if (freeCash > 0) {
        raw.push({
          id: 'class-cash',
          name: 'Broker Cash',
          value: freeCash,
          to: '/accounts',
        });
      }
    } else {
      const bySector = new Map<string, number>();
      for (const pos of positions) {
        const val = toNumber(pos.marketValue ?? pos.costBasis);
        if (val <= 0) continue;
        const sector =
          instruments.get(pos.instrumentId)?.sector?.trim() || 'Equities / ETFs';
        bySector.set(sector, (bySector.get(sector) ?? 0) + val);
      }
      for (const [sector, val] of bySector.entries()) {
        raw.push({
          id: `sector-${sector}`,
          name: sector,
          value: val,
          to: '/positions',
        });
      }
      const cryptoVal = crypto.reduce((acc, c) => acc + c.valueEur, 0);
      if (cryptoVal > 0) {
        raw.push({
          id: 'sector-crypto',
          name: 'Crypto Assets',
          value: cryptoVal,
          to: '/crypto',
        });
      }
      if (freeCash > 0) {
        raw.push({
          id: 'sector-cash',
          name: 'Cash Reserve',
          value: freeCash,
          to: '/accounts',
        });
      }
    }

    raw.sort((a, b) => b.value - a.value);
    const total = raw.reduce((acc, item) => acc + item.value, 0) || 1;

    return raw.map((item, idx) => ({
      ...item,
      weight: item.value / total,
      color: palette[idx % palette.length]!,
    }));
  }, [mode, positions, instruments, crypto, freeCash]);

  const size = 210;
  const stroke = 22;
  const center = size / 2;
  const radius = center - stroke / 2 - 10;

  const pointAt = (theta: number): [number, number] => [
    center + radius * Math.sin(theta),
    center - radius * Math.cos(theta),
  ];
  const arcPath = (a0: number, a1: number): string => {
    const [x0, y0] = pointAt(a0);
    const [x1, y1] = pointAt(a1);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };

  const locate = (event: PointerEvent<SVGSVGElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || segments.length === 0) return;
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    let theta = Math.atan2(dx, -dy);
    if (theta < 0) theta += TWO_PI;
    const fraction = theta / TWO_PI;
    let acc = 0;
    for (let i = 0; i < segments.length; i += 1) {
      acc += segments[i]!.weight;
      if (fraction <= acc) {
        setActive(i);
        return;
      }
    }
    setActive(segments.length - 1);
  };

  const current = active !== null ? segments[active] : null;
  const visibleSegments =
    showAll || segments.length <= 5 ? segments : segments.slice(0, 5);

  let cursor = 0;

  const centerNoun =
    mode === 'class'
      ? segments.length === 1
        ? 'class'
        : 'classes'
      : mode === 'sector'
        ? segments.length === 1
          ? 'sector'
          : 'sectors'
        : segments.length === 1
          ? 'asset'
          : 'assets';

  return (
    <div className="flex flex-col gap-4 border-t border-[var(--line)] pt-4">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="relative mx-auto aspect-square w-full max-w-[205px] shrink-0 sm:mx-0 sm:w-[195px]">
          <svg
            ref={ref}
            viewBox={`0 0 ${size} ${size}`}
            role="img"
            aria-label={`Portfolio breakdown by ${mode}`}
            className="h-full w-full touch-none select-none"
            onPointerDown={locate}
            onPointerMove={locate}
            onPointerUp={() => setActive(null)}
            onPointerLeave={() => setActive(null)}
          >
            {(segments.length === 0 ||
              (segments.length === 1 && segments[0]!.weight > 0.999)) && (
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={segments[0]?.color ?? 'var(--surface-flat)'}
                strokeWidth={stroke}
              />
            )}
            {segments.length > 1 &&
              segments.map((segment, index) => {
                const a0 = cursor * TWO_PI;
                cursor += segment.weight;
                const a1 = cursor * TWO_PI;
                return (
                  <path
                    key={segment.id}
                    d={arcPath(a0, a1)}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth={active === index ? stroke + 6 : stroke}
                    strokeLinecap="butt"
                    opacity={active === null || active === index ? 1 : 0.4}
                  />
                );
              })}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            {current ? (
              <>
                <p className="max-w-full truncate text-xs font-semibold text-[var(--text-muted)]">
                  {current.name}
                </p>
                <p className="text-lg font-extrabold text-[var(--text-strong)]">
                  <AmountInline value={current.value} />
                </p>
                <p className="text-xs font-semibold tabular-nums text-[var(--accent)]">
                  {percent.format(current.weight)}
                </p>
              </>
            ) : (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  Allocation
                </p>
                <p className="text-2xl font-extrabold leading-tight tabular-nums text-[var(--text-strong)]">
                  {segments.length}
                </p>
                <p className="text-[11px] font-semibold text-[var(--text-muted)]">
                  {centerNoun}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex w-full min-w-0 flex-1 flex-col gap-1.5">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2 px-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              Breakdown
            </span>
            <div className="inline-flex items-center rounded-full border border-[var(--line)] bg-[var(--surface-sunken)] p-0.5 text-[10px] font-semibold">
              {(
                [
                  { id: 'holding', label: 'By holding' },
                  { id: 'class', label: 'By class' },
                  { id: 'sector', label: 'By sector' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setMode(tab.id);
                    setActive(null);
                    setShowAll(false);
                  }}
                  className={`tap rounded-full px-2.5 py-0.5 transition-colors ${
                    mode === tab.id
                      ? 'bg-[var(--surface-raised)] text-[var(--text-strong)] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {visibleSegments.map((segment, index) => (
            <Link
              key={segment.id}
              to={segment.to}
              onPointerEnter={() => setActive(index)}
              onPointerLeave={() => setActive(null)}
              className="tap flex items-center gap-2.5 rounded-[var(--radius-field)] px-2 py-1.5 hover:bg-[var(--surface-flat)]"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: segment.color }}
              />
              {segment.ticker &&
                (segment.isCrypto ? (
                  <CoinIcon
                    src={segment.cryptoImage ?? null}
                    ticker={segment.ticker}
                    size={20}
                  />
                ) : (
                  <StockAvatar
                    ticker={segment.ticker}
                    isin={segment.isin}
                    size={20}
                  />
                ))}
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text-strong)]">
                {segment.name}
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--text-strong)]">
                <AmountInline value={segment.value} />
              </span>
              <span className="w-12 shrink-0 text-right text-xs font-semibold tabular-nums text-[var(--accent)]">
                {percent.format(segment.weight)}
              </span>
            </Link>
          ))}

          {segments.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="tap mt-1 self-start px-2 text-xs font-semibold text-[var(--accent)]"
            >
              {showAll
                ? 'Show top 5'
                : `Show all (${segments.length} ${centerNoun})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
