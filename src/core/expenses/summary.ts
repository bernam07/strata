import type { Money } from '../money/money';
import { money, zero } from '../money/money';
import type { Transaction, TransactionKind } from '../types';

export type CategoryLookup = (transactionId: string) => string;

const expenseKinds: readonly TransactionKind[] = ['expense'];

const isExpense = (transaction: Transaction): boolean =>
  expenseKinds.includes(transaction.kind);

const magnitude = (transaction: Transaction): Money =>
  money(transaction.amount).abs();

export interface CategoryTotal {
  category: string;
  total: Money;
}

export const expensesByCategory = (
  transactions: readonly Transaction[],
  categoryOf: CategoryLookup,
): CategoryTotal[] => {
  const totals = new Map<string, Money>();
  for (const transaction of transactions) {
    if (!isExpense(transaction)) continue;
    const category = categoryOf(transaction.id);
    totals.set(
      category,
      (totals.get(category) ?? zero()).plus(magnitude(transaction)),
    );
  }
  return [...totals.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total.comparedTo(a.total));
};

export interface MonthlyExpense {
  month: string;
  total: Money;
  byCategory: CategoryTotal[];
}

export const monthlyExpenses = (
  transactions: readonly Transaction[],
  categoryOf: CategoryLookup,
): MonthlyExpense[] => {
  const byMonth = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    if (!isExpense(transaction)) continue;
    const month = transaction.occurredAt.slice(0, 7);
    const bucket = byMonth.get(month) ?? [];
    bucket.push(transaction);
    byMonth.set(month, bucket);
  }

  return [...byMonth.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([month, rows]) => ({
      month,
      total: rows.reduce((sum, row) => sum.plus(magnitude(row)), zero()),
      byCategory: expensesByCategory(rows, categoryOf),
    }));
};

export interface CategoryComparison {
  category: string;
  current: Money;
  previous: Money;
  delta: Money;
}

export const comparePeriods = (
  current: readonly Transaction[],
  previous: readonly Transaction[],
  categoryOf: CategoryLookup,
): CategoryComparison[] => {
  const currentTotals = new Map(
    expensesByCategory(current, categoryOf).map((entry) => [
      entry.category,
      entry.total,
    ]),
  );
  const previousTotals = new Map(
    expensesByCategory(previous, categoryOf).map((entry) => [
      entry.category,
      entry.total,
    ]),
  );

  const categories = new Set([
    ...currentTotals.keys(),
    ...previousTotals.keys(),
  ]);

  return [...categories]
    .map((category) => {
      const currentValue = currentTotals.get(category) ?? zero();
      const previousValue = previousTotals.get(category) ?? zero();
      return {
        category,
        current: currentValue,
        previous: previousValue,
        delta: currentValue.minus(previousValue),
      };
    })
    .sort((a, b) => b.current.comparedTo(a.current));
};
