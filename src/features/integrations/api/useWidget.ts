import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/db/supabase';

export const widgetTokenKey = ['widget-token'] as const;

export const useWidgetToken = () =>
  useQuery<string | null>({
    queryKey: widgetTokenKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('widget_tokens')
        .select('token')
        .maybeSingle();
      if (error) throw error;
      return data?.token ?? null;
    },
  });

export const useCreateWidgetToken = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('create_widget_token');
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: widgetTokenKey }),
  });
};

export const widgetEndpoint = (token: string): string =>
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/widget?token=${token}`;
