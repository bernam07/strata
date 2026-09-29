import { useMemo, useState } from 'react';
import {
  computePaydayCycle,
  usePaydayCycle,
  type PaydayRuleMode,
} from '@/core/payday/paydayCycle';
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

const shortDateFmt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
});

export const getEdenredMonthStats = (balance: number, now = new Date()) => {
  const cycle = computePaydayCycle(now);
  const perWorkingDay = Math.max(0, balance) / cycle.remainingWorkingDays;
  return {
    totalWorkingDays: cycle.totalWorkingDays,
    remainingWorkingDays: cycle.remainingWorkingDays,
    perWorkingDay,
    cycleStart: cycle.cycleStart,
    cycleEndInclusive: cycle.cycleEndInclusive,
    nextPayday: cycle.nextPayday,
    cycleStartIso: cycle.cycleStartIso,
    nextPaydayIso: cycle.nextPaydayIso,
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
  const { cycle, config, updateConfig, setPickedPaydayDate } = usePaydayCycle();

  const perWorkingDay = Math.max(0, balance) / cycle.remainingWorkingDays;

  const [topUpOpen, setTopUpOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [dailyRate, setDailyRate] = useState(loadDailyRate);
  const [daysCount, setDaysCount] = useState(() =>
    String(cycle.totalWorkingDays),
  );

  const spentInCycle = useMemo(() => {
    let sum = 0;
    for (const tx of transactions) {
      if (tx.kind !== 'expense') continue;
      if (tx.occurredAt.slice(0, 10) < cycle.cycleStartIso) continue;
      sum += Math.abs(Number(tx.amount));
    }
    return sum;
  }, [transactions, cycle.cycleStartIso]);

  const computedTopUp = useMemo(() => {
    const rate = Number(dailyRate.replace(',', '.'));
    const days = Number(daysCount);
    if (!Number.isFinite(rate) || !Number.isFinite(days) || rate <= 0 || days <= 0) {
      return 0;
    }
    return Math.round(rate * days * 100) / 100;
  }, [dailyRate, daysCount]);

  const handleModeSwitch = (mode: PaydayRuleMode) => {
    updateConfig({
      ...config,
      mode,
    });
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
          <button
            type="button"
            onClick={() => setCalendarOpen((v) => !v)}
            className="tap mt-0.5 inline-flex items-center gap-1.5 text-left text-xs text-[var(--text-muted)] hover:text-[var(--text-strong)]"
          >
            <span>
              📅 {shortDateFmt.format(cycle.cycleStart)} –{' '}
              {shortDateFmt.format(cycle.cycleEndInclusive)} · Next{' '}
              <strong className="font-semibold text-[var(--text-strong)]">
                {shortDateFmt.format(cycle.nextPayday)}
              </strong>
            </span>
            <span className="rounded bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
              {calendarOpen ? 'Done' : 'Edit date'}
            </span>
          </button>
        </div>
        <button
          type="button"
          onClick={() => setTopUpOpen((open) => !open)}
          className="tap rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold text-[var(--accent)]"
        >
          {topUpOpen ? 'Close' : '+ Monthly top-up'}
        </button>
      </div>

      {calendarOpen && (
        <div className="page-enter flex flex-col gap-3 rounded-[var(--radius-field)] border border-[var(--line)] bg-[var(--surface-sunken)] p-3.5">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                When did you receive? (Calendar)
              </span>
              <TextInput
                type="date"
                value={cycle.cycleStartIso}
                onChange={(e) => {
                  if (e.target.value) setPickedPaydayDate(e.target.value);
                }}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Next payday (auto or custom)
              </span>
              <TextInput
                type="date"
                value={config.customNextDate ?? cycle.nextPaydayIso}
                onChange={(e) =>
                  updateConfig({
                    ...config,
                    customNextDate: e.target.value || null,
                  })
                }
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Monthly auto-calculation rule
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleModeSwitch('workdays_before_end')}
                className={`tap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  config.mode === 'workdays_before_end'
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)] shadow-[inset_0_0_0_1px_var(--accent)]'
                    : 'neu-flat text-[var(--text-2)]'
                }`}
              >
                {config.workdaysBeforeEnd} workdays before month-end
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch('day_of_month')}
                className={`tap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  config.mode === 'day_of_month'
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)] shadow-[inset_0_0_0_1px_var(--accent)]'
                    : 'neu-flat text-[var(--text-2)]'
                }`}
              >
                Day {config.dayOfMonth} of every month (Fri if weekend)
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div className="flex min-w-0 flex-col gap-0.5 rounded-[var(--radius-field)] neu-flat px-3 py-2">
          <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Per workday
          </span>
          <span className="truncate text-sm font-bold text-[var(--positive)]">
            <AmountInline value={perWorkingDay} />
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
            {cycle.remainingWorkingDays}{' '}
            <span className="text-[10px] font-normal text-[var(--text-muted)]">
              / {cycle.totalWorkingDays}d
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
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Daily allowance (€)
              </span>
              <MoneyInput
                value={dailyRate}
                onChange={setDailyRate}
                placeholder="9.60"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
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
