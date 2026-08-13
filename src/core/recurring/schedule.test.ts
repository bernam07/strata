import { describe, expect, it } from 'vitest';
import { dueOccurrences, nextDate } from './schedule';

describe('nextDate', () => {
  it('advances weekly by 7 days across a month boundary', () => {
    expect(nextDate('2026-01-28', 'weekly')).toBe('2026-02-04');
  });

  it('advances monthly and clamps to the last day of a short month', () => {
    expect(nextDate('2026-01-31', 'monthly')).toBe('2026-02-28');
    expect(nextDate('2026-03-31', 'monthly')).toBe('2026-04-30');
  });

  it('advances quarterly and yearly', () => {
    expect(nextDate('2026-01-15', 'quarterly')).toBe('2026-04-15');
    expect(nextDate('2026-02-15', 'yearly')).toBe('2027-02-15');
  });
});

describe('dueOccurrences', () => {
  it('lists every missed run up to today and returns the following run', () => {
    const { dates, nextRun } = dueOccurrences('2026-01-01', '2026-03-10', 'monthly');
    expect(dates).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
    expect(nextRun).toBe('2026-04-01');
  });

  it('returns nothing when the next run is in the future', () => {
    const { dates, nextRun } = dueOccurrences('2026-06-01', '2026-03-10', 'monthly');
    expect(dates).toEqual([]);
    expect(nextRun).toBe('2026-06-01');
  });
});
