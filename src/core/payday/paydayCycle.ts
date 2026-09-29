import { useEffect, useState } from 'react';

export type PaydayRuleMode = 'workdays_before_end' | 'day_of_month';

export interface PaydayConfig {
  /** Last payday date selected on the calendar (YYYY-MM-DD) */
  anchorDate: string;
  /** Optional explicit next payday date selected on the calendar (YYYY-MM-DD) */
  customNextDate?: string | null;
  /** How future months should be calculated automatically */
  mode: PaydayRuleMode;
  /** Day of month (1-31) when mode === 'day_of_month' */
  dayOfMonth: number;
  /** Working days before end of month (1-15) when mode === 'workdays_before_end' */
  workdaysBeforeEnd: number;
}

const STORAGE_KEY = 'strata-payday-config-v1';
const CHANGE_EVENT = 'strata-payday-config-changed';

export const toIsoDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const parseIsoDate = (iso: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y = 0, m = 1, d = 1] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
};

// Returns the date corresponding to `workdaysBeforeEnd` working days (Mon–Fri)
// counting backwards from the end of the given month.
export const getPaydayByWorkdaysBeforeEnd = (
  year: number,
  month: number,
  workdaysBeforeEnd = 4,
): Date => {
  const target = Math.max(1, Math.min(20, Math.round(workdaysBeforeEnd)));
  const lastDay = new Date(year, month + 1, 0).getDate();
  let seen = 0;
  for (let d = lastDay; d >= 1; d -= 1) {
    const date = new Date(year, month, d);
    const dow = date.getDay();
    if (dow !== 0 && dow !== 6) {
      seen += 1;
      if (seen === target) return date;
    }
  }
  return new Date(year, month, 1);
};

// Returns the date for a fixed day of month (e.g. 25th). If it falls on a
// weekend (Sat/Sun), shifts to the preceding Friday.
export const getPaydayByDayOfMonth = (
  year: number,
  month: number,
  dayOfMonth = 25,
): Date => {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const clampedDay = Math.max(1, Math.min(lastDay, Math.round(dayOfMonth)));
  const date = new Date(year, month, clampedDay);
  const dow = date.getDay();
  if (dow === 6) {
    // Saturday -> Friday
    date.setDate(date.getDate() - 1);
  } else if (dow === 0) {
    // Sunday -> Friday
    date.setDate(date.getDate() - 2);
  }
  return date;
};

// Given a specific calendar date picked by the user, count how many working
// days from the end of that month it is (1 = last working day of the month).
export const deriveWorkdaysFromEnd = (date: Date): number => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const pickedDay = date.getDate();
  const lastDay = new Date(year, month + 1, 0).getDate();
  let count = 0;
  for (let d = lastDay; d >= pickedDay; d -= 1) {
    const dow = new Date(year, month, d).getDay();
    if (dow !== 0 && dow !== 6) count += 1;
  }
  return Math.max(1, Math.min(20, count));
};

export const countWorkingDaysBetween = (
  startInclusive: Date,
  endExclusive: Date,
): number => {
  const cur = new Date(
    startInclusive.getFullYear(),
    startInclusive.getMonth(),
    startInclusive.getDate(),
  );
  const end = new Date(
    endExclusive.getFullYear(),
    endExclusive.getMonth(),
    endExclusive.getDate(),
  );
  let count = 0;
  while (cur < end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

export const loadPaydayConfig = (now = new Date()): PaydayConfig => {
  const defaultAnchor = toIsoDate(
    getPaydayByWorkdaysBeforeEnd(now.getFullYear(), now.getMonth(), 4),
  );
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        anchorDate: defaultAnchor,
        customNextDate: null,
        mode: 'workdays_before_end',
        dayOfMonth: 25,
        workdaysBeforeEnd: 4,
      };
    }
    const parsed = JSON.parse(raw) as Partial<PaydayConfig>;
    return {
      anchorDate:
        typeof parsed.anchorDate === 'string' && parseIsoDate(parsed.anchorDate)
          ? parsed.anchorDate
          : defaultAnchor,
      customNextDate:
        typeof parsed.customNextDate === 'string' &&
        parseIsoDate(parsed.customNextDate)
          ? parsed.customNextDate
          : null,
      mode:
        parsed.mode === 'day_of_month' ? 'day_of_month' : 'workdays_before_end',
      dayOfMonth:
        typeof parsed.dayOfMonth === 'number' &&
        parsed.dayOfMonth >= 1 &&
        parsed.dayOfMonth <= 31
          ? Math.round(parsed.dayOfMonth)
          : 25,
      workdaysBeforeEnd:
        typeof parsed.workdaysBeforeEnd === 'number' &&
        parsed.workdaysBeforeEnd >= 1 &&
        parsed.workdaysBeforeEnd <= 20
          ? Math.round(parsed.workdaysBeforeEnd)
          : 4,
    };
  } catch {
    return {
      anchorDate: defaultAnchor,
      customNextDate: null,
      mode: 'workdays_before_end',
      dayOfMonth: 25,
      workdaysBeforeEnd: 4,
    };
  }
};

