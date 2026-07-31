import { useMemo } from 'react';
import type { Account, Transaction } from '@/core/types';
import { kindMeta } from '@/core/transactions/kinds';
import { formatEur, isNegative, money } from '@/core/money/money';
import { InstitutionLogo } from '@/features/accounts/components/InstitutionLogo';

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export const TransactionList = ({
  transactions,
  accounts,
}: {
  transactions: Transaction[];
  accounts: Account[];
}) => {
  const accountsById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );

  if (transactions.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-[var(--text-muted)]">
        No transactions for this filter.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {transactions.map((transaction) => {
        const account = accountsById.get(transaction.accountId);
        const amount = money(transaction.amount);
        const negative = isNegative(amount);
        return (
          <li
            key={transaction.id}
            className="flex items-center gap-4 rounded-[var(--radius-neu-sm)] px-3 py-3 neu-flat"
          >
            {account && (
              <InstitutionLogo
                institutionId={account.institutionId}
                size={36}
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--text-strong)]">
                {transaction.note || kindMeta[transaction.kind].label}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {kindMeta[transaction.kind].label}
                {account ? ` · ${account.name}` : ''} ·{' '}
                {dateFormatter.format(new Date(transaction.occurredAt))}
              </p>
            </div>
            <span
              className="text-sm font-semibold tabular-nums"
              style={{
                color: negative ? 'var(--negative)' : 'var(--positive)',
              }}
            >
              {formatEur(amount)}
            </span>
          </li>
        );
      })}
    </ul>
  );
};
