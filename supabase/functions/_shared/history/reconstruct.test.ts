import { describe, expect, it } from 'vitest';
import {
  reconstructInvestments,
  type LedgerEntry,
  type PricePoint,
} from './reconstruct.ts';

const prices = (...points: [string, number][]): PricePoint[] =>
  points.map(([date, price]) => ({ date, price }));

describe('reconstructInvestments', () => {
  it('values holdings at the quantity actually held on each date', () => {
    const ledger: LedgerEntry[] = [
      { instrumentId: 'i1', quantity: 10, date: '2026-01-02' },
      { instrumentId: 'i1', quantity: 10, date: '2026-01-04' },
    ];
    const series = reconstructInvestments(
      ledger,
      new Map([
        ['i1', prices(['2026-01-02', 5], ['2026-01-03', 6], ['2026-01-04', 7])],
      ]),
    );
    expect(series).toEqual([
      { date: '2026-01-02', investments: 50 }, // 10 × 5
      { date: '2026-01-03', investments: 60 }, // still 10 × 6
      { date: '2026-01-04', investments: 140 }, // now 20 × 7
    ]);
  });

  it('forward-fills prices across gaps and drops to zero after a full sell', () => {
    const ledger: LedgerEntry[] = [
      { instrumentId: 'i1', quantity: 4, date: '2026-01-02' },
      { instrumentId: 'i1', quantity: -4, date: '2026-01-05' },
    ];
    const series = reconstructInvestments(
      ledger,
      // no price on the 3rd — the 2nd's price carries forward
      new Map([['i1', prices(['2026-01-02', 10], ['2026-01-04', 12], ['2026-01-05', 13])]]),
    );
    expect(series).toEqual([
      { date: '2026-01-02', investments: 40 },
      { date: '2026-01-04', investments: 48 }, // 4 × 12
      // 2026-01-05: sold to zero → dropped (no positive value)
    ]);
  });

  it('ignores dates before an instrument is held and instruments without prices', () => {
    const ledger: LedgerEntry[] = [
      { instrumentId: 'i1', quantity: 2, date: '2026-03-01' },
      { instrumentId: 'i2', quantity: 5, date: '2026-01-01' }, // no price history
    ];
    const series = reconstructInvestments(
      ledger,
      new Map([['i1', prices(['2026-02-01', 100], ['2026-03-01', 110])]]),
    );
    // 2026-02-01 has a price but i1 not yet held → skipped; i2 has no prices → excluded
    expect(series).toEqual([{ date: '2026-03-01', investments: 220 }]);
  });

  it('returns nothing when no instrument can be priced', () => {
    expect(
      reconstructInvestments(
        [{ instrumentId: 'i1', quantity: 1, date: '2026-01-01' }],
        new Map(),
      ),
    ).toEqual([]);
  });
});
