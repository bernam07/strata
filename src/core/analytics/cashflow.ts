import type { Money } from '../money/money';
import { money, zero } from '../money/money';
import type { Transaction, TransactionKind } from '../types';

const inflowKinds: readonly TransactionKind[] = [
  'deposit',
  'income',
  'dividend',
  'interest',
];

const outflowKinds: readonly TransactionKind[] = [
  'expense',
  'fee',
  'withdrawal',
];

export interface MonthlyCashflow {
  month: string;
  inflow: Money;
  outflow: Money;
  net: Money;
}

export const monthlyCashflow = (
  transactions: readonly Transaction[],
): MonthlyCashflow[] => {
  const byMonth = new Map<string, { inflow: Money; outflow: Money }>();

  for (const transaction of transactions) {
    const isInflow = inflowKinds.includes(transaction.kind);
    const isOutflow = outflowKinds.includes(transaction.kind);
    if (!isInflow && !isOutflow) continue;

    const month = transaction.occurredAt.slice(0, 7);
    const entry = byMonth.get(month) ?? { inflow: zero(), outflow: zero() };
    const magnitude = money(transaction.amount).abs();
    if (isInflow) entry.inflow = entry.inflow.plus(magnitude);
    else entry.outflow = entry.outflow.plus(magnitude);
    byMonth.set(month, entry);
  }

  return [...byMonth.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([month, entry]) => ({
      month,
      inflow: entry.inflow,
      outflow: entry.outflow,
      net: entry.inflow.minus(entry.outflow),
    }));
};
