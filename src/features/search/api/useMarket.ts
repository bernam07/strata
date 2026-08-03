import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/db/supabase';

export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

export interface QuoteData {
  quote?: {
    symbol: string;
    price: number;
    previousClose: number;
    currency: string;
  };
  history?: { date: string; value: number }[];
  error?: string;
}

const invokeMarket = async <T>(body: Record<string, string>): Promise<T> => {
  const { data, error } = await supabase.functions.invoke('market', { body });
  if (error) throw error;
  return data as T;
};

export const useStockSearch = (query: string) =>
  useQuery<SearchResult[]>({
    queryKey: ['market-search', query],
    enabled: query.trim().length >= 2,
    retry: false,
    queryFn: async () => {
      const data = await invokeMarket<{ results: SearchResult[]; error?: string }>({
        action: 'search',
        q: query.trim(),
      });
      if (data.error) throw new Error(data.error);
      return data.results ?? [];
    },
  });

export const useQuote = (symbol: string | null) =>
  useQuery<QuoteData>({
    queryKey: ['market-quote', symbol],
    enabled: symbol !== null,
    queryFn: () =>
      invokeMarket<QuoteData>({ action: 'quote', symbol: symbol ?? '', range: '1y' }),
  });

export const useInstrumentQuote = (
  instrument:
    | { isin: string | null; ticker: string; yahoo?: string | null }
    | null,
) =>
  useQuery<QuoteData>({
    queryKey: [
      'instrument-quote',
      instrument?.yahoo,
      instrument?.isin,
      instrument?.ticker,
    ],
    enabled: instrument !== null,
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: () =>
      invokeMarket<QuoteData>({
        action: 'quote',
        yahoo: instrument?.yahoo ?? '',
        isin: instrument?.isin ?? '',
        ticker: instrument?.ticker ?? '',
        range: '1y',
      }),
  });

export interface WatchItem {
  symbol: string;
  name: string;
  currency: string;
}

export const watchlistKey = ['watchlist'] as const;

export const useWatchlist = () =>
  useQuery<WatchItem[]>({
    queryKey: watchlistKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('watchlist')
        .select('symbol, name, currency')
        .order('added_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const useToggleWatch = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { item: WatchItem; watched: boolean }) => {
      if (input.watched) {
        const { error } = await supabase
          .from('watchlist')
          .delete()
          .eq('symbol', input.item.symbol);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('watchlist').insert({
          symbol: input.item.symbol,
          name: input.item.name,
          currency: input.item.currency,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: watchlistKey }),
  });
};
