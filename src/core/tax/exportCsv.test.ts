import { describe, expect, it } from 'vitest';
import { money } from '../money/money';
import { realizedDisposals } from './fifo';
import { disposalsToCsv, foreignIncomeToCsv } from './exportCsv';
import type { Transaction } from '../types';

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

describe('disposalsToCsv', () => {
  it('produces a header and one row per disposal', () => {
    const disposals = realizedDisposals([
      trade('i1', '10', '-100', '2025-01-01T00:00:00Z'),
      trade('i1', '-10', '130', '2025-06-01T00:00:00Z'),
    ]);
    const csv = disposalsToCsv(disposals, () => 'Apple Inc.');
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('Gain EUR');
    expect(lines[1]).toBe('Apple Inc.,10,2025-01-01,2025-06-01,100.00,130.00,30.00');
  });

  it('escapes names containing commas', () => {
    const disposals = realizedDisposals([
      trade('i1', '1', '-10', '2025-01-01T00:00:00Z'),
      trade('i1', '-1', '12', '2025-06-01T00:00:00Z'),
    ]);
    const csv = disposalsToCsv(disposals, () => 'Vanguard, S&P 500');
    expect(csv.split('\n')[1]).toContain('"Vanguard, S&P 500"');
  });
});

describe('foreignIncomeToCsv', () => {
  it('writes a header and one row per country with two-decimal values', () => {
    const csv = foreignIncomeToCsv([
      { country: 'US', gain: money('80'), dividends: money('12.5') },
      { country: 'IE', gain: money('-3'), dividends: money('0') },
    ]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Country,Realized gain EUR,Dividends EUR');
    expect(lines[1]).toBe('US,80.00,12.50');
    expect(lines[2]).toBe('IE,-3.00,0.00');
  });
});
