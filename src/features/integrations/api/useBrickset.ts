import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/db/supabase';
import {
  getCachedBricksetKey,
  setCachedBricksetKey,
} from '@/features/collectibles/api/brickset';

export interface BricksetConnection {
  updatedAt: string;
}

export const bricksetConnectionKey = ['brickset', 'connection'] as const;
export const bricksetKeyQueryKey = ['brickset', 'api-key'] as const;

export const useBricksetConnection = () =>
  useQuery<BricksetConnection | null>({
    queryKey: bricksetConnectionKey,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('provider_credentials')
          .select('updated_at')
          .eq('provider', 'brickset')
          .maybeSingle();

        if (error) {
          const local = getCachedBricksetKey();
          return local ? { updatedAt: new Date().toISOString() } : null;
        }

        if (data) {
          return { updatedAt: data.updated_at };
        }

        const local = getCachedBricksetKey();
        return local ? { updatedAt: new Date().toISOString() } : null;
      } catch {
        const local = getCachedBricksetKey();
        return local ? { updatedAt: new Date().toISOString() } : null;
      }
    },
  });

export const useBricksetKey = () =>
  useQuery<string | null>({
    queryKey: bricksetKeyQueryKey,
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc('get_brickset_api_key');
        if (!error && data) {
          setCachedBricksetKey(data);
          return data;
        }
      } catch {
        // Fall back to local storage
      }
      return getCachedBricksetKey();
    },
  });

export const useSetBricksetKey = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) => {
      const trimmed = key.trim();
      if (!trimmed) throw new Error('API key cannot be empty');

      // Always save locally immediately
      setCachedBricksetKey(trimmed);

      // Save to Supabase Vault
      try {
        const { error } = await supabase.rpc('set_brickset_api_key', {
          p_key: trimmed,
        });
        if (error) {
          console.warn('Could not store Brickset key in vault:', error.message);
        }
      } catch (err) {
        console.warn('Failed to call set_brickset_api_key RPC:', err);
      }
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: bricksetConnectionKey });
      client.invalidateQueries({ queryKey: bricksetKeyQueryKey });
    },
  });
};

export const useRemoveBricksetKey = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      setCachedBricksetKey(null);

      try {
        const { error } = await supabase.rpc('remove_brickset_api_key');
        if (error) {
          console.warn('Could not remove Brickset key from vault:', error.message);
        }
      } catch (err) {
        console.warn('Failed to call remove_brickset_api_key RPC:', err);
      }
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: bricksetConnectionKey });
      client.invalidateQueries({ queryKey: bricksetKeyQueryKey });
    },
  });
};
