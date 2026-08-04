import { describe, expect, it } from 'vitest';
import { money } from '../money/money';
import type { Transaction } from '../types';
import type { Disposal } from './fifo';
import { dividendsByCountry, gainsByCountry, isForeign } from './anexoJ';

const disposal = (instrumentId: string, gain: string): Disposal => ({
  instrumentId,
  quantity: money('1'),
  acquiredAt: '2025-01-01T00:00:00Z',
  disposedAt: '2026-01-01T00:00:00Z',
  cost: money('100'),
  proceeds: money(String(100 + Number(gain))),
  gain: money(gain),
});

const country = (id: string) =>
  ({ apple: 'US', nvidia: 'US', edp: 'PT' })[id] ?? 'Unknown';

describe('gainsByCountry', () => {
  it('aggregates disposals by country and sorts by gain', () => {
    const rows = gainsByCountry(
      [disposal('apple', '50'), disposal('nvidia', '30'), disposal('edp', '10')],
      country,
    );
    expect(rows[0]!.country).toBe('US');
    expect(rows[0]!.gain.toString()).toBe('80');
    expect(rows[0]!.count).toBe(2);
    expect(rows[1]!.country).toBe('PT');
  });
});

describe('dividendsByCountry', () => {
  it('sums gross dividends per country', () => {
    const div = (id: string, amount: string): Transaction => ({
      id: `${id}-${amount}`,
      accountId: 'a',
      kind: 'dividend',
      amount,
      quantity: null,
      currency: 'EUR',
      fxRate: '1',
      occurredAt: '2026-03-01T00:00:00Z',
      note: null,
      source: 't212_sync',
      externalId: null,
      transferGroupId: null,
      instrumentId: id,
      createdAt: '2026-03-01T00:00:00Z',
    });
    const rows = dividendsByCountry([div('apple', '5'), div('edp', '3')], country);
    expect(rows.find((r) => r.country === 'US')!.gross.toString()).toBe('5');
    expect(rows.find((r) => r.country === 'PT')!.gross.toString()).toBe('3');
  });
});

describe('isForeign', () => {
  it('treats non-PT known countries as foreign', () => {
    expect(isForeign('US')).toBe(true);
    expect(isForeign('PT')).toBe(false);
    expect(isForeign('Unknown')).toBe(false);
  });
});
