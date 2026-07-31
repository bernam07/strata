import { useMemo } from 'react';
import { deriveBalances } from '@/core/balances/deriveBalances';
import { computeNetWorth, emptyNetWorth } from '@/core/networth/netWorth';
import { useAccounts } from '@/features/accounts/api/useAccounts';
import { useTransactions } from '@/features/transactions/api/useTransactions';
import { AccountBalanceCard } from './AccountBalanceCard';
import { NetWorthSummary } from './NetWorthSummary';

const SectionTitle = ({ children }: { children: string }) => (
  <h2 className="px-0.5 text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
    {children}
  </h2>
);

export const DashboardPage = () => {
  const accountsQuery = useAccounts();
  const transactionsQuery = useTransactions();

  const netWorth = useMemo(() => {
    const accounts = accountsQuery.data ?? [];
    const transactions = transactionsQuery.data ?? [];
    if (accounts.length === 0) return emptyNetWorth();
    return computeNetWorth(accounts, deriveBalances(transactions));
  }, [accountsQuery.data, transactionsQuery.data]);

  const loading = accountsQuery.isLoading || transactionsQuery.isLoading;

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
        <p className="text-sm text-[var(--text-muted)]">Loading…</p>
      ) : (
        <>
          <NetWorthSummary netWorth={netWorth} />

          {netWorth.assets.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionTitle>Assets</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                {netWorth.assets.map((entry) => (
                  <AccountBalanceCard key={entry.account.id} entry={entry} />
                ))}
              </div>
            </section>
          )}

          {netWorth.liabilities.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionTitle>Liabilities</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                {netWorth.liabilities.map((entry) => (
                  <AccountBalanceCard key={entry.account.id} entry={entry} />
                ))}
              </div>
            </section>
          )}

          {netWorth.assets.length === 0 &&
            netWorth.liabilities.length === 0 && (
              <p className="text-sm text-[var(--text-muted)]">
                No accounts yet. Create your first one under Accounts.
              </p>
            )}
        </>
      )}
    </div>
  );
};
