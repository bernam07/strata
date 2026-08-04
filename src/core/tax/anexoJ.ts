import type { Money } from '../money/money';
import { money, zero } from '../money/money';
import type { Transaction } from '../types';
import type { Disposal } from './fifo';

export type CountryOf = (instrumentId: string) => string;

export interface CountryGains {
  country: string;
  proceeds: Money;
  cost: Money;
  gain: Money;
  count: number;
}

export const gainsByCountry = (
  disposals: readonly Disposal[],
  countryOf: CountryOf,
): CountryGains[] => {
  const byCountry = new Map<string, CountryGains>();
  for (const disposal of disposals) {
    const country = countryOf(disposal.instrumentId);
    const entry =
      byCountry.get(country) ??
      { country, proceeds: zero(), cost: zero(), gain: zero(), count: 0 };
    entry.proceeds = entry.proceeds.plus(disposal.proceeds);
    entry.cost = entry.cost.plus(disposal.cost);
    entry.gain = entry.gain.plus(disposal.gain);
    entry.count += 1;
    byCountry.set(country, entry);
  }
  return [...byCountry.values()].sort((a, b) => b.gain.comparedTo(a.gain));
};

export interface CountryDividends {
  country: string;
  gross: Money;
  count: number;
}

export const dividendsByCountry = (
  transactions: readonly Transaction[],
  countryOf: CountryOf,
): CountryDividends[] => {
  const byCountry = new Map<string, CountryDividends>();
  for (const transaction of transactions) {
    if (transaction.kind !== 'dividend' || !transaction.instrumentId) continue;
    const country = countryOf(transaction.instrumentId);
    const entry = byCountry.get(country) ?? { country, gross: zero(), count: 0 };
    entry.gross = entry.gross.plus(money(transaction.amount).abs());
    entry.count += 1;
    byCountry.set(country, entry);
  }
  return [...byCountry.values()].sort((a, b) => b.gross.comparedTo(a.gross));
};

export const isForeign = (country: string): boolean =>
  country !== 'PT' && country !== 'Unknown';
