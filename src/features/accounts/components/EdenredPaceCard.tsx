import { useMemo, useState } from 'react';
import type { Account, Transaction } from '@/core/types';
import { useCreateTransaction } from '@/features/transactions/api/useTransactions';
import { AmountInline } from '@/ui/Amount';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { MoneyInput, TextInput } from '@/ui/Field';
import { toast } from '@/ui/toast';

const DAILY_RATE_KEY = 'strata-edenred-daily-rate';

const loadDailyRate = (): string => {
  try {
    return localStorage.getItem(DAILY_RATE_KEY) || '9.60';
  } catch {
    return '9.60';
  }
};

export const countWorkingDays = (year: number, month: number, fromDay = 1): number => {
  const lastDay = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let d = fromDay; d <= lastDay; d += 1) {
    const dow = new Date(year, month, d).getDay();
    if (dow !== 0 && dow !== 6) count += 1;
  }
  return count;
};

export const getEdenredMonthStats = (balance: number, now = new Date()) => {
  const year = now.getFullYear();
  const month = now.getMonth();
  const totalWorkingDays = countWorkingDays(year, month, 1);
  const remainingWorkingDays = Math.max(
    1,
    countWorkingDays(year, month, now.getDate()),
  );
  const perWorkingDay = Math.max(0, balance) / remainingWorkingDays;
  return {
    totalWorkingDays,
    remainingWorkingDays,
    perWorkingDay,
  };
};

export const EdenredPaceCard = ({
  account,
  balance,
  transactions,
}: {
  account: Account;
  balance: number;
  transactions: readonly Transaction[];
}) => {
  const createTx = useCreateTransaction();
  const now = new Date();
  const stats = useMemo(() => getEdenredMonthStats(balance), [balance]);

  const [topUpOpen, setTopUpOpen] = useState(false);
  const [dailyRate, setDailyRate] = useState(loadDailyRate);
  const [daysCount, setDaysCount] = useState(() =>
    String(stats.totalWorkingDays),
  );

  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    '0',
  )}`;
  const spentThisMonth = useMemo(() => {
    let sum = 0;
    for (const tx of transactions) {
      if (tx.kind !== 'expense') continue;
      if (!tx.occurredAt.startsWith(monthKey)) continue;
      sum += Math.abs(Number(tx.amount));
    }
    return sum;
  }, [transactions, monthKey]);

  const computedTopUp = useMemo(() => {
    const rate = Number(dailyRate.replace(',', '.'));
    const days = Number(daysCount);
    if (!Number.isFinite(rate) || !Number.isFinite(days) || rate <= 0 || days <= 0) {
      return 0;
    }
    return Math.round(rate * days * 100) / 100;
  }, [dailyRate, daysCount]);

  const handleTopUp = () => {
    if (computedTopUp <= 0) return;
    try {
      localStorage.setItem(DAILY_RATE_KEY, dailyRate);
    } catch {
      // ignore storage errors
    }
    createTx.mutate(
      {
        accountId: account.id,
        kind: 'income',
        amount: computedTopUp.toFixed(4),
        occurredAt: new Date().toISOString(),
        note: `Subsídio de Refeição (${daysCount}d × €${dailyRate})`,
      },
      {
        onSuccess: () => {
          setTopUpOpen(false);
          toast('Subsídio de refeição creditado', 'success');
        },
        onError: () => toast('Erro ao creditar subsídio', 'error'),
      },
    );
  };

  return (
    <Card className="flex min-w-0 flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            Edenred Smart Pace
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            Daily meal allowance budget for the remaining working days.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setTopUpOpen((open) => !open)}
          className="tap rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold text-[var(--accent)]"
        >
          {topUpOpen ? 'Close' : '+ Monthly top-up'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="flex min-w-0 flex-col gap-0.5 rounded-[var(--radius-field)] neu-flat px-3 py-2">
          <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Per workday
          </span>
          <span className="truncate text-sm font-bold text-[var(--positive)]">
            <AmountInline value={stats.perWorkingDay} />
            <span className="text-[10px] font-normal text-[var(--text-muted)]">
              /d
            </span>
          </span>
        </div>

        <div className="flex min-w-0 flex-col gap-0.5 rounded-[var(--radius-field)] neu-flat px-3 py-2">
          <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Workdays left
          </span>
          <span className="truncate text-sm font-bold tabular-nums text-[var(--text-strong)]">
            {stats.remainingWorkingDays}{' '}
            <span className="text-[10px] font-normal text-[var(--text-muted)]">
              / {stats.totalWorkingDays}d
            </span>
          </span>
        </div>

        <div className="flex min-w-0 flex-col gap-0.5 rounded-[var(--radius-field)] neu-flat px-3 py-2">
          <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Spent this mo
          </span>
          <span className="truncate text-sm font-bold text-[var(--negative)]">
            <AmountInline value={spentThisMonth} />
          </span>
        </div>
      </div>

      {topUpOpen && (
        <div className="page-enter flex flex-col gap-3 rounded-[var(--radius-field)] border border-[var(--line)] bg-[var(--surface-sunken)] p-3.5">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Daily allowance (€)
              </span>
              <MoneyInput
                value={dailyRate}
                onChange={setDailyRate}
                placeholder="9.60"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Working days
              </span>
              <TextInput
                type="number"
                min={1}
                max={31}
                value={daysCount}
                onChange={(e) => setDaysCount(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-[var(--text-muted)]">
              Total:{' '}
              <strong className="font-bold text-[var(--positive)]">
                +<AmountInline value={computedTopUp} />
              </strong>
            </span>
            <Button
              onClick={handleTopUp}
              disabled={createTx.isPending || computedTopUp <= 0}
            >
              {createTx.isPending ? 'Crediting…' : 'Credit allowance'}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};
