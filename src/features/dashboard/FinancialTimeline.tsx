import type { Account, Transaction } from '@/core/types';
import { kindMeta } from '@/core/transactions/kinds';
import { isNegative, money, toNumber } from '@/core/money/money';
import { AmountInline } from '@/ui/Amount';
import { SectionTitle } from '@/ui/SectionTitle';
import type { InstrumentMeta } from '@/features/positions/api/usePositions';

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
});

export const FinancialTimeline = ({
  transactions,
  accounts,
  instruments,
}: {
  transactions: Transaction[];
  accounts: Account[];
  instruments?: Map<string, InstrumentMeta>;
}) => {
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const visible = transactions.slice(0, 8);

  if (visible.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 lg:col-span-2">
      <SectionTitle action={{ to: '/transactions', label: 'All activity' }}>
        Timeline
      </SectionTitle>
      <ol className="relative ml-2 border-l border-[var(--line)] pl-5">
        {visible.map((transaction) => {
          const amount = money(transaction.amount);
          const instrument = transaction.instrumentId
            ? instruments?.get(transaction.instrumentId)
            : undefined;
          const account = accountsById.get(transaction.accountId);
          const title = instrument?.name ?? instrument?.ticker ?? transaction.note ?? kindMeta[transaction.kind].label;
          const tone = isNegative(amount) ? 'var(--negative)' : 'var(--positive)';

          return (
            <li key={transaction.id} className="relative flex items-center justify-between gap-4 border-b border-[var(--line)] py-3 last:border-b-0">
              <span className="absolute -left-[25px] h-2.5 w-2.5 rounded-full border-2 border-[var(--bg)] bg-[var(--accent)]" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--text-strong)]">
                  {title}
                </p>
                <p className="truncate text-xs text-[var(--text-muted)]">
                  {kindMeta[transaction.kind].label} · {account?.name ?? 'Account'} ·{' '}
                  {dateFormatter.format(new Date(transaction.occurredAt))}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums" style={{ color: tone }}>
                <AmountInline value={toNumber(amount)} signed />
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
};