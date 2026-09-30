import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  projectPortfolioDividends,
  type ExpectedDividend,
  type HoldingDividendInput,
  type ReceivedDividend,
} from '@/core/dividends/projectDividends';
import { supabase } from '@/db/supabase';
import {
  usePositions,
  type InstrumentMeta,
} from '@/features/positions/api/usePositions';
import {
  useInstrumentProfiles,
  type InstrumentProfile,
} from '@/features/search/api/useMarket';
import { toNumber } from '@/core/money/money';

export interface ReceivedDividendItem extends ReceivedDividend {
  id: string;
}

export interface DividendsData {
  received: ReceivedDividendItem[];
  expected: ExpectedDividend[];
  instruments: Map<string, InstrumentMeta>;
  profiles: Map<string, InstrumentProfile>;
}

export const useDividends = () => {
  const positionsQuery = usePositions();

  const rawDividends = useQuery({
    queryKey: ['dividends-raw'],
    queryFn: async () => {
      const [dividendsRes, instrumentsRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('id, instrument_id, amount, occurred_at')
          .eq('kind', 'dividend')
          .order('occurred_at', { ascending: false }),
        supabase
          .from('instruments')
          .select('id, ticker, isin, name, currency, yahoo_symbol, sector'),
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

      return { received, instruments };
    },
  });

  const instrumentsList = useMemo(() => {
    return Array.from(rawDividends.data?.instruments.values() ?? []);
  }, [rawDividends.data?.instruments]);

  const profileQueries = useInstrumentProfiles(instrumentsList);

  const profilesMap = useMemo(() => {
    const map = new Map<string, InstrumentProfile>();
    instrumentsList.forEach((inst, idx) => {
      const profile = profileQueries[idx]?.data?.profile;
      if (profile) {
        map.set(inst.id, profile);
      }
    });
    return map;
  }, [instrumentsList, profileQueries]);

  const data = useMemo<DividendsData | undefined>(() => {
    if (!rawDividends.data) return undefined;

    const { received, instruments } = rawDividends.data;
    const positions = positionsQuery.data?.positions ?? [];

    const holdingsInputs: HoldingDividendInput[] = positions.map((p) => ({
      instrumentId: p.instrumentId,
      marketValueEur: toNumber(p.marketValue ?? p.costBasis),
      quantity: toNumber(p.quantity),
      profile: profilesMap.get(p.instrumentId) ?? null,
    }));

    // If there are instruments with received history but no active position, also include them
    const heldIds = new Set(positions.map((p) => p.instrumentId));
    for (const [id] of rawDividends.data.instruments) {
      if (!heldIds.has(id)) {
        holdingsInputs.push({
          instrumentId: id,
          marketValueEur: 0,
          quantity: 0,
          profile: profilesMap.get(id) ?? null,
        });
      }
    }

    const expected = projectPortfolioDividends(
      received,
      holdingsInputs,
      365,
      new Date(),
    );

    return {
      received,
      expected,
      instruments,
      profiles: profilesMap,
    };
  }, [rawDividends.data, positionsQuery.data?.positions, profilesMap]);

  return {
    data,
    isLoading: rawDividends.isLoading || positionsQuery.isLoading,
    isLoadingProfiles: profileQueries.some((q) => q.isLoading),
    error: rawDividends.error ?? positionsQuery.error,
  };
};
