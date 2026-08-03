import type { ExpectedDividend } from './projectDividends';

export interface MonthlyDividend {
  month: string;
  label: string;
  value: number;
}

const monthKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

export const expectedByMonth = (
  expected: readonly ExpectedDividend[],
  now: Date,
  months = 12,
): MonthlyDividend[] => {
  const buckets: MonthlyDividend[] = [];
  const index = new Map<string, MonthlyDividend>();
  for (let i = 0; i < months; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const bucket: MonthlyDividend = {
      month: monthKey(date),
      label: date.toLocaleDateString('en-GB', { month: 'short' }),
      value: 0,
    };
    buckets.push(bucket);
    index.set(bucket.month, bucket);
  }

  for (const item of expected) {
    const bucket = index.get(item.expectedAt.slice(0, 7));
    if (bucket) bucket.value += Number(item.estimatedAmount);
  }

  return buckets;
};

export const annualIncomeByInstrument = (
  expected: readonly ExpectedDividend[],
): Map<string, number> => {
  const totals = new Map<string, number>();
  for (const item of expected) {
    totals.set(
      item.instrumentId,
      (totals.get(item.instrumentId) ?? 0) + Number(item.estimatedAmount),
    );
  }
  return totals;
};
