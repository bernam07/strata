import { describe, expect, it } from 'vitest';
import { portfolioToPriceRows, type T212Position } from './portfolio.ts';
import { invertToEur } from '../fx/frankfurter.ts';

describe('portfolioToPriceRows', () => {
  const positions: T212Position[] = [
    { ticker: 'AAPL_US_EQ', quantity: 2, averagePrice: 100, currentPrice: 150 },
    { ticker: 'UNKNOWN_EQ', quantity: 1, averagePrice: 10, currentPrice: 11 },
  ];

  it('maps resolved positions to price rows with the instrument currency', () => {
    const rows = portfolioToPriceRows(
      'u1',
      '2026-07-31',
      positions,
      (ticker) => (ticker === 'AAPL_US_EQ' ? 'i1' : null),
      () => 'USD',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      user_id: 'u1',
      instrument_id: 'i1',
      as_of: '2026-07-31',
      close: 150,
      currency: 'USD',
    });
  });
});

describe('invertToEur', () => {
  it('inverts EUR-based rates into quote=EUR rows', () => {
    const rows = invertToEur({
      base: 'EUR',
      date: '2026-07-31',
      rates: { USD: 1.25 },
    });
    const usd = rows.find((row) => row.base === 'USD');
    expect(usd?.rate).toBe(0.8);
    expect(usd?.quote).toBe('EUR');
    expect(rows.find((row) => row.base === 'EUR')?.rate).toBe(1);
  });
});
