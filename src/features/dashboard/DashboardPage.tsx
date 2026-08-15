import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { deriveBalances } from '@/core/balances/deriveBalances';
import { computeNetWorth, emptyNetWorth } from '@/core/networth/netWorth';
import { netWorthAtCostSeries, sliceFrom } from '@/core/analytics/series';
import { money, sum, toNumber, zero, type Money } from '@/core/money/money';
import { useAccounts } from '@/features/accounts/api/useAccounts';
import {
  applyBrokerBalances,
  useBrokerAccounts,
} from '@/features/accounts/api/useBrokerAccounts';
import { useTransactions } from '@/features/transactions/api/useTransactions';
import { useInstruments, usePositions } from '@/features/positions/api/usePositions';
import { useCrypto } from '@/features/crypto/api/useCrypto';
import { TransactionList } from '@/features/transactions/components/TransactionList';
import { Skeleton } from '@/ui/Skeleton';
import { PageHeader } from '@/ui/PageHeader';
import { usePersistentState } from '@/app/usePersistentState';
import { AlertBanner } from '@/features/alerts/Alerts';
import { Onboarding } from '@/features/onboarding/Onboarding';
import { NetWorthDonut } from './NetWorthDonut';
import { NetWorthTrend } from './NetWorthTrend';
import { GoalCard } from './GoalCard';
import { MonthlySummary } from './MonthlySummary';
import { Movers } from './Movers';
import {
  useBackfillHistory,
  useNetWorthHistory,
  useRecordNetWorth,
} from './api/useNetWorthHistory';

type Period = '1M' | '6M' | '1Y' | 'All';

const periods: Period[] = ['1M', '6M', '1Y', 'All'];

const periodStart = (period: Period): Date | null => {
  if (period === 'All') return null;
  const now = new Date();
  const months = period === '1M' ? 1 : period === '6M' ? 6 : 12;
  return new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
};

const PeriodToggle = ({
  value,
  onChange,
}: {
  value: Period;
  onChange: (period: Period) => void;
}) => (
  <div className="flex gap-1 rounded-[var(--radius-field)] neu-sunken p-1">
    {periods.map((period) => (
      <button
        key={period}
        type="button"
        onClick={() => onChange(period)}
        className={`tap rounded-[var(--radius-field)] px-2.5 py-1 text-xs font-semibold ${
          value === period
            ? 'neu-flat text-[var(--accent)]'
            : 'text-[var(--text-muted)]'
        }`}
      >
        {period}
      </button>
    ))}
  </div>
);

const SectionTitle = ({
  children,
  action,
}: {
  children: string;
  action?: { to: string; label: string };
}) => (
  <div className="flex items-baseline justify-between px-0.5">
    <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
      {children}
    </h2>
    {action && (
      <Link
        to={action.to}
        className="tap text-xs font-semibold text-[var(--accent)]"
      >
        {action.label} →
      </Link>
    )}
  </div>
);

