import { useMemo } from 'react';
import { deriveBalances } from '@/core/balances/deriveBalances';
import { computeNetWorth, emptyNetWorth } from '@/core/networth/netWorth';
import { useAccounts } from '@/features/accounts/api/useAccounts';
import { useTransactions } from '@/features/transactions/api/useTransactions';
import { AccountBalanceCard } from './AccountBalanceCard';
import { NetWorthSummary } from './NetWorthSummary';

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
      <h1 className="text-2xl font-bold text-[var(--text-strong)]">Resumo</h1>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">A carregar…</p>
      ) : (
        <>
          <NetWorthSummary netWorth={netWorth} />

          {netWorth.assets.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Ativos
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {netWorth.assets.map((entry) => (
                  <AccountBalanceCard key={entry.account.id} entry={entry} />
                ))}
              </div>
            </section>
          )}

          {netWorth.liabilities.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Passivos
              </h2>
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
                Ainda não tens contas. Cria a primeira no separador Contas.
              </p>
            )}
        </>
      )}
    </div>
  );
};
