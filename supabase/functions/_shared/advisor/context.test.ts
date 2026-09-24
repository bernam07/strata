import { describe, expect, it } from 'vitest';
import {
  detectSources,
  enrichAdvisorContext,
  type RawAdvisorData,
} from './context.ts';

describe('enrichAdvisorContext', () => {
  it('enriches holdings with ticker, name and sector from instruments', () => {
    const raw: RawAdvisorData = {
      accounts: [
        {
          name: 'Main Checking',
          type: 'cash',
          currency: 'EUR',
          institution_id: 'activobank',
        },
      ],
      transactions: [
        {
          id: 'tx-1',
          kind: 'expense',
          amount: '-45.50',
          currency: 'EUR',
          occurred_at: '2026-09-20T12:00:00Z',
          note: 'Groceries',
          source: 'manual',
          instrument_id: null,
        },
      ],
      holdings: [
        {
          instrument_id: 'inst-1',
          quantity: '10',
          average_price: '150.00',
          current_price: '180.00',
          previous_close: '178.00',
          currency: 'USD',
          updated_at: '2026-09-24T18:00:00Z',
        },
      ],
      instruments: [
        {
          id: 'inst-1',
          ticker: 'AAPL',
          name: 'Apple Inc.',
          currency: 'USD',
          sector: 'Technology',
        },
      ],
      snapshots: [
        {
          as_of: '2026-09-24',
          net: '50000',
          assets: '55000',
          liabilities: '5000',
          investments: '35000',
        },
      ],
      brokers: [
        {
          provider: 'trading212',
          free: '1000',
          invested: '34000',
          ppl: '5000',
          total: '35000',
          currency: 'EUR',
          updated_at: '2026-09-24T18:00:00Z',
        },
      ],
      crypto: [
        {
          symbol: 'BTC',
          name: 'Bitcoin',
          quantity: '0.25',
          current_price: '60000',
          currency: 'EUR',
        },
      ],
      categories: [
        {
          id: 'cat-food',
          name: 'Food & Dining',
          type: 'expense',
        },
      ],
      txCategories: [
        {
          transaction_id: 'tx-1',
          category_id: 'cat-food',
        },
      ],
      budgets: [
        {
          category_id: 'cat-food',
          amount_limit: '500',
          period: 'monthly',
          currency: 'EUR',
        },
      ],
    };

    const result = enrichAdvisorContext(raw);

    expect(result.holdings).toHaveLength(1);
    expect(result.holdings[0]).toEqual({
      ticker: 'AAPL',
      name: 'Apple Inc.',
      sector: 'Technology',
      quantity: '10',
      averagePrice: '150.00',
      currentPrice: '180.00',
      currency: 'USD',
    });

    expect(result.crypto).toHaveLength(1);
    expect(result.crypto[0].symbol).toBe('BTC');

    expect(result.recentTransactions).toHaveLength(1);
    expect(result.recentTransactions[0].category).toBe('Food & Dining');

    expect(result.budgets).toHaveLength(1);
    expect(result.budgets[0].category).toBe('Food & Dining');
    expect(result.budgets[0].limit).toBe('500');

    expect(result.accounts).toHaveLength(1);
    expect(result.accounts[0].institution).toBe('activobank');
  });
});

describe('detectSources', () => {
  it('detects relevant sections from response text', () => {
    const sources = detectSources(
      'O teu património líquido total é de 50.000€ com grande alocação em [Portfolio] e tens 0.25 [Crypto].',
    );
    const paths = sources.map((s) => s.path);
    expect(paths).toContain('/');
    expect(paths).toContain('/positions');
    expect(paths).toContain('/crypto');
  });

  it('falls back to default sources when nothing specific matches', () => {
    const sources = detectSources('Olá! Tudo bem?');
    expect(sources.map((s) => s.path)).toEqual([
      '/',
      '/positions',
      '/transactions',
    ]);
  });
});
