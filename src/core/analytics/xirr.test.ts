import { describe, expect, it } from 'vitest';
import { xirr, type CashFlow } from './xirr';

const flow = (amount: number, iso: string): CashFlow => ({
  amount,
  when: new Date(iso),
});

describe('xirr', () => {
  it('returns 10% for a one-year 1000 to 1100 investment', () => {
    const rate = xirr([
      flow(-1000, '2021-01-01T00:00:00Z'),
      flow(1100, '2022-01-01T00:00:00Z'),
    ]);
    expect(rate).not.toBeNull();
    expect(rate!).toBeCloseTo(0.1, 4);
  });

  it('doubles over one year gives 100%', () => {
    const rate = xirr([
      flow(-1000, '2021-01-01T00:00:00Z'),
      flow(2000, '2022-01-01T00:00:00Z'),
    ]);
    expect(rate!).toBeCloseTo(1.0, 4);
  });

  it('solves a multi-flow schedule so that npv is zero at the rate', () => {
    const flows = [
      flow(-1000, '2020-01-01T00:00:00Z'),
      flow(-500, '2020-07-01T00:00:00Z'),
      flow(1600, '2021-01-01T00:00:00Z'),
    ];
    const rate = xirr(flows);
    expect(rate).not.toBeNull();

    const origin = new Date('2020-01-01T00:00:00Z');
    const npv = flows.reduce((sum, f) => {
      const years =
        (f.when.getTime() - origin.getTime()) / (365 * 86_400_000);
      return sum + f.amount / (1 + rate!) ** years;
    }, 0);
    expect(Math.abs(npv)).toBeLessThan(1e-4);
  });

  it('handles a loss', () => {
    const rate = xirr([
      flow(-1000, '2021-01-01T00:00:00Z'),
      flow(900, '2022-01-01T00:00:00Z'),
    ]);
    expect(rate!).toBeCloseTo(-0.1, 4);
  });

  it('returns null without both inflow and outflow', () => {
    expect(
      xirr([
        flow(-1000, '2020-01-01T00:00:00Z'),
        flow(-500, '2021-01-01T00:00:00Z'),
      ]),
    ).toBeNull();
  });

  it('converges on a deep loss where Newton would overshoot', () => {
    const rate = xirr([
      flow(-1000, '2020-01-01T00:00:00Z'),
      flow(10, '2021-01-01T00:00:00Z'),
    ]);
    expect(rate).not.toBeNull();
    expect(rate!).toBeLessThan(-0.9);
  });
});