export const DashboardPage = () => {
  const accountsQuery = useAccounts();
  const transactionsQuery = useTransactions();
  const brokersQuery = useBrokerAccounts();
  const { data: instruments } = useInstruments();
  const positionsQuery = usePositions();
  const { data: crypto = [] } = useCrypto();
  const { data: snapshots = [] } = useNetWorthHistory();
  const recordNetWorth = useRecordNetWorth();
  const backfill = useBackfillHistory();
  const [period, setPeriod] = usePersistentState<Period>('dashboard-period', '1Y');

  const model = useMemo(() => {
    const accounts = accountsQuery.data ?? [];
    const transactions = transactionsQuery.data ?? [];
    const brokers = brokersQuery.data ?? new Map();
    const balances = applyBrokerBalances(
      deriveBalances(transactions),
      accounts,
      brokers,
    );
    const netWorth =
      accounts.length === 0
        ? emptyNetWorth()
        : computeNetWorth(accounts, balances);
    const assets = [...netWorth.assets].sort((a, b) =>
      b.balance.comparedTo(a.balance),
    );
    const liabilities = [...netWorth.liabilities].sort((a, b) =>
      a.balance.comparedTo(b.balance),
    );
    return {
      netWorth,
      assets,
      liabilities,
      series: netWorthAtCostSeries(transactions),
      recent: transactions.slice(0, 5),
    };
  }, [accountsQuery.data, transactionsQuery.data, brokersQuery.data]);

  const loading = accountsQuery.isLoading || transactionsQuery.isLoading;
  const accounts = accountsQuery.data ?? [];
  const empty = !loading && accounts.length === 0 && crypto.length === 0;
  const positions = positionsQuery.data?.positions ?? [];
  const positionInstruments = positionsQuery.data?.instruments ?? new Map();
  const rankablePositions = positions.filter(
    (position) => position.unrealizedPct !== null,
  ).length;

  const cryptoTotal = crypto.reduce((total, item) => total + item.valueEur, 0);
  const cryptoDay = crypto.reduce((total, item) => total + item.dayChangeEur, 0);
  const netWithCrypto = model.netWorth.net.plus(money(cryptoTotal));
  const cryptoExtra = useMemo(
    () =>
      cryptoTotal > 0
        ? [{ id: 'crypto', name: 'Crypto', value: cryptoTotal, to: '/positions' }]
        : [],
    [cryptoTotal],
  );

  const investments = useMemo(() => {
    const brokers = brokersQuery.data ?? new Map();
    let total = zero();
    for (const snapshot of brokers.values()) total = total.plus(money(snapshot.total));
    return total;
  }, [brokersQuery.data]);

  const dataReady =
    !loading &&
    !brokersQuery.isLoading &&
    accounts.length > 0 &&
    !positionsQuery.isLoading;

  useEffect(() => {
    if (!dataReady) return;
    recordNetWorth.mutate({
      net: toNumber(netWithCrypto),
      assets: toNumber(model.netWorth.totalAssets) + cryptoTotal,
      liabilities: toNumber(model.netWorth.totalLiabilities),
      investments: toNumber(investments) + cryptoTotal,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataReady, netWithCrypto.toString()]);

  const baseSeries = snapshots.length >= 2 ? snapshots : model.series;
  const usingSnapshots = snapshots.length >= 2;

  const displayedSeries = useMemo(() => {
    const start = periodStart(period);
    const sliced = start ? sliceFrom(baseSeries, start) : baseSeries;
    return sliced.length >= 2 ? sliced : baseSeries;
  }, [baseSeries, period]);

  const todayPl = useMemo<Money | null>(() => {
    const changes = positions
      .map((position) => position.dayChange)
      .filter((change): change is Money => change !== null);
    if (changes.length === 0 && cryptoDay === 0) return null;
    return sum(changes).plus(money(cryptoDay));
  }, [positions, cryptoDay]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Overview"
        subtitle="Everything you own and owe, in one cross-section."
      />

      {loading ? (
        <div className="flex flex-col gap-8">
          <Skeleton className="h-52 w-full rounded-[var(--radius-card)]" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-20 rounded-[var(--radius-card)]" />
            <Skeleton className="h-20 rounded-[var(--radius-card)]" />
          </div>
        </div>
      ) : empty ? (
        <Onboarding />
      ) : (
        <>
          <Onboarding />
          <AlertBanner />

          <section className="relative overflow-hidden rounded-[var(--radius-card)] neu-raised p-6">
            <div
              className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full opacity-60 blur-3xl"
              style={{
                background:
                  'radial-gradient(circle, var(--accent-soft), transparent 70%)',
              }}
            />
            <div className="relative">
              <NetWorthDonut
                netWorth={model.netWorth}
                today={todayPl}
                extra={cryptoExtra}
                net={netWithCrypto}
              />
            </div>
          </section>

          <NetWorthTrend
            series={displayedSeries}
            basisLabel={usingSnapshots ? 'market value' : 'at cost'}
            control={<PeriodToggle value={period} onChange={setPeriod} />}
            footer={
              positions.length > 0 && snapshots.length < 60 ? (
                <div className="flex items-center justify-end gap-3 border-t border-[var(--line)] pt-3">
                  {backfill.isError && (
                    <span className="text-xs text-[var(--negative)]">
                      Couldn't reconstruct.
                    </span>
                  )}
                  {backfill.data?.inserted !== undefined && !backfill.isError && (
                    <span className="text-xs text-[var(--text-muted)]">
                      Added {backfill.data.inserted} days.
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => backfill.mutate()}
                    disabled={backfill.isPending}
                    className="tap text-xs font-semibold text-[var(--accent)] disabled:opacity-60"
                  >
                    {backfill.isPending
                      ? 'Reconstructing…'
                      : 'Reconstruct earlier history'}
                  </button>
                </div>
              ) : null
            }
          />

          <GoalCard net={netWithCrypto} />

          <MonthlySummary snapshots={snapshots} />

          {rankablePositions >= 2 && (
            <section className="flex flex-col gap-3">
              <SectionTitle action={{ to: '/positions', label: 'All positions' }}>
                Movers
              </SectionTitle>
              <Movers positions={positions} instruments={positionInstruments} />
            </section>
          )}

          {model.recent.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionTitle action={{ to: '/transactions', label: 'View all' }}>
                Recent activity
              </SectionTitle>
              <TransactionList
                transactions={model.recent}
                accounts={accounts}
                instruments={instruments}
              />
            </section>
          )}
        </>
      )}
    </div>
  );
};
