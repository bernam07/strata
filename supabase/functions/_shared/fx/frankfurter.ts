export interface FrankfurterResponse {
  base: string;
  date: string;
  rates: Record<string, number>;
}

export interface FxRow {
  base: string;
  quote: string;
  as_of: string;
  rate: number;
}

export const invertToEur = (response: FrankfurterResponse): FxRow[] => {
  const rows: FxRow[] = [];
  for (const [currency, rate] of Object.entries(response.rates)) {
    if (rate <= 0) continue;
    rows.push({
      base: currency,
      quote: 'EUR',
      as_of: response.date,
      rate: Math.round((1 / rate) * 1e8) / 1e8,
    });
  }
  rows.push({ base: 'EUR', quote: 'EUR', as_of: response.date, rate: 1 });
  return rows;
};
