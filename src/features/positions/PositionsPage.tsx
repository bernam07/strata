import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { isNegative, money, sum, toNumber, zero } from '@/core/money/money';
import { weightBy } from '@/core/analytics/series';
import { Button } from '@/ui/Button';
import { PageHeader } from '@/ui/PageHeader';
import { AmountInline } from '@/ui/Amount';
import { PageHero } from '@/ui/PageHero';
import { Stat } from '@/ui/Stat';
import { SectionTitle } from '@/ui/SectionTitle';
import { Card } from '@/ui/Card';
import { Collapsible } from '@/ui/Collapsible';
import { SkeletonRows } from '@/ui/Skeleton';
import { pct1 as percent } from '@/ui/format';
import { usePositions } from './api/usePositions';
import { useBrokerAccounts } from '@/features/accounts/api/useBrokerAccounts';
import { useRefreshPrices } from '@/features/search/api/useMarket';
import { RebalancePanel } from './RebalancePanel';
import { PositionRow } from './components/PositionRow';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { TextInput } from '@/ui/Field';

const AnalyticsView = lazy(() =>
  import('@/features/analytics/AnalyticsView').then((module) => ({
    default: module.AnalyticsView,
  })),
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
  const [sort, setSort] = useState<'value' | 'gain' | 'name'>('value');
  const [metricMode, setMetricMode] = useState<'all' | 'today'>('all');
  const [search, setSearch] = useState('');
  const { data, isLoading } = usePositions();
  const { data: brokers } = useBrokerAccounts();
  const refresh = useRefreshPrices();

  const positions = data?.positions ?? [];
  const totalMarket = sum(
    positions.map((position) => position.marketValue ?? position.costBasis),
  );
  const totalCost = sum(positions.map((position) => position.costBasis));
  const totalGain = totalMarket.minus(totalCost);
  const gainNegative = isNegative(totalGain);
  const totalDayChange = sum(
    positions.map((position) => position.dayChange ?? zero()),
  );
  const dayNegative = isNegative(totalDayChange);
  const totalMarketNumber = totalMarket.toNumber();
  const totalCostNumber = totalCost.toNumber();
  const totalGainPct =
    totalCostNumber > 0 ? totalGain.toNumber() / totalCostNumber : null;
  const prevMarketNumber = totalMarketNumber - totalDayChange.toNumber();
  const totalDayPct =
    prevMarketNumber > 0 ? totalDayChange.toNumber() / prevMarketNumber : null;

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

  const freeCash = money(brokers?.get('t212')?.free ?? 0);
  const hasCash = freeCash.greaterThan(0);
  const totalWithCash = totalMarket.plus(freeCash);

  const query = search.trim().toLowerCase();
  const sortedPositions = positions
    .filter((position) => {
      if (!query) return true;
      const meta = data?.instruments.get(position.instrumentId);
      return [meta?.name, meta?.ticker, meta?.sector]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(query));
    })
    .sort((a, b) => {
      if (sort === 'name') {
        const nameA = data?.instruments.get(a.instrumentId)?.name ?? '';
        const nameB = data?.instruments.get(b.instrumentId)?.name ?? '';
        return nameA.localeCompare(nameB);
      }
      if (sort === 'gain') {
        if (metricMode === 'today') {
          return (
            (b.dayChange?.toNumber() ?? -Infinity) -
            (a.dayChange?.toNumber() ?? -Infinity)
          );
        }
        return (b.unrealized?.toNumber() ?? 0) - (a.unrealized?.toNumber() ?? 0);
      }
      return money(b.marketValue ?? b.costBasis)
        .minus(a.marketValue ?? a.costBasis)
        .toNumber();
    });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Portfolio"
        subtitle="Your holdings, performance and allocation."
        actions={
          positions.length > 0 && (
            <Button
              size="sm"
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

      {refresh.isSuccess && (refresh.data?.stale ?? 0) > 0 && (
        <p className="text-sm text-[var(--text-muted)]">
          {refresh.data!.stale} holding
          {refresh.data!.stale === 1 ? '' : 's'} kept last-known prices — the
          account total holds its last synced value.{' '}
          <Link to="/integrations" className="font-semibold text-[var(--accent)]">
            Sync Trading 212
          </Link>{' '}
          for exact figures.
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
          <PageHero
            label="Portfolio value"
            value={toNumber(totalWithCash)}
            sub={
              hasCash ? (
                <>
                  <AmountInline value={toNumber(totalMarket)} /> holdings ·{' '}
                  <AmountInline value={toNumber(freeCash)} /> cash
                </>
              ) : undefined
            }
          >
            <div className="grid grid-cols-2 gap-3">
              <Stat
                label="Cost basis"
                value={<AmountInline value={toNumber(totalCost)} />}
              />
              {metricMode === 'today' ? (
                <Stat
                  label="Today's change"
                  value={<AmountInline value={toNumber(totalDayChange)} signed />}
                  hint={
                    totalDayPct !== null && !totalDayChange.equals(zero())
                      ? `${dayNegative ? '−' : '+'}${percent.format(Math.abs(totalDayPct))}`
                      : undefined
                  }
                  tone={
                    totalDayChange.equals(zero())
                      ? 'default'
                      : dayNegative
                        ? 'negative'
                        : 'positive'
                  }
                />
              ) : (
                <Stat
                  label="Unrealized gain"
                  value={<AmountInline value={toNumber(totalGain)} signed />}
                  hint={
                    totalGainPct !== null && !totalGain.equals(zero())
                      ? `${gainNegative ? '−' : '+'}${percent.format(Math.abs(totalGainPct))} return`
                      : undefined
                  }
                  tone={
                    totalGain.equals(zero())
                      ? 'default'
                      : gainNegative
                        ? 'negative'
                        : 'positive'
                  }
                />
              )}
            </div>
          </PageHero>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionTitle note={`${positions.length} held`}>Stocks</SectionTitle>
              <div className="flex flex-wrap items-center gap-2">
                <SegmentedControl
                  value={metricMode}
                  onChange={setMetricMode}
                  label="Return period"
                  segments={[
                    { value: 'all', label: 'All-time' },
                    { value: 'today', label: 'Today' },
                  ]}
                />
                <SegmentedControl
                  value={sort}
                  onChange={setSort}
                  label="Sort positions"
                  segments={[
                    { value: 'value', label: 'Value' },
                    { value: 'gain', label: 'Gain' },
                    { value: 'name', label: 'Name' },
                  ]}
                />
              </div>
            </div>
            {positions.length > 5 && (
              <TextInput
                value={search}
                placeholder="Filter holdings by name, ticker or sector…"
                onChange={(event) => setSearch(event.target.value)}
              />
            )}
            {sortedPositions.map((position) => (
              <PositionRow
                key={position.instrumentId}
                position={position}
                instrument={data?.instruments.get(position.instrumentId)}
                weight={totalMarketNumber > 0 ? toNumber(position.marketValue ?? position.costBasis) / totalMarketNumber : undefined}
                metricMode={metricMode}
              />
            ))}
            {sortedPositions.length === 0 && query && (
              <p className="py-4 text-center text-xs text-[var(--text-muted)]">
                No holdings match &ldquo;{search}&rdquo;.
              </p>
            )}
          </div>

          {allocation.length > 1 && (
            <Collapsible title="Allocation">
              <Bars rows={allocation} />
            </Collapsible>
          )}

          {hasSectors && (
            <Collapsible title="Sectors">
              <Bars
                rows={sectorSlices.map((slice) => ({
                  key: slice.group,
                  label: slice.group,
                  weight: slice.weight,
                }))}
              />
            </Collapsible>
          )}

          <Collapsible title="Performance">
            <Suspense
              fallback={
                <p className="text-sm text-[var(--text-muted)]">Loading…</p>
              }
            >
              <AnalyticsView />
            </Suspense>
          </Collapsible>

          {allocation.length > 1 && (
            <Collapsible title="Rebalancing">
              <RebalancePanel
                positions={positions.map((position) => ({
                  instrumentId: position.instrumentId,
                  value: (position.marketValue ?? position.costBasis).toNumber(),
                }))}
                instruments={data?.instruments ?? new Map()}
                total={totalMarketNumber}
              />
            </Collapsible>
          )}
        </>
      )}
    </div>
  );
};
