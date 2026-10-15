import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/db/supabase';
import { toast } from '@/ui/toast';

export const useGlobalSync = () => {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Offline — connect to the internet to sync.');
      }

      // Check whether Trading 212 is connected before invoking t212-sync
      const { data: cred } = await supabase
        .from('provider_credentials')
        .select('provider')
        .eq('provider', 't212')
        .maybeSingle();

      let inserted = 0;
      if (cred) {
        const res = await supabase.functions.invoke<{
          inserted?: number;
          error?: string;
        }>('t212-sync', { body: {} });
        if (res.data?.inserted) {
          inserted = res.data.inserted;
        }
      }

      await supabase.functions
        .invoke('market', { body: { action: 'refresh' } })
        .catch(() => undefined);

      return { inserted, t212Connected: Boolean(cred) };
    },
    onSuccess: ({ inserted, t212Connected }) => {
      void client.invalidateQueries();
      if (t212Connected && inserted > 0) {
        toast(`Synced · ${inserted} new T212 transaction${inserted === 1 ? '' : 's'}`, 'success');
      } else if (t212Connected) {
        toast('Trading 212 & market prices synced', 'success');
      } else {
        toast('Market prices refreshed', 'success');
      }
    },
    onError: (err) => {
      toast(
        err instanceof Error ? err.message : "Couldn't complete sync",
        'error',
      );
    },
  });
};
