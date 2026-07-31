import type { Transaction, TransactionKind } from '../types';
import type { CashFlow } from './xirr';
import type { ValuationPoint } from './twr';

export interface SeriesPoint {
  date: string;
  value: number;
}

const dayOf = (iso: string): string => iso.slice(0, 10);

const round2 = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const byOccurredAt = (a: Transaction, b: Transaction): number =>
  a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0;

const boundaryKinds: readonly TransactionKind[] = [
  'deposit',
  'income',
  'withdrawal',
  'expense',
];

interface Holding {
  quantity: number;
  averageCost: number;
}

export interface Step {
  transaction: Transaction;
  valueBefore: number;
  valueAfter: number;
}

const walk = (transactions: readonly Transaction[]): Step[] => {
  const sorted = [...transactions].sort(byOccurredAt);
  const holdings = new Map<string, Holding>();
  let cash = 0;
  const steps: Step[] = [];

  for (const transaction of sorted) {
    let costBefore = 0;
    for (const holding of holdings.values()) {
      costBefore += holding.quantity * holding.averageCost;
    }
    const valueBefore = cash + costBefore;

    cash += Number(transaction.amount);
    if (transaction.instrumentId && transaction.quantity !== null) {
      const quantity = Number(transaction.quantity);
      const holding = holdings.get(transaction.instrumentId) ?? {
        quantity: 0,
        averageCost: 0,
      };
      if (quantity > 0) {
        const cost = -Number(transaction.amount);
        const nextQuantity = holding.quantity + quantity;
        holding.averageCost =
          nextQuantity === 0
            ? 0
            : (holding.quantity * holding.averageCost + cost) / nextQuantity;
        holding.quantity = nextQuantity;
      } else {
        holding.quantity += quantity;
        if (holding.quantity <= 0) {
          holding.quantity = 0;
          holding.averageCost = 0;
        }
      }
      holdings.set(transaction.instrumentId, holding);
    }

    let costAfter = 0;
    for (const holding of holdings.values()) {
      costAfter += holding.quantity * holding.averageCost;
    }

    steps.push({ transaction, valueBefore, valueAfter: cash + costAfter });
  }

  return steps;
};

export const netWorthAtCostSeries = (
  transactions: readonly Transaction[],
): SeriesPoint[] => {
  const points: SeriesPoint[] = [];
  for (const step of walk(transactions)) {
    const date = dayOf(step.transaction.occurredAt);
    const last = points[points.length - 1];
    if (last && last.date === date) {
      last.value = round2(step.valueAfter);
    } else {
      points.push({ date, value: round2(step.valueAfter) });
    }
  }
  return points;
};

export const valuationPoints = (
  transactions: readonly Transaction[],
): ValuationPoint[] => {
  const steps = walk(transactions);
  const points: ValuationPoint[] = [];
  for (const step of steps) {
    if (boundaryKinds.includes(step.transaction.kind)) {
      points.push({
        value: round2(step.valueBefore),
        flow: Number(step.transaction.amount),
      });
    }
  }
  const last = steps[steps.length - 1];
  if (last) points.push({ value: round2(last.valueAfter), flow: 0 });
  return points;
};

export const externalCashFlows = (
  transactions: readonly Transaction[],
  terminalValue: number,
  now: Date,
): CashFlow[] => {
  const flows: CashFlow[] = [];
  for (const transaction of transactions) {
    if (boundaryKinds.includes(transaction.kind)) {
      flows.push({
        amount: -Number(transaction.amount),
        when: new Date(transaction.occurredAt),
      });
    }
  }
  flows.push({ amount: terminalValue, when: now });
  return flows;
};

export const sliceFrom = (
  series: readonly SeriesPoint[],
  from: Date,
): SeriesPoint[] => {
  const iso = from.toISOString().slice(0, 10);
  return series.filter((point) => point.date >= iso);
};

export interface YearBreakdown {
  year: number;
  deposits: number;
  withdrawals: number;
  dividends: number;
  expenses: number;
  netChange: number;
}

const sumByKind = (rows: Transaction[], kinds: TransactionKind[]): number =>
  rows
    .filter((row) => kinds.includes(row.kind))
    .reduce((total, row) => total + Number(row.amount), 0);

export const yearlyBreakdown = (
  transactions: readonly Transaction[],
): YearBreakdown[] => {
  const byYear = new Map<number, Transaction[]>();
  for (const transaction of transactions) {
    const year = new Date(transaction.occurredAt).getUTCFullYear();
    const bucket = byYear.get(year) ?? [];
    bucket.push(transaction);
    byYear.set(year, bucket);
  }

  return [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, rows]) => ({
      year,
      deposits: round2(sumByKind(rows, ['deposit', 'income'])),
      withdrawals: round2(sumByKind(rows, ['withdrawal'])),
      dividends: round2(sumByKind(rows, ['dividend', 'interest'])),
      expenses: round2(sumByKind(rows, ['expense', 'fee'])),
      netChange: round2(
        rows.reduce((total, row) => total + Number(row.amount), 0),
      ),
    }));
};

export interface Slice {
  group: string;
  value: number;
  weight: number;
}

export const weightBy = <T>(
  items: readonly T[],
  groupOf: (item: T) => string,
  valueOf: (item: T) => number,
): Slice[] => {
  const totals = new Map<string, number>();
  let total = 0;
  for (const item of items) {
    const value = valueOf(item);
    if (value <= 0) continue;
    totals.set(groupOf(item), (totals.get(groupOf(item)) ?? 0) + value);
    total += value;
  }
  return [...totals.entries()]
    .map(([group, value]) => ({
      group,
      value: round2(value),
      weight: total === 0 ? 0 : value / total,
    }))
    .sort((a, b) => b.value - a.value);
};

export const geographyFromIsin = (isin: string | null): string => {
  if (!isin || isin.length < 2) return 'Desconhecido';
  return isin.slice(0, 2).toUpperCase();
};
