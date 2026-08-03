import { describe, expect, it } from 'vitest';
import type { ExpectedDividend } from './projectDividends';
import { annualIncomeByInstrument, expectedByMonth } from './forecast';

const make = (
  instrumentId: string,
  expectedAt: string,
  amount: string,
): ExpectedDividend => ({
  instrumentId,
  expectedAt,
  estimatedAmount: amount,
  cadence: 'quarterly',
  estimated: true,
});

describe('expectedByMonth', () => {
  it('buckets estimates into 12 forward months from now', () => {
    const now = new Date(2026, 0, 15);
    const months = expectedByMonth(
      [make('a', '2026-01-20T00:00:00Z', '10'), make('a', '2026-03-05T00:00:00Z', '12')],
      now,
    );
    expect(months).toHaveLength(12);
    expect(months[0]!.month).toBe('2026-01');
    expect(months[0]!.value).toBe(10);
    expect(months[2]!.value).toBe(12);
  });

  it('ignores estimates beyond the window', () => {
    const now = new Date(2026, 0, 1);
    const months = expectedByMonth([make('a', '2027-06-01T00:00:00Z', '99')], now);
    expect(months.reduce((sum, m) => sum + m.value, 0)).toBe(0);
  });
});

describe('annualIncomeByInstrument', () => {
  it('sums estimated amounts per instrument', () => {
    const totals = annualIncomeByInstrument([
      make('a', '2026-01-01T00:00:00Z', '10'),
      make('a', '2026-04-01T00:00:00Z', '10'),
      make('b', '2026-02-01T00:00:00Z', '5'),
    ]);
    expect(totals.get('a')).toBe(20);
    expect(totals.get('b')).toBe(5);
  });
});
