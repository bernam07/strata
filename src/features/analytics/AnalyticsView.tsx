import { useMemo, useState } from 'react';
import { eur0 as eur, pct1 as percent } from '@/ui/format';
import {
  externalCashFlows,
  geographyFromIsin,
  investedAtCostSeries,
  sliceFrom,
  valuationPoints,
  weightBy,
  yearlyBreakdown,
} from '@/core/analytics/series';
import { timeWeightedReturn } from '@/core/analytics/twr';
import { xirr } from '@/core/analytics/xirr';
import { deriveBalances } from '@/core/balances/deriveBalances';
import { useTransactions } from '@/features/transactions/api/useTransactions';
import { usePositions } from '@/features/positions/api/usePositions';
import { useAccounts } from '@/features/accounts/api/useAccounts';
import {
  applyBrokerBalances,
  useBrokerAccounts,
} from '@/features/accounts/api/useBrokerAccounts';
import {
  useBackfillHistory,
  useInvestmentsHistory,
} from '@/features/dashboard/api/useNetWorthHistory';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Skeleton } from '@/ui/Skeleton';
import { Stat } from '@/ui/Stat';
import { toast } from '@/ui/toast';
import { Link } from 'react-router-dom';
import { StockAvatar } from '@/features/positions/components/StockAvatar';
import { NetWorthChart } from './NetWorthChart';
import { BenchmarkCard } from './BenchmarkCard';
import { DiversificationBars } from './DiversificationBars';
import { CardTitle } from '@/ui/Heading';

interface Mover {
  instrumentId: string;
  ticker: string;
  isin: string | null;
  name: string;
  pct: number;
}

const MoverRow = ({ mover }: { mover: Mover }) => (
  <Link
    to={`/positions/${mover.instrumentId}`}
    className="tap flex items-center gap-3"
  >
    <StockAvatar ticker={mover.ticker} isin={mover.isin} size={28} />
    <span className="flex-1 truncate text-sm font-semibold text-[var(--text-strong)]">
      {mover.name}
    </span>
    <span
      className="text-sm font-semibold tabular-nums"
      style={{ color: mover.pct >= 0 ? 'var(--positive)' : 'var(--negative)' }}
    >
      {mover.pct >= 0 ? '+' : ''}
      {(mover.pct * 100).toFixed(1)}%
    </span>
  </Link>
);

const periods = [
  { key: '1M', days: 30 },
  { key: '3M', days: 91 },
  { key: '1Y', days: 365 },
  { key: 'All', days: null },
] as const;

const sanePercent = (
  value: number | null,
  formatter: Intl.NumberFormat,
): string =>
  value === null || value < -0.95 || value > 5 ? '—' : formatter.format(value);

