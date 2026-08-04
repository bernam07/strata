export interface RebalanceInput {
  instrumentId: string;
  value: number;
}

export interface RebalanceRow {
  instrumentId: string;
  currentWeight: number;
  targetWeight: number;
  driftWeight: number;
  driftValue: number;
}

export const rebalanceRows = (
  positions: readonly RebalanceInput[],
  targetOf: (instrumentId: string) => number | undefined,
  total: number,
): RebalanceRow[] => {
  const rows: RebalanceRow[] = [];
  for (const position of positions) {
    const target = targetOf(position.instrumentId);
    if (target === undefined) continue;
    const currentWeight = total > 0 ? position.value / total : 0;
    const driftWeight = target - currentWeight;
    rows.push({
      instrumentId: position.instrumentId,
      currentWeight,
      targetWeight: target,
      driftWeight,
      driftValue: driftWeight * total,
    });
  }
  return rows.sort((a, b) => Math.abs(b.driftValue) - Math.abs(a.driftValue));
};