export const savePaydayConfig = (config: PaydayConfig): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
    }
  } catch {
    // ignore storage errors
  }
};

export const getPaydayForMonthFromConfig = (
  year: number,
  month: number,
  config: PaydayConfig,
): Date => {
  if (config.mode === 'day_of_month') {
    return getPaydayByDayOfMonth(year, month, config.dayOfMonth);
  }
  return getPaydayByWorkdaysBeforeEnd(year, month, config.workdaysBeforeEnd);
};

export interface PaydayCycleInfo {
  config: PaydayConfig;
  cycleStart: Date;
  cycleEndInclusive: Date;
  nextPayday: Date;
  cycleStartIso: string;
  cycleEndIso: string;
  nextPaydayIso: string;
  totalWorkingDays: number;
  remainingWorkingDays: number;
  totalCalendarDays: number;
  remainingCalendarDays: number;
  elapsedCalendarDays: number;
}

export const computePaydayCycle = (
  now = new Date(),
  config = loadPaydayConfig(now),
): PaydayCycleInfo => {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const anchor = parseIsoDate(config.anchorDate);

  let cycleStart: Date;
  let nextPayday: Date;

  // If the user picked an anchorDate that is in the same month/year as today
  // (or within the last 35 days and <= today), honor that exact picked date
  // as the current cycle start!
  const diffDaysFromAnchor = anchor
    ? Math.round((today.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  if (anchor && diffDaysFromAnchor >= 0 && diffDaysFromAnchor <= 34) {
    cycleStart = anchor;
    const customNext = config.customNextDate
      ? parseIsoDate(config.customNextDate)
      : null;
    if (customNext && customNext > today) {
      nextPayday = customNext;
    } else {
      // Next payday is in the month following anchorDate (or current month if anchor was early)
      const candidateSameMonth = getPaydayForMonthFromConfig(
        anchor.getFullYear(),
        anchor.getMonth(),
        config,
      );
      if (candidateSameMonth > today && candidateSameMonth > anchor) {
        nextPayday = candidateSameMonth;
      } else {
        nextPayday = getPaydayForMonthFromConfig(
          anchor.getFullYear(),
          anchor.getMonth() + 1,
          config,
        );
      }
    }
  } else {
    // Roll forward automatically for any future month
    const thisMonthPayday = getPaydayForMonthFromConfig(
      today.getFullYear(),
      today.getMonth(),
      config,
    );
    if (today >= thisMonthPayday) {
      cycleStart = thisMonthPayday;
      nextPayday = getPaydayForMonthFromConfig(
        today.getFullYear(),
        today.getMonth() + 1,
        config,
      );
    } else {
      cycleStart = getPaydayForMonthFromConfig(
        today.getFullYear(),
        today.getMonth() - 1,
        config,
      );
      nextPayday = thisMonthPayday;
    }
  }

  const cycleEndInclusive = new Date(
    nextPayday.getFullYear(),
    nextPayday.getMonth(),
    nextPayday.getDate() - 1,
  );

  const totalWorkingDays = Math.max(
    1,
    countWorkingDaysBetween(cycleStart, nextPayday),
  );
  const remainingWorkingDays = Math.max(
    1,
    countWorkingDaysBetween(today, nextPayday),
  );

  const msPerDay = 1000 * 60 * 60 * 24;
  const totalCalendarDays = Math.max(
    1,
    Math.round((nextPayday.getTime() - cycleStart.getTime()) / msPerDay),
  );
  const remainingCalendarDays = Math.max(
    1,
    Math.round((nextPayday.getTime() - today.getTime()) / msPerDay),
  );
  const elapsedCalendarDays = Math.max(
    1,
    totalCalendarDays - remainingCalendarDays + 1,
  );

  return {
    config,
    cycleStart,
    cycleEndInclusive,
    nextPayday,
    cycleStartIso: toIsoDate(cycleStart),
    cycleEndIso: toIsoDate(cycleEndInclusive),
    nextPaydayIso: toIsoDate(nextPayday),
    totalWorkingDays,
    remainingWorkingDays,
    totalCalendarDays,
    remainingCalendarDays,
    elapsedCalendarDays,
  };
};

export const usePaydayCycle = () => {
  const [config, setConfig] = useState<PaydayConfig>(() => loadPaydayConfig());

  useEffect(() => {
    const sync = () => setConfig(loadPaydayConfig());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const updateConfig = (next: PaydayConfig) => {
    savePaydayConfig(next);
    setConfig(next);
  };

  const setPickedPaydayDate = (isoDate: string, modeOverride?: PaydayRuleMode) => {
    const parsed = parseIsoDate(isoDate);
    if (!parsed) return;
    const dayOfMonth = parsed.getDate();
    const workdaysBeforeEnd = deriveWorkdaysFromEnd(parsed);
    const nextConfig: PaydayConfig = {
      anchorDate: isoDate,
      customNextDate: null,
      mode: modeOverride ?? config.mode,
      dayOfMonth,
      workdaysBeforeEnd,
    };
    updateConfig(nextConfig);
  };

  const cycle = computePaydayCycle(new Date(), config);

  return {
    cycle,
    config,
    updateConfig,
    setPickedPaydayDate,
  };
};
