import { describe, expect, it } from 'vitest';
import { deriveBalances } from '../balances/deriveBalances';
import type { Account, Transaction } from '../types';
import { computeNetWorth } from './netWorth';

const account = (
  id: string,
  overrides: Partial<Account> = {},
): Account => ({
  id,
  institutionId: 'revolut',
  name: id,
  type: 'cash',
  currency: 'EUR',
  createdAt: '2026-01-01T00:00:00Z',
  archivedAt: null,
  ...overrides,
});

const tx = (accountId: string, amount: string): Transaction => ({
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
  instrumentId: null,
  createdAt: '2026-01-01T00:00:00Z',
});

describe('computeNetWorth', () => {
  it('buckets a positive cash account as an asset', () => {
    const accounts = [account('revolut')];
    const balances = deriveBalances([tx('revolut', '70.00')]);
    const result = computeNetWorth(accounts, balances);
    expect(result.assets).toHaveLength(1);
    expect(result.liabilities).toHaveLength(0);
    expect(result.net.toString()).toBe('70');
  });

  it('moves a negative cash account into liabilities by sign', () => {
    const accounts = [account('revolut')];
    const balances = deriveBalances([tx('revolut', '100'), tx('revolut', '-150')]);
    const result = computeNetWorth(accounts, balances);
    expect(result.assets).toHaveLength(0);
    expect(result.liabilities).toHaveLength(1);
    expect(result.totalLiabilities.toString()).toBe('-50');
    expect(result.net.toString()).toBe('-50');
  });

  it('keeps a liability-typed account in liabilities even at zero balance', () => {
    const accounts = [account('mortgage', { type: 'liability' })];
    const balances = deriveBalances([]);
    const result = computeNetWorth(accounts, balances);
    expect(result.liabilities).toHaveLength(1);
    expect(result.assets).toHaveLength(0);
  });

  it('nets assets against liabilities', () => {
    const accounts = [account('savings'), account('overdrawn')];
    const balances = deriveBalances([
      tx('savings', '1000'),
      tx('overdrawn', '-200'),
    ]);
    const result = computeNetWorth(accounts, balances);
    expect(result.totalAssets.toString()).toBe('1000');
    expect(result.totalLiabilities.toString()).toBe('-200');
    expect(result.net.toString()).toBe('800');
  });

  it('excludes archived accounts', () => {
    const accounts = [account('old', { archivedAt: '2026-02-01T00:00:00Z' })];
    const balances = deriveBalances([tx('old', '500')]);
    const result = computeNetWorth(accounts, balances);
    expect(result.assets).toHaveLength(0);
    expect(result.net.toString()).toBe('0');
  });
});
