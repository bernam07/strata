import { describe, expect, it } from 'vitest';
import { appendPriceSnapshot, type PriceSnapshot } from './useCollectibles';

describe('appendPriceSnapshot', () => {
  it('initializes history with purchase price if history is empty', () => {
    const history = appendPriceSnapshot(
      [],
      150.0,
      'collectr',
      { date: '2026-01-01T00:00:00Z', price: 100.0 },
    );

    expect(history.length).toBe(2);
    expect(history[0]).toEqual({
      date: '2026-01-01T00:00:00Z',
      price: 100.0,
      source: 'purchase',
    });
    expect(history[1]?.price).toBe(150.0);
    expect(history[1]?.source).toBe('collectr');
  });

  it('does not duplicate record if price is identical to last recorded price', () => {
    const existing: PriceSnapshot[] = [
      { date: '2026-01-01T00:00:00Z', price: 100.0, source: 'purchase' },
      { date: '2026-01-02T00:00:00Z', price: 150.0, source: 'collectr' },
    ];

    const history = appendPriceSnapshot(existing, 150.0, 'collectr');
    expect(history.length).toBe(2);
    expect(history[1]?.price).toBe(150.0);
  });

  it('appends new price when value changes', () => {
    const existing: PriceSnapshot[] = [
      { date: '2026-01-01T00:00:00Z', price: 100.0, source: 'purchase' },
    ];

    const history = appendPriceSnapshot(existing, 125.5, 'brickset');
    expect(history.length).toBe(2);
    expect(history[1]?.price).toBe(125.5);
    expect(history[1]?.source).toBe('brickset');
  });

  it('caps history list at 60 items', () => {
    const largeHistory: PriceSnapshot[] = Array.from({ length: 65 }, (_, i) => ({
      date: `2026-01-01T00:0${i}:00Z`,
      price: i + 1,
      source: 'sync',
    }));

    const result = appendPriceSnapshot(largeHistory, 999.0, 'sync');
    expect(result.length).toBe(60);
    expect(result[result.length - 1]?.price).toBe(999.0);
  });
});
