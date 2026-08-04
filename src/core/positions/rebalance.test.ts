import { describe, expect, it } from 'vitest';
import { rebalanceRows } from './rebalance';

describe('rebalanceRows', () => {
  it('computes drift weight and value against targets', () => {
    const targets: Record<string, number> = { a: 0.6, b: 0.4 };
    const rows = rebalanceRows(
      [
        { instrumentId: 'a', value: 700 },
        { instrumentId: 'b', value: 300 },
      ],
      (id) => targets[id],
      1000,
    );
    const a = rows.find((r) => r.instrumentId === 'a')!;
    expect(a.currentWeight).toBeCloseTo(0.7);
    expect(a.driftWeight).toBeCloseTo(-0.1);
    expect(a.driftValue).toBeCloseTo(-100);
    const b = rows.find((r) => r.instrumentId === 'b')!;
    expect(b.driftValue).toBeCloseTo(100);
  });

  it('skips positions without a target and sorts by absolute drift', () => {
    const targets: Record<string, number> = { a: 0.5 };
    const rows = rebalanceRows(
      [
        { instrumentId: 'a', value: 100 },
        { instrumentId: 'b', value: 900 },
      ],
      (id) => targets[id],
      1000,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.instrumentId).toBe('a');
    expect(rows[0]!.driftValue).toBeCloseTo(400);
  });
});
