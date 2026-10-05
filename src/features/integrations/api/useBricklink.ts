import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/db/supabase';
import {
  getCachedBricklinkCredentials,
  setCachedBricklinkCredentials,
  type BricklinkCredentials,
} from '@/features/collectibles/api/bricklink';

export interface BricklinkConnection {
  updatedAt: string;
}

export const bricklinkConnectionKey = ['bricklink', 'connection'] as const;
export const bricklinkCredentialsQueryKey = ['bricklink', 'credentials'] as const;

export const useBricklinkConnection = () =>
  useQuery<BricklinkConnection | null>({
    queryKey: bricklinkConnectionKey,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('provider_credentials')
          .select('updated_at')
          .eq('provider', 'bricklink')
          .maybeSingle();

        if (error) {
          const cached = getCachedBricklinkCredentials();
          return cached ? { updatedAt: new Date().toISOString() } : null;
        }

        if (data) {
          return { updatedAt: data.updated_at };
        }

        const cached = getCachedBricklinkCredentials();
        return cached ? { updatedAt: new Date().toISOString() } : null;
      } catch {
        const cached = getCachedBricklinkCredentials();
        return cached ? { updatedAt: new Date().toISOString() } : null;
      }
    },
  });

export const useBricklinkCredentials = () =>
  useQuery<BricklinkCredentials | null>({
    queryKey: bricklinkCredentialsQueryKey,
    queryFn: async () => {
      // 1. Try fetching from Supabase Vault via RPC
      try {
        const { data, error } = await supabase.rpc('get_bricklink_credentials');
        if (!error && data) {
          try {
            const parsed = JSON.parse(data) as BricklinkCredentials;
            setCachedBricklinkCredentials(parsed);
            return parsed;
          } catch {
            // ignore JSON parse error
          }
        }
      } catch {
        // Fall back to local storage
      }
      return getCachedBricklinkCredentials();
    },
  });

export const useSetBricklinkCredentials = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (creds: BricklinkCredentials) => {
      const consumerKey = creds.consumerKey.trim();
      const consumerSecret = creds.consumerSecret.trim();
      const tokenValue = creds.tokenValue.trim();
      const tokenSecret = creds.tokenSecret.trim();

      if (!consumerKey || !consumerSecret || !tokenValue || !tokenSecret) {
        throw new Error('All 4 BrickLink credentials are required');
      }

      const payload: BricklinkCredentials = {
        consumerKey,
        consumerSecret,
        tokenValue,
        tokenSecret,
      };

      // Always save to localStorage immediately for fast client access
      setCachedBricklinkCredentials(payload);

      // Save to Supabase Vault
      try {
        const { error } = await supabase.rpc('set_bricklink_credentials', {
          p_consumer_key: consumerKey,
          p_consumer_secret: consumerSecret,
          p_token_value: tokenValue,
          p_token_secret: tokenSecret,
        });
        if (error) {
          console.warn('Could not store BrickLink credentials in vault:', error.message);
        }
      } catch (err) {
        console.warn('Failed to call set_bricklink_credentials RPC:', err);
      }
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: bricklinkConnectionKey });
      client.invalidateQueries({ queryKey: bricklinkCredentialsQueryKey });
    },
  });
};

export const useRemoveBricklinkCredentials = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      setCachedBricklinkCredentials(null);

      try {
        const { error } = await supabase.rpc('remove_bricklink_credentials');
        if (error) {
          console.warn('Could not remove BrickLink credentials from vault:', error.message);
        }
      } catch (err) {
        console.warn('Failed to call remove_bricklink_credentials RPC:', err);
      }
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: bricklinkConnectionKey });
      client.invalidateQueries({ queryKey: bricklinkCredentialsQueryKey });
    },
  });
};