export const AnalyticsView = () => {
  const transactionsQuery = useTransactions();
  const positionsQuery = usePositions();
  const accountsQuery = useAccounts();
  const brokersQuery = useBrokerAccounts();
  const { data: investmentsHistory = [] } = useInvestmentsHistory();
  const backfill = useBackfillHistory();
  const [period, setPeriod] = useState<(typeof periods)[number]['key']>('All');

  const reconstruct = () =>
    backfill.mutate(undefined, {
      onSuccess: (data) =>
        toast(
          data?.inserted
            ? `Reconstructed ${data.inserted} day${data.inserted === 1 ? '' : 's'} of history`
            : 'History is already up to date',
          'success',
        ),
      onError: () => toast("Couldn't reconstruct history", 'error'),
    });

  const model = useMemo(() => {
    const transactions = transactionsQuery.data ?? [];
    const positions = positionsQuery.data?.positions ?? [];
    const instruments = positionsQuery.data?.instruments;
    const accounts = accountsQuery.data ?? [];
    const brokers = brokersQuery.data ?? new Map();

    const balances = applyBrokerBalances(
      deriveBalances(transactions),
      accounts,
      brokers,
    );
    let netWorthMarket = 0;
    for (const balance of balances.values()) {
      netWorthMarket += balance.toNumber();
    }

    let investedMarket = 0;
    for (const position of positions) {
      investedMarket += (position.marketValue ?? position.costBasis).toNumber();
    }

    const twr = timeWeightedReturn(valuationPoints(transactions));
    const irr = xirr(
      externalCashFlows(transactions, netWorthMarket, new Date()),
    );

    const series = investedAtCostSeries(transactions);
    const years = yearlyBreakdown(transactions);

    const geography = weightBy(
      positions,
      (position) =>
        geographyFromIsin(instruments?.get(position.instrumentId)?.isin ?? null),
      (position) => (position.marketValue ?? position.costBasis).toNumber(),
    );
    const currency = weightBy(
      positions,
      (position) => instruments?.get(position.instrumentId)?.currency ?? 'EUR',
      (position) => (position.marketValue ?? position.costBasis).toNumber(),
    );

    const movers = positions
      .filter((position) => position.unrealizedPct !== null)
      .map((position) => {
        const meta = instruments?.get(position.instrumentId);
        return {
          instrumentId: position.instrumentId,
          ticker: meta?.ticker ?? position.instrumentId,
          isin: meta?.isin ?? null,
          name: meta?.name ?? meta?.ticker ?? position.instrumentId,
          pct: position.unrealizedPct as number,
        };
      })
      .sort((a, b) => b.pct - a.pct);
    const gainers = movers.filter((m) => m.pct > 0).slice(0, 3);
    const losers = movers
      .filter((m) => m.pct < 0)
      .slice(-3)
      .reverse();

    return {
      netWorthMarket,
      investedMarket,
      twr,
      irr,
      series,
      years,
      geography,
      currency,
      gainers,
      losers,
    };
  }, [transactionsQuery.data, positionsQuery.data, accountsQuery.data, brokersQuery.data]);

  const usingSnapshots = investmentsHistory.length >= 2;
  const baseSeries = usingSnapshots ? investmentsHistory : model.series;
  const activePeriod = periods.find((entry) => entry.key === period)!;
  const shownSeries = activePeriod.days
    ? sliceFrom(
        baseSeries,
        new Date(Date.now() - activePeriod.days * 86_400_000),
      )
    : baseSeries;

  const loading = transactionsQuery.isLoading || positionsQuery.isLoading;

  return (
    <div className="flex flex-col gap-8">
      {loading ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-20 rounded-[var(--radius-card)]" />
            <Skeleton className="h-20 rounded-[var(--radius-card)]" />
            <Skeleton className="h-20 rounded-[var(--radius-card)]" />
          </div>
          <Skeleton className="h-72 rounded-[var(--radius-card)]" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Invested value"
              value={eur.format(model.investedMarket)}
              hint="Market value of holdings"
            />
            <Stat
              label="TWR"
              value={sanePercent(model.twr, percent)}
              hint="Time-weighted return"
            />
            <Stat
              label="XIRR"
              value={sanePercent(model.irr, percent)}
              hint="Money-weighted, annualized"
            />
          </div>

          <Card className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <CardTitle>
                Investments over time
              </CardTitle>
              <SegmentedControl
                value={period}
                onChange={setPeriod}
                segments={periods.map((entry) => ({
                  value: entry.key,
                  label: entry.key,
                }))}
                label="Chart period"
              />
            </div>
            <NetWorthChart series={shownSeries} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[var(--text-muted)]">
                {usingSnapshots
                  ? 'Market value of your holdings, from your daily snapshots.'
                  : 'Reconstructed at acquisition cost from your ledger. Market value fills in as daily snapshots accumulate.'}
              </p>
              <Button
                variant="ghost"
                onClick={reconstruct}
                disabled={backfill.isPending}
              >
                {backfill.isPending ? 'Reconstructing…' : 'Reconstruct history'}
              </Button>
            </div>
          </Card>

          <BenchmarkCard />

          {(model.gainers.length > 0 || model.losers.length > 0) && (
            <Card className="grid gap-8 sm:grid-cols-2">
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Top gainers
                </h3>
                {model.gainers.length > 0 ? (
                  model.gainers.map((mover) => (
                    <MoverRow key={mover.instrumentId} mover={mover} />
                  ))
                ) : (
                  <p className="text-sm text-[var(--text-muted)]">None.</p>
                )}
              </div>
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Top losers
                </h3>
                {model.losers.length > 0 ? (
                  model.losers.map((mover) => (
                    <MoverRow key={mover.instrumentId} mover={mover} />
                  ))
                ) : (
                  <p className="text-sm text-[var(--text-muted)]">None.</p>
                )}
              </div>
            </Card>
          )}

          <Card className="grid gap-8 sm:grid-cols-2">
            <DiversificationBars title="Geography (ISIN)" slices={model.geography} />
            <DiversificationBars title="Currency" slices={model.currency} />
          </Card>

          {model.years.length > 0 && (
            <Card className="flex flex-col gap-4">
              <CardTitle>
                By calendar year
              </CardTitle>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-[0.12em] text-[var(--text-muted)]">
                      <th className="pb-2 pr-4">Year</th>
                      <th className="pb-2 pr-4 text-right">Inflows</th>
                      <th className="pb-2 pr-4 text-right">Dividends</th>
                      <th className="pb-2 pr-4 text-right">Expenses</th>
                      <th className="pb-2 text-right">Net change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {model.years.map((row) => (
                      <tr key={row.year} className="border-t border-[var(--text-muted)]/10">
                        <td className="py-2 pr-4 font-semibold text-[var(--text-strong)]">
                          {row.year}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums">
                          {eur.format(row.deposits)}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums text-[var(--positive)]">
                          {eur.format(row.dividends)}
                        </td>
                        <td className="py-2 pr-4 text-right tabular-nums text-[var(--negative)]">
                          {eur.format(row.expenses)}
                        </td>
                        <td className="py-2 text-right tabular-nums text-[var(--text-strong)]">
                          {eur.format(row.netChange)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
