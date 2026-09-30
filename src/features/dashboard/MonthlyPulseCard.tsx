import { useMemo, useState } from 'react';
import { usePersistentState } from '@/app/usePersistentState';
import type { Transaction } from '@/core/types';
import { monthlyCashflow } from '@/core/analytics/cashflow';
import {
  netWorthChangeForMonth,
  summarizeMonth,
} from '@/core/analytics/monthly';
import type { SeriesPoint } from '@/core/analytics/series';
import { toNumber } from '@/core/money/money';
import { usePaydayCycle, type PaydayRuleMode } from '@/core/payday/paydayCycle';
import { useBudgets } from '@/features/expenses/api/useBudgets';
import {
  computeRecurringMetrics,
  useRecurring,
} from '@/features/transactions/api/useRecurring';
import { AmountInline } from '@/ui/Amount';
import { Card } from '@/ui/Card';
import { TextInput } from '@/ui/Field';
import { pct0 } from '@/ui/format';

const shortDateFmt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
});

const MiniDelta = ({
  current,
  previous,
  show = true,
}: {
  current: number;
  previous: number;
  show?: boolean;
}) => {
  if (!show || (previous === 0 && current === 0)) return null;
  const diff = current - previous;
  if (Math.abs(diff) < 1) {
    return (
      <span className="truncate text-[10px] text-[var(--text-muted)]">
        ≈ last mo
      </span>
    );
  }
  return (
    <span className="truncate text-[10px] tabular-nums text-[var(--text-muted)]">
      <AmountInline value={diff} signed /> vs last mo
    </span>
  );
};

