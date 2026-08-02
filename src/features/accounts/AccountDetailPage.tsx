import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Transaction } from '@/core/types';
import { balanceOf, deriveBalances } from '@/core/balances/deriveBalances';
import { formatEur, isNegative } from '@/core/money/money';
import { useAccounts } from './api/useAccounts';
import { getInstitution } from './institutions';
import { InstitutionLogo } from './components/InstitutionLogo';
import {
  useReverseTransaction,
  useTransactions,
} from '@/features/transactions/api/useTransactions';
import { TransactionList } from '@/features/transactions/components/TransactionList';
import { Card } from '@/ui/Card';
import { SkeletonRows } from '@/ui/Skeleton';

const typeLabel: Record<string, string> = {
  cash: 'Cash',
  investment: 'Investment',
  liability: 'Liability',
};

export const AccountDetailPage = () => {
  const { id = '' } = useParams();
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts();
  const { data: transactions = [], isLoading } = useTransactions({
    accountId: id,
  });
  const reverse = useReverseTransaction();

  const account = accounts.find((entry) => entry.id === id);
  const balance = useMemo(
    () => balanceOf(deriveBalances(transactions), id),
    [transactions, id],
  );

  const onReverse = (transaction: Transaction) => {
    if (
      window.confirm(
        'Reverse this entry? A matching adjustment will be added — the original stays in the ledger.',
      )
    ) {
      reverse.mutate(transaction);
    }
  };

  if (!accountsLoading && !account) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[var(--text-muted)]">Account not found.</p>
        <Link to="/accounts" className="text-sm font-semibold text-[var(--accent)]">
          ← Back to accounts
        </Link>
      </div>
    );
  }

  const negative = isNegative(balance);

  return (
    <div className="flex flex-col gap-8">
      <Link
        to="/accounts"
        className="tap text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-strong)]"
      >
        ← Accounts
      </Link>

      <Card className="flex items-center gap-4">
        {account && (
          <InstitutionLogo institutionId={account.institutionId} size={52} />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold text-[var(--text-strong)]">
            {account?.name ?? '…'}
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            {account
              ? `${getInstitution(account.institutionId).displayName} · ${typeLabel[account.type]}`
              : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
            Balance
          </p>
          <p
            className="text-2xl font-bold tabular-nums"
            style={{ color: negative ? 'var(--negative)' : 'var(--text-strong)' }}
          >
            {formatEur(balance)}
          </p>
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="px-0.5 text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          History
        </h2>
        {isLoading ? (
          <SkeletonRows count={4} />
        ) : (
          <TransactionList
            transactions={transactions}
            accounts={account ? [account] : []}
            showAccount={false}
            onReverse={onReverse}
          />
        )}
      </div>
    </div>
  );
};
