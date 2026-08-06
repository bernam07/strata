import { useMemo, useRef, useState, type PointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { formatEur, isNegative, type Money } from '@/core/money/money';
import type { NetWorth } from '@/core/networth/netWorth';
import { InstitutionLogo } from '@/features/accounts/components/InstitutionLogo';

const percent = new Intl.NumberFormat('en-GB', {
  style: 'percent',
  maximumFractionDigits: 1,
});

const assetPalette = [
  '#e0a44a',
  '#5aa9c9',
  '#4fb286',
  '#7c8bff',
  '#c4708f',
  '#5b6ee1',
  '#d0567b',
  '#2fa27a',
];

interface Segment {
  id: string;
  name: string;
  institutionId: string;
  balance: Money;
  magnitude: number;
  liability: boolean;
  color: string;
  weight: number;
}

const TWO_PI = Math.PI * 2;

export const NetWorthDonut = ({
  netWorth,
  today = null,
}: {
  netWorth: NetWorth;
  today?: Money | null;
}) => {
  const ref = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);

  const segments = useMemo<Segment[]>(() => {
    const raw = [
      ...netWorth.assets.map((entry) => ({ entry, liability: false })),
      ...netWorth.liabilities.map((entry) => ({ entry, liability: true })),
    ]
      .map(({ entry, liability }) => ({
        entry,
        liability,
        magnitude: entry.balance.abs().toNumber(),
      }))
      .filter((item) => item.magnitude > 0)
      .sort((a, b) => b.magnitude - a.magnitude);

    const total = raw.reduce((sum, item) => sum + item.magnitude, 0) || 1;
    let assetIndex = 0;
    return raw.map((item) => ({
      id: item.entry.account.id,
      name: item.entry.account.name,
      institutionId: item.entry.account.institutionId,
      balance: item.entry.balance,
      magnitude: item.magnitude,
      liability: item.liability,
      color: item.liability
        ? 'var(--negative)'
        : assetPalette[assetIndex++ % assetPalette.length]!,
      weight: item.magnitude / total,
    }));
  }, [netWorth]);

  const size = 220;
  const stroke = 24;
  const radius = (size - stroke) / 2;
  const center = size / 2;

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

  let cursor = 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg
            ref={ref}
            viewBox={`0 0 ${size} ${size}`}
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
                <p className="text-xl font-extrabold tabular-nums text-[var(--text-strong)]">
                  {formatEur(current.balance)}
                </p>
                <p
                  className="text-xs font-semibold tabular-nums"
                  style={{
                    color: current.liability
                      ? 'var(--negative)'
                      : 'var(--positive)',
                  }}
                >
                  {percent.format(current.weight)}
                </p>
              </>
            ) : (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  Net worth
                </p>
                <p className="text-[26px] font-extrabold leading-tight tabular-nums text-[var(--text-strong)]">
                  {formatEur(netWorth.net)}
                </p>
                {today !== null && (
                  <p
                    className="text-xs font-semibold tabular-nums"
                    style={{
                      color: isNegative(today)
                        ? 'var(--negative)'
                        : 'var(--positive)',
                    }}
                  >
                    {isNegative(today) ? '▼' : '▲'} {formatEur(today)} today
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex w-full min-w-0 flex-1 flex-col gap-1.5">
          {segments.map((segment, index) => (
            <Link
              key={segment.id}
              to={`/accounts/${segment.id}`}
              onPointerEnter={() => setActive(index)}
              onPointerLeave={() => setActive(null)}
              className="tap flex items-center gap-3 rounded-[var(--radius-field)] px-2 py-1.5 hover:bg-[var(--surface-flat)]"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: segment.color }}
              />
              <InstitutionLogo institutionId={segment.institutionId} size={22} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text-strong)]">
                {segment.name}
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--text-strong)]">
                {formatEur(segment.balance)}
              </span>
              <span
                className="w-12 shrink-0 text-right text-xs font-semibold tabular-nums"
                style={{
                  color: segment.liability
                    ? 'var(--negative)'
                    : 'var(--positive)',
                }}
              >
                {percent.format(segment.weight)}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};
