import { describe, expect, it } from 'vitest';
import type { Transaction } from '../types';
import { realizedDisposals, realizedGainsByYear } from './fifo';

const trade = (
  instrumentId: string,
  quantity: string,
  amount: string,
  occurredAt: string,
): Transaction => ({
  id: crypto.randomUUID(),
  accountId: 'acc',
  kind: quantity.startsWith('-') ? 'sell' : 'buy',
  amount,
  quantity,
  currency: 'EUR',
  fxRate: '1',
  occurredAt,
  note: null,
  source: 't212_sync',
  externalId: crypto.randomUUID(),
  transferGroupId: null,
  instrumentId,
  createdAt: occurredAt,
});

describe('realizedDisposals', () => {
  it('matches a sell against the earliest lot first', () => {
    const disposals = realizedDisposals([
      trade('i1', '10', '-100', '2026-01-01T00:00:00Z'),
      trade('i1', '10', '-150', '2026-02-01T00:00:00Z'),
      trade('i1', '-10', '130', '2026-03-01T00:00:00Z'),
    ]);
    expect(disposals).toHaveLength(1);
    expect(disposals[0]!.cost.toString()).toBe('100');
    expect(disposals[0]!.proceeds.toString()).toBe('130');
    expect(disposals[0]!.gain.toString()).toBe('30');
    expect(disposals[0]!.acquiredAt).toBe('2026-01-01T00:00:00Z');
  });

  it('splits a sell across two lots', () => {
    const disposals = realizedDisposals([
      trade('i1', '10', '-100', '2026-01-01T00:00:00Z'),
      trade('i1', '10', '-150', '2026-02-01T00:00:00Z'),
      trade('i1', '-15', '300', '2026-03-01T00:00:00Z'),
    ]);
    expect(disposals).toHaveLength(2);
    expect(disposals[0]!.quantity.toString()).toBe('10');
    expect(disposals[0]!.gain.toString()).toBe('100');
    expect(disposals[1]!.quantity.toString()).toBe('5');
    expect(disposals[1]!.cost.toString()).toBe('75');
    expect(disposals[1]!.proceeds.toString()).toBe('100');
    expect(disposals[1]!.gain.toString()).toBe('25');
  });

  it('incorporates fees folded into the buy amount as cost', () => {
    const disposals = realizedDisposals([
      trade('i1', '10', '-101', '2026-01-01T00:00:00Z'),
      trade('i1', '-10', '109', '2026-03-01T00:00:00Z'),
    ]);
    expect(disposals[0]!.cost.toString()).toBe('101');
    expect(disposals[0]!.gain.toString()).toBe('8');
  });

  it('leaves unmatched shares undisposed', () => {
    const disposals = realizedDisposals([
      trade('i1', '5', '-50', '2026-01-01T00:00:00Z'),
      trade('i1', '-10', '120', '2026-03-01T00:00:00Z'),
    ]);
    expect(disposals).toHaveLength(1);
    expect(disposals[0]!.quantity.toString()).toBe('5');
  });
});

describe('realizedGainsByYear', () => {
  it('aggregates disposals by calendar year of disposal', () => {
    const years = realizedGainsByYear([
      trade('i1', '10', '-100', '2024-01-01T00:00:00Z'),
      trade('i1', '-10', '130', '2025-06-01T00:00:00Z'),
      trade('i2', '5', '-50', '2025-02-01T00:00:00Z'),
      trade('i2', '-5', '40', '2026-02-01T00:00:00Z'),
    ]);
    expect(years).toHaveLength(2);
    expect(years[0]).toMatchObject({ year: 2025 });
    expect(years[0]!.gain.toString()).toBe('30');
    expect(years[1]).toMatchObject({ year: 2026 });
    expect(years[1]!.gain.toString()).toBe('-10');
  });
});
