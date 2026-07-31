import { describe, expect, it } from 'vitest';
import {
  inferCadence,
  projectDividends,
  type ReceivedDividend,
} from './projectDividends';

const received = (
  instrumentId: string,
  amount: string,
  paidAt: string,
): ReceivedDividend => ({ instrumentId, amount, paidAt });

describe('inferCadence', () => {
  it('detects quarterly from ~91 day gaps', () => {
    expect(
      inferCadence([
        '2025-01-01T00:00:00Z',
        '2025-04-02T00:00:00Z',
        '2025-07-02T00:00:00Z',
        '2025-10-01T00:00:00Z',
      ]),
    ).toBe('quarterly');
  });

  it('detects monthly', () => {
    expect(
      inferCadence([
        '2025-01-01T00:00:00Z',
        '2025-02-01T00:00:00Z',
        '2025-03-01T00:00:00Z',
      ]),
    ).toBe('monthly');
  });

  it('detects annual', () => {
    expect(
      inferCadence(['2023-05-01T00:00:00Z', '2024-05-01T00:00:00Z']),
    ).toBe('annual');
  });

  it('returns irregular with a single payment', () => {
    expect(inferCadence(['2025-01-01T00:00:00Z'])).toBe('irregular');
  });
});

describe('projectDividends', () => {
  it('projects the next quarterly payments within the horizon', () => {
    const history: ReceivedDividend[] = [
      received('i1', '5', '2026-01-01T00:00:00Z'),
      received('i1', '5', '2026-04-02T00:00:00Z'),
      received('i1', '5', '2026-07-02T00:00:00Z'),
    ];
    const expected = projectDividends(history, 200, new Date('2026-07-15T00:00:00Z'));
    expect(expected.length).toBeGreaterThanOrEqual(1);
    expect(expected[0]!.cadence).toBe('quarterly');
    expect(expected[0]!.estimated).toBe(true);
    expect(expected[0]!.estimatedAmount).toBe('5');
    expect(new Date(expected[0]!.expectedAt).getTime()).toBeGreaterThan(
      new Date('2026-07-15T00:00:00Z').getTime(),
    );
  });

  it('skips instruments with irregular history', () => {
    const expected = projectDividends(
      [received('i1', '5', '2026-01-01T00:00:00Z')],
      365,
      new Date('2026-02-01T00:00:00Z'),
    );
    expect(expected).toHaveLength(0);
  });

  it('does not project past dates', () => {
    const history: ReceivedDividend[] = [
      received('i1', '3', '2025-01-01T00:00:00Z'),
      received('i1', '3', '2025-07-01T00:00:00Z'),
    ];
    const expected = projectDividends(history, 400, new Date('2026-06-01T00:00:00Z'));
    for (const dividend of expected) {
      expect(new Date(dividend.expectedAt).getTime()).toBeGreaterThanOrEqual(
        new Date('2026-06-01T00:00:00Z').getTime(),
      );
    }
  });
});
