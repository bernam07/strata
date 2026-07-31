export interface ReceivedDividend {
  instrumentId: string;
  amount: string;
  paidAt: string;
}

export type DividendCadence =
  | 'monthly'
  | 'quarterly'
  | 'semiannual'
  | 'annual'
  | 'irregular';

export interface ExpectedDividend {
  instrumentId: string;
  expectedAt: string;
  estimatedAmount: string;
  cadence: DividendCadence;
  estimated: true;
}

const DAY = 86_400_000;

const cadenceFromDays = (days: number): DividendCadence => {
  if (days <= 45) return 'monthly';
  if (days <= 135) return 'quarterly';
  if (days <= 225) return 'semiannual';
  if (days <= 400) return 'annual';
  return 'irregular';
};

const cadenceDays: Record<Exclude<DividendCadence, 'irregular'>, number> = {
  monthly: 30,
  quarterly: 91,
  semiannual: 182,
  annual: 365,
};

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
};

export const inferCadence = (paidDates: readonly string[]): DividendCadence => {
  if (paidDates.length < 2) return 'irregular';
  const times = [...paidDates].map((date) => Date.parse(date)).sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < times.length; i += 1) {
    gaps.push((times[i]! - times[i - 1]!) / DAY);
  }
  return cadenceFromDays(median(gaps));
};

export const projectDividends = (
  history: readonly ReceivedDividend[],
  horizon: number,
  now: Date,
): ExpectedDividend[] => {
  const byInstrument = new Map<string, ReceivedDividend[]>();
  for (const dividend of history) {
    const bucket = byInstrument.get(dividend.instrumentId) ?? [];
    bucket.push(dividend);
    byInstrument.set(dividend.instrumentId, bucket);
  }

  const expected: ExpectedDividend[] = [];
  for (const [instrumentId, entries] of byInstrument) {
    const sorted = [...entries].sort((a, b) =>
      a.paidAt < b.paidAt ? -1 : a.paidAt > b.paidAt ? 1 : 0,
    );
    const cadence = inferCadence(sorted.map((entry) => entry.paidAt));
    if (cadence === 'irregular') continue;

    const last = sorted[sorted.length - 1]!;
    const step = cadenceDays[cadence] * DAY;
    let next = Date.parse(last.paidAt) + step;
    const limit = now.getTime() + horizon * DAY;

    while (next <= limit) {
      if (next >= now.getTime()) {
        expected.push({
          instrumentId,
          expectedAt: new Date(next).toISOString(),
          estimatedAmount: last.amount,
          cadence,
          estimated: true,
        });
      }
      next += step;
    }
  }

  return expected;
};
