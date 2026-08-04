import type { Money } from '../money/money';
import { money } from '../money/money';
import type { Transaction } from '../types';

export type Cadence =
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'annual';

export interface RecurringExpense {
  label: string;
  amount: Money;
  cadence: Cadence;
  count: number;
  lastAt: string;
  nextExpected: string;
}

const DAY = 86_400_000;

const cadenceDays: Record<Cadence, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 91,
  annual: 365,
};

const classify = (days: number): Cadence | null => {
  if (days >= 6 && days <= 8) return 'weekly';
  if (days >= 12 && days <= 16) return 'biweekly';
  if (days >= 26 && days <= 35) return 'monthly';
  if (days >= 84 && days <= 100) return 'quarterly';
  if (days >= 350 && days <= 380) return 'annual';
  return null;
};

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

const normalize = (note: string): string =>
  note.trim().toLowerCase().replace(/\s+/g, ' ');

export const detectRecurring = (
  transactions: readonly Transaction[],
): RecurringExpense[] => {
  const groups = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    if (transaction.kind !== 'expense') continue;
    if (!transaction.note || transaction.note.trim().length === 0) continue;
    const key = normalize(transaction.note);
    const bucket = groups.get(key) ?? [];
    bucket.push(transaction);
    groups.set(key, bucket);
  }

  const recurring: RecurringExpense[] = [];
  for (const entries of groups.values()) {
    if (entries.length < 3) continue;
    const sorted = [...entries].sort((a, b) =>
      a.occurredAt < b.occurredAt ? -1 : 1,
    );
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i += 1) {
      gaps.push(
        (Date.parse(sorted[i]!.occurredAt) -
          Date.parse(sorted[i - 1]!.occurredAt)) /
          DAY,
      );
    }
    const cadence = classify(median(gaps));
    if (!cadence) continue;

    const amounts = sorted.map((t) => Number(t.amount)).map(Math.abs);
    const last = sorted[sorted.length - 1]!;
    recurring.push({
      label: last.note!.trim(),
      amount: money(median(amounts).toFixed(2)),
      cadence,
      count: sorted.length,
      lastAt: last.occurredAt,
      nextExpected: new Date(
        Date.parse(last.occurredAt) + cadenceDays[cadence] * DAY,
      ).toISOString(),
    });
  }

  return recurring.sort((a, b) => b.amount.comparedTo(a.amount));
};

export const monthlyEquivalent = (item: RecurringExpense): Money => {
  const perMonth = 30 / cadenceDays[item.cadence];
  return item.amount.times(perMonth);
};
