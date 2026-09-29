import { useMemo } from 'react';
import type { Transaction } from '@/core/types';
import { monthlyCashflow } from '@/core/analytics/cashflow';
import {
  netWorthChangeForMonth,
  summarizeMonth,
} from '@/core/analytics/monthly';
import type { SeriesPoint } from '@/core/analytics/series';
import { toNumber } from '@/core/money/money';
import { AmountInline } from '@/ui/Amount';
import { Card } from '@/ui/Card';
import { pct0 } from '@/ui/format';

const MiniDelta = ({
  current,
  previous,
}: {
  current: number;
  previous: number;
}) => {
  if (previous === 0 && current === 0) return null;
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

    const inflow = current ? toNumber(current.inflow) : currentSummary.income;
    const outflow = current ? toNumber(current.outflow) : currentSummary.expenses;
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

    const dayOfMonth = Math.max(1, now.getDate());
    const dailySpend = outflow > 0 ? outflow / dayOfMonth : 0;

    const monthName = now.toLocaleDateString('en-GB', { month: 'short' });

    return {
      inflow,
      outflow,
      net,
      prevInflow: prevSummary.income,
      prevOutflow: prevSummary.expenses,
      prevNet: prevSummary.net,
      dividends: currentSummary.dividends,
      netWorthChange,
      savingsRate,
      runwayMonths,
      dailySpend,
      monthName,
      hasActivity:
        inflow > 0 ||
        outflow > 0 ||
        currentSummary.dividends > 0 ||
        rows.length > 0,
    };
  }, [transactions, liquidCash, snapshots]);

  if (!stats.hasActivity) return null;

  const spendShare =
    stats.inflow > 0
      ? Math.min(100, Math.max(0, (stats.outflow / stats.inflow) * 100))
      : stats.outflow > 0
        ? 100
        : 0;

  return (
    <Card className="flex min-w-0 flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            {stats.monthName} pulse
          </span>
          {stats.savingsRate !== null && stats.savingsRate > 0 && (
            <span className="rounded-full bg-[color-mix(in_srgb,var(--positive)_16%,transparent)] px-2 py-0.5 text-[10px] font-bold tabular-nums text-[var(--positive)]">
              {pct0.format(stats.savingsRate)} saved
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          {stats.netWorthChange !== null && (
            <span
              className="text-[11px] font-semibold tabular-nums"
              style={{
                color:
                  stats.netWorthChange >= 0
                    ? 'var(--positive)'
                    : 'var(--negative)',
              }}
            >
              <AmountInline value={stats.netWorthChange} signed /> NW
            </span>
          )}
          {stats.runwayMonths !== null && (
            <span
              className="text-[11px] font-semibold tabular-nums text-[var(--text-muted)]"
              title="Liquid cash divided by average monthly expenses"
            >
              Runway{' '}
              <strong className="text-[var(--text-strong)]">
                {stats.runwayMonths >= 99
                  ? '99+ mos'
                  : `${stats.runwayMonths.toFixed(1)} mos`}
              </strong>
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="flex min-w-0 flex-col gap-0.5 rounded-[var(--radius-field)] neu-flat px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Inflow
          </span>
          <span className="truncate text-sm font-bold text-[var(--positive)]">
            <AmountInline value={stats.inflow} />
          </span>
          <MiniDelta current={stats.inflow} previous={stats.prevInflow} />
        </div>

        <div className="flex min-w-0 flex-col gap-0.5 rounded-[var(--radius-field)] neu-flat px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Spent
          </span>
          <span className="truncate text-sm font-bold text-[var(--negative)]">
            <AmountInline value={stats.outflow} />
          </span>
          <MiniDelta current={stats.outflow} previous={stats.prevOutflow} />
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
          <MiniDelta current={stats.net} previous={stats.prevNet} />
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
            <span>
              Daily burn:{' '}
              <strong className="font-semibold text-[var(--text-2)]">
                <AmountInline value={stats.dailySpend} />
                /day
              </strong>
            </span>
            {stats.dividends > 0 ? (
              <span>
                Includes <AmountInline value={stats.dividends} /> in dividends
              </span>
            ) : (
              stats.inflow > 0 && (
                <span className="tabular-nums">
                  {pct0.format(stats.outflow / stats.inflow)} of income spent
                </span>
              )
            )}
          </div>
        </div>
      )}
    </Card>
  );
};
