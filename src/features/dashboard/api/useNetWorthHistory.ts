import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SeriesPoint } from '@/core/analytics/series';
import { supabase } from '@/db/supabase';

export const netWorthHistoryKey = ['net-worth-history'] as const;

interface SnapshotRow {
  as_of: string;
  net: number;
  investments: number;
}

const fetchSnapshots = async (): Promise<SnapshotRow[]> => {
  const { data, error } = await supabase
    .from('net_worth_snapshots')
    .select('as_of, net, investments')
    .order('as_of', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    as_of: row.as_of,
    net: Number(row.net),
    investments: Number(row.investments ?? 0),
  }));
};

export const useNetWorthHistory = () =>
  useQuery({
    queryKey: netWorthHistoryKey,
    queryFn: fetchSnapshots,
    select: (rows): SeriesPoint[] =>
      rows.map((row) => ({ date: row.as_of, value: row.net })),
  });

// Investment-only history from the same snapshots (market value of holdings).
export const useInvestmentsHistory = () =>
  useQuery({
    queryKey: netWorthHistoryKey,
    queryFn: fetchSnapshots,
    select: (rows): SeriesPoint[] =>
      rows
        .filter((row) => row.investments > 0)
        .map((row) => ({ date: row.as_of, value: row.investments })),
  });

export interface NetWorthSnapshotInput {
  net: number;
  assets: number;
  liabilities: number;
  investments: number;
}

export const useBackfillHistory = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('market', {
        body: { action: 'backfill', range: '5y' },
      });
      if (error) throw error;
      return data as { inserted?: number };
    },
    onSuccess: () => client.invalidateQueries({ queryKey: netWorthHistoryKey }),
  });
};

export const useRecordNetWorth = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: NetWorthSnapshotInput) => {
      const asOf = new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from('net_worth_snapshots').upsert(
        {
          as_of: asOf,
          net: input.net,
          assets: input.assets,
          liabilities: input.liabilities,
          investments: input.investments,
        },
        { onConflict: 'user_id,as_of' },
      );
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: netWorthHistoryKey }),
  });
};
