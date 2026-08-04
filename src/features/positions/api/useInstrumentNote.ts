import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/db/supabase';

export const noteKey = (instrumentId: string) =>
  ['instrument-note', instrumentId] as const;

export const useInstrumentNote = (instrumentId: string) =>
  useQuery<string>({
    queryKey: noteKey(instrumentId),
    enabled: instrumentId.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instrument_notes')
        .select('body')
        .eq('instrument_id', instrumentId)
        .maybeSingle();
      if (error) throw error;
      return data?.body ?? '';
    },
  });

export const useSaveInstrumentNote = (instrumentId: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const trimmed = body.trim();
      if (trimmed.length === 0) {
        const { error } = await supabase
          .from('instrument_notes')
          .delete()
          .eq('instrument_id', instrumentId);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from('instrument_notes')
        .upsert(
          { instrument_id: instrumentId, body: trimmed },
          { onConflict: 'user_id,instrument_id' },
        );
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: noteKey(instrumentId) }),
  });
};
