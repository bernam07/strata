import { useMemo } from 'react';
import {
  netWorthChangeForMonth,
  summarizeMonth,
} from '@/core/analytics/monthly';
import type { SeriesPoint } from '@/core/analytics/series';
import { useTransactions } from '@/features/transactions/api/useTransactions';
import { Card } from '@/ui/Card';
import { eur0 as eur } from '@/ui/format';

const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long' });

const signedEur = (value: number): string =>
  `${value >= 0 ? '+' : '−'}${eur.format(Math.abs(value))}`;

const Delta = ({ current, previous }: { current: number; previous: number }) => {
  const diff = current - previous;
  if (Math.abs(diff) < 1) {
    return <span className="text-[11px] text-[var(--text-muted)]">≈ last month</span>;
  }
  // For spending, more is worse; the caller picks colours, so keep this neutral
  // and just show the direction against last month.
  return (
    <span className="text-[11px] text-[var(--text-muted)]">
      {signedEur(diff)} vs last month
    </span>
  );
};

const Figure = ({
  label,
  value,
  accent,
  children,
}: {
  label: string;
  value: string;
  accent?: string;
  children?: React.ReactNode;
}) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
      {label}
    </span>
    <span
      className="text-xl font-bold tabular-nums"
      style={{ color: accent ?? 'var(--text-strong)' }}
    >
      {value}
    </span>
    {children}
  </div>
);

export const MonthlySummary = ({
  snapshots,
}: {
  snapshots: readonly SeriesPoint[];
}) => {
  const { data: transactions = [] } = useTransactions();

  const model = useMemo(() => {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    return {
      label: monthName.format(now),
      current: summarizeMonth(transactions, year, month),
      previous: summarizeMonth(transactions, prevYear, prevMonth),
      netWorthChange: netWorthChangeForMonth(snapshots, year, month),
    };
  }, [transactions, snapshots]);

  const { current, previous } = model;
  const hasActivity =
    current.income !== 0 ||
    current.expenses !== 0 ||
    current.dividends !== 0 ||
    current.deposits !== 0;
  if (!hasActivity) return null;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold text-[var(--text-strong)]">
          {model.label} so far
        </h2>
        {model.netWorthChange !== null && (
          <span
            className="text-sm font-semibold tabular-nums"
            style={{
              color:
                model.netWorthChange >= 0
                  ? 'var(--positive)'
                  : 'var(--negative)',
            }}
          >
            {signedEur(model.netWorthChange)} net worth
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <Figure
          label="Income"
          value={eur.format(current.income)}
          accent="var(--positive)"
        >
          <Delta current={current.income} previous={previous.income} />
        </Figure>
        <Figure
          label="Spending"
          value={eur.format(current.expenses)}
          accent="var(--negative)"
        >
          <Delta current={current.expenses} previous={previous.expenses} />
        </Figure>
        <Figure
          label="Saved"
          value={signedEur(current.net)}
          accent={current.net >= 0 ? 'var(--positive)' : 'var(--negative)'}
        >
          <Delta current={current.net} previous={previous.net} />
        </Figure>
      </div>

      {current.dividends > 0 && (
        <p className="text-xs text-[var(--text-muted)]">
          Includes {eur.format(current.dividends)} in dividends and interest.
        </p>
      )}
    </Card>
  );
};
