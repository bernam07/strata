import { useEffect, useMemo, useState } from 'react';
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
import { TransactionList } from '@/features/transactions/components/TransactionList';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Skeleton } from '@/ui/Skeleton';
import { AccountBalanceCard } from './AccountBalanceCard';
import { NetWorthSummary } from './NetWorthSummary';
import { Movers } from './Movers';
import {
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
  const { data: snapshots = [] } = useNetWorthHistory();
  const recordNetWorth = useRecordNetWorth();
  const [period, setPeriod] = useState<Period>('1Y');

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
  const empty = !loading && accounts.length === 0;
  const positions = positionsQuery.data?.positions ?? [];
  const positionInstruments = positionsQuery.data?.instruments ?? new Map();
  const rankablePositions = positions.filter(
    (position) => position.unrealizedPct !== null,
  ).length;

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
      net: toNumber(model.netWorth.net),
      assets: toNumber(model.netWorth.totalAssets),
      liabilities: toNumber(model.netWorth.totalLiabilities),
      investments: toNumber(investments),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataReady, model.netWorth.net.toString()]);

  const baseSeries = snapshots.length >= 2 ? snapshots : model.series;
  const usingSnapshots = snapshots.length >= 2;

  const displayedSeries = useMemo(() => {
    const start = periodStart(period);
    return start ? sliceFrom(baseSeries, start) : baseSeries;
  }, [baseSeries, period]);

  const todayPl = useMemo<Money | null>(() => {
    const changes = positions
      .map((position) => position.dayChange)
      .filter((change): change is Money => change !== null);
    return changes.length > 0 ? sum(changes) : null;
  }, [positions]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
          Overview
        </h1>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">
          Everything you own and owe, in one cross-section.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col gap-8">
          <Skeleton className="h-52 w-full rounded-[var(--radius-card)]" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-20 rounded-[var(--radius-card)]" />
            <Skeleton className="h-20 rounded-[var(--radius-card)]" />
          </div>
        </div>
      ) : empty ? (
        <Card className="flex flex-col items-start gap-4">
          <div>
            <p className="font-semibold text-[var(--text-strong)]">
              Start your first layer
            </p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Add an account, then record a transaction to see your net worth
              build up.
            </p>
          </div>
          <Link to="/accounts">
            <Button>Add an account</Button>
          </Link>
        </Card>
      ) : (
        <>
          <NetWorthSummary
            netWorth={model.netWorth}
            series={displayedSeries}
            today={todayPl}
            basisLabel={usingSnapshots ? 'market value' : 'at cost'}
            control={<PeriodToggle value={period} onChange={setPeriod} />}
          />

          {rankablePositions >= 2 && (
            <section className="flex flex-col gap-3">
              <SectionTitle action={{ to: '/positions', label: 'All positions' }}>
                Movers
              </SectionTitle>
              <Movers positions={positions} instruments={positionInstruments} />
            </section>
          )}

          {model.assets.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionTitle>Assets</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                {model.assets.map((entry) => (
                  <AccountBalanceCard key={entry.account.id} entry={entry} />
                ))}
              </div>
            </section>
          )}

          {model.liabilities.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionTitle>Liabilities</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                {model.liabilities.map((entry) => (
                  <AccountBalanceCard key={entry.account.id} entry={entry} />
                ))}
              </div>
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
