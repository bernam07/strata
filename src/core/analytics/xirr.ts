export interface CashFlow {
  amount: number;
  when: Date;
}

const DAYS_PER_YEAR = 365;

const yearsBetween = (from: Date, to: Date): number =>
  (to.getTime() - from.getTime()) / (DAYS_PER_YEAR * 86_400_000);

const npv = (rate: number, flows: readonly CashFlow[], origin: Date): number => {
  let total = 0;
  for (const flow of flows) {
    total += flow.amount / (1 + rate) ** yearsBetween(origin, flow.when);
  }
  return total;
};

const dNpv = (rate: number, flows: readonly CashFlow[], origin: Date): number => {
  let total = 0;
  for (const flow of flows) {
    const t = yearsBetween(origin, flow.when);
    total += (-t * flow.amount) / (1 + rate) ** (t + 1);
  }
  return total;
};

const bisection = (
  flows: readonly CashFlow[],
  origin: Date,
  tolerance: number,
): number | null => {
  let low = -0.9999;
  let high = 100;
  let fLow = npv(low, flows, origin);
  let fHigh = npv(high, flows, origin);
  if (fLow * fHigh > 0) return null;

  for (let i = 0; i < 200; i += 1) {
    const mid = (low + high) / 2;
    const fMid = npv(mid, flows, origin);
    if (Math.abs(fMid) < tolerance) return mid;
    if (fLow * fMid < 0) {
      high = mid;
      fHigh = fMid;
    } else {
      low = mid;
      fLow = fMid;
    }
  }
  return (low + high) / 2;
};

export const xirr = (
  flows: readonly CashFlow[],
  guess = 0.1,
  tolerance = 1e-7,
): number | null => {
  const hasPositive = flows.some((flow) => flow.amount > 0);
  const hasNegative = flows.some((flow) => flow.amount < 0);
  if (!hasPositive || !hasNegative) return null;

  const origin = flows.reduce(
    (earliest, flow) => (flow.when < earliest ? flow.when : earliest),
    flows[0]!.when,
  );

  let rate = guess;
  for (let i = 0; i < 100; i += 1) {
    const value = npv(rate, flows, origin);
    if (Math.abs(value) < tolerance) return rate;
    const derivative = dNpv(rate, flows, origin);
    if (derivative === 0) break;
    const next = rate - value / derivative;
    if (!Number.isFinite(next) || next <= -1) break;
    if (Math.abs(next - rate) < tolerance) return next;
    rate = next;
  }

  return bisection(flows, origin, tolerance);
};
