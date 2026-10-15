import { lazy, Suspense, useMemo, useState } from 'react';
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
import { CardTitle } from '@/ui/Heading';
import { PortfolioNav } from '@/ui/HubNav';
import { SkeletonRows } from '@/ui/Skeleton';
import { Surface } from '@/ui/Surface';
import { pct1 as percent, qty8 as cryptoQtyFormat } from '@/ui/format';
import { usePositions } from './api/usePositions';
import { useBrokerAccounts } from '@/features/accounts/api/useBrokerAccounts';
import { useCrypto, type CryptoHolding } from '@/features/crypto/api/useCrypto';
import { CoinIcon } from '@/features/crypto/CoinIcon';
import { useRefreshPrices } from '@/features/search/api/useMarket';
import { RebalancePanel } from './RebalancePanel';
import { PositionRow } from './components/PositionRow';
import { PortfolioDonut } from './components/PortfolioDonut';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { TextInput } from '@/ui/Field';

const AnalyticsView = lazy(() =>
  import('@/features/analytics/AnalyticsView').then((module) => ({
    default: module.AnalyticsView,
  })),
);

type PortfolioView = 'holdings' | 'analytics' | 'allocation';
type AssetClassFilter = 'all' | 'stocks' | 'crypto';

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

const CryptoHoldingRow = ({
  holding,
  weight,
  metricMode,
}: {
  holding: CryptoHolding;
  weight?: number;
  metricMode: 'all' | 'today';
}) => {
  const activeGain =
    metricMode === 'today' ? holding.dayChangeEur : holding.gainEur;
  const activePct =
    metricMode === 'today' ? holding.dayChangePct : holding.gainPct;
  const hasMetric =
    metricMode === 'today' ? holding.dayChangePct !== null : holding.costEur > 0;
  const color = hasMetric
    ? activeGain < 0
      ? 'var(--negative)'
      : 'var(--positive)'
    : 'var(--text-muted)';

  return (
    <Link to="/crypto">
      <Surface
        elevation="flat"
        className="tap relative flex flex-col gap-2.5 overflow-hidden p-4 hover:border-[var(--accent)]"
      >
        <div className="flex items-center gap-3.5">
          <CoinIcon
            src={holding.imageUrl}
            ticker={holding.symbol}
            size={38}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <p className="truncate font-semibold text-[var(--text-strong)]">
                {holding.name}
              </p>
              <span className="shrink-0 rounded-full bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--text-muted)]">
                Crypto
              </span>
              {weight !== undefined && weight > 0 && (
                <span className="shrink-0 rounded-full bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--text-muted)]">
                  {percent.format(weight)}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
              {cryptoQtyFormat.format(holding.quantity)} {holding.symbol}
              {holding.averagePrice > 0 && (
                <>
                  {' · '}
                  <AmountInline value={holding.averagePrice} /> avg
                </>
              )}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold tabular-nums text-[var(--text-strong)]">
              <AmountInline value={holding.valueEur} />
            </p>
            {hasMetric ? (
              <p
                className="mt-0.5 text-xs font-semibold tabular-nums"
                style={{ color }}
              >
                <AmountInline value={activeGain} signed />
                {activePct !== null && ` · ${percent.format(activePct)}`}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {metricMode === 'today' ? 'No change today' : '—'}
              </p>
            )}
          </div>
        </div>

        {weight !== undefined && weight > 0 && (
          <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.max(2.5, Math.min(100, weight * 100))}%`,
                background: 'var(--accent)',
              }}
            />
          </div>
        )}
      </Surface>
    </Link>
  );
};

export const PositionsPage = () => {
  const [view, setView] = useState<PortfolioView>('holdings');
  const [assetFilter, setAssetFilter] = useState<AssetClassFilter>('all');
  const [sort, setSort] = useState<'value' | 'gain' | 'name'>('value');
  const [metricMode, setMetricMode] = useState<'all' | 'today'>('all');
  const [search, setSearch] = useState('');
  const { data, isLoading } = usePositions();
  const { data: brokers } = useBrokerAccounts();
  const { data: crypto = [] } = useCrypto();
  const refresh = useRefreshPrices();

  const positions = data?.positions ?? [];
  const stocksMarket = sum(
    positions.map((position) => position.marketValue ?? position.costBasis),
  );
  const stocksCost = sum(positions.map((position) => position.costBasis));
  const stocksDayChange = sum(
    positions.map((position) => position.dayChange ?? zero()),
  );

  const cryptoMarketNumber = crypto.reduce(
    (acc, item) => acc + item.valueEur,
    0,
  );
  const cryptoCostNumber = crypto.reduce((acc, item) => acc + item.costEur, 0);
  const cryptoDayNumber = crypto.reduce(
    (acc, item) => acc + item.dayChangeEur,
    0,
  );

  const totalInvestedMarket = stocksMarket.plus(money(cryptoMarketNumber));
  const totalCost = stocksCost.plus(money(cryptoCostNumber));
  const totalGain = totalInvestedMarket.minus(totalCost);
  const gainNegative = isNegative(totalGain);
  const totalDayChange = stocksDayChange.plus(money(cryptoDayNumber));
  const dayNegative = isNegative(totalDayChange);

  const stocksMarketNumber = stocksMarket.toNumber();
  const totalInvestedNumber = totalInvestedMarket.toNumber();
  const totalCostNumber = totalCost.toNumber();
  const totalGainPct =
    totalCostNumber > 0 ? totalGain.toNumber() / totalCostNumber : null;
  const prevMarketNumber = totalInvestedNumber - totalDayChange.toNumber();
  const totalDayPct =
    prevMarketNumber > 0 ? totalDayChange.toNumber() / prevMarketNumber : null;

  const allocation = useMemo(() => {
    const items: { key: string; label: string; value: number }[] = [
      ...positions.map((position) => {
        const meta = data?.instruments.get(position.instrumentId);
        return {
          key: position.instrumentId,
          label: meta?.name ?? meta?.ticker ?? 'Instrument',
          value: (position.marketValue ?? position.costBasis).toNumber(),
        };
      }),
      ...crypto.map((coin) => ({
        key: `crypto-${coin.symbol}`,
        label: `${coin.name} (${coin.symbol})`,
        value: coin.valueEur,
      })),
    ];
    return items
      .filter((entry) => entry.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
      .map((entry) => ({
        key: entry.key,
        label: entry.label,
        weight: totalInvestedNumber > 0 ? entry.value / totalInvestedNumber : 0,
      }));
  }, [positions, data?.instruments, crypto, totalInvestedNumber]);

  const sectorSlices = weightBy(
    positions,
    (position) => data?.instruments.get(position.instrumentId)?.sector ?? 'Other',
    (position) => (position.marketValue ?? position.costBasis).toNumber(),
  );
  const hasSectors = sectorSlices.some((slice) => slice.group !== 'Other');

  const freeCash = money(brokers?.get('t212')?.free ?? 0);
  const freeCashNumber = freeCash.toNumber();
  const hasCash = freeCashNumber > 0;
  const hasCrypto = crypto.length > 0;
  const totalWithCash = totalInvestedMarket.plus(freeCash);
  const totalHoldingsCount = positions.length + crypto.length;

  const query = search.trim().toLowerCase();

  const unifiedRows = useMemo(() => {
    type RowItem =
      | {
          kind: 'stock';
          key: string;
          name: string;
          value: number;
          gain: number;
          position: (typeof positions)[number];
        }
      | {
          kind: 'crypto';
          key: string;
          name: string;
          value: number;
          gain: number;
          holding: CryptoHolding;
        };

    const list: RowItem[] = [];

    if (assetFilter === 'all' || assetFilter === 'stocks') {
      for (const pos of positions) {
        const meta = data?.instruments.get(pos.instrumentId);
        if (query) {
          const matches = [meta?.name, meta?.ticker, meta?.sector]
            .filter(Boolean)
            .some((v) => v!.toLowerCase().includes(query));
          if (!matches) continue;
        }
        const val = (pos.marketValue ?? pos.costBasis).toNumber();
        const gainVal =
          metricMode === 'today'
            ? (pos.dayChange?.toNumber() ?? -Infinity)
            : (pos.unrealized?.toNumber() ?? 0);
        list.push({
          kind: 'stock',
          key: `stock-${pos.instrumentId}`,
          name: meta?.name ?? meta?.ticker ?? '',
          value: val,
          gain: gainVal,
          position: pos,
        });
      }
    }

    if (assetFilter === 'all' || assetFilter === 'crypto') {
      for (const coin of crypto) {
        if (query) {
          const matches = [coin.name, coin.symbol, 'crypto']
            .some((v) => v.toLowerCase().includes(query));
          if (!matches) continue;
        }
        const gainVal =
          metricMode === 'today'
            ? (coin.dayChangePct !== null ? coin.dayChangeEur : -Infinity)
            : coin.gainEur;
        list.push({
          kind: 'crypto',
          key: `crypto-${coin.symbol}`,
          name: coin.name,
          value: coin.valueEur,
          gain: gainVal,
          holding: coin,
        });
      }
    }

    list.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'gain') return b.gain - a.gain;
      return b.value - a.value;
    });

    return list;
  }, [assetFilter, positions, crypto, data?.instruments, query, metricMode, sort]);

  return (
    <div className="flex flex-col gap-6">
      <PortfolioNav />

      <PageHeader
        title="Portfolio"
        subtitle="Your holdings, performance and allocation across stocks, ETFs and crypto."
        actions={
          totalHoldingsCount > 0 && (
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
      ) : totalHoldingsCount === 0 ? (
        <Card className="flex flex-col items-start gap-4">
          <p className="text-sm text-[var(--text-muted)]">
            No open positions yet. Connect Trading 212 or add crypto holdings to start tracking your portfolio.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to="/integrations">
              <Button>Connect Trading 212</Button>
            </Link>
            <Link to="/crypto">
              <Button variant="ghost">Add Crypto</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <PageHero
            label="Portfolio value"
            value={toNumber(totalWithCash)}
            sub={
              hasCash || hasCrypto ? (
                <>
                  {stocksMarketNumber > 0 && (
                    <>
                      <AmountInline value={stocksMarketNumber} /> stocks
                    </>
                  )}
                  {hasCrypto && (
                    <>
                      {stocksMarketNumber > 0 ? ' · ' : ''}
                      <AmountInline value={cryptoMarketNumber} /> crypto
                    </>
                  )}
                  {hasCash && (
                    <>
                      {stocksMarketNumber > 0 || hasCrypto ? ' · ' : ''}
                      <AmountInline value={freeCashNumber} /> cash
                    </>
                  )}
                </>
              ) : undefined
            }
          >
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Stat
                  label="Cost basis"
                  value={<AmountInline value={totalCostNumber} />}
                />
                {metricMode === 'today' ? (
                  <Stat
                    label="Today's change"
                    value={<AmountInline value={toNumber(totalDayChange)} signed />}
                    hint={
                      totalDayPct !== null
                        ? totalDayChange.equals(zero())
                          ? '0.0%'
                          : `${dayNegative ? '−' : '+'}${percent.format(Math.abs(totalDayPct))}`
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

              <PortfolioDonut
                positions={positions}
                instruments={data?.instruments ?? new Map()}
                crypto={crypto}
                freeCash={freeCashNumber}
              />
            </div>
          </PageHero>

          <SegmentedControl
            value={view}
            onChange={setView}
            fill
            size="md"
            label="Portfolio view"
            segments={[
              { value: 'holdings', label: `Holdings (${totalHoldingsCount})` },
              { value: 'analytics', label: 'Analytics' },
              { value: 'allocation', label: 'Allocation & Rebalance' },
            ]}
          />

          {view === 'holdings' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {hasCrypto && positions.length > 0 ? (
                  <SegmentedControl
                    value={assetFilter}
                    onChange={setAssetFilter}
                    label="Filter by asset class"
                    segments={[
                      { value: 'all', label: `All (${totalHoldingsCount})` },
                      {
                        value: 'stocks',
                        label: `Stocks & ETFs (${positions.length})`,
                      },
                      { value: 'crypto', label: `Crypto (${crypto.length})` },
                    ]}
                  />
                ) : (
                  <SectionTitle note={`${totalHoldingsCount} held`}>
                    {hasCrypto ? 'Crypto Holdings' : 'Stocks & ETFs'}
                  </SectionTitle>
                )}

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

              {totalHoldingsCount > 5 && (
                <TextInput
                  value={search}
                  placeholder="Filter holdings by name, ticker, coin or sector…"
                  onChange={(event) => setSearch(event.target.value)}
                />
              )}

              <div className="flex flex-col gap-2">
                {unifiedRows.map((row) =>
                  row.kind === 'stock' ? (
                    <PositionRow
                      key={row.key}
                      position={row.position}
                      instrument={data?.instruments.get(row.position.instrumentId)}
                      weight={
                        totalInvestedNumber > 0
                          ? row.value / totalInvestedNumber
                          : undefined
                      }
                      metricMode={metricMode}
                    />
                  ) : (
                    <CryptoHoldingRow
                      key={row.key}
                      holding={row.holding}
                      weight={
                        totalInvestedNumber > 0
                          ? row.value / totalInvestedNumber
                          : undefined
                      }
                      metricMode={metricMode}
                    />
                  ),
                )}
              </div>

              {unifiedRows.length === 0 && query && (
                <p className="py-4 text-center text-xs text-[var(--text-muted)]">
                  No holdings match &ldquo;{search}&rdquo;.
                </p>
              )}
            </div>
          )}

          {view === 'analytics' && (
            <Suspense
              fallback={
                <p className="text-sm text-[var(--text-muted)]">Loading…</p>
              }
            >
              <AnalyticsView />
            </Suspense>
          )}

          {view === 'allocation' && (
            <div className="flex flex-col gap-6">
              {allocation.length > 0 && (
                <Card className="flex flex-col gap-4">
                  <CardTitle>Top holdings weight</CardTitle>
                  <Bars rows={allocation} />
                </Card>
              )}

              {hasSectors && (
                <Card className="flex flex-col gap-4">
                  <CardTitle>Stock &amp; ETF sectors</CardTitle>
                  <Bars
                    rows={sectorSlices.map((slice) => ({
                      key: slice.group,
                      label: slice.group,
                      weight: slice.weight,
                    }))}
                  />
                </Card>
              )}

              {positions.length > 1 && (
                <Card className="flex flex-col gap-4">
                  <CardTitle>Rebalancing targets (Stocks &amp; ETFs)</CardTitle>
                  <RebalancePanel
                    positions={positions.map((position) => ({
                      instrumentId: position.instrumentId,
                      value: (
                        position.marketValue ?? position.costBasis
                      ).toNumber(),
                    }))}
                    instruments={data?.instruments ?? new Map()}
                    total={stocksMarketNumber}
                  />
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
