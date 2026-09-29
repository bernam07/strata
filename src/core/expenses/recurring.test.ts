import { describe, expect, it } from 'vitest';
import type { Transaction } from '../types';
import {
  compoundMonthlyCost,
  detectHabitLeaks,
  detectRecurring,
  monthlyEquivalent,
} from './recurring';

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
    expect(found[0]!.priceCreep).toBeNull();
  });

  it('detects price creep when the latest charge increased', () => {
    const found = detectRecurring([
      expense('Netflix', '2026-01-10', '-11.99'),
      expense('Netflix', '2026-02-10', '-11.99'),
      expense('Netflix', '2026-03-10', '-13.99'),
    ]);
    expect(found).toHaveLength(1);
    expect(found[0]!.priceCreep).not.toBeNull();
    expect(found[0]!.priceCreep!.previousAmount).toBeCloseTo(11.99, 2);
    expect(found[0]!.priceCreep!.latestAmount).toBeCloseTo(13.99, 2);
    expect(found[0]!.priceCreep!.deltaAmount).toBeCloseTo(2.0, 2);
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

  it('computes 10-year compounded opportunity cost at 8% p.a. and detects 30d habit leaks', () => {
    expect(compoundMonthlyCost(10, 10, 0.08)).toBeCloseTo(1829.46, 1);

    const leaks = detectHabitLeaks(
      [
        expense('Padaria', '2026-03-02', '-3.50'),
        expense('Padaria', '2026-03-09', '-4.00'),
        expense('Padaria', '2026-03-18', '-3.50'),
      ],
      new Set(),
      new Date('2026-03-25T10:00:00.000Z'),
    );
    expect(leaks).toHaveLength(1);
    expect(leaks[0]!.label).toBe('Padaria');
    expect(leaks[0]!.countLast30d).toBe(3);
    expect(leaks[0]!.totalLast30d).toBeCloseTo(11, 2);
  });
});
