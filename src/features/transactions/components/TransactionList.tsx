import { useMemo } from 'react';
import type { Account, Transaction } from '@/core/types';
import { kindMeta } from '@/core/transactions/kinds';
import { formatEur, isNegative, money } from '@/core/money/money';
import { InstitutionLogo } from '@/features/accounts/components/InstitutionLogo';
import type { InstrumentMeta } from '@/features/positions/api/usePositions';

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const quantityFormatter = new Intl.NumberFormat('en-GB', {
  maximumFractionDigits: 4,
});

export const TransactionList = ({
  transactions,
  accounts,
  instruments,
  showAccount = true,
  onReverse,
  onEdit,
}: {
  transactions: Transaction[];
  accounts: Account[];
  instruments?: Map<string, InstrumentMeta>;
  showAccount?: boolean;
  onReverse?: (transaction: Transaction) => void;
  onEdit?: (transaction: Transaction) => void;
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
        const isManual =
          transaction.source === 'manual' &&
          transaction.transferGroupId === null;
        const canReverse = onReverse && isManual;
        const canEdit = onEdit && isManual;

        const instrument = transaction.instrumentId
          ? instruments?.get(transaction.instrumentId)
          : undefined;
        const label = kindMeta[transaction.kind].label;
        const title = instrument
          ? instrument.name || instrument.ticker
          : transaction.note || label;

        const meta: string[] = [];
        if (instrument && transaction.quantity !== null) {
          meta.push(
            `${label} ${quantityFormatter.format(Math.abs(Number(transaction.quantity)))} sh`,
          );
        } else {
          meta.push(label);
        }
        if (showAccount && account) meta.push(account.name);
        meta.push(dateFormatter.format(new Date(transaction.occurredAt)));

        return (
          <li
            key={transaction.id}
            className="group flex items-center gap-4 rounded-[var(--radius-field)] px-3 py-3 neu-flat"
          >
            {showAccount && account && (
              <InstitutionLogo institutionId={account.institutionId} size={36} />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--text-strong)]">
                {title}
              </p>
              <p className="truncate text-xs text-[var(--text-muted)]">
                {meta.join(' · ')}
              </p>
            </div>
            <span
              className="text-sm font-semibold tabular-nums"
              style={{ color: negative ? 'var(--negative)' : 'var(--positive)' }}
            >
              {formatEur(amount)}
            </span>
            {canEdit && (
              <button
                type="button"
                onClick={() => onEdit(transaction)}
                title="Edit this entry"
                aria-label="Edit this entry"
                className="tap grid h-8 w-8 place-items-center rounded-[var(--radius-field)] text-[var(--text-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--accent)]"
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 20h4L18 10l-4-4L4 16v4z" />
                  <path d="M13.5 6.5l4 4" />
                </svg>
              </button>
            )}
            {canReverse && (
              <button
                type="button"
                onClick={() => onReverse(transaction)}
                title="Reverse this entry"
                aria-label="Reverse this entry"
                className="tap grid h-8 w-8 place-items-center rounded-[var(--radius-field)] text-[var(--text-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--negative)]"
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 14L4 9l5-5" />
                  <path d="M4 9h11a5 5 0 015 5v1" />
                </svg>
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
};
