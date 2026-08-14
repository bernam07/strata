import type { Transaction, TransactionKind } from '../types';
import type { SeriesPoint } from './series';

export interface MonthSummary {
  year: number;
  month: number; // 0-indexed
  income: number; // salary and other income
  dividends: number; // dividends and interest
  expenses: number; // spending and fees, as a positive number
  deposits: number; // your own money added to accounts
  net: number; // income + dividends − expenses (excludes deposits/investments)
}

const round2 = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const sumByKind = (
  rows: readonly Transaction[],
  kinds: readonly TransactionKind[],
): number =>
  rows
    .filter((row) => kinds.includes(row.kind))
    .reduce((total, row) => total + Number(row.amount), 0);

export const summarizeMonth = (
  transactions: readonly Transaction[],
  year: number,
  month: number,
): MonthSummary => {
  const rows = transactions.filter((transaction) => {
    const date = new Date(transaction.occurredAt);
    return date.getUTCFullYear() === year && date.getUTCMonth() === month;
  });

  const income = sumByKind(rows, ['income']);
  const dividends = sumByKind(rows, ['dividend', 'interest']);
  const expenses = -sumByKind(rows, ['expense', 'fee']);
  const deposits = sumByKind(rows, ['deposit']);

  return {
    year,
    month,
    income: round2(income),
    dividends: round2(dividends),
    expenses: round2(expenses),
    deposits: round2(deposits),
    net: round2(income + dividends - expenses),
  };
};

// Net-worth change across a calendar month, read from the snapshot history:
// the last snapshot within the month minus the last snapshot strictly before
// it. Returns null when there isn't a before-and-during pair to compare.
export const netWorthChangeForMonth = (
  snapshots: readonly SeriesPoint[],
  year: number,
  month: number,
): number | null => {
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  let before: number | null = null;
  let during: number | null = null;
  for (const point of snapshots) {
    if (point.date < `${monthPrefix}-01`) before = point.value;
    else if (point.date.startsWith(monthPrefix)) during = point.value;
  }
  if (during === null || before === null) return null;
  return round2(during - before);
};
