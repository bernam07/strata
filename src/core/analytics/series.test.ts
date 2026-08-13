import { describe, expect, it } from 'vitest';
import type { Transaction } from '../types';
import {
  externalCashFlows,
  geographyFromIsin,
  investedAtCostSeries,
  netWorthAtCostSeries,
  valuationPoints,
  weightBy,
  yearlyBreakdown,
} from './series';
import { timeWeightedReturn } from './twr';
import { xirr } from './xirr';

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

describe('netWorthAtCostSeries', () => {
  it('tracks cash movements cumulatively', () => {
    const series = netWorthAtCostSeries([
      tx('100', '2026-01-01T10:00:00Z'),
      tx('-30', '2026-01-02T10:00:00Z', { kind: 'expense' }),
    ]);
    expect(series).toEqual([
      { date: '2026-01-01', value: 100 },
      { date: '2026-01-02', value: 70 },
    ]);
  });

  it('keeps net worth flat when cash converts to a holding at cost', () => {
    const series = netWorthAtCostSeries([
      tx('1000', '2026-01-01T10:00:00Z'),
      tx('-500', '2026-01-05T10:00:00Z', {
        kind: 'buy',
        quantity: '5',
        instrumentId: 'i1',
      }),
    ]);
    expect(series[1]!.value).toBe(1000);
  });

  it('books realized gains on a sale above cost', () => {
    const series = netWorthAtCostSeries([
      tx('1000', '2026-01-01T10:00:00Z'),
      tx('-500', '2026-01-05T10:00:00Z', {
        kind: 'buy',
        quantity: '5',
        instrumentId: 'i1',
      }),
      tx('650', '2026-02-01T10:00:00Z', {
        kind: 'sell',
        quantity: '-5',
        instrumentId: 'i1',
      }),
    ]);
    expect(series[2]!.value).toBe(1150);
  });

  it('collapses same-day transactions to the closing value', () => {
    const series = netWorthAtCostSeries([
      tx('100', '2026-01-01T09:00:00Z'),
      tx('50', '2026-01-01T18:00:00Z', { kind: 'income' }),
    ]);
    expect(series).toEqual([{ date: '2026-01-01', value: 150 }]);
  });
});

describe('investedAtCostSeries', () => {
  it('tracks only the cost basis of holdings, ignoring cash', () => {
    const series = investedAtCostSeries([
      tx('1000', '2026-01-01T10:00:00Z'),
      tx('-500', '2026-01-05T10:00:00Z', {
        kind: 'buy',
        quantity: '5',
        instrumentId: 'i1',
      }),
      tx('-200', '2026-01-06T10:00:00Z', {
        kind: 'buy',
        quantity: '2',
        instrumentId: 'i2',
      }),
    ]);
    // Pure cash deposit adds no investment point; buys build up cost basis.
    expect(series).toEqual([
      { date: '2026-01-05', value: 500 },
      { date: '2026-01-06', value: 700 },
    ]);
  });

  it('drops back down when a holding is sold off', () => {
    const series = investedAtCostSeries([
      tx('-500', '2026-01-05T10:00:00Z', {
        kind: 'buy',
        quantity: '5',
        instrumentId: 'i1',
      }),
      tx('650', '2026-02-01T10:00:00Z', {
        kind: 'sell',
        quantity: '-5',
        instrumentId: 'i1',
      }),
    ]);
    expect(series).toEqual([
      { date: '2026-01-05', value: 500 },
      { date: '2026-02-01', value: 0 },
    ]);
  });
});

describe('yearlyBreakdown', () => {
  it('groups flows by calendar year', () => {
    const rows = yearlyBreakdown([
      tx('1000', '2025-03-01T00:00:00Z'),
      tx('-40', '2025-06-01T00:00:00Z', { kind: 'expense' }),
      tx('12', '2026-02-01T00:00:00Z', { kind: 'dividend' }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ year: 2025, deposits: 1000, expenses: -40 });
    expect(rows[1]).toMatchObject({ year: 2026, dividends: 12 });
  });
});

describe('weightBy', () => {
  it('computes weights from positive values', () => {
    const slices = weightBy(
      [
        { g: 'US', v: 75 },
        { g: 'IE', v: 25 },
      ],
      (item) => item.g,
      (item) => item.v,
    );
    expect(slices[0]).toEqual({ group: 'US', value: 75, weight: 0.75 });
    expect(slices[1]).toEqual({ group: 'IE', value: 25, weight: 0.25 });
  });
});

describe('valuationPoints wiring', () => {
  it('feeds timeWeightedReturn so a mid-period deposit is isolated', () => {
    const transactions = [
      tx('1000', '2026-01-01T10:00:00Z'),
      tx('100', '2026-02-01T10:00:00Z', { kind: 'dividend' }),
      tx('500', '2026-03-01T10:00:00Z'),
      tx('60', '2026-04-01T10:00:00Z', { kind: 'dividend' }),
    ];
    const points = valuationPoints(transactions);
    const twr = timeWeightedReturn(points);
    expect(twr).toBeCloseTo(0.14125, 6);
  });
});

describe('externalCashFlows wiring', () => {
  it('feeds xirr with contributions negative and terminal value positive', () => {
    const transactions = [tx('1000', '2021-01-01T00:00:00Z')];
    const flows = externalCashFlows(
      transactions,
      1100,
      new Date('2022-01-01T00:00:00Z'),
    );
    const rate = xirr(flows);
    expect(rate).not.toBeNull();
    expect(rate!).toBeCloseTo(0.1, 4);
  });
});

describe('geographyFromIsin', () => {
  it('reads the country prefix', () => {
    expect(geographyFromIsin('US0378331005')).toBe('US');
    expect(geographyFromIsin('IE00B3XXRP09')).toBe('IE');
    expect(geographyFromIsin(null)).toBe('Desconhecido');
  });
});
