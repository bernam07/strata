import { useQuery } from '@tanstack/react-query';
import {
  projectDividends,
  type ExpectedDividend,
  type ReceivedDividend,
} from '@/core/dividends/projectDividends';
import { supabase } from '@/db/supabase';
import type { InstrumentMeta } from '@/features/positions/api/usePositions';

export interface ReceivedDividendItem extends ReceivedDividend {
  id: string;
}

export interface DividendsData {
  received: ReceivedDividendItem[];
  expected: ExpectedDividend[];
  instruments: Map<string, InstrumentMeta>;
}

export const useDividends = () =>
  useQuery<DividendsData>({
    queryKey: ['dividends'],
    queryFn: async () => {
      const [dividendsRes, instrumentsRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('id, instrument_id, amount, occurred_at')
          .eq('kind', 'dividend')
          .order('occurred_at', { ascending: false }),
        supabase.from('instruments').select('id, ticker, isin, name, currency'),
      ]);

      if (dividendsRes.error) throw dividendsRes.error;
      if (instrumentsRes.error) throw instrumentsRes.error;

      const instruments = new Map<string, InstrumentMeta>(
        (instrumentsRes.data ?? []).map((row) => [row.id, row]),
      );

      const received: ReceivedDividendItem[] = (dividendsRes.data ?? [])
        .filter((row) => row.instrument_id !== null)
        .map((row) => ({
          id: row.id,
          instrumentId: row.instrument_id as string,
          amount: row.amount,
          paidAt: row.occurred_at,
        }));

      const expected = projectDividends(received, 365, new Date());

      return { received, expected, instruments };
    },
  });
