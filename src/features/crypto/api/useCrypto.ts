import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/db/supabase';

export interface CryptoHolding {
  symbol: string;
  name: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  previousClose: number | null;
  currency: string;
  valueEur: number;
  costEur: number;
  gainEur: number;
  gainPct: number | null;
  dayChangePct: number | null;
  dayChangeEur: number;
}

export const cryptoKey = ['crypto-holdings'] as const;

export const useCrypto = () =>
  useQuery<CryptoHolding[]>({
    queryKey: cryptoKey,
    queryFn: async () => {
      const [holdingsRes, fxRes] = await Promise.all([
        supabase
          .from('crypto_holdings')
          .select('symbol, name, quantity, average_price, current_price, previous_close, currency'),
        supabase
          .from('fx_rates')
          .select('base, rate, as_of')
          .eq('quote', 'EUR')
          .order('as_of', { ascending: false }),
      ]);
      if (holdingsRes.error) throw holdingsRes.error;

      const fx = new Map<string, number>();
      for (const row of fxRes.data ?? []) {
        if (!fx.has(row.base)) fx.set(row.base, Number(row.rate));
      }
      const rate = (currency: string) =>
        currency === 'EUR' ? 1 : (fx.get(currency) ?? 1);

      return (holdingsRes.data ?? [])
        .map((row) => {
          const fxRate = rate(row.currency);
          const quantity = Number(row.quantity);
          const currentPrice = Number(row.current_price);
          const averagePrice = Number(row.average_price);
          const previousClose =
            row.previous_close === null ? null : Number(row.previous_close);
          const valueEur = quantity * currentPrice * fxRate;
          const costEur = quantity * averagePrice * fxRate;
          const gainEur = valueEur - costEur;
          return {
            symbol: row.symbol,
            name: row.name,
            quantity,
            averagePrice,
            currentPrice,
            previousClose,
            currency: row.currency,
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
                ? quantity * (currentPrice - previousClose) * fxRate
                : 0,
          };
        })
        .sort((a, b) => b.valueEur - a.valueEur);
    },
  });

export const useAddCrypto = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      symbol: string;
      name: string;
      quantity: number;
      averagePrice: number;
    }) => {
      const { data: quote } = await supabase.functions.invoke('market', {
        body: { action: 'quote', symbol: input.symbol, range: '5d' },
      });
      const price = Number(quote?.quote?.price);
      const currency = String(quote?.quote?.currency ?? 'USD');
      const { error } = await supabase.from('crypto_holdings').upsert(
        {
          symbol: input.symbol,
          name: input.name,
          quantity: input.quantity,
          average_price: input.averagePrice,
          current_price: Number.isFinite(price) ? price : 0,
          previous_close: Number(quote?.quote?.previousClose) || null,
          currency,
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
