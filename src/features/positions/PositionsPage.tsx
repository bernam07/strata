import { lazy, Suspense, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatEur, isNegative, money, sum, zero } from '@/core/money/money';
import { weightBy } from '@/core/analytics/series';
import { Button } from '@/ui/Button';
import { PageHeader } from '@/ui/PageHeader';
import { Card } from '@/ui/Card';
import { SkeletonRows } from '@/ui/Skeleton';
import { usePositions } from './api/usePositions';
import { useRefreshPrices } from '@/features/search/api/useMarket';
import { RebalancePanel } from './RebalancePanel';
import { PositionRow } from './components/PositionRow';
import { CryptoManager } from '@/features/crypto/CryptoManager';
import { useCrypto } from '@/features/crypto/api/useCrypto';

const AnalyticsView = lazy(() =>
  import('@/features/analytics/AnalyticsView').then((module) => ({
    default: module.AnalyticsView,
  })),
);

const percent = new Intl.NumberFormat('en-GB', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const Section = ({
  title,
  badge,
  open,
  onToggle,
  children,
}: {
  title: string;
  badge?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) => (
  <Card className="flex flex-col gap-4">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="tap flex items-center justify-between gap-3"
    >
      <span className="flex items-baseline gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          {title}
        </span>
        {badge != null && (
          <span className="text-sm font-semibold tabular-nums text-[var(--text-2)]">
            {badge}
          </span>
        )}
      </span>
      <span
        className="text-[var(--text-muted)] transition-transform"
        style={{ transform: open ? 'rotate(90deg)' : 'none' }}
      >
        ›
      </span>
    </button>
    {open && <div className="flex flex-col gap-4">{children}</div>}
  </Card>
);

const Bars = ({
  rows,
}: {
  rows: { key: string; label: string; weight: number }[];
}) => (
  <>
    {rows.map((row) => (
      <div key={row.key} className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-sm font-semibold text-[var(--text-strong)]">
            {row.label}
          </span>
          <span className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">
            {percent.format(row.weight)}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full neu-sunken">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(row.weight * 100, 100)}%`,
              background: 'var(--accent)',
            }}
          />
        </div>
      </div>
    ))}
  </>
);

