export interface ValuationPoint {
  value: number;
  flow: number;
}

export const linkReturns = (returns: readonly number[]): number =>
  returns.reduce((product, r) => product * (1 + r), 1) - 1;

export const timeWeightedReturn = (
  points: readonly ValuationPoint[],
): number => {
  const subReturns: number[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1]!;
    const current = points[i]!;
    const base = previous.value + previous.flow;
    if (base === 0) continue;
    subReturns.push(current.value / base - 1);
  }
  return linkReturns(subReturns);
};
