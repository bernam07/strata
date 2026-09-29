import { describe, expect, it } from 'vitest';
import {
  computePaydayCycle,
  deriveWorkdaysFromEnd,
  getPaydayByWorkdaysBeforeEnd,
  getPaydayForMonthFromConfig,
  parseIsoDate,
} from './paydayCycle';

describe('paydayCycle', () => {
  it('computes 4th working day before month-end for September 2026 (25 Sep)', () => {
    // Sep 2026: 30 (Wed, 1st), 29 (Tue, 2nd), 28 (Mon, 3rd), 25 (Fri, 4th)
    const date = getPaydayByWorkdaysBeforeEnd(2026, 8, 4);
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(8);
    expect(date.getDate()).toBe(25);
  });

  it('derives workdays_before_end from a picked calendar date', () => {
    const parsed = parseIsoDate('2026-09-25')!;
    expect(parsed.getDate()).toBe(25);
    expect(deriveWorkdaysFromEnd(parsed)).toBe(4);
  });

  it('shifts weekend day_of_month to the preceding Friday', () => {
    // Oct 25, 2026 is a Sunday -> should shift back to Friday Oct 23, 2026
    const date = getPaydayForMonthFromConfig(2026, 9, {
      mode: 'day_of_month',
      dayOfMonth: 25,
      workdaysBeforeEnd: 4,
      anchorDate: '2026-09-25',
      customNextDate: null,
    });
    expect(date.getDate()).toBe(23);
  });

  it('computes active cycle and remaining working days across month boundaries', () => {
    const cycle = computePaydayCycle(new Date(2026, 8, 29, 12, 0, 0), {
      mode: 'workdays_before_end',
      dayOfMonth: 25,
      workdaysBeforeEnd: 4,
      anchorDate: '2026-09-25',
      customNextDate: null,
    });
    expect(cycle.cycleStartIso).toBe('2026-09-25');
    // Oct 2026: 30 (Fri, 1st), 29 (Thu, 2nd), 28 (Wed, 3rd), 27 (Tue, 4th) -> cycle ends Oct 26
    expect(cycle.nextPaydayIso).toBe('2026-10-27');
    expect(cycle.cycleEndIso).toBe('2026-10-26');
    expect(cycle.remainingWorkingDays).toBeGreaterThan(15);
  });
});
