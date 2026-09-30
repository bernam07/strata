import { useMemo, useRef, useState, type PointerEvent } from 'react';
import { pctMax1 as percent } from '@/ui/format';
import { Link } from 'react-router-dom';
import { formatEur, money, toNumber, type Money } from '@/core/money/money';
import type { NetWorth } from '@/core/networth/netWorth';
import { AmountInline } from '@/ui/Amount';
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
  extra = [],
  net,
}: {
  netWorth: NetWorth;
  extra?: ExtraSegment[];
  net?: Money;
}) => {
  const ref = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [groupMode, setGroupMode] = useState<'account' | 'institution'>('account');
  const [showAll, setShowAll] = useState(false);

  const hasGroupedInstitutions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of netWorth.assets) {
      if (entry.balance.abs().toNumber() <= 0) continue;
      counts.set(
        entry.account.institutionId,
        (counts.get(entry.account.institutionId) ?? 0) + 1,
      );
    }
    return [...counts.values()].some((count) => count > 1);
  }, [netWorth.assets]);

  const segments = useMemo<Segment[]>(() => {
    const rawAssets =
      groupMode === 'institution' && hasGroupedInstitutions
        ? (() => {
            const byInst = new Map<
              string,
              {
                id: string;
                name: string;
                institutionId: string;
                balance: Money;
                to: string;
                count: number;
              }
            >();
            for (const entry of netWorth.assets) {
              const instId = entry.account.institutionId;
              const existing = byInst.get(instId);
              if (!existing) {
                byInst.set(instId, {
                  id: `inst-${instId}`,
                  name: entry.account.name,
                  institutionId: instId,
                  balance: entry.balance,
                  to: `/accounts/${entry.account.id}`,
                  count: 1,
                });
              } else {
                existing.balance = existing.balance.plus(entry.balance);
                existing.count += 1;
                existing.name = `${getInstitution(instId).displayName} (${existing.count})`;
                existing.to = '/accounts';
              }
            }
            return [...byInst.values()].map((item) => ({
              id: item.id,
              name: item.name,
              institutionId: item.institutionId,
              balance: item.balance,
              to: item.to,
              liability: false,
            }));
          })()
        : netWorth.assets.map((entry) => ({
            id: entry.account.id,
            name: entry.account.name,
            institutionId: entry.account.institutionId,
            balance: entry.balance,
            to: `/accounts/${entry.account.id}`,
            liability: false,
          }));

    const raw = [
      ...rawAssets,
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
    const usedBrandInstitutions = new Set<string>();

    return raw.map((item) => {
      const brand = item.institutionId
        ? getInstitution(item.institutionId).brandColor
        : '';
      const canUseBrand =
        Boolean(brand) &&
        luminance(brand) > 0.16 &&
        !usedBrandInstitutions.has(item.institutionId);

      let color: string;
      if (item.liability) {
        color = 'var(--negative)';
      } else if (canUseBrand) {
        color = brand;
        usedBrandInstitutions.add(item.institutionId);
      } else {
        color = assetPalette[assetIndex % assetPalette.length]!;
        assetIndex += 1;
      }

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
  }, [netWorth, extra, groupMode, hasGroupedInstitutions]);

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
  const visibleSegments =
    showAll || segments.length <= 5 ? segments : segments.slice(0, 5);

  let cursor = 0;

  return (
    <div className="flex flex-col gap-4">
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
                <p className="text-xl font-extrabold text-[var(--text-strong)]">
                  <AmountInline value={toNumber(current.balance)} />
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
                  Holdings
                </p>
                <p className="text-2xl font-extrabold leading-tight tabular-nums text-[var(--text-strong)]">
                  {segments.length}
                </p>
                <p className="text-[11px] font-semibold text-[var(--text-muted)]">
                  {segments.length === 1 ? 'account' : 'accounts'}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex w-full min-w-0 flex-1 flex-col gap-1.5">
          {hasGroupedInstitutions && (
            <div className="mb-1 flex items-center justify-between px-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Breakdown
              </span>
              <div className="inline-flex items-center rounded-full border border-[var(--line)] bg-[var(--surface-sunken)] p-0.5 text-[10px] font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setGroupMode('account');
                    setActive(null);
                  }}
                  className={`tap rounded-full px-2 py-0.5 transition-colors ${
                    groupMode === 'account'
                      ? 'bg-[var(--surface-raised)] text-[var(--text-strong)] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'
                  }`}
                >
                  By bucket
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGroupMode('institution');
                    setActive(null);
                  }}
                  className={`tap rounded-full px-2 py-0.5 transition-colors ${
                    groupMode === 'institution'
                      ? 'bg-[var(--surface-raised)] text-[var(--text-strong)] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'
                  }`}
                >
                  By bank
                </button>
              </div>
            </div>
          )}

          {visibleSegments.map((segment, index) => (
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
              <span className="shrink-0 text-sm font-semibold text-[var(--text-strong)]">
                <AmountInline value={toNumber(segment.balance)} />
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

          {segments.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="tap mt-1 self-start px-2 text-xs font-semibold text-[var(--accent)]"
            >
              {showAll
                ? 'Show top 5'
                : `Show all (${segments.length} accounts)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
