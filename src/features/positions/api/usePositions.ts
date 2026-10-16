import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  derivePositions,
  type Position,
} from '@/core/positions/derivePositions';
import { div, money, mul, ratio, subtract, zero } from '@/core/money/money';
import { supabase } from '@/db/supabase';
import { toTransaction } from '@/db/mappers';
import { getLocalXtbState } from '@/features/integrations/api/useXtb';

export interface InstrumentMeta {
  id: string;
  ticker: string;
  isin: string | null;
  name: string;
  currency: string;
  yahoo_symbol?: string | null;
  sector?: string | null;
}

export interface PricePoint {
  date: string;
  value: number;
}

// Override (or clear, with '') the Yahoo symbol used to price an instrument,
// then refresh so its price is re-fetched from the corrected symbol.
export const useSetInstrumentYahoo = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { instrumentId: string; symbol: string }) => {
      const { error } = await supabase.rpc('set_instrument_yahoo_mine', {
        p_id: input.instrumentId,
        p_symbol: input.symbol,
      });
      if (error) throw error;
      const { error: refreshError } = await supabase.functions.invoke('market', {
        body: { action: 'refresh' },
      });
      if (refreshError) throw refreshError;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['positions'] });
      client.invalidateQueries({ queryKey: ['instrument-prices'] });
      client.invalidateQueries({ queryKey: ['instrument-quote'] });
      client.invalidateQueries({ queryKey: ['broker-accounts'] });
    },
  });
};

export const isSanePrice = (price: number, referencePrice: number): boolean => {
  if (!Number.isFinite(price) || price <= 0) return false;
  if (!Number.isFinite(referencePrice) || referencePrice <= 0) return true;
  const r = price / referencePrice;
  return r >= 0.08 && r <= 8;
};

export const useInstrumentPrices = (instrumentId: string) =>
  useQuery<PricePoint[]>({
    queryKey: ['instrument-prices', instrumentId],
    queryFn: async () => {
      const [{ data, error }, { data: holding }] = await Promise.all([
        supabase
          .from('prices')
          .select('as_of, close')
          .eq('instrument_id', instrumentId)
          .order('as_of', { ascending: true }),
        supabase
          .from('holdings')
          .select('average_price')
          .eq('instrument_id', instrumentId)
          .maybeSingle(),
      ]);
      if (error) throw error;
      const points = (data ?? []).map((row) => ({
        date: row.as_of,
        value: Number(row.close),
      }));
      const refPrice = Number(holding?.average_price ?? 0);
      if (refPrice > 0) {
        const filtered = points.filter((p) => isSanePrice(p.value, refPrice));
        if (filtered.length > 0) return filtered;
      }
      return points;
    },
  });

export interface HoldingNative {
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  currency: string;
}

export const useHolding = (instrumentId: string) =>
  useQuery<HoldingNative | null>({
    queryKey: ['holding', instrumentId],
    enabled: instrumentId.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('holdings')
        .select('quantity, average_price, current_price, currency')
        .eq('instrument_id', instrumentId);
      if (error) throw error;
      const rows = data ?? [];
      if (rows.length === 0) {
        const local = getLocalXtbState()?.holdings.find(
          (h) => h.instrumentId === instrumentId,
        );
        if (!local) return null;
        return {
          quantity: local.quantity,
          averagePrice: local.averagePrice,
          currentPrice: local.currentPrice,
          currency: local.currency,
        };
      }
      const first = rows[0]!;
      const totalQty = rows.reduce((s, r) => s + Number(r.quantity), 0);
      const totalCost = rows.reduce(
        (s, r) => s + Number(r.quantity) * Number(r.average_price),
        0,
      );
      const averagePrice = totalQty > 0 ? totalCost / totalQty : Number(first.average_price);
      const rawCurrent = Number(first.current_price);
      const currentPrice = isSanePrice(rawCurrent, averagePrice)
        ? rawCurrent
        : averagePrice;
      return {
        quantity: totalQty,
        averagePrice,
        currentPrice,
        currency: first.currency,
      };
    },
  });

export const useInstruments = () =>
  useQuery<Map<string, InstrumentMeta>>({
    queryKey: ['instruments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instruments')
        .select('id, ticker, isin, name, currency, yahoo_symbol, sector');
      if (error) throw error;
      const map = new Map<string, InstrumentMeta>(
        (data ?? []).map((row) => [row.id, row]),
      );
      const localXtb = getLocalXtbState();
      for (const h of localXtb?.holdings ?? []) {
        if (!map.has(h.instrumentId)) {
          map.set(h.instrumentId, {
            id: h.instrumentId,
            ticker: h.ticker,
            isin: null,
            name: h.name,
            currency: h.currency,
            yahoo_symbol: h.yahooSymbol,
            sector: h.sector,
          });
        }
      }
      return map;
    },
  });