export const PositionsPage = () => {
  const { data, isLoading } = usePositions();
  const { data: crypto = [] } = useCrypto();
  const refresh = useRefreshPrices();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (key: string) =>
    setOpen((current) => ({ ...current, [key]: !current[key] }));

  const positions = data?.positions ?? [];
  const totalMarket = sum(
    positions.map((position) => position.marketValue ?? position.costBasis),
  );
  const totalCost = sum(positions.map((position) => position.costBasis));
  const totalGain = totalMarket.minus(totalCost);
  const gainNegative = isNegative(totalGain);
  const totalMarketNumber = totalMarket.toNumber();

  const allocation = positions
    .map((position) => ({
      instrumentId: position.instrumentId,
      value: (position.marketValue ?? position.costBasis).toNumber(),
    }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
    .map((entry) => {
      const meta = data?.instruments.get(entry.instrumentId);
      return {
        key: entry.instrumentId,
        label: meta?.name ?? meta?.ticker ?? 'Instrument',
        weight: totalMarketNumber > 0 ? entry.value / totalMarketNumber : 0,
      };
    });

  const sectorSlices = weightBy(
    positions,
    (position) => data?.instruments.get(position.instrumentId)?.sector ?? 'Other',
    (position) => (position.marketValue ?? position.costBasis).toNumber(),
  );
  const hasSectors = sectorSlices.some((slice) => slice.group !== 'Other');

  const cryptoTotal = crypto.reduce((total, item) => total + item.valueEur, 0);
  const cryptoBadge =
    cryptoTotal > 0 ? formatEur(money(cryptoTotal)) : undefined;

  const sortedPositions = positions
    .slice()
    .sort((a, b) =>
      money(b.marketValue ?? b.costBasis)
        .minus(a.marketValue ?? a.costBasis)
        .toNumber(),
    );

  const cryptoSection = (
    <Section
      title="Crypto"
      badge={cryptoBadge}
      open={!!open.crypto}
      onToggle={() => toggle('crypto')}
    >
      <CryptoManager />
    </Section>
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Portfolio"
        subtitle="Your holdings, performance and allocation."
        actions={
          positions.length > 0 && (
            <Button
              variant="ghost"
              onClick={() => refresh.mutate()}
              disabled={refresh.isPending}
            >
              {refresh.isPending ? 'Refreshing…' : 'Refresh prices'}
            </Button>
          )
        }
      />

      {refresh.isError && (
        <p className="text-sm text-[var(--negative)]">
          Couldn't refresh prices. Try again in a moment.
        </p>
      )}

      {isLoading ? (
        <SkeletonRows count={4} />
      ) : positions.length === 0 ? (
        <>
          <Card className="flex flex-col items-start gap-4">
            <p className="text-sm text-[var(--text-muted)]">
              No open positions yet. Connect Trading 212 to import your holdings.
            </p>
            <Link to="/integrations">
              <Button>Go to Integrations</Button>
            </Link>
          </Card>
          {cryptoSection}
        </>
      ) : (
        <>
          <Section
            title="Market value"
            badge={formatEur(totalMarket)}
            open={!!open.market}
            onToggle={() => toggle('market')}
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                  Market value
                </p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-[var(--text-strong)]">
                  {formatEur(totalMarket)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[var(--text-muted)]">Cost basis</p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-[var(--text-2)]">
                  {formatEur(totalCost)}
                </p>
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  Unrealized gain
                </p>
                <p
                  className="text-lg font-semibold tabular-nums"
                  style={{
                    color: totalGain.equals(zero())
                      ? 'var(--text-muted)'
                      : gainNegative
                        ? 'var(--negative)'
                        : 'var(--positive)',
                  }}
                >
                  {formatEur(totalGain)}
                </p>
              </div>
            </div>
          </Section>

          <Section
            title="Stocks"
            badge={String(positions.length)}
            open={!!open.stocks}
            onToggle={() => toggle('stocks')}
          >
            <div className="flex flex-col gap-2">
              {sortedPositions.map((position) => (
                <PositionRow
                  key={position.instrumentId}
                  position={position}
                  instrument={data?.instruments.get(position.instrumentId)}
                />
              ))}
            </div>
          </Section>

          {allocation.length > 1 && (
            <Section
              title="Allocation"
              open={!!open.allocation}
              onToggle={() => toggle('allocation')}
            >
              <Bars rows={allocation} />
            </Section>
          )}

          {hasSectors && (
            <Section
              title="Sectors"
              open={!!open.sectors}
              onToggle={() => toggle('sectors')}
            >
              <Bars
                rows={sectorSlices.map((slice) => ({
                  key: slice.group,
                  label: slice.group,
                  weight: slice.weight,
                }))}
              />
            </Section>
          )}

          <Section
            title="Performance"
            open={!!open.performance}
            onToggle={() => toggle('performance')}
          >
            <Suspense
              fallback={
                <p className="text-sm text-[var(--text-muted)]">Loading…</p>
              }
            >
              <AnalyticsView />
            </Suspense>
          </Section>

          {allocation.length > 1 && (
            <Section
              title="Rebalancing"
              open={!!open.rebalancing}
              onToggle={() => toggle('rebalancing')}
            >
              <RebalancePanel
                positions={positions.map((position) => ({
                  instrumentId: position.instrumentId,
                  value: (position.marketValue ?? position.costBasis).toNumber(),
                }))}
                instruments={data?.instruments ?? new Map()}
                total={totalMarketNumber}
              />
            </Section>
          )}

          {cryptoSection}
        </>
      )}
    </div>
  );
};
