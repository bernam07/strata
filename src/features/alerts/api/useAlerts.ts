import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AlertDirection } from '@/core/alerts/evaluate';
import { supabase } from '@/db/supabase';

export interface PriceAlert {
  id: string;
  symbol: string;
  name: string;
  direction: AlertDirection;
  target: number;
  currency: string;
  triggeredAt: string | null;
}

export const alertsKey = ['price-alerts'] as const;

export const usePriceAlerts = () =>
  useQuery<PriceAlert[]>({
    queryKey: alertsKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_alerts')
        .select('id, symbol, name, direction, target, currency, triggered_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        symbol: row.symbol,
        name: row.name,
        direction: row.direction as AlertDirection,
        target: Number(row.target),
        currency: row.currency,
        triggeredAt: row.triggered_at,
      }));
    },
  });

export const useCreateAlert = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      symbol: string;
      name: string;
      direction: AlertDirection;
      target: number;
      currency: string;
    }) => {
      const { error } = await supabase.from('price_alerts').insert({
        symbol: input.symbol,
        name: input.name,
        direction: input.direction,
        target: input.target,
        currency: input.currency,
      });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: alertsKey }),
  });
};

export const useDeleteAlert = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('price_alerts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: alertsKey }),
  });
};

export const useMarkAlertTriggered = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; triggered: boolean }) => {
      const { error } = await supabase
        .from('price_alerts')
        .update({ triggered_at: input.triggered ? new Date().toISOString() : null })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: alertsKey }),
  });
};
