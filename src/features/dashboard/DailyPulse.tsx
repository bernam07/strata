import type { Transaction } from '@/core/types';
import { money, sum, toNumber } from '@/core/money/money';
import { kindMeta } from '@/core/transactions/kinds';
import { AmountInline } from '@/ui/Amount';

const todayKey = () => new Date().toISOString().slice(0, 10);

export const DailyPulse = ({
  transactions,
  todayPl,
}: {
  transactions: Transaction[];
  todayPl: number | null;
}) => {
  const today = todayKey();
  const todayTransactions = transactions.filter((transaction) =>
    transaction.occurredAt.startsWith(today),
  );
  const latestKind = todayTransactions[0]?.kind;
  const cashflow = sum(todayTransactions.map((transaction) => money(transaction.amount)));

  if (todayTransactions.length === 0 && todayPl === null) return null;

  return (
    <section className="border-y border-[var(--line)] py-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          Today
        </h2>
        <span className="text-xs text-[var(--text-muted)]">
          {todayTransactions.length} {todayTransactions.length === 1 ? 'movement' : 'movements'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
            Market move
          </p>
          <p
            className="mt-1 truncate text-lg font-bold tabular-nums"
            style={{
              color:
                todayPl === null || todayPl === 0
                  ? 'var(--text-strong)'
                  : todayPl > 0
                    ? 'var(--positive)'
                    : 'var(--negative)',
            }}
          >
            {todayPl === null ? '—' : <AmountInline value={todayPl} signed />}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
            Ledger flow
          </p>
          <p className="mt-1 truncate text-lg font-bold tabular-nums text-[var(--text-strong)]">
            <AmountInline value={toNumber(cashflow)} signed />
          </p>
        </div>
        <p className="col-span-2 self-end text-xs text-[var(--text-muted)] sm:col-span-1 sm:text-right">
          {todayTransactions.length > 0
            ? `Last: ${latestKind ? kindMeta[latestKind].label.toLowerCase() : 'movement'}`
            : 'No ledger movement today'}
        </p>
      </div>
    </section>
  );
};