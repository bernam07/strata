import { describe, expect, it } from 'vitest';
import { linkReturns, timeWeightedReturn } from './twr';

describe('linkReturns', () => {
  it('chains sub-period returns geometrically', () => {
    expect(linkReturns([0.1, 0, 0.1])).toBeCloseTo(0.21, 10);
  });

  it('is zero for an empty series', () => {
    expect(linkReturns([])).toBe(0);
  });
});

describe('timeWeightedReturn', () => {
  it('isolates a mid-period deposit from performance', () => {
    const twr = timeWeightedReturn([
      { value: 0, flow: 1000 },
      { value: 1100, flow: 0 },
      { value: 1100, flow: 500 },
      { value: 1760, flow: 0 },
    ]);
    expect(twr).toBeCloseTo(0.21, 10);
  });

  it('matches raw growth when there are no interim flows', () => {
    const twr = timeWeightedReturn([
      { value: 0, flow: 1000 },
      { value: 1250, flow: 0 },
    ]);
    expect(twr).toBeCloseTo(0.25, 10);
  });

  it('reflects a loss', () => {
    const twr = timeWeightedReturn([
      { value: 0, flow: 1000 },
      { value: 800, flow: 0 },
    ]);
    expect(twr).toBeCloseTo(-0.2, 10);
  });

  it('is not distorted by a large late withdrawal', () => {
    const twr = timeWeightedReturn([
      { value: 0, flow: 1000 },
      { value: 1100, flow: -600 },
      { value: 550, flow: 0 },
    ]);
    expect(twr).toBeCloseTo(0.21, 10);
  });
});
