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

export const useDailyBriefing = () =>
  useQuery<boolean>({
    queryKey: [...preferencesKey, 'daily-briefing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('daily_briefing')
        .maybeSingle();
      if (error) throw error;
      return data?.daily_briefing ?? false;
    },
  });

export const useSetDailyBriefing = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({ daily_briefing: enabled }, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onSuccess: () =>
      client.invalidateQueries({ queryKey: [...preferencesKey, 'daily-briefing'] }),
  });
};

const LOCAL_STORAGE_COLLECTIBLES_KEY = 'strata_include_collectibles_net_worth';

export const useIncludeCollectiblesInNetWorth = () =>
  useQuery<boolean>({
    queryKey: [...preferencesKey, 'include-collectibles'],
    queryFn: async () => {
      const stored = localStorage.getItem(LOCAL_STORAGE_COLLECTIBLES_KEY);
      const defaultVal = stored !== null ? stored === 'true' : true;

      const { data, error } = await supabase
        .from('user_preferences')
        .select('include_collectibles_in_net_worth')
        .maybeSingle();

      if (error) return defaultVal;
      const val = data?.include_collectibles_in_net_worth ?? defaultVal;
      localStorage.setItem(LOCAL_STORAGE_COLLECTIBLES_KEY, String(val));
      return val;
    },
    initialData: () => {
      const stored = localStorage.getItem(LOCAL_STORAGE_COLLECTIBLES_KEY);
      return stored !== null ? stored === 'true' : true;
    },
  });

export const useSetIncludeCollectiblesInNetWorth = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      localStorage.setItem(LOCAL_STORAGE_COLLECTIBLES_KEY, String(enabled));
      client.setQueryData([...preferencesKey, 'include-collectibles'], enabled);

      const { error } = await supabase
        .from('user_preferences')
        .upsert(
          { include_collectibles_in_net_worth: enabled },
          { onConflict: 'user_id' },
        );
      if (error) {
        console.warn('Failed to persist user preference to Supabase, saved locally:', error);
      }
    },
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: [...preferencesKey, 'include-collectibles'],
      }),
  });
};