export interface PositionsData {
  positions: Position[];
  byProvider: Map<string, Position[]>;
  instruments: Map<string, InstrumentMeta>;
  fromBroker: boolean;
}

const latestByKey = <T>(rows: T[], key: (row: T) => string): Map<string, T> => {
  const map = new Map<string, T>();
  for (const row of rows) {
    if (!map.has(key(row))) map.set(key(row), row);
  }
  return map;
};

interface RawHoldingRow {
  instrument_id: string;
  provider?: string;
  quantity: string | number;
  average_price: string | number;
  current_price: string | number;
  previous_close: string | number | null;
  currency: string;
}

const fetchHoldingsWithProviderFallback = async (): Promise<RawHoldingRow[]> => {
  const withProvider = await supabase
    .from('holdings')
    .select(
      'instrument_id, provider, quantity, average_price, current_price, previous_close, currency',
    );
  if (!withProvider.error && withProvider.data) {
    return withProvider.data as RawHoldingRow[];
  }
  const withoutProvider = await supabase
    .from('holdings')
    .select(
      'instrument_id, quantity, average_price, current_price, previous_close, currency',
    );
  return (withoutProvider.data ?? []) as RawHoldingRow[];
};

const mergePositionsByInstrument = (rawPositions: Position[]): Position[] => {
  const grouped = new Map<string, Position[]>();
  for (const pos of rawPositions) {
    const bucket = grouped.get(pos.instrumentId) ?? [];
    bucket.push(pos);
    grouped.set(pos.instrumentId, bucket);
  }

  const merged: Position[] = [];
  for (const [instrumentId, list] of grouped.entries()) {
    if (list.length === 1) {
      merged.push(list[0]!);
      continue;
    }
    let quantity = zero();
    let costBasis = zero();
    let marketValue = zero();
    let hasDay = false;
    let dayChangeSum = zero();

    for (const item of list) {
      quantity = quantity.plus(item.quantity);
      costBasis = costBasis.plus(item.costBasis);
      marketValue = marketValue.plus(item.marketValue ?? item.costBasis);
      if (item.dayChange !== null) {
        hasDay = true;
        dayChangeSum = dayChangeSum.plus(item.dayChange);
      }
    }

    const averageCost = quantity.isZero() ? zero() : div(costBasis, quantity);
    const unrealized = subtract(marketValue, costBasis);
    const unrealizedPct = ratio(unrealized, costBasis);
    const prevMarket = subtract(marketValue, dayChangeSum);
    const dayChange = hasDay ? dayChangeSum : null;
    const dayChangePct =
      hasDay && !prevMarket.isZero() ? ratio(dayChangeSum, prevMarket) : null;

    merged.push({
      instrumentId,
      quantity,
      averageCost,
      costBasis,
      marketValue,
      unrealized,
      unrealizedPct,
      dayChange,
      dayChangePct,
    });
  }
  return merged;
};

