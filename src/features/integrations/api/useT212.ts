import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/db/supabase';

export interface ProviderConnection {
  useDemo: boolean;
  updatedAt: string;
}

export const connectionKey = ['t212', 'connection'] as const;
export const syncRunsKey = ['t212', 'sync-runs'] as const;

export const useT212Connection = () =>
  useQuery<ProviderConnection | null>({
    queryKey: connectionKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('provider_credentials')
        .select('use_demo, updated_at')
        .eq('provider', 't212')
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { useDemo: data.use_demo, updatedAt: data.updated_at };
    },
  });

export const useSetT212Key = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { key: string; secret: string; useDemo: boolean }) => {
      const { error } = await supabase.rpc('set_t212_api_key', {
        p_key: input.key,
        p_secret: input.secret,
        p_use_demo: input.useDemo,
      });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: connectionKey }),
  });
};

export const useRemoveT212Key = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('remove_t212_api_key');
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: connectionKey }),
  });
};

export interface SyncRun {
  id: string;
  status: 'running' | 'success' | 'error';
  startedAt: string;
  finishedAt: string | null;
  insertedRows: number;
  errorMessage: string | null;
}

export const useSyncRuns = () =>
  useQuery<SyncRun[]>({
    queryKey: syncRunsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sync_runs')
        .select('id, status, started_at, finished_at, inserted_rows, error_message')
        .eq('provider', 't212')
        .order('started_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        status: row.status,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        insertedRows: row.inserted_rows,
        errorMessage: row.error_message,
      }));
    },
  });

export const useClearSyncHistory = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('clear_sync_history');
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: syncRunsKey }),
  });
};

export const useResetSync = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('reset_t212_sync');
      if (error) throw error;
    },
    onSuccess: () => {
      client.invalidateQueries();
    },
  });
};

export const useRunSync = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('t212-sync', {
        body: {},
      });
      if (error) throw error;
      return data as { ok: boolean; inserted?: number; error?: string };
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: syncRunsKey });
      client.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
};
