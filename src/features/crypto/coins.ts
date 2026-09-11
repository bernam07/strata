// Yahoo quotes crypto as a pair — BTC-EUR, BTC-USD, BTC-GBP — so a search for
// "btc" comes back as several rows for the same coin and the list fills up with
// one currency's worth of duplicates. These helpers collapse a result set to
// one row per coin, and present the coin rather than the pair.

export interface CoinOption {
  /** The pair we store and price against, e.g. BTC-EUR. */
  symbol: string;
  /** The coin itself, e.g. BTC. */
  base: string;
  name: string;
}

// Prefer the euro pair: the app reports in euro, so pricing against EUR avoids
// a second FX conversion. Fall back through the majors.
const QUOTE_RANK: Record<string, number> = { EUR: 0, USD: 1, USDT: 2, GBP: 3 };

export const coinBase = (symbol: string): string =>
  symbol.split('-')[0] || symbol;

// "Bitcoin EUR" → "Bitcoin"; the currency is already carried by the pair.
export const coinName = (name: string): string =>
  name.replace(/\s+(EUR|USD|USDT|GBP)\s*$/i, '').trim() || name;

export const distinctCoins = (
  results: readonly { symbol: string; name: string; type: string }[],
  limit = 8,
): CoinOption[] => {
  const best = new Map<string, { symbol: string; name: string; rank: number }>();
  for (const result of results) {
    if (result.type !== 'CRYPTOCURRENCY') continue;
    const [base, quote] = result.symbol.split('-');
    if (!base) continue;
    const rank = QUOTE_RANK[(quote ?? '').toUpperCase()] ?? 9;
    const current = best.get(base);
    // Map iteration keeps Yahoo's relevance order for the coins themselves.
    if (!current || rank < current.rank) {
      best.set(base, { symbol: result.symbol, name: coinName(result.name), rank });
    }
  }
  return [...best.entries()]
    .map(([base, entry]) => ({ base, symbol: entry.symbol, name: entry.name }))
    .slice(0, limit);
};
