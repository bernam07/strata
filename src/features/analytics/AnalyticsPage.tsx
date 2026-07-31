import { useMemo, useState } from 'react';
import {
  externalCashFlows,
  geographyFromIsin,
  netWorthAtCostSeries,
  sliceFrom,
  valuationPoints,
  weightBy,
  yearlyBreakdown,
} from '@/core/analytics/series';
import { timeWeightedReturn } from '@/core/analytics/twr';
import { xirr } from '@/core/analytics/xirr';
import { useTransactions } from '@/features/transactions/api/useTransactions';
import { usePositions } from '@/features/positions/api/usePositions';
import { Card } from '@/ui/Card';
import { Surface } from '@/ui/Surface';
import { NetWorthChart } from './NetWorthChart';
import { DiversificationBars } from './DiversificationBars';

const eur = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const percent = new Intl.NumberFormat('en-GB', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const periods = [
  { key: '1M', days: 30 },
  { key: '3M', days: 91 },
  { key: '1Y', days: 365 },
  { key: 'All', days: null },
] as const;

const StatTile = ({ label, value }: { label: string; value: string }) => (
  <Surface elevation="sunken" className="flex flex-col gap-1 p-5">
    <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
      {label}
    </span>
    <span className="text-2xl font-bold tabular-nums text-[var(--text-strong)]">
      {value}
    </span>
  </Surface>
);

export const AnalyticsPage = () => {
  const transactionsQuery = useTransactions();
  const positionsQuery = usePositions();
  const [period, setPeriod] = useState<(typeof periods)[number]['key']>('All');

  const model = useMemo(() => {
    const transactions = transactionsQuery.data ?? [];
    const positions = positionsQuery.data?.positions ?? [];
    const instruments = positionsQuery.data?.instruments;

    const cashTotal = transactions.reduce(
      (total, transaction) => total + Number(transaction.amount),
      0,
    );
    const positionsValue = positions.reduce(
      (total, position) =>
        total + (position.marketValue ?? position.costBasis).toNumber(),
      0,
    );
    const netWorthMarket = cashTotal + positionsValue;

    const twr = timeWeightedReturn(valuationPoints(transactions));
    const irr = xirr(
      externalCashFlows(transactions, netWorthMarket, new Date()),
    );

    const series = netWorthAtCostSeries(transactions);
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

    return { netWorthMarket, twr, irr, series, years, geography, currency };
  }, [transactionsQuery.data, positionsQuery.data]);

  const activePeriod = periods.find((entry) => entry.key === period)!;
  const shownSeries = activePeriod.days
    ? sliceFrom(
        model.series,
        new Date(Date.now() - activePeriod.days * 86_400_000),
      )
    : model.series;

  const loading = transactionsQuery.isLoading || positionsQuery.isLoading;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
        Analytics
      </h1>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Loading…</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile
              label="Net worth"
              value={eur.format(model.netWorthMarket)}
            />
            <StatTile
              label="TWR"
              value={percent.format(model.twr)}
            />
            <StatTile
              label="XIRR"
              value={model.irr === null ? '—' : percent.format(model.irr)}
            />
          </div>

          <Card className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-[var(--text-strong)]">
                Net worth over time
              </h2>
              <div className="flex gap-1 rounded-[var(--radius-neu-sm)] neu-sunken p-1">
                {periods.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => setPeriod(entry.key)}
                    className={`rounded-[var(--radius-neu-sm)] px-3 py-1 text-xs font-semibold ${
                      period === entry.key
                        ? 'neu-flat text-[var(--accent)]'
                        : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {entry.key}
                  </button>
                ))}
              </div>
            </div>
            <NetWorthChart series={shownSeries} />
            <p className="text-xs text-[var(--text-muted)]">
              Series at acquisition cost. Historical market value fills in as
              daily snapshots accumulate.
            </p>
          </Card>

          <Card className="grid gap-8 sm:grid-cols-2">
            <DiversificationBars title="Geography (ISIN)" slices={model.geography} />
            <DiversificationBars title="Currency" slices={model.currency} />
          </Card>

          {model.years.length > 0 && (
            <Card className="flex flex-col gap-4">
              <h2 className="font-semibold text-[var(--text-strong)]">
                By calendar year
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
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
