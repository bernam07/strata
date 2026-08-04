import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/db/supabase';

export const targetsKey = ['allocation-targets'] as const;

export const useAllocationTargets = () =>
  useQuery<Map<string, number>>({
    queryKey: targetsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('allocation_targets')
        .select('instrument_id, target_weight');
      if (error) throw error;
      return new Map(
        (data ?? []).map((row) => [row.instrument_id, Number(row.target_weight)]),
      );
    },
  });

export const useSetTarget = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      instrumentId: string;
      weight: number | null;
    }) => {
      if (input.weight === null) {
        const { error } = await supabase
          .from('allocation_targets')
          .delete()
          .eq('instrument_id', input.instrumentId);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from('allocation_targets').upsert(
        {
          instrument_id: input.instrumentId,
          target_weight: input.weight,
        },
        { onConflict: 'user_id,instrument_id' },
      );
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: targetsKey }),
  });
};
