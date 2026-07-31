export interface ParsedT212Ticker {
  symbol: string;
  market: string | null;
  kind: string | null;
}

export const parseT212Ticker = (ticker: string): ParsedT212Ticker => {
  const segments = ticker.split('_');
  if (segments.length >= 3) {
    const kind = segments[segments.length - 1] ?? null;
    const market = segments[segments.length - 2] ?? null;
    const symbol = segments.slice(0, segments.length - 2).join('_');
    return { symbol, market, kind };
  }
  if (segments.length === 2) {
    return { symbol: segments[0] ?? ticker, market: null, kind: segments[1] ?? null };
  }
  return { symbol: ticker, market: null, kind: null };
};

export const round4 = (value: number): number =>
  Math.round((value + Number.EPSILON) * 1e4) / 1e4;

export const round8 = (value: number): number =>
  Math.round((value + Number.EPSILON) * 1e8) / 1e8;
