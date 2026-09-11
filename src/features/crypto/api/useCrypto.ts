import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/db/supabase';

export interface CryptoHolding {
  symbol: string;
  name: string;
  coinId: string | null;
  imageUrl: string | null;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  previousClose: number | null;
  valueEur: number;
  costEur: number;
  gainEur: number;
  gainPct: number | null;
  dayChangePct: number | null;
  dayChangeEur: number;
}

export const cryptoKey = ['crypto-holdings'] as const;

// CoinGecko is queried with vs_currency=eur, so stored prices are already in
// euro and there is no FX step here — unlike the Yahoo pairs this replaced.
export const useCrypto = () =>
  useQuery<CryptoHolding[]>({
    queryKey: cryptoKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crypto_holdings')
        .select(
          'symbol, name, coin_id, image_url, quantity, average_price, current_price, previous_close',
        );
      if (error) throw error;

      return (data ?? [])
        .map((row) => {
          const quantity = Number(row.quantity);
          const currentPrice = Number(row.current_price);
          const averagePrice = Number(row.average_price);
          const previousClose =
            row.previous_close === null ? null : Number(row.previous_close);
          const valueEur = quantity * currentPrice;
          const costEur = quantity * averagePrice;
          const gainEur = valueEur - costEur;
          return {
            symbol: row.symbol,
            name: row.name,
            coinId: row.coin_id,
            imageUrl: row.image_url,
            quantity,
            averagePrice,
            currentPrice,
            previousClose,
            valueEur,
            costEur,
            gainEur,
            gainPct: costEur > 0 ? gainEur / costEur : null,
            dayChangePct:
              previousClose && previousClose > 0
                ? (currentPrice - previousClose) / previousClose
                : null,
            dayChangeEur:
              previousClose && previousClose > 0
                ? quantity * (currentPrice - previousClose)
                : 0,
          };
        })
        .sort((a, b) => b.valueEur - a.valueEur);
    },
  });

export interface CoinHit {
  id: string;
  symbol: string;
  name: string;
  rank: number | null;
  image: string | null;
}

export const useCoinSearch = (query: string) =>
  useQuery<CoinHit[]>({
    queryKey: ['coin-search', query],
    enabled: query.trim().length >= 1,
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('market', {
        body: { action: 'crypto-search', q: query.trim() },
      });
      if (error) throw error;
      const body = data as { coins?: CoinHit[]; error?: string };
      if (body.error) throw new Error(body.error);
      return body.coins ?? [];
    },
  });

interface CoinMarket {
  id: string;
  price: number;
  changePct: number | null;
  symbol: string;
  name: string;
  image: string | null;
}

export const useAddCrypto = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      coinId: string;
      symbol: string;
      name: string;
      image: string | null;
      quantity: number;
      averagePrice: number;
    }) => {
      // Price the coin at the moment it is added, so the holding is worth
      // something before the next scheduled refresh runs.
      const { data } = await supabase.functions.invoke('market', {
        body: { action: 'crypto-markets', ids: input.coinId },
      });
      const market = (data as { markets?: Record<string, CoinMarket> })?.markets?.[
        input.coinId
      ];
      const price = Number(market?.price);
      const changePct = market?.changePct ?? null;

      const { error } = await supabase.from('crypto_holdings').upsert(
        {
          symbol: input.symbol,
          name: input.name,
          coin_id: input.coinId,
          image_url: market?.image ?? input.image,
          quantity: input.quantity,
          average_price: input.averagePrice,
          current_price: Number.isFinite(price) ? price : 0,
          previous_close:
            Number.isFinite(price) && changePct !== null && changePct > -100
              ? price / (1 + changePct / 100)
              : null,
          currency: 'EUR',
        },
        { onConflict: 'user_id,symbol' },
      );
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: cryptoKey }),
  });
};

export const useDeleteCrypto = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (symbol: string) => {
      const { error } = await supabase
        .from('crypto_holdings')
        .delete()
        .eq('symbol', symbol);
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: cryptoKey }),
  });
};
