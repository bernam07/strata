import { round8 } from './normalize.ts';

export interface T212Position {
  ticker: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
}

export interface PriceRow {
  user_id: string;
  instrument_id: string;
  as_of: string;
  close: number;
  currency: string;
}

export const portfolioToPriceRows = (
  userId: string,
  asOf: string,
  positions: readonly T212Position[],
  resolveInstrument: (ticker: string) => string | null,
  currencyOf: (instrumentId: string) => string,
): PriceRow[] => {
  const rows: PriceRow[] = [];
  for (const position of positions) {
    const instrumentId = resolveInstrument(position.ticker);
    if (!instrumentId) continue;
    rows.push({
      user_id: userId,
      instrument_id: instrumentId,
      as_of: asOf,
      close: round8(position.currentPrice),
      currency: currencyOf(instrumentId),
    });
  }
  return rows;
};
