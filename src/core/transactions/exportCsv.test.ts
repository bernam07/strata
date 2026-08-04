import { describe, expect, it } from 'vitest';
import type { Transaction } from '../types';
import { transactionsToCsv } from './exportCsv';

const base: Transaction = {
  id: 't1',
  accountId: 'a1',
  kind: 'expense',
  amount: '-12.50',
  quantity: null,
  currency: 'EUR',
  fxRate: '1',
  occurredAt: '2026-02-01T12:00:00.000Z',
  note: null,
  source: 'manual',
  externalId: null,
  transferGroupId: null,
  instrumentId: null,
  createdAt: '2026-02-01T12:00:00.000Z',
};

const accountName = () => 'Revolut';
const instrumentName = () => 'Apple';

describe('transactionsToCsv', () => {
  it('writes a header and one row per transaction, newest first', () => {
    const csv = transactionsToCsv(
      [
        { ...base, id: 'old', occurredAt: '2026-01-01T12:00:00.000Z' },
        { ...base, id: 'new', occurredAt: '2026-03-01T12:00:00.000Z' },
      ],
      accountName,
      instrumentName,
    );
    const lines = csv.split('\n');
    expect(lines[0]).toContain('Date,Kind,Amount EUR');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('2026-03-01');
    expect(lines[2]).toContain('2026-01-01');
  });

  it('escapes commas and quotes in notes', () => {
    const csv = transactionsToCsv(
      [{ ...base, note: 'Coffee, "large"' }],
      accountName,
      instrumentName,
    );
    expect(csv).toContain('"Coffee, ""large"""');
  });

  it('formats amount to two decimals and includes instrument for trades', () => {
    const csv = transactionsToCsv(
      [{ ...base, kind: 'buy', amount: '-100', quantity: '3', instrumentId: 'i1' }],
      accountName,
      instrumentName,
    );
    expect(csv).toContain('-100.00,Revolut,Apple,3');
  });
});
