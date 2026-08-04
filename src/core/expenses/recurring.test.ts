import { describe, expect, it } from 'vitest';
import type { Transaction } from '../types';
import { detectRecurring, monthlyEquivalent } from './recurring';

const expense = (note: string, date: string, amount = '-9.99'): Transaction => ({
  id: `${note}-${date}`,
  accountId: 'a1',
  kind: 'expense',
  amount,
  quantity: null,
  currency: 'EUR',
  fxRate: '1',
  occurredAt: `${date}T10:00:00.000Z`,
  note,
  source: 'manual',
  externalId: null,
  transferGroupId: null,
  instrumentId: null,
  createdAt: `${date}T10:00:00.000Z`,
});

describe('detectRecurring', () => {
  it('flags a monthly subscription with 3+ occurrences', () => {
    const found = detectRecurring([
      expense('Spotify', '2026-01-05'),
      expense('Spotify', '2026-02-04'),
      expense('Spotify', '2026-03-06'),
    ]);
    expect(found).toHaveLength(1);
    expect(found[0]!.label).toBe('Spotify');
    expect(found[0]!.cadence).toBe('monthly');
    expect(found[0]!.count).toBe(3);
  });

  it('ignores irregular or too-few occurrences', () => {
    expect(
      detectRecurring([
        expense('Random', '2026-01-01'),
        expense('Random', '2026-01-20'),
      ]),
    ).toHaveLength(0);
    expect(
      detectRecurring([
        expense('Ad hoc', '2026-01-01'),
        expense('Ad hoc', '2026-01-03'),
        expense('Ad hoc', '2026-06-01'),
      ]),
    ).toHaveLength(0);
  });

  it('projects the monthly-equivalent cost of a weekly expense', () => {
    const [weekly] = detectRecurring([
      expense('Gym', '2026-01-01', '-10'),
      expense('Gym', '2026-01-08', '-10'),
      expense('Gym', '2026-01-15', '-10'),
      expense('Gym', '2026-01-22', '-10'),
    ]);
    expect(weekly!.cadence).toBe('weekly');
    expect(monthlyEquivalent(weekly!).toNumber()).toBeCloseTo(42.857, 2);
  });
});
