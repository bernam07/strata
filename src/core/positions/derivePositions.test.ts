import { describe, expect, it } from 'vitest';
import type { Transaction } from '../types';
import { derivePositions, type PriceLookup } from './derivePositions';

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

const noPrice: PriceLookup = () => null;
const eur: () => string = () => '1';

describe('derivePositions', () => {
  it('computes a weighted average cost across two buys', () => {
    const positions = derivePositions(
      [
        trade('i1', '10', '-100', '2026-01-01T00:00:00Z'),
        trade('i1', '10', '-140', '2026-02-01T00:00:00Z'),
      ],
      noPrice,
      eur,
    );
    expect(positions).toHaveLength(1);
    expect(positions[0]!.quantity.toString()).toBe('20');
    expect(positions[0]!.averageCost.toString()).toBe('12');
    expect(positions[0]!.costBasis.toString()).toBe('240');
  });

  it('keeps average cost unchanged after a partial sell', () => {
    const positions = derivePositions(
      [
        trade('i1', '10', '-100', '2026-01-01T00:00:00Z'),
        trade('i1', '-4', '60', '2026-03-01T00:00:00Z'),
      ],
      noPrice,
      eur,
    );
    expect(positions[0]!.quantity.toString()).toBe('6');
    expect(positions[0]!.averageCost.toString()).toBe('10');
    expect(positions[0]!.costBasis.toString()).toBe('60');
  });

  it('drops a fully closed position', () => {
    const positions = derivePositions(
      [
        trade('i1', '10', '-100', '2026-01-01T00:00:00Z'),
        trade('i1', '-10', '130', '2026-03-01T00:00:00Z'),
      ],
      noPrice,
      eur,
    );
    expect(positions).toHaveLength(0);
  });

  it('folds fees into the average cost', () => {
    const positions = derivePositions(
      [trade('i1', '10', '-101', '2026-01-01T00:00:00Z')],
      noPrice,
      eur,
    );
    expect(positions[0]!.averageCost.toString()).toBe('10.1');
  });

  it('computes market value and unrealized gain with a price and fx rate', () => {
    const positions = derivePositions(
      [trade('i1', '10', '-100', '2026-01-01T00:00:00Z')],
      () => ({ close: '15', currency: 'USD' }),
      () => '0.9',
    );
    const position = positions[0]!;
    expect(position.marketValue!.toString()).toBe('135');
    expect(position.unrealized!.toString()).toBe('35');
    expect(position.unrealizedPct).toBeCloseTo(0.35, 10);
  });

  it('leaves market value null without a price', () => {
    const positions = derivePositions(
      [trade('i1', '10', '-100', '2026-01-01T00:00:00Z')],
      noPrice,
      eur,
    );
    expect(positions[0]!.marketValue).toBeNull();
    expect(positions[0]!.unrealized).toBeNull();
  });

  it('processes transactions in chronological order regardless of input order', () => {
    const positions = derivePositions(
      [
        trade('i1', '10', '-140', '2026-02-01T00:00:00Z'),
        trade('i1', '10', '-100', '2026-01-01T00:00:00Z'),
      ],
      noPrice,
      eur,
    );
    expect(positions[0]!.averageCost.toString()).toBe('12');
  });
});
