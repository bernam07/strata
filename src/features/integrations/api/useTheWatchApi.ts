import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/db/supabase';
import {
  getCachedTheWatchApiKey,
  setCachedTheWatchApiKey,
} from '@/features/collectibles/api/theWatchApi';

export interface TheWatchApiConnection {
  updatedAt: string;
}

export const theWatchApiConnectionKey = ['thewatchapi', 'connection'] as const;
export const theWatchApiKeyQueryKey = ['thewatchapi', 'api-key'] as const;

export const useTheWatchApiConnection = () =>
  useQuery<TheWatchApiConnection | null>({
    queryKey: theWatchApiConnectionKey,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('provider_credentials')
          .select('updated_at')
          .eq('provider', 'thewatchapi')
          .maybeSingle();

        if (error) {
          const local = getCachedTheWatchApiKey();
          return local ? { updatedAt: new Date().toISOString() } : null;
        }

        if (data) {
          return { updatedAt: data.updated_at };
        }

        const local = getCachedTheWatchApiKey();
        return local ? { updatedAt: new Date().toISOString() } : null;
      } catch {
        const local = getCachedTheWatchApiKey();
        return local ? { updatedAt: new Date().toISOString() } : null;
      }
    },
  });

export const useTheWatchApiKey = () =>
  useQuery<string | null>({
    queryKey: theWatchApiKeyQueryKey,
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc('get_thewatchapi_api_key');
        if (!error && data) {
          setCachedTheWatchApiKey(data);
          return data;
        }
      } catch {
        // Fall back to local storage
      }
      return getCachedTheWatchApiKey();
    },
  });

export const useSetTheWatchApiKey = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) => {
      const trimmed = key.trim();
      if (!trimmed) throw new Error('API key cannot be empty');

      // Always save locally immediately
      setCachedTheWatchApiKey(trimmed);

      // Attempt to save to Supabase Vault
      try {
        const { error } = await supabase.rpc('set_thewatchapi_api_key', {
          p_key: trimmed,
        });
        if (error) {
          console.warn('Could not store TheWatchAPI key in vault:', error.message);
        }
      } catch (err) {
        console.warn('Failed to call set_thewatchapi_api_key RPC:', err);
      }
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: theWatchApiConnectionKey });
      client.invalidateQueries({ queryKey: theWatchApiKeyQueryKey });
    },
  });
};

export const useRemoveTheWatchApiKey = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      setCachedTheWatchApiKey(null);

      try {
        const { error } = await supabase.rpc('remove_thewatchapi_api_key');
        if (error) {
          console.warn('Could not remove TheWatchAPI key from vault:', error.message);
        }
      } catch (err) {
        console.warn('Failed to call remove_thewatchapi_api_key RPC:', err);
      }
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: theWatchApiConnectionKey });
      client.invalidateQueries({ queryKey: theWatchApiKeyQueryKey });
    },
  });
};