export const MonthlyPulseCard = ({
  transactions,
  liquidCash,
  snapshots = [],
}: {
  transactions: Transaction[];
  liquidCash: number;
  snapshots?: readonly SeriesPoint[];
}) => {
  const [pulseMode, setPulseMode] = usePersistentState<'calendar' | 'paycycle'>(
    'strata-pulse-mode',
    'calendar',
  );
  const [calendarOpen, setCalendarOpen] = useState(false);
  const { cycle, config, updateConfig, setPickedPaydayDate } = usePaydayCycle();
  const { data: budgets = [] } = useBudgets();
  const { data: recurringRules = [] } = useRecurring();

  const stats = useMemo(() => {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;

    const currentSummary = summarizeMonth(transactions, year, month);
    const prevSummary = summarizeMonth(transactions, prevYear, prevMonth);
    const netWorthChange = netWorthChangeForMonth(snapshots, year, month);

    const currentMonthKey = `${now.getFullYear()}-${String(
      now.getMonth() + 1,
    ).padStart(2, '0')}`;
    const rows = monthlyCashflow(transactions);
    const current = rows.find((r) => r.month === currentMonthKey);

    let inflow = current ? toNumber(current.inflow) : currentSummary.income;
    let outflow = current ? toNumber(current.outflow) : currentSummary.expenses;
    let dividends = currentSummary.dividends;

    if (pulseMode === 'paycycle') {
      let cycIn = 0;
      let cycOut = 0;
      let cycDiv = 0;
      for (const tx of transactions) {
        if (tx.transferGroupId) continue;
        const day = tx.occurredAt.slice(0, 10);
        if (day < cycle.cycleStartIso || day > cycle.cycleEndIso) continue;
        const amt = Number(tx.amount);
        if (tx.kind === 'income' || tx.kind === 'interest') {
          cycIn += Math.abs(amt);
        } else if (tx.kind === 'dividend') {
          cycIn += Math.abs(amt);
          cycDiv += Math.abs(amt);
        } else if (tx.kind === 'expense' || tx.kind === 'fee') {
          cycOut += Math.abs(amt);
        }
      }
      inflow = cycIn;
      outflow = cycOut;
      dividends = cycDiv;
    }

    const net = inflow - outflow;
    const savingsRate = inflow > 0 ? net / inflow : null;

    const recentWithSpend = rows
      .filter((r) => toNumber(r.outflow) > 0)
      .slice(0, 3);
    const avgMonthlyOutflow =
      recentWithSpend.length > 0
        ? recentWithSpend.reduce((acc, r) => acc + toNumber(r.outflow), 0) /
          recentWithSpend.length
        : outflow;

    const runwayMonths =
      avgMonthlyOutflow > 0 && liquidCash > 0
        ? liquidCash / avgMonthlyOutflow
        : null;

    const daysInCalendarMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).getDate();
    const elapsedDays =
      pulseMode === 'paycycle'
        ? cycle.elapsedCalendarDays
        : Math.max(1, now.getDate());
    const remainingDays =
      pulseMode === 'paycycle'
        ? Math.max(1, cycle.remainingCalendarDays)
        : Math.max(1, daysInCalendarMonth - now.getDate() + 1);

    const periodEndIso =
      pulseMode === 'paycycle'
        ? cycle.cycleEndIso
        : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(daysInCalendarMonth).padStart(2, '0')}`;

    const upcomingRecurring = computeRecurringMetrics(
      recurringRules,
      periodEndIso,
    ).dueBeforePayday;

    const totalBudgetLimit = budgets.reduce(
      (acc, b) => acc + (Number(b.limit) || 0),
      0,
    );

    let safePool: number | null = null;
    let safeBasis: 'budget' | 'income' | null = null;
    if (totalBudgetLimit > 0) {
      safePool = Math.max(0, totalBudgetLimit - outflow - upcomingRecurring);
      safeBasis = 'budget';
    } else if (inflow > 0) {
      safePool = Math.max(0, inflow - outflow - upcomingRecurring);
      safeBasis = 'income';
    }

    const safePerDay = safePool !== null ? safePool / remainingDays : null;
    const dailySpend = outflow > 0 ? outflow / elapsedDays : 0;

    const monthName = now.toLocaleDateString('en-GB', { month: 'short' });

    return {
      inflow,
      outflow,
      net,
      prevInflow: prevSummary.income,
      prevOutflow: prevSummary.expenses,
      prevNet: prevSummary.net,
      dividends,
      netWorthChange,
      savingsRate,
      runwayMonths,
      dailySpend,
      safePerDay,
      safePool,
      safeBasis,
      remainingDays,
      upcomingRecurring,
      monthName,
      hasActivity:
        inflow > 0 ||
        outflow > 0 ||
        currentSummary.dividends > 0 ||
        rows.length > 0 ||
        transactions.length > 0,
    };
  }, [
    transactions,
    liquidCash,
    snapshots,
    pulseMode,
    cycle.cycleStartIso,
    cycle.cycleEndIso,
    cycle.elapsedCalendarDays,
    cycle.remainingCalendarDays,
    budgets,
    recurringRules,
  ]);

  if (!stats.hasActivity) return null;

  const spendShare =
    stats.inflow > 0
      ? Math.min(100, Math.max(0, (stats.outflow / stats.inflow) * 100))
      : stats.outflow > 0
        ? 100
        : 0;

  const handleModeSwitch = (mode: PaydayRuleMode) => {
    updateConfig({ ...config, mode });
  };

  return (
    <Card className="flex min-w-0 flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              {pulseMode === 'paycycle'
                ? 'Payday cycle pulse'
                : `${stats.monthName} pulse`}
            </span>
            {stats.savingsRate !== null && stats.savingsRate > 0 && (
              <span className="rounded-full bg-[color-mix(in_srgb,var(--positive)_16%,transparent)] px-2 py-0.5 text-[10px] font-bold tabular-nums text-[var(--positive)]">
                {pct0.format(stats.savingsRate)} saved
              </span>
            )}
          </div>

          {pulseMode === 'paycycle' && (
            <button
              type="button"
              onClick={() => setCalendarOpen((v) => !v)}
              className="tap inline-flex items-center gap-1.5 text-left text-[11px] text-[var(--text-muted)] hover:text-[var(--text-strong)]"
            >
              <span>
                📅 {shortDateFmt.format(cycle.cycleStart)} –{' '}
                {shortDateFmt.format(cycle.cycleEndInclusive)} ·{' '}
                {cycle.remainingCalendarDays}d left
              </span>
              <span className="rounded bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                {calendarOpen ? 'Done' : 'Edit date'}
              </span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-full border border-[var(--line)] bg-[var(--surface-sunken)] p-0.5 text-[10px] font-semibold">
            <button
              type="button"
              onClick={() => {
                setPulseMode('calendar');
                setCalendarOpen(false);
              }}
              className={`tap rounded-full px-2 py-0.5 transition-colors ${
                pulseMode === 'calendar'
                  ? 'bg-[var(--surface-raised)] text-[var(--text-strong)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'
              }`}
            >
              Calendar
            </button>
            <button
              type="button"
              onClick={() => setPulseMode('paycycle')}
              className={`tap rounded-full px-2 py-0.5 transition-colors ${
                pulseMode === 'paycycle'
                  ? 'bg-[var(--surface-raised)] text-[var(--text-strong)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'
              }`}
            >
              Pay cycle
            </button>
          </div>
        </div>
      </div>

      {pulseMode === 'paycycle' && calendarOpen && (
        <div className="page-enter flex flex-col gap-3 rounded-[var(--radius-field)] border border-[var(--line)] bg-[var(--surface-sunken)] p-3">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Payday / Cycle start (Calendar)
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
                className={`tap rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
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
                className={`tap rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
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
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Inflow
          </span>
          <span className="truncate text-sm font-bold text-[var(--positive)]">
            <AmountInline value={stats.inflow} />
          </span>
          <MiniDelta
            current={stats.inflow}
            previous={stats.prevInflow}
            show={pulseMode === 'calendar'}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-0.5 rounded-[var(--radius-field)] neu-flat px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Spent
          </span>
          <span className="truncate text-sm font-bold text-[var(--negative)]">
            <AmountInline value={stats.outflow} />
          </span>
          <MiniDelta
            current={stats.outflow}
            previous={stats.prevOutflow}
            show={pulseMode === 'calendar'}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-0.5 rounded-[var(--radius-field)] neu-flat px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Saved
          </span>
          <span
            className="truncate text-sm font-bold"
            style={{
              color: stats.net >= 0 ? 'var(--positive)' : 'var(--negative)',
            }}
          >
            <AmountInline value={stats.net} signed />
          </span>
          <MiniDelta
            current={stats.net}
            previous={stats.prevNet}
            show={pulseMode === 'calendar'}
          />
        </div>
      </div>

      {(stats.inflow > 0 || stats.outflow > 0) && (
        <div className="flex flex-col gap-1.5">
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${spendShare}%`,
                background:
                  spendShare > 90 ? 'var(--negative)' : 'var(--accent)',
              }}
            />
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${Math.max(0, 100 - spendShare)}%`,
                background: 'var(--positive)',
              }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                Daily burn:{' '}
                <strong className="font-semibold text-[var(--text-2)]">
                  <AmountInline value={stats.dailySpend} />
                </strong>
                /day
              </span>
              {stats.safePerDay !== null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-[11px]">
                  <span>Safe / day:</span>
                  <strong
                    className="font-bold tabular-nums"
                    style={{
                      color:
                        stats.safePerDay > 0
                          ? 'var(--positive)'
                          : 'var(--negative)',
                    }}
                  >
                    <AmountInline value={stats.safePerDay} />
                  </strong>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    ({stats.remainingDays}d left
                    {stats.upcomingRecurring > 0 ? ' · after bills' : ''})
                  </span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {stats.dividends > 0 && (
                <span>
                  Dividends:{' '}
                  <strong className="font-semibold text-[var(--positive)]">
                    +<AmountInline value={stats.dividends} />
                  </strong>
                </span>
              )}
              {stats.runwayMonths !== null && (
                <span>
                  Runway:{' '}
                  <strong className="font-semibold text-[var(--text-2)]">
                    {stats.runwayMonths >= 99
                      ? '99+ mos'
                      : `${stats.runwayMonths.toFixed(1)} mos`}
                  </strong>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
