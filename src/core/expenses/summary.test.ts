import { describe, expect, it } from 'vitest';
import type { Transaction } from '../types';
import {
  comparePeriods,
  expensesByCategory,
  monthlyExpenses,
} from './summary';

const tx = (
  amount: string,
  occurredAt: string,
  overrides: Partial<Transaction> = {},
): Transaction => ({
  id: crypto.randomUUID(),
  accountId: 'acc',
  kind: 'expense',
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

describe('expensesByCategory', () => {
  it('sums magnitudes per category and ignores non-expenses', () => {
    const groceries = tx('-30', '2026-01-01T00:00:00Z');
    const rent = tx('-500', '2026-01-02T00:00:00Z');
    const income = tx('2000', '2026-01-03T00:00:00Z', { kind: 'income' });
    const category = (id: string) =>
      id === groceries.id ? 'Alimentação' : id === rent.id ? 'Casa' : 'Outros';

    const totals = expensesByCategory([groceries, rent, income], category);
    expect(totals).toHaveLength(2);
    expect(totals[0]).toMatchObject({ category: 'Casa' });
    expect(totals[0]!.total.toString()).toBe('500');
    expect(totals[1]!.total.toString()).toBe('30');
  });
});

describe('monthlyExpenses', () => {
  it('groups by month, most recent first', () => {
    const months = monthlyExpenses(
      [
        tx('-30', '2026-01-15T00:00:00Z'),
        tx('-20', '2026-02-10T00:00:00Z'),
        tx('-10', '2026-02-20T00:00:00Z'),
      ],
      () => 'Geral',
    );
    expect(months.map((month) => month.month)).toEqual(['2026-02', '2026-01']);
    expect(months[0]!.total.toString()).toBe('30');
    expect(months[1]!.total.toString()).toBe('30');
  });
});

describe('comparePeriods', () => {
  it('computes deltas across categories present in either period', () => {
    const current = [tx('-40', '2026-02-01T00:00:00Z')];
    const previous = [tx('-25', '2026-01-01T00:00:00Z')];
    const comparison = comparePeriods(current, previous, () => 'Alimentação');
    expect(comparison).toHaveLength(1);
    expect(comparison[0]!.delta.toString()).toBe('15');
  });
});
