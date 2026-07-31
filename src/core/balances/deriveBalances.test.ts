import { describe, expect, it } from 'vitest';
import type { Transaction } from '../types';
import { balanceOf, deriveBalances } from './deriveBalances';

const tx = (
  accountId: string,
  amount: string,
  overrides: Partial<Transaction> = {},
): Transaction => ({
  id: crypto.randomUUID(),
  accountId,
  kind: 'deposit',
  amount,
  quantity: null,
  currency: 'EUR',
  fxRate: '1',
  occurredAt: '2026-01-01T00:00:00Z',
  note: null,
  source: 'manual',
  externalId: null,
  transferGroupId: null,
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('deriveBalances', () => {
  it('returns zero for an account with no transactions', () => {
    const balances = deriveBalances([]);
    expect(balanceOf(balances, 'missing').toString()).toBe('0');
  });

  it('computes the acceptance-criteria case: 100 in, 30 out, leaves 70', () => {
    const balances = deriveBalances([
      tx('revolut', '100.00'),
      tx('revolut', '-30.00', { kind: 'expense' }),
    ]);
    expect(balanceOf(balances, 'revolut').toString()).toBe('70');
  });

  it('lets a balance go negative', () => {
    const balances = deriveBalances([
      tx('revolut', '100.00'),
      tx('revolut', '-150.00', { kind: 'expense' }),
    ]);
    expect(balanceOf(balances, 'revolut').toString()).toBe('-50');
  });

  it('keeps accounts isolated', () => {
    const balances = deriveBalances([
      tx('a', '100.00'),
      tx('b', '250.00'),
      tx('a', '-40.00'),
    ]);
    expect(balanceOf(balances, 'a').toString()).toBe('60');
    expect(balanceOf(balances, 'b').toString()).toBe('250');
  });

  it('nets a linked transfer to zero across both legs', () => {
    const group = crypto.randomUUID();
    const balances = deriveBalances([
      tx('a', '100.00'),
      tx('a', '-25.00', { kind: 'transfer', transferGroupId: group }),
      tx('b', '25.00', { kind: 'transfer', transferGroupId: group }),
    ]);
    expect(balanceOf(balances, 'a').toString()).toBe('75');
    expect(balanceOf(balances, 'b').toString()).toBe('25');
  });
});
