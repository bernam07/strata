import { useQuery } from '@tanstack/react-query';
import {
  derivePositions,
  type Position,
} from '@/core/positions/derivePositions';
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
      const [transactionsRes, instrumentsRes, pricesRes, fxRes] =
        await Promise.all([
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

      if (transactionsRes.error) throw transactionsRes.error;
      if (instrumentsRes.error) throw instrumentsRes.error;

      const transactions = transactionsRes.data.map(toTransaction);
      const instruments = new Map<string, InstrumentMeta>(
        (instrumentsRes.data ?? []).map((row) => [row.id, row]),
      );

      const latestPrice = latestByKey(
        pricesRes.data ?? [],
        (row) => row.instrument_id,
      );
      const latestFx = latestByKey(fxRes.data ?? [], (row) => row.base);

      const positions = derivePositions(
        transactions,
        (instrumentId) => {
          const price = latestPrice.get(instrumentId);
          return price ? { close: price.close, currency: price.currency } : null;
        },
        (currency) =>
          currency === 'EUR' ? '1' : (latestFx.get(currency)?.rate ?? '1'),
      );

      return { positions, instruments };
    },
  });
