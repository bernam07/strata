import type { Money } from '../money/money';
import { money } from '../money/money';
import type { Transaction } from '../types';

export type Cadence =
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'annual';

export interface PriceCreep {
  previousAmount: number;
  latestAmount: number;
  deltaAmount: number;
  deltaPct: number;
}

export interface RecurringExpense {
  label: string;
  amount: Money;
  latestAmount: Money;
  cadence: Cadence;
  count: number;
  lastAt: string;
  nextExpected: string;
  priceCreep: PriceCreep | null;
}

export interface HabitLeak {
  label: string;
  countLast30d: number;
  totalLast30d: number;
  tenYearCost: number;
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

/**
 * Future value of investing `monthlyAmount` every month for `years` at `annualReturn` (default 8% p.a.).
 */
export const compoundMonthlyCost = (
  monthlyAmount: number,
  years = 10,
  annualReturn = 0.08,
): number => {
  if (monthlyAmount <= 0 || years <= 0) return 0;
  const months = years * 12;
  const r = annualReturn / 12;
  return monthlyAmount * ((Math.pow(1 + r, months) - 1) / r);
};

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
    const latestVal = amounts[amounts.length - 1]!;
    const priorAmounts = amounts.slice(0, -1);
    const priorMedian = median(priorAmounts);

    let priceCreep: PriceCreep | null = null;
    if (priorMedian > 0 && latestVal - priorMedian >= 0.25) {
      const deltaPct = (latestVal - priorMedian) / priorMedian;
      if (deltaPct >= 0.015) {
        priceCreep = {
          previousAmount: priorMedian,
          latestAmount: latestVal,
          deltaAmount: latestVal - priorMedian,
          deltaPct,
        };
      }
    }

    recurring.push({
      label: last.note!.trim(),
      amount: money(median(amounts).toFixed(2)),
      latestAmount: money(latestVal.toFixed(2)),
      cadence,
      count: sorted.length,
      lastAt: last.occurredAt,
      nextExpected: new Date(
        Date.parse(last.occurredAt) + cadenceDays[cadence] * DAY,
      ).toISOString(),
      priceCreep,
    });
  }

  return recurring.sort((a, b) => b.amount.comparedTo(a.amount));
};

export const monthlyEquivalent = (item: RecurringExpense): Money => {
  const perMonth = 30 / cadenceDays[item.cadence];
  return item.latestAmount.times(perMonth);
};

/**
 * Finds frequent repeat expenses in the last 30 days (3+ occurrences) that are NOT already in `recurring`,
 * highlighting habitual micro-leaks (e.g. cafés, delivery, impulse purchases).
 */
export const detectHabitLeaks = (
  transactions: readonly Transaction[],
  recurringLabels: ReadonlySet<string>,
  now = new Date(),
): HabitLeak[] => {
  const cutoff = now.getTime() - 30 * DAY;
  const groups = new Map<string, { label: string; count: number; total: number }>();

  for (const tx of transactions) {
    if (tx.kind !== 'expense') continue;
    if (!tx.note || tx.note.trim().length === 0) continue;
    const ts = Date.parse(tx.occurredAt);
    if (Number.isNaN(ts) || ts < cutoff) continue;

    const key = normalize(tx.note);
    if (recurringLabels.has(key)) continue;

    const amt = Math.abs(Number(tx.amount));
    if (amt <= 0) continue;

    const current = groups.get(key) ?? {
      label: tx.note.trim(),
      count: 0,
      total: 0,
    };
    current.count += 1;
    current.total += amt;
    groups.set(key, current);
  }

  return [...groups.values()]
    .filter((item) => item.count >= 3)
    .map((item) => ({
      label: item.label,
      countLast30d: item.count,
      totalLast30d: item.total,
      tenYearCost: compoundMonthlyCost(item.total, 10, 0.08),
    }))
    .sort((a, b) => b.totalLast30d - a.totalLast30d)
    .slice(0, 5);
};
