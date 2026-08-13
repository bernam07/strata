import { useMemo, useRef, useState, type PointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { formatEur, isNegative, money, type Money } from '@/core/money/money';
import type { NetWorth } from '@/core/networth/netWorth';
import { InstitutionLogo } from '@/features/accounts/components/InstitutionLogo';
import { getInstitution } from '@/features/accounts/institutions';

const luminance = (hex: string): number => {
  const value = hex.replace('#', '');
  if (value.length < 6) return 1;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

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
  to?: string;
  balance: Money;
  magnitude: number;
  liability: boolean;
  color: string;
  weight: number;
}

const TWO_PI = Math.PI * 2;

export interface ExtraSegment {
  id: string;
  name: string;
  value: number;
  to?: string;
}

export const NetWorthDonut = ({
  netWorth,
  today = null,
  extra = [],
  net,
}: {
  netWorth: NetWorth;
  today?: Money | null;
  extra?: ExtraSegment[];
  net?: Money;
}) => {
  const ref = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);

  const segments = useMemo<Segment[]>(() => {
    const raw = [
      ...netWorth.assets.map((entry) => ({
        id: entry.account.id,
        name: entry.account.name,
        institutionId: entry.account.institutionId,
        balance: entry.balance,
        to: `/accounts/${entry.account.id}`,
        liability: false,
      })),
      ...netWorth.liabilities.map((entry) => ({
        id: entry.account.id,
        name: entry.account.name,
        institutionId: entry.account.institutionId,
        balance: entry.balance,
        to: `/accounts/${entry.account.id}`,
        liability: true,
      })),
      ...extra.map((item) => ({
        id: item.id,
        name: item.name,
        institutionId: '',
        balance: money(item.value),
        to: item.to,
        liability: false,
      })),
    ]
      .map((item) => ({ ...item, magnitude: item.balance.abs().toNumber() }))
      .filter((item) => item.magnitude > 0)
      .sort((a, b) => b.magnitude - a.magnitude);

    const total = raw.reduce((sum, item) => sum + item.magnitude, 0) || 1;
    let assetIndex = 0;
    return raw.map((item) => {
      const brand = item.institutionId
        ? getInstitution(item.institutionId).brandColor
        : '';
      const color = item.liability
        ? 'var(--negative)'
        : brand && luminance(brand) > 0.16
          ? brand
          : assetPalette[assetIndex % assetPalette.length]!;
      if (!item.liability) assetIndex += 1;
      return {
        id: item.id,
        name: item.name,
        institutionId: item.institutionId,
        to: item.to,
        balance: item.balance,
        magnitude: item.magnitude,
        liability: item.liability,
        color,
        weight: item.magnitude / total,
      };
    });
  }, [netWorth, extra]);

  const centerNet = net ?? netWorth.net;

  const size = 220;
  const stroke = 22;
  const center = size / 2;
  // Inset so the ring — even the thicker active segment — never touches the
  // viewBox edge and gets clipped.
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

  let cursor = 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="relative mx-auto aspect-square w-full max-w-[220px] shrink-0 sm:mx-0 sm:w-[200px]">
          <svg
            ref={ref}
            viewBox={`0 0 ${size} ${size}`}
            role="img"
            aria-label={`Net worth ${formatEur(centerNet)}, by account`}
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
                  {formatEur(centerNet)}
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
              to={segment.to ?? '/positions'}
              onPointerEnter={() => setActive(index)}
              onPointerLeave={() => setActive(null)}
              className="tap flex items-center gap-3 rounded-[var(--radius-field)] px-2 py-1.5 hover:bg-[var(--surface-flat)]"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: segment.color }}
              />
              {segment.institutionId && (
                <InstitutionLogo institutionId={segment.institutionId} size={22} />
              )}
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
