import { describe, expect, it } from 'vitest';
import type { Transaction } from '../types';
import { buildInsights } from './insights';

const fmt = (n: number) => `€${Math.round(n)}`;
const now = new Date('2026-08-15T12:00:00Z');

const tx = (
  amount: string,
  occurredAt: string,
  kind: Transaction['kind'],
  overrides: Partial<Transaction> = {},
): Transaction => ({
  id: crypto.randomUUID(),
  accountId: 'acc',
  kind,
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

describe('buildInsights', () => {
  it('reports savings and dividends for the current month', () => {
    const insights = buildInsights({
      now,
      transactions: [
        tx('2000', '2026-08-01T10:00:00Z', 'income'),
        tx('-500', '2026-08-05T10:00:00Z', 'expense'),
        tx('30', '2026-08-06T10:00:00Z', 'dividend'),
      ],
      cash: 0,
      investments: 0,
      fmt,
    });
    const saved = insights.find((i) => i.id === 'saved');
    expect(saved).toMatchObject({ tone: 'positive' });
    expect(saved!.text).toContain('€1530'); // 2000 + 30 − 500
    expect(insights.find((i) => i.id === 'dividends')?.tone).toBe('positive');
  });

  it('flags a spending spike vs the 3-month average', () => {
    const insights = buildInsights({
      now,
      transactions: [
        tx('-400', '2026-07-10T10:00:00Z', 'expense'), // last month
        tx('-100', '2026-06-10T10:00:00Z', 'expense'),
        tx('-100', '2026-05-10T10:00:00Z', 'expense'),
        tx('-100', '2026-04-10T10:00:00Z', 'expense'),
      ],
      cash: 0,
      investments: 0,
      fmt,
    });
    const trend = insights.find((i) => i.id === 'spend-trend');
    expect(trend).toMatchObject({ tone: 'negative' });
    expect(trend!.text).toContain('300%'); // 400 vs avg 100
  });

  it('nudges when too much sits in cash', () => {
    const insights = buildInsights({
      now,
      transactions: [],
      cash: 6000,
      investments: 4000,
      fmt,
    });
    expect(insights.find((i) => i.id === 'cash-idle')).toMatchObject({
      tone: 'neutral',
    });
  });

  it('stays quiet when cash is a small share', () => {
    const insights = buildInsights({
      now,
      transactions: [],
      cash: 1000,
      investments: 20000,
      fmt,
    });
    expect(insights.find((i) => i.id === 'cash-idle')).toBeUndefined();
  });
});
