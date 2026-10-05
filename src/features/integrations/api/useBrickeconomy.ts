import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/db/supabase';

export interface BrickeconomyConnection {
  updatedAt: string;
}

export const brickeconomyConnectionKey = ['brickeconomy', 'connection'] as const;
export const brickeconomyKeyQueryKey = ['brickeconomy', 'api-key'] as const;

const LOCAL_STORAGE_KEY = 'strata_brickeconomy_key';

export const getCachedBrickeconomyKey = (): string | null => {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(LOCAL_STORAGE_KEY) || null;
};

export const useBrickeconomyConnection = () =>
  useQuery<BrickeconomyConnection | null>({
    queryKey: brickeconomyConnectionKey,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('provider_credentials')
          .select('updated_at')
          .eq('provider', 'brickeconomy')
          .maybeSingle();

        if (error) {
          const local = getCachedBrickeconomyKey();
          return local ? { updatedAt: new Date().toISOString() } : null;
        }

        if (data) {
          return { updatedAt: data.updated_at };
        }

        const local = getCachedBrickeconomyKey();
        return local ? { updatedAt: new Date().toISOString() } : null;
      } catch {
        const local = getCachedBrickeconomyKey();
        return local ? { updatedAt: new Date().toISOString() } : null;
      }
    },
  });

export const useBrickeconomyKey = () =>
  useQuery<string | null>({
    queryKey: brickeconomyKeyQueryKey,
    queryFn: async (): Promise<string | null> => {
      try {
        const { data, error } = await (supabase.rpc as any)('get_brickeconomy_api_key');
        if (!error && typeof data === 'string' && data) {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(LOCAL_STORAGE_KEY, data);
          }
          return data;
        }
      } catch {
        // Fall back to local storage
      }
      return getCachedBrickeconomyKey();
    },
  });

export const useSetBrickeconomyKey = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) => {
      const trimmed = key.trim();
      if (!trimmed) throw new Error('API key cannot be empty');

      // Save to localStorage immediately
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LOCAL_STORAGE_KEY, trimmed);
      }

      // Save to Supabase Vault
      try {
        const { error } = await (supabase.rpc as any)('set_brickeconomy_api_key', {
          p_key: trimmed,
        });
        if (error) {
          console.warn('Could not store BrickEconomy key in vault:', error.message);
        }
      } catch (err) {
        console.warn('Failed to call set_brickeconomy_api_key RPC:', err);
      }
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: brickeconomyConnectionKey });
      client.invalidateQueries({ queryKey: brickeconomyKeyQueryKey });
    },
  });
};

export const useRemoveBrickeconomyKey = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }

      try {
        const { error } = await (supabase.rpc as any)('delete_brickeconomy_api_key');
        if (error) {
          console.warn('Could not remove BrickEconomy key from vault:', error.message);
        }
      } catch (err) {
        console.warn('Failed to call delete_brickeconomy_api_key RPC:', err);
      }
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: brickeconomyConnectionKey });
      client.invalidateQueries({ queryKey: brickeconomyKeyQueryKey });
    },
  });
};
