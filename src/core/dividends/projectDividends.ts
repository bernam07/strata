export interface ReceivedDividend {
  instrumentId: string;
  amount: string;
  paidAt: string;
}

export type DividendCadence =
  | 'monthly'
  | 'quarterly'
  | 'semiannual'
  | 'annual'
  | 'irregular';

export interface ExpectedDividend {
  instrumentId: string;
  expectedAt: string;
  estimatedAmount: string;
  cadence: DividendCadence;
  estimated: true;
  exDividendAt?: string;
  confirmedDate?: boolean;
}

const DAY = 86_400_000;

export const cadenceFromDays = (days: number): DividendCadence => {
  if (days <= 45) return 'monthly';
  if (days <= 135) return 'quarterly';
  if (days <= 225) return 'semiannual';
  if (days <= 400) return 'annual';
  return 'irregular';
};

export const cadenceDays: Record<Exclude<DividendCadence, 'irregular'>, number> = {
  monthly: 30,
  quarterly: 91,
  semiannual: 182,
  annual: 365,
};

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
};

export const inferCadence = (paidDates: readonly string[]): DividendCadence => {
  if (paidDates.length < 2) return 'irregular';
  const times = [...paidDates].map((date) => Date.parse(date)).sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < times.length; i += 1) {
    gaps.push((times[i]! - times[i - 1]!) / DAY);
  }
  return cadenceFromDays(median(gaps));
};

export const projectDividends = (
  history: readonly ReceivedDividend[],
  horizon: number,
  now: Date,
): ExpectedDividend[] => {
  const byInstrument = new Map<string, ReceivedDividend[]>();
  for (const dividend of history) {
    const bucket = byInstrument.get(dividend.instrumentId) ?? [];
    bucket.push(dividend);
    byInstrument.set(dividend.instrumentId, bucket);
  }

  const expected: ExpectedDividend[] = [];
  for (const [instrumentId, entries] of byInstrument) {
    const sorted = [...entries].sort((a, b) =>
      a.paidAt < b.paidAt ? -1 : a.paidAt > b.paidAt ? 1 : 0,
    );
    const cadence = inferCadence(sorted.map((entry) => entry.paidAt));
    if (cadence === 'irregular') continue;

    const last = sorted[sorted.length - 1]!;
    const step = cadenceDays[cadence] * DAY;
    let next = Date.parse(last.paidAt) + step;
    const limit = now.getTime() + horizon * DAY;

    while (next <= limit) {
      if (next >= now.getTime()) {
        expected.push({
          instrumentId,
          expectedAt: new Date(next).toISOString(),
          estimatedAmount: last.amount,
          cadence,
          estimated: true,
        });
      }
      next += step;
    }
  }

  return expected;
};

export interface HoldingDividendInput {
  instrumentId: string;
  marketValueEur: number;
  quantity: number;
  currency?: string;
  profile?: {
    dividendDate: string | null;
    exDividendDate: string | null;
    dividendYield: number | null;
    dividendRate: number | null;
    currency: string | null;
  } | null;
}

/**
 * Projects upcoming dividend payments across the portfolio combining:
 * 1. Historical received dividends
 * 2. Current holding positions & market values
 * 3. Live market profile dividend schedules (dividendDate, exDividendDate, dividendYield, dividendRate)
 */
