import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/db/supabase';

export interface RebrickableConnection {
  updatedAt: string;
}

export const rebrickableConnectionKey = ['rebrickable', 'connection'] as const;
export const rebrickableKeyQueryKey = ['rebrickable', 'api-key'] as const;

const LOCAL_STORAGE_KEY = 'strata_rebrickable_key';

export const getCachedRebrickableKey = (): string | null => {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(LOCAL_STORAGE_KEY) || null;
};

export const useRebrickableConnection = () =>
  useQuery<RebrickableConnection | null>({
    queryKey: rebrickableConnectionKey,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('provider_credentials')
          .select('updated_at')
          .eq('provider', 'rebrickable')
          .maybeSingle();

        if (error) {
          // If RPC/table error or offline, fallback to local storage
          const local = getCachedRebrickableKey();
          return local ? { updatedAt: new Date().toISOString() } : null;
        }

        if (data) {
          return { updatedAt: data.updated_at };
        }

        const local = getCachedRebrickableKey();
        return local ? { updatedAt: new Date().toISOString() } : null;
      } catch {
        const local = getCachedRebrickableKey();
        return local ? { updatedAt: new Date().toISOString() } : null;
      }
    },
  });

export const useRebrickableKey = () =>
  useQuery<string | null>({
    queryKey: rebrickableKeyQueryKey,
    queryFn: async () => {
      // 1. Try fetching from Supabase Vault via RPC
      try {
        const { data, error } = await supabase.rpc('get_rebrickable_api_key');
        if (!error && data) {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(LOCAL_STORAGE_KEY, data);
          }
          return data;
        }
      } catch {
        // Fall back to local storage
      }
      return getCachedRebrickableKey();
    },
  });

export const useSetRebrickableKey = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) => {
      const trimmed = key.trim();
      if (!trimmed) throw new Error('API key cannot be empty');

      // Always save to localStorage immediately for fast client access
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LOCAL_STORAGE_KEY, trimmed);
      }

      // Save to Supabase Vault
      try {
        const { error } = await supabase.rpc('set_rebrickable_api_key', {
          p_key: trimmed,
        });
        if (error) {
          // Non-fatal if Supabase backend doesn't have the migration yet, localStorage still holds it
          console.warn('Could not store Rebrickable key in vault:', error.message);
        }
      } catch (err) {
        console.warn('Failed to call set_rebrickable_api_key RPC:', err);
      }
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: rebrickableConnectionKey });
      client.invalidateQueries({ queryKey: rebrickableKeyQueryKey });
    },
  });
};

export const useRemoveRebrickableKey = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }

      try {
        const { error } = await supabase.rpc('remove_rebrickable_api_key');
        if (error) {
          console.warn('Could not remove Rebrickable key from vault:', error.message);
        }
      } catch (err) {
        console.warn('Failed to call remove_rebrickable_api_key RPC:', err);
      }
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: rebrickableConnectionKey });
      client.invalidateQueries({ queryKey: rebrickableKeyQueryKey });
    },
  });
};
