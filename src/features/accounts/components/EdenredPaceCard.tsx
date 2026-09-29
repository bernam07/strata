import { useMemo, useState } from 'react';
import type { Account, Transaction } from '@/core/types';
import { useCreateTransaction } from '@/features/transactions/api/useTransactions';
import { AmountInline } from '@/ui/Amount';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { MoneyInput, TextInput } from '@/ui/Field';
import { toast } from '@/ui/toast';

const DAILY_RATE_KEY = 'strata-edenred-daily-rate';
const PAYDAY_WORKDAYS_KEY = 'strata-edenred-workdays-before-end';

const loadDailyRate = (): string => {
  try {
    return localStorage.getItem(DAILY_RATE_KEY) || '9.60';
  } catch {
    return '9.60';
  }
};

const loadWorkdaysBeforeEnd = (): number => {
  try {
    const raw = Number(localStorage.getItem(PAYDAY_WORKDAYS_KEY));
    if (Number.isFinite(raw) && raw >= 1 && raw <= 15) return Math.round(raw);
    return 4;
  } catch {
    return 4;
  }
};

// Returns the date corresponding to `workdaysBeforeEnd` working days (Mon–Fri)
// counting backwards from the end of the given month.
// Example: Sep 2026 has 30 days (Wed=1, Tue=2, Mon=3, Fri 25=4) -> 25 Sep 2026.
export const getPaydayForMonth = (
  year: number,
  month: number,
  workdaysBeforeEnd = 4,
): Date => {
  const target = Math.max(1, Math.min(15, Math.round(workdaysBeforeEnd)));
  const lastDay = new Date(year, month + 1, 0).getDate();
  let seen = 0;
  for (let d = lastDay; d >= 1; d -= 1) {
    const date = new Date(year, month, d);
    const dow = date.getDay();
    if (dow !== 0 && dow !== 6) {
      seen += 1;
      if (seen === target) return date;
    }
  }
  return new Date(year, month, 1);
};

export const countWorkingDaysBetween = (startInclusive: Date, endExclusive: Date): number => {
  const cur = new Date(
    startInclusive.getFullYear(),
    startInclusive.getMonth(),
    startInclusive.getDate(),
  );
  const end = new Date(
    endExclusive.getFullYear(),
    endExclusive.getMonth(),
    endExclusive.getDate(),
  );
  let count = 0;
  while (cur < end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

const toIsoDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const shortDateFmt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
});

export const getEdenredMonthStats = (
  balance: number,
  now = new Date(),
  workdaysBeforeEnd = loadWorkdaysBeforeEnd(),
) => {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisMonthPayday = getPaydayForMonth(
    today.getFullYear(),
    today.getMonth(),
    workdaysBeforeEnd,
  );

  let cycleStart: Date;
  let nextPayday: Date;

  if (today >= thisMonthPayday) {
    cycleStart = thisMonthPayday;
    nextPayday = getPaydayForMonth(
      today.getFullYear(),
      today.getMonth() + 1,
      workdaysBeforeEnd,
    );
  } else {
    cycleStart = getPaydayForMonth(
      today.getFullYear(),
      today.getMonth() - 1,
      workdaysBeforeEnd,
    );
    nextPayday = thisMonthPayday;
  }

  const cycleEndInclusive = new Date(
    nextPayday.getFullYear(),
    nextPayday.getMonth(),
    nextPayday.getDate() - 1,
  );

  const totalWorkingDays = Math.max(
    1,
    countWorkingDaysBetween(cycleStart, nextPayday),
  );
  const remainingWorkingDays = Math.max(
    1,
    countWorkingDaysBetween(today, nextPayday),
  );
  const perWorkingDay = Math.max(0, balance) / remainingWorkingDays;

  return {
    totalWorkingDays,
    remainingWorkingDays,
    perWorkingDay,
    cycleStart,
    cycleEndInclusive,
    nextPayday,
    cycleStartIso: toIsoDate(cycleStart),
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
  const [workdaysBeforeEnd, setWorkdaysBeforeEnd] = useState<string>(() =>
    String(loadWorkdaysBeforeEnd()),
  );
  const parsedWorkdaysRule = useMemo(() => {
    const n = Number(workdaysBeforeEnd);
    return Number.isFinite(n) && n >= 1 && n <= 15 ? Math.round(n) : 4;
  }, [workdaysBeforeEnd]);

  const stats = useMemo(
    () => getEdenredMonthStats(balance, new Date(), parsedWorkdaysRule),
    [balance, parsedWorkdaysRule],
  );

  const [topUpOpen, setTopUpOpen] = useState(false);
  const [dailyRate, setDailyRate] = useState(loadDailyRate);
  const [daysCount, setDaysCount] = useState(() =>
    String(stats.totalWorkingDays),
  );

  const spentInCycle = useMemo(() => {
    let sum = 0;
    for (const tx of transactions) {
      if (tx.kind !== 'expense') continue;
      if (tx.occurredAt.slice(0, 10) < stats.cycleStartIso) continue;
      sum += Math.abs(Number(tx.amount));
    }
    return sum;
  }, [transactions, stats.cycleStartIso]);

  const computedTopUp = useMemo(() => {
    const rate = Number(dailyRate.replace(',', '.'));
    const days = Number(daysCount);
    if (!Number.isFinite(rate) || !Number.isFinite(days) || rate <= 0 || days <= 0) {
      return 0;
    }
    return Math.round(rate * days * 100) / 100;
  }, [dailyRate, daysCount]);

  const handleRuleChange = (val: string) => {
    setWorkdaysBeforeEnd(val);
    const n = Number(val);
    if (Number.isFinite(n) && n >= 1 && n <= 15) {
      try {
        localStorage.setItem(PAYDAY_WORKDAYS_KEY, String(Math.round(n)));
      } catch {
        // ignore storage errors
      }
    }
  };

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
            Cycle {shortDateFmt.format(stats.cycleStart)} –{' '}
            {shortDateFmt.format(stats.cycleEndInclusive)} · Next top-up{' '}
            <strong className="font-semibold text-[var(--text-strong)]">
              {shortDateFmt.format(stats.nextPayday)}
            </strong>
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
            Spent in cycle
          </span>
          <span className="truncate text-sm font-bold text-[var(--negative)]">
            <AmountInline value={spentInCycle} />
          </span>
        </div>
      </div>

      {topUpOpen && (
        <div className="page-enter flex flex-col gap-3 rounded-[var(--radius-field)] border border-[var(--line)] bg-[var(--surface-sunken)] p-3.5">
          <div className="grid grid-cols-3 gap-2">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Daily (€)
              </span>
              <MoneyInput
                value={dailyRate}
                onChange={setDailyRate}
                placeholder="9.60"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Workdays
              </span>
              <TextInput
                type="number"
                min={1}
                max={31}
                value={daysCount}
                onChange={(e) => setDaysCount(e.target.value)}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <span
                className="truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]"
                title="Working days before the end of the month when allowance is paid"
              >
                Payday (-wd)
              </span>
              <TextInput
                type="number"
                min={1}
                max={15}
                value={workdaysBeforeEnd}
                onChange={(e) => handleRuleChange(e.target.value)}
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
