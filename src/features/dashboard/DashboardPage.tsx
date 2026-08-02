import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { deriveBalances } from '@/core/balances/deriveBalances';
import { computeNetWorth, emptyNetWorth } from '@/core/networth/netWorth';
import { netWorthAtCostSeries } from '@/core/analytics/series';
import { useAccounts } from '@/features/accounts/api/useAccounts';
import {
  applyBrokerBalances,
  useBrokerAccounts,
} from '@/features/accounts/api/useBrokerAccounts';
import { useTransactions } from '@/features/transactions/api/useTransactions';
import { TransactionList } from '@/features/transactions/components/TransactionList';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Skeleton } from '@/ui/Skeleton';
import { AccountBalanceCard } from './AccountBalanceCard';
import { NetWorthSummary } from './NetWorthSummary';

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
          <NetWorthSummary netWorth={model.netWorth} series={model.series} />

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
              />
            </section>
          )}
        </>
      )}
    </div>
  );
};
