import { describe, expect, it } from 'vitest';
import type { Transaction } from '../types';
import { netWorthChangeForMonth, summarizeMonth } from './monthly';

const tx = (
  amount: string,
  occurredAt: string,
  overrides: Partial<Transaction> = {},
): Transaction => ({
  id: crypto.randomUUID(),
  accountId: 'acc',
  kind: 'deposit',
  amount,
  quantity: null,
  currency: 'EUR',
  fxRate: '1',
  occurredAt,
  note: null,
  source: 'manual',
  externalId: null,
  transferGroupId: null,
  instrumentId: null,
  createdAt: occurredAt,
  ...overrides,
});

describe('summarizeMonth', () => {
  it('separates income, dividends, expenses and deposits within the month', () => {
    const transactions = [
      tx('2000', '2026-08-01T10:00:00Z', { kind: 'income' }),
      tx('15', '2026-08-10T10:00:00Z', { kind: 'dividend' }),
      tx('-40', '2026-08-12T10:00:00Z', { kind: 'expense' }),
      tx('-2', '2026-08-12T10:00:00Z', { kind: 'fee' }),
      tx('500', '2026-08-15T10:00:00Z', { kind: 'deposit' }),
      tx('-999', '2026-07-31T10:00:00Z', { kind: 'expense' }), // previous month, ignored
    ];
    const summary = summarizeMonth(transactions, 2026, 7); // August (0-indexed)
    expect(summary).toEqual({
      year: 2026,
      month: 7,
      income: 2000,
      dividends: 15,
      expenses: 42,
      deposits: 500,
      net: 1973, // 2000 + 15 − 42
    });
  });

  it('is all zeros for a month with no activity', () => {
    const summary = summarizeMonth([tx('100', '2026-01-01T00:00:00Z')], 2026, 5);
    expect(summary).toMatchObject({ income: 0, expenses: 0, net: 0 });
  });
});

describe('netWorthChangeForMonth', () => {
  it('compares the last in-month snapshot with the last one before the month', () => {
    const snapshots = [
      { date: '2026-07-28', value: 10000 },
      { date: '2026-08-05', value: 10500 },
      { date: '2026-08-20', value: 11000 },
    ];
    expect(netWorthChangeForMonth(snapshots, 2026, 7)).toBe(1000);
  });

  it('returns null without a prior-month anchor', () => {
    const snapshots = [{ date: '2026-08-05', value: 10500 }];
    expect(netWorthChangeForMonth(snapshots, 2026, 7)).toBeNull();
  });
});