export const usePositions = () =>
  useQuery<PositionsData>({
    queryKey: ['positions'],
    queryFn: async () => {
      const [dbHoldings, instrumentsRes, pricesRes, fxRes] = await Promise.all([
        fetchHoldingsWithProviderFallback(),
        supabase
          .from('instruments')
          .select('id, ticker, isin, name, currency, yahoo_symbol, sector'),
        supabase
          .from('prices')
          .select('instrument_id, close, currency, as_of')
          .order('as_of', { ascending: false })
          .limit(200),
        supabase
          .from('fx_rates')
          .select('base, rate, as_of')
          .eq('quote', 'EUR')
          .order('as_of', { ascending: false })
          .limit(25),
      ]);

      if (instrumentsRes.error) throw instrumentsRes.error;

      const instruments = new Map<string, InstrumentMeta>(
        (instrumentsRes.data ?? []).map((row) => [row.id, row]),
      );

      const holdings: RawHoldingRow[] = [...dbHoldings];
      const localXtb = getLocalXtbState();
      if (localXtb && localXtb.holdings.length > 0) {
        for (const h of localXtb.holdings) {
          if (!instruments.has(h.instrumentId)) {
            instruments.set(h.instrumentId, {
              id: h.instrumentId,
              ticker: h.ticker,
              isin: null,
              name: h.name,
              currency: h.currency,
              yahoo_symbol: h.yahooSymbol,
              sector: h.sector,
            });
          }
          const alreadyInDb = holdings.some(
            (row) =>
              row.instrument_id === h.instrumentId &&
              (row.provider ?? 't212') === 'xtb',
          );
          if (!alreadyInDb) {
            holdings.push({
              instrument_id: h.instrumentId,
              provider: 'xtb',
              quantity: h.quantity,
              average_price: h.averagePrice,
              current_price: h.currentPrice,
              previous_close: h.previousClose,
              currency: h.currency,
            });
          }
        }
      }

      const latestFx = latestByKey(fxRes.data ?? [], (row) => row.base);
      const fxRate = (currency: string) =>
        currency === 'EUR' ? '1' : (latestFx.get(currency)?.rate ?? '1');

      if (holdings.length > 0) {
        const pricesList = pricesRes.data ?? [];
        const byProvider = new Map<string, Position[]>();

        const rawPositions: Position[] = holdings.map((holding) => {
          const provider = holding.provider ?? 't212';
          const fx = money(fxRate(holding.currency));
          const quantity = money(holding.quantity);
          const avgNum = Number(holding.average_price);
          const rawCurrentNum = Number(holding.current_price);

          let saneCurrentPrice: string | number = holding.current_price;
          if (!isSanePrice(rawCurrentNum, avgNum)) {
            const fallbackPrice = pricesList.find(
              (p) =>
                p.instrument_id === holding.instrument_id &&
                isSanePrice(Number(p.close), avgNum),
            );
            saneCurrentPrice = fallbackPrice
              ? fallbackPrice.close
              : holding.average_price;
          }

          const saneCurrentNum = Number(saneCurrentPrice);
          const averageCost = mul(money(holding.average_price), fx);
          const currentEur = mul(money(saneCurrentPrice), fx);
          const costBasis = mul(quantity, averageCost);
          const marketValue = mul(quantity, currentEur);
          const unrealized = subtract(marketValue, costBasis);
          const today = new Date().toISOString().slice(0, 10);
          const previous = holding.previous_close;
          const prevNum = previous !== null ? Number(previous) : 0;
          const prevIsSane =
            previous !== null &&
            prevNum > 0 &&
            isSanePrice(prevNum, saneCurrentNum) &&
            Math.abs(prevNum - saneCurrentNum) / Math.max(saneCurrentNum, 0.0001) <= 0.35;

          let effectivePrevNum: number | null = prevIsSane ? prevNum : null;
          if (effectivePrevNum === null) {
            const priorPrice = pricesList.find(
              (p) =>
                p.instrument_id === holding.instrument_id &&
                p.as_of < today &&
                isSanePrice(Number(p.close), saneCurrentNum) &&
                Math.abs(Number(p.close) - saneCurrentNum) /
                  Math.max(saneCurrentNum, 0.0001) <=
                  0.35,
            );
            if (priorPrice) {
              effectivePrevNum = Number(priorPrice.close);
            }
          }

          let dayChange: Position['dayChange'] = null;
          let dayChangePct: Position['dayChangePct'] = null;
          if (effectivePrevNum !== null && effectivePrevNum > 0) {
            const previousEur = mul(money(effectivePrevNum), fx);
            dayChange = mul(quantity, subtract(currentEur, previousEur));
            dayChangePct = ratio(subtract(currentEur, previousEur), previousEur);
          }

          const pos: Position = {
            instrumentId: holding.instrument_id,
            provider,
            quantity,
            averageCost,
            costBasis,
            marketValue,
            unrealized,
            unrealizedPct: ratio(unrealized, costBasis),
            dayChange,
            dayChangePct,
          };

          const providerList = byProvider.get(provider) ?? [];
          providerList.push(pos);
          byProvider.set(provider, providerList);

          return pos;
        });

        const positions = mergePositionsByInstrument(rawPositions);
        return { positions, byProvider, instruments, fromBroker: true };
      }

      const transactionsRes = await supabase
        .from('transactions')
        .select('*')
        .not('instrument_id', 'is', null);

      if (transactionsRes.error) throw transactionsRes.error;

      const transactions = (transactionsRes.data ?? []).map(toTransaction);
      const latestPrice = latestByKey(
        pricesRes.data ?? [],
        (row) => row.instrument_id,
      );
      const positions = derivePositions(
        transactions,
        (instrumentId) => {
          const price = latestPrice.get(instrumentId);
          return price ? { close: price.close, currency: price.currency } : null;
        },
        fxRate,
      );
      return {
        positions,
        byProvider: new Map(),
        instruments,
        fromBroker: false,
      };
    },
  });
