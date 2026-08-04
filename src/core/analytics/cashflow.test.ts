import { describe, expect, it } from 'vitest';
import type { Transaction, TransactionKind } from '../types';
import { monthlyCashflow } from './cashflow';

const tx = (kind: TransactionKind, amount: string, date: string): Transaction => ({
  id: `${kind}-${date}-${amount}`,
  accountId: 'a',
  kind,
  amount,
  quantity: null,
  currency: 'EUR',
  fxRate: '1',
  occurredAt: `${date}T10:00:00Z`,
  note: null,
  source: 'manual',
  externalId: null,
  transferGroupId: null,
  instrumentId: null,
  createdAt: `${date}T10:00:00Z`,
});

describe('monthlyCashflow', () => {
  it('separates inflows and outflows and nets them per month', () => {
    const rows = monthlyCashflow([
      tx('income', '2000', '2026-03-01'),
      tx('expense', '-500', '2026-03-04'),
      tx('dividend', '30', '2026-03-10'),
      tx('withdrawal', '-100', '2026-03-15'),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.inflow.toString()).toBe('2030');
    expect(rows[0]!.outflow.toString()).toBe('600');
    expect(rows[0]!.net.toString()).toBe('1430');
  });

  it('ignores buys, sells and transfers', () => {
    const rows = monthlyCashflow([
      tx('buy', '-1000', '2026-03-01'),
      tx('sell', '1200', '2026-03-02'),
      tx('transfer', '-50', '2026-03-03'),
    ]);
    expect(rows).toHaveLength(0);
  });

  it('orders months newest first', () => {
    const rows = monthlyCashflow([
      tx('income', '100', '2026-01-01'),
      tx('income', '100', '2026-05-01'),
    ]);
    expect(rows.map((r) => r.month)).toEqual(['2026-05', '2026-01']);
  });
});