export const projectPortfolioDividends = (
  history: readonly ReceivedDividend[],
  holdings: readonly HoldingDividendInput[],
  horizon: number,
  now: Date,
): ExpectedDividend[] => {
  const byInstrumentHistory = new Map<string, ReceivedDividend[]>();
  for (const dividend of history) {
    const bucket = byInstrumentHistory.get(dividend.instrumentId) ?? [];
    bucket.push(dividend);
    byInstrumentHistory.set(dividend.instrumentId, bucket);
  }

  const holdingsMap = new Map<string, HoldingDividendInput>(
    holdings.map((h) => [h.instrumentId, h]),
  );

  // If holdings are provided, prioritize held instruments. Otherwise fallback to historical instruments.
  const instrumentIds =
    holdings.length > 0
      ? [...new Set([...holdings.map((h) => h.instrumentId)])]
      : [...byInstrumentHistory.keys()];

  const expected: ExpectedDividend[] = [];
  const todayMs = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const limitMs = todayMs + horizon * DAY;

  for (const instrumentId of instrumentIds) {
    const rawEntries = byInstrumentHistory.get(instrumentId) ?? [];
    const entries = [...rawEntries].sort((a, b) =>
      a.paidAt < b.paidAt ? -1 : a.paidAt > b.paidAt ? 1 : 0,
    );
    const holding = holdingsMap.get(instrumentId);
    const profile = holding?.profile;

    const hasMarketYield =
      (profile?.dividendYield ?? 0) > 0 || (profile?.dividendRate ?? 0) > 0;
    const hasMarketDates =
      Boolean(profile?.dividendDate) || Boolean(profile?.exDividendDate);
    const hasHistory = entries.length > 0;

    // Skip instruments that do not pay dividends
    if (!hasHistory && !hasMarketYield && !hasMarketDates) {
      continue;
    }

    // Determine cadence
    let cadence: Exclude<DividendCadence, 'irregular'> = 'quarterly';
    if (entries.length >= 2) {
      const inferred = inferCadence(entries.map((e) => e.paidAt));
      if (inferred !== 'irregular') cadence = inferred;
    } else if (entries.length === 1) {
      const last = entries[0]!;
      const singleAmt = Number(last.amount);
      const annualEst =
        (profile?.dividendYield ?? 0) > 0 && (holding?.marketValueEur ?? 0) > 0
          ? holding!.marketValueEur * profile!.dividendYield!
          : 0;
      if (annualEst > 0 && singleAmt > 0) {
        const freq = annualEst / singleAmt;
        if (freq >= 8) cadence = 'monthly';
        else if (freq >= 2.8) cadence = 'quarterly';
        else if (freq >= 1.5) cadence = 'semiannual';
        else cadence = 'annual';
      }
    }

    const step = cadenceDays[cadence] * DAY;
    const paymentsPerYear =
      cadence === 'monthly' ? 12 : cadence === 'semiannual' ? 2 : cadence === 'annual' ? 1 : 4;

    // Estimate per-payout amount in EUR
    let estimatedAmountNum = 0;
    const profileAnnualEur =
      (profile?.dividendYield ?? 0) > 0 && (holding?.marketValueEur ?? 0) > 0
        ? holding!.marketValueEur * profile!.dividendYield!
        : (profile?.dividendRate ?? 0) > 0 && (holding?.quantity ?? 0) > 0
          ? holding!.quantity * profile!.dividendRate!
          : 0;

    if (entries.length > 0) {
      const lastAmt = Number(entries[entries.length - 1]!.amount);
      estimatedAmountNum =
        lastAmt > 0 ? lastAmt : profileAnnualEur > 0 ? profileAnnualEur / paymentsPerYear : 0;
    } else if (profileAnnualEur > 0) {
      estimatedAmountNum = profileAnnualEur / paymentsPerYear;
    }

    const estimatedAmount = estimatedAmountNum > 0 ? estimatedAmountNum.toFixed(2) : '0';

    // Parse market dates if provided
    const parsedDivMs = profile?.dividendDate
      ? Date.parse(`${profile.dividendDate}T00:00:00Z`)
      : NaN;
    const parsedExMs = profile?.exDividendDate
      ? Date.parse(`${profile.exDividendDate}T00:00:00Z`)
      : NaN;
    const lastPaidMs = entries.length > 0 ? Date.parse(entries[entries.length - 1]!.paidAt) : NaN;

    const addedTimestamps = new Set<number>();

    // Strategy 1: Confirmed or projected future dividend date from market profile
    if (Number.isFinite(parsedDivMs) && parsedDivMs >= todayMs && parsedDivMs <= limitMs) {
      expected.push({
        instrumentId,
        expectedAt: new Date(parsedDivMs).toISOString(),
        estimatedAmount,
        cadence,
        estimated: true,
        exDividendAt: profile?.exDividendDate ?? undefined,
        confirmedDate: true,
      });
      addedTimestamps.add(parsedDivMs);

      // Step forward for the rest of the 12-month horizon
      let next = parsedDivMs + step;
      while (next <= limitMs) {
        expected.push({
          instrumentId,
          expectedAt: new Date(next).toISOString(),
          estimatedAmount,
          cadence,
          estimated: true,
          confirmedDate: false,
        });
        addedTimestamps.add(next);
        next += step;
      }
      continue;
    }

    // Strategy 2: Upcoming ex-dividend date from market profile (payout ~14 days later)
    if (
      Number.isFinite(parsedExMs) &&
      parsedExMs + 14 * DAY >= todayMs &&
      parsedExMs + 14 * DAY <= limitMs
    ) {
      const estPayMs = parsedExMs + 14 * DAY;
      expected.push({
        instrumentId,
        expectedAt: new Date(estPayMs).toISOString(),
        estimatedAmount,
        cadence,
        estimated: true,
        exDividendAt: profile?.exDividendDate ?? undefined,
        confirmedDate: false,
      });
      addedTimestamps.add(estPayMs);

      let next = estPayMs + step;
      while (next <= limitMs) {
        expected.push({
          instrumentId,
          expectedAt: new Date(next).toISOString(),
          estimatedAmount,
          cadence,
          estimated: true,
          confirmedDate: false,
        });
        addedTimestamps.add(next);
        next += step;
      }
      continue;
    }

    // Strategy 3: Step forward from most recent known payout (market date in past or last history)
    const anchorMs = Math.max(
      Number.isFinite(parsedDivMs) ? parsedDivMs : -Infinity,
      Number.isFinite(lastPaidMs) ? lastPaidMs : -Infinity,
    );

    if (Number.isFinite(anchorMs)) {
      let next = anchorMs + step;
      while (next < todayMs) {
        next += step;
      }
      while (next <= limitMs) {
        if (!addedTimestamps.has(next)) {
          expected.push({
            instrumentId,
            expectedAt: new Date(next).toISOString(),
            estimatedAmount,
            cadence,
            estimated: true,
            confirmedDate: false,
          });
          addedTimestamps.add(next);
        }
        next += step;
      }
      continue;
    }

    // Strategy 4: No prior dates, but holding pays dividend (yield > 0)
    // Project starting from next month's 15th
    if (hasMarketYield) {
      let next = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        15,
      ).getTime();
      while (next <= limitMs) {
        if (!addedTimestamps.has(next)) {
          expected.push({
            instrumentId,
            expectedAt: new Date(next).toISOString(),
            estimatedAmount,
            cadence,
            estimated: true,
            confirmedDate: false,
          });
          addedTimestamps.add(next);
        }
        next += step;
      }
    }
  }

  return expected.sort((a, b) => (a.expectedAt < b.expectedAt ? -1 : 1));
};

