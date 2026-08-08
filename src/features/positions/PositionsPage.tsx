import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatEur, isNegative, money, sum, zero } from '@/core/money/money';
import { weightBy } from '@/core/analytics/series';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { SkeletonRows } from '@/ui/Skeleton';
import { usePositions } from './api/usePositions';
import { useRefreshPrices } from '@/features/search/api/useMarket';
import { RebalancePanel } from './RebalancePanel';
import { PositionRow } from './components/PositionRow';

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

export const PositionsPage = () => {
  const { data, isLoading } = usePositions();
  const refresh = useRefreshPrices();
  const [showPerformance, setShowPerformance] = useState(false);

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
    .map((entry) => ({
      ...entry,
      weight: totalMarketNumber > 0 ? entry.value / totalMarketNumber : 0,
    }));

  const sectorSlices = weightBy(
    positions,
    (position) => data?.instruments.get(position.instrumentId)?.sector ?? 'Other',
    (position) => (position.marketValue ?? position.costBasis).toNumber(),
  );
  const hasSectors = sectorSlices.some((slice) => slice.group !== 'Other');

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
          Portfolio
        </h1>
        {positions.length > 0 && (
          <Button
            variant="ghost"
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
          >
            {refresh.isPending ? 'Refreshing…' : 'Refresh prices'}
          </Button>
        )}
      </div>

      {refresh.isError && (
        <p className="text-sm text-[var(--negative)]">
          Couldn't refresh prices. Try again in a moment.
        </p>
      )}

      {isLoading ? (
        <SkeletonRows count={4} />
      ) : positions.length === 0 ? (
        <Card className="flex flex-col items-start gap-4">
          <p className="text-sm text-[var(--text-muted)]">
            No open positions yet. Connect Trading 212 to import your holdings.
          </p>
          <Link to="/integrations">
            <Button>Go to Integrations</Button>
          </Link>
        </Card>
      ) : (
        <>
          <Card className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Market value
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-[var(--text-strong)]">
                {formatEur(totalMarket)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[var(--text-muted)]">Unrealized gain</p>
              <p
                className="mt-1 text-lg font-semibold tabular-nums"
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
          </Card>

          {allocation.length > 1 && (
            <Card className="flex flex-col gap-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Allocation
              </h2>
              {allocation.map((entry) => {
                const meta = data?.instruments.get(entry.instrumentId);
                return (
                  <div key={entry.instrumentId} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-semibold text-[var(--text-strong)]">
                        {meta?.name ?? meta?.ticker ?? 'Instrument'}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">
                        {percent.format(entry.weight)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full neu-sunken">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${entry.weight * 100}%`,
                          background: 'var(--accent)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </Card>
          )}

          {hasSectors && (
            <Card className="flex flex-col gap-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                By sector
              </h2>
              {sectorSlices.map((slice) => (
                <div key={slice.group} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-semibold text-[var(--text-strong)]">
                      {slice.group}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">
                      {percent.format(slice.weight)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full neu-sunken">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${slice.weight * 100}%`,
                        background: 'var(--accent)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </Card>
          )}

          {allocation.length > 1 && (
            <RebalancePanel
              positions={positions.map((position) => ({
                instrumentId: position.instrumentId,
                value: (position.marketValue ?? position.costBasis).toNumber(),
              }))}
              instruments={data?.instruments ?? new Map()}
              total={totalMarketNumber}
            />
          )}

          <div className="flex flex-col gap-2">
            {positions
              .slice()
              .sort((a, b) =>
                money(b.marketValue ?? b.costBasis)
                  .minus(a.marketValue ?? a.costBasis)
                  .toNumber(),
              )
              .map((position) => (
                <PositionRow
                  key={position.instrumentId}
                  position={position}
                  instrument={data?.instruments.get(position.instrumentId)}
                />
              ))}
          </div>

          <Card className="flex flex-col gap-4">
            <button
              type="button"
              onClick={() => setShowPerformance((open) => !open)}
              aria-expanded={showPerformance}
              className="tap flex items-center justify-between gap-3"
            >
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Performance & analytics
              </span>
              <span
                className="text-[var(--text-muted)] transition-transform"
                style={{ transform: showPerformance ? 'rotate(90deg)' : 'none' }}
              >
                ›
              </span>
            </button>
            {showPerformance && (
              <Suspense
                fallback={
                  <p className="text-sm text-[var(--text-muted)]">Loading…</p>
                }
              >
                <AnalyticsView />
              </Suspense>
            )}
          </Card>
        </>
      )}
    </div>
  );
};
