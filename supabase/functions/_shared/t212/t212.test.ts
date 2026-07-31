import { describe, expect, it } from 'vitest';
import { parseT212Ticker, round4 } from './normalize.ts';
import { backoffDelayMs, retryAfterMs } from './backoff.ts';
import { extractCursor } from './cursor.ts';
import {
  cashTransactionToRow,
  dividendToTransactionRow,
  orderToTransactionRow,
  toInstrumentRow,
} from './map.ts';
import type {
  T212CashTransaction,
  T212Dividend,
  T212Instrument,
  T212Order,
} from './types.ts';

const resolver = (map: Record<string, string>) => (ticker: string) =>
  map[ticker] ?? null;

describe('parseT212Ticker', () => {
  it('splits symbol, market and kind', () => {
    expect(parseT212Ticker('AAPL_US_EQ')).toEqual({
      symbol: 'AAPL',
      market: 'US',
      kind: 'EQ',
    });
  });

  it('handles symbols with underscores', () => {
    expect(parseT212Ticker('BRK_B_US_EQ')).toEqual({
      symbol: 'BRK_B',
      market: 'US',
      kind: 'EQ',
    });
  });

  it('handles two-segment tickers', () => {
    expect(parseT212Ticker('VUSA_EQ')).toEqual({
      symbol: 'VUSA',
      market: null,
      kind: 'EQ',
    });
  });
});

describe('backoff', () => {
  it('grows exponentially and caps', () => {
    expect(backoffDelayMs(0, 1000, 60000)).toBe(1000);
    expect(backoffDelayMs(3, 1000, 60000)).toBe(8000);
    expect(backoffDelayMs(10, 1000, 60000)).toBe(60000);
  });

  it('honours a numeric Retry-After header', () => {
    expect(retryAfterMs('30', 1000)).toBe(30000);
  });

  it('falls back when the header is absent', () => {
    expect(retryAfterMs(null, 1234)).toBe(1234);
  });
});

describe('extractCursor', () => {
  it('reads the cursor from a next page path', () => {
    expect(
      extractCursor('/api/v0/history/orders?cursor=abc123&limit=50'),
    ).toBe('abc123');
  });

  it('returns null when there is no next page', () => {
    expect(extractCursor(null)).toBeNull();
  });
});

describe('order mapping', () => {
  const order: T212Order = {
    id: 42,
    ticker: 'AAPL_US_EQ',
    filledQuantity: 2,
    filledValue: 300,
    fillPrice: 150,
    taxes: [{ name: 'stamp', quantity: 1.5 }],
    dateExecuted: '2026-01-02T10:00:00Z',
  };

  it('maps a buy to a negative amount including taxes', () => {
    const row = orderToTransactionRow('u1', 'acc', order, resolver({ AAPL_US_EQ: 'i1' }));
    expect(row.kind).toBe('buy');
    expect(row.amount).toBe(-301.5);
    expect(row.quantity).toBe(2);
    expect(row.instrument_id).toBe('i1');
    expect(row.external_id).toBe('order:42');
  });

  it('maps a sell to a positive amount net of taxes', () => {
    const row = orderToTransactionRow(
      'u1',
      'acc',
      { ...order, filledQuantity: -2 },
      resolver({}),
    );
    expect(row.kind).toBe('sell');
    expect(row.amount).toBe(298.5);
    expect(row.quantity).toBe(-2);
    expect(row.instrument_id).toBeNull();
  });
});

describe('dividend mapping', () => {
  it('uses the euro amount and derives the fx rate', () => {
    const dividend: T212Dividend = {
      reference: 'div-9',
      ticker: 'AAPL_US_EQ',
      quantity: 2,
      amount: 2,
      amountInEuro: 1.8,
      paidOn: '2026-03-01T00:00:00Z',
    };
    const row = dividendToTransactionRow('u1', 'acc', dividend, resolver({}));
    expect(row.kind).toBe('dividend');
    expect(row.amount).toBe(1.8);
    expect(row.fx_rate).toBe(0.9);
    expect(row.external_id).toBe('dividend:div-9');
  });
});

describe('cash mapping', () => {
  it('maps a deposit', () => {
    const cash: T212CashTransaction = {
      reference: 'c1',
      dateTime: '2026-01-01T00:00:00Z',
      amount: 100,
      type: 'DEPOSIT',
    };
    const row = cashTransactionToRow('u1', 'acc', cash);
    expect(row.kind).toBe('deposit');
    expect(row.amount).toBe(100);
    expect(row.external_id).toBe('cash:c1');
  });

  it('maps unknown types to an adjustment', () => {
    const row = cashTransactionToRow('u1', 'acc', {
      reference: 'c2',
      dateTime: '2026-01-01T00:00:00Z',
      amount: -5,
      type: 'CARD_DEBIT',
    });
    expect(row.kind).toBe('adjustment');
    expect(row.amount).toBe(-5);
  });
});

describe('instrument mapping', () => {
  it('extracts the plain ticker and keeps the t212 ticker', () => {
    const instrument: T212Instrument = {
      ticker: 'AAPL_US_EQ',
      isin: 'US0378331005',
      name: 'Apple Inc.',
      currencyCode: 'USD',
    };
    const row = toInstrumentRow('u1', instrument);
    expect(row.ticker).toBe('AAPL');
    expect(row.t212_ticker).toBe('AAPL_US_EQ');
    expect(row.isin).toBe('US0378331005');
    expect(row.currency).toBe('USD');
  });
});

describe('round4', () => {
  it('avoids float drift', () => {
    expect(round4(-(300 + 1.5))).toBe(-301.5);
    expect(round4(0.1 + 0.2)).toBe(0.3);
  });
});
