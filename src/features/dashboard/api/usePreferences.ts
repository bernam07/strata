import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/db/supabase';

export const preferencesKey = ['user-preferences'] as const;

export const useNetWorthGoal = () =>
  useQuery<number | null>({
    queryKey: preferencesKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('net_worth_goal')
        .maybeSingle();
      if (error) throw error;
      return data?.net_worth_goal ?? null;
    },
  });

export const useSetNetWorthGoal = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (goal: number | null) => {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({ net_worth_goal: goal }, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: preferencesKey }),
  });
};
