import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SeriesPoint } from '@/core/analytics/series';
import { supabase } from '@/db/supabase';

export const netWorthHistoryKey = ['net-worth-history'] as const;

export const useNetWorthHistory = () =>
  useQuery<SeriesPoint[]>({
    queryKey: netWorthHistoryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('net_worth_snapshots')
        .select('as_of, net')
        .order('as_of', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({ date: row.as_of, value: Number(row.net) }));
    },
  });

export interface NetWorthSnapshotInput {
  net: number;
  assets: number;
  liabilities: number;
  investments: number;
}

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
