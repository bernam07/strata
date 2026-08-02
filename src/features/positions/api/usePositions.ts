import { useQuery } from '@tanstack/react-query';
import {
  derivePositions,
  type Position,
} from '@/core/positions/derivePositions';
import { money, mul, ratio, subtract } from '@/core/money/money';
import { supabase } from '@/db/supabase';
import { toTransaction } from '@/db/mappers';

export interface InstrumentMeta {
  id: string;
  ticker: string;
  isin: string | null;
  name: string;
  currency: string;
}

export interface PositionsData {
  positions: Position[];
  instruments: Map<string, InstrumentMeta>;
  fromBroker: boolean;
}

const latestByKey = <T>(rows: T[], key: (row: T) => string): Map<string, T> => {
  const map = new Map<string, T>();
  for (const row of rows) {
    if (!map.has(key(row))) map.set(key(row), row);
  }
  return map;
};

export const usePositions = () =>
  useQuery<PositionsData>({
    queryKey: ['positions'],
    queryFn: async () => {
      const [holdingsRes, transactionsRes, instrumentsRes, pricesRes, fxRes] =
        await Promise.all([
          supabase
            .from('holdings')
            .select('instrument_id, quantity, average_price, current_price, currency'),
          supabase
            .from('transactions')
            .select('*')
            .not('instrument_id', 'is', null),
          supabase.from('instruments').select('id, ticker, isin, name, currency'),
          supabase
            .from('prices')
            .select('instrument_id, close, currency, as_of')
            .order('as_of', { ascending: false }),
          supabase
            .from('fx_rates')
            .select('base, rate, as_of')
            .eq('quote', 'EUR')
            .order('as_of', { ascending: false }),
        ]);

      if (instrumentsRes.error) throw instrumentsRes.error;

      const instruments = new Map<string, InstrumentMeta>(
        (instrumentsRes.data ?? []).map((row) => [row.id, row]),
      );
      const latestFx = latestByKey(fxRes.data ?? [], (row) => row.base);
      const fxRate = (currency: string) =>
        currency === 'EUR' ? '1' : (latestFx.get(currency)?.rate ?? '1');

      const holdings = holdingsRes.data ?? [];
      if (holdings.length > 0) {
        const positions: Position[] = holdings.map((holding) => {
          const fx = money(fxRate(holding.currency));
          const quantity = money(holding.quantity);
          const averageCost = mul(money(holding.average_price), fx);
          const currentEur = mul(money(holding.current_price), fx);
          const costBasis = mul(quantity, averageCost);
          const marketValue = mul(quantity, currentEur);
          const unrealized = subtract(marketValue, costBasis);
          return {
            instrumentId: holding.instrument_id,
            quantity,
            averageCost,
            costBasis,
            marketValue,
            unrealized,
            unrealizedPct: ratio(unrealized, costBasis),
          };
        });
        return { positions, instruments, fromBroker: true };
      }

      const transactions = (transactionsRes.data ?? []).map(toTransaction);
      const latestPrice = latestByKey(
        pricesRes.data ?? [],
        (row) => row.instrument_id,
      );
      const positions = derivePositions(
        transactions,
        (instrumentId) => {
          const price = latestPrice.get(instrumentId);
          return price ? { close: price.close, currency: price.currency } : null;
        },
        fxRate,
      );
      return { positions, instruments, fromBroker: false };
    },
  });
