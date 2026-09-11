import { useEffect, useMemo } from 'react';
import { deriveBalances } from '@/core/balances/deriveBalances';
import { computeNetWorth, emptyNetWorth } from '@/core/networth/netWorth';
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
import { SectionTitle } from '@/ui/SectionTitle';
import { AlertBanner } from '@/features/alerts/Alerts';
import { Onboarding } from '@/features/onboarding/Onboarding';
import { NetWorthDonut } from './NetWorthDonut';
import { GoalCard } from './GoalCard';
import { InsightsStrip } from './InsightsStrip';
import { MonthlySummary } from './MonthlySummary';
import { Movers } from './Movers';
import { useNetWorthHistory, useRecordNetWorth } from './api/useNetWorthHistory';

export const DashboardPage = () => {
  const accountsQuery = useAccounts();
  const transactionsQuery = useTransactions();
  const brokersQuery = useBrokerAccounts();
  const { data: instruments } = useInstruments();
  const positionsQuery = usePositions();
  const { data: crypto = [] } = useCrypto();
  const { data: snapshots = [] } = useNetWorthHistory();
  const recordNetWorth = useRecordNetWorth();

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
        ? [{ id: 'crypto', name: 'Crypto', value: cryptoTotal, to: '/crypto' }]
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

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
            <section className="relative overflow-hidden rounded-[var(--radius-card)] neu-raised p-6 lg:col-span-2">
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

            <MonthlySummary snapshots={snapshots} className="lg:col-span-2" />

            <GoalCard net={netWithCrypto} />

            <InsightsStrip
              cash={Math.max(0, toNumber(model.netWorth.totalAssets) - toNumber(investments))}
              investments={toNumber(investments) + cryptoTotal}
            />

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
          </div>
        </>
      )}
    </div>
  );
};
