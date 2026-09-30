import {
  keepPreviousData,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
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

// Bounded queue to avoid hitting Yahoo / Edge function concurrent rate limits
let activeProfileFetches = 0;
const profileFetchQueue: (() => void)[] = [];

const enqueueProfileFetch = async <T>(fn: () => Promise<T>): Promise<T> => {
  if (activeProfileFetches >= 4) {
    await new Promise<void>((resolve) => profileFetchQueue.push(resolve));
  }
  activeProfileFetches += 1;
  try {
    return await fn();
  } finally {
    activeProfileFetches -= 1;
    const next = profileFetchQueue.shift();
    if (next) next();
  }
};

export const fetchInstrumentProfile = async (instrument: {
  isin: string | null;
  ticker: string;
  yahoo?: string | null;
}): Promise<{ profile?: InstrumentProfile; error?: string }> => {
  return enqueueProfileFetch(() =>
    invokeMarket<{ profile?: InstrumentProfile; error?: string }>({
      action: 'profile',
      yahoo: instrument?.yahoo ?? '',
      isin: instrument?.isin ?? '',
      ticker: instrument?.ticker ?? '',
    }),
  );
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

export const useQuote = (symbol: string | null, range = '1y') =>
  useQuery<QuoteData>({
    queryKey: ['market-quote', symbol, range],
    enabled: symbol !== null,
    placeholderData: keepPreviousData,
    queryFn: () =>
      invokeMarket<QuoteData>({ action: 'quote', symbol: symbol ?? '', range }),
  });

export interface InstrumentProfile {
  symbol: string;
  currency: string | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  marketCap: number | null;
  trailingPe: number | null;
  forwardPe: number | null;
  dividendYield: number | null;
  dividendRate: number | null;
  beta: number | null;
  earningsDate: string | null;
  exDividendDate: string | null;
  dividendDate: string | null;
  sector: string | null;
  industry: string | null;
}

// Reference data and the dates that matter for a holding. Changes rarely, so
// it is cached for an hour rather than re-fetched alongside the price.
export const useInstrumentProfile = (
  instrument:
    | { isin: string | null; ticker: string; yahoo?: string | null }
    | null,
) =>
  useQuery<{ profile?: InstrumentProfile; error?: string }>({
    queryKey: [
      'instrument-profile',
      instrument?.yahoo ?? null,
      instrument?.isin ?? null,
      instrument?.ticker,
    ],
    enabled: instrument !== null,
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: false,
    queryFn: () =>
      instrument ? fetchInstrumentProfile(instrument) : Promise.resolve({}),
  });

export const useInstrumentProfiles = (
  instruments: Array<{
    id: string;
    isin: string | null;
    ticker: string;
    yahoo_symbol?: string | null;
  }>,
) => {
  return useQueries({
    queries: instruments.map((inst) => ({
      queryKey: [
        'instrument-profile',
        inst.yahoo_symbol ?? null,
        inst.isin ?? null,
        inst.ticker,
      ],
      queryFn: () =>
        fetchInstrumentProfile({
          yahoo: inst.yahoo_symbol,
          isin: inst.isin,
          ticker: inst.ticker,
        }),
      staleTime: 60 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: false,
    })),
  });
};

export const useInstrumentQuote = (
  instrument:
    | { isin: string | null; ticker: string; yahoo?: string | null }
    | null,
  range = '1y',
) =>
  useQuery<QuoteData>({
    queryKey: [
      'instrument-quote',
      instrument?.yahoo,
      instrument?.isin,
      instrument?.ticker,
      range,
    ],
    enabled: instrument !== null,
    staleTime: 5 * 60 * 1000,
    retry: false,
    placeholderData: keepPreviousData,
    queryFn: () =>
      invokeMarket<QuoteData>({
        action: 'quote',
        yahoo: instrument?.yahoo ?? '',
        isin: instrument?.isin ?? '',
        ticker: instrument?.ticker ?? '',
        range,
      }),
  });

export interface MiniQuote {
  price: number;
  previousClose: number;
  currency: string;
}

export const useBatchQuotes = (symbols: string[]) => {
  const key = [...symbols].sort();
  return useQuery<Record<string, MiniQuote>>({
    queryKey: ['market-quotes', key],
    enabled: symbols.length > 0,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const data = await invokeMarket<{ quotes: Record<string, MiniQuote> }>({
        action: 'quotes',
        symbols: key.join(','),
      });
      return data.quotes ?? {};
    },
  });
};

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

export const useRefreshPrices = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: cred } = await supabase
        .from('provider_credentials')
        .select('provider')
        .eq('provider', 't212')
        .maybeSingle();

      const { data, error } = await supabase.functions.invoke('market', {
        body: { action: 'refresh' },
      });
      if (error) throw error;

      if (cred) {
        await supabase.functions.invoke('t212-sync', { body: {} });
      }

      return data as { updated?: number; stale?: number; errors?: string[] };
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['positions'] });
      client.invalidateQueries({ queryKey: ['holding'] });
      client.invalidateQueries({ queryKey: ['broker-accounts'] });
      client.invalidateQueries({ queryKey: ['instrument-prices'] });
      client.invalidateQueries({ queryKey: ['net-worth-history'] });
      client.invalidateQueries({ queryKey: ['crypto-holdings'] });
    },
  });
};

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
