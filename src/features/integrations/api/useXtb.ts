import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  parseXtbFile,
  xtbTickerToYahooSymbol,
  type XtbParsedReport,
} from '@/core/importers/xtb';
import { setAccountInstitutionOverride, toAccount } from '@/db/mappers';
import { supabase } from '@/db/supabase';

const XTB_STATE_STORAGE_KEY = 'strata_xtb_state_v1';

export interface XtbStoredHolding {
  instrumentId: string;
  ticker: string;
  yahooSymbol: string;
  name: string;
  sector: string | null;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  previousClose: number | null;
  currency: string;
  provider: string;
}

export interface XtbLocalState {
  accountId: string | null;
  accountNumber: string | null;
  generatedAt: string | null;
  importedAt: string;
  openPositionsCount: number;
  cashOperationsCount: number;
  closedPositionsCount: number;
  freeCash: number;
  invested: number;
  ppl: number;
  total: number;
  holdings: XtbStoredHolding[];
}

export const xtbStateKey = ['xtb-state'] as const;

export const getLocalXtbState = (): XtbLocalState | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(XTB_STATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as XtbLocalState;
    if (!parsed || !Array.isArray(parsed.holdings)) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const setLocalXtbState = (state: XtbLocalState | null): void => {
  if (typeof window === 'undefined') return;
  try {
    if (!state) {
      window.localStorage.removeItem(XTB_STATE_STORAGE_KEY);
    } else {
      window.localStorage.setItem(XTB_STATE_STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    // ignore storage errors
  }
};

export const useXtbState = () =>
  useQuery<XtbLocalState | null>({
    queryKey: xtbStateKey,
    queryFn: () => getLocalXtbState(),
  });

const ensureXtbAccount = async (preferredAccountId?: string): Promise<string> => {
  const { data: existingRows, error: listErr } = await supabase
    .from('accounts')
    .select('*')
    .is('archived_at', null)
    .order('created_at', { ascending: true });

  if (listErr) throw listErr;
  const accounts = (existingRows ?? []).map(toAccount);

  if (preferredAccountId) {
    const matched = accounts.find((a) => a.id === preferredAccountId);
    if (matched) return matched.id;
  }

  const existingXtb = accounts.find(
    (a) =>
      a.institutionId === 'xtb' ||
      a.name.trim().toUpperCase().startsWith('XTB'),
  );
  if (existingXtb) {
    setAccountInstitutionOverride(existingXtb.id, 'xtb');
    return existingXtb.id;
  }

  const attemptInsert = (instId: string) =>
    supabase
      .from('accounts')
      .insert({
        name: 'XTB',
        type: 'investment',
        institution_id: instId,
      })
      .select('*')
      .single();

  let { data, error } = await attemptInsert('xtb');
  if (error && error.code === '23503') {
    await supabase.functions
      .invoke('market', { body: { action: 'ensure-institutions' } })
      .catch(() => undefined);
    const retry = await attemptInsert('xtb');
    data = retry.data;
    error = retry.error;
    if (error && error.code === '23503') {
      const fallback = await attemptInsert('trade_republic');
      data = fallback.data;
      error = fallback.error;
      if (data) {
        setAccountInstitutionOverride(data.id, 'xtb');
      }
    }
  }
  if (error || !data) throw error ?? new Error('Failed to create XTB account');
  setAccountInstitutionOverride(data.id, 'xtb');
  return data.id;
};

interface YahooQuoteItem {
  price: number;
  previousClose: number;
  currency: string;
}

const fetchYahooQuotesInEur = async (
  symbols: string[],
): Promise<Map<string, { priceEur: number; previousCloseEur: number | null }>> => {
  const result = new Map<
    string,
    { priceEur: number; previousCloseEur: number | null }
  >();
  if (symbols.length === 0) return result;

  try {
    const [quotesRes, fxRes] = await Promise.all([
      supabase.functions.invoke<{
        quotes?: Record<string, YahooQuoteItem>;
      }>('market', {
        body: { action: 'quotes', symbols: symbols.join(',') },
      }),
      supabase
        .from('fx_rates')
        .select('base, rate, as_of')
        .eq('quote', 'EUR')
        .order('as_of', { ascending: false })
        .limit(25),
    ]);

    const fxMap = new Map<string, number>();
    for (const row of fxRes.data ?? []) {
      if (!fxMap.has(row.base)) fxMap.set(row.base, Number(row.rate));
    }
    const toEurRate = (curr: string): number => {
      const upper = curr.toUpperCase();
      if (upper === 'EUR') return 1;
      if (upper === 'GBX' || upper === 'GBP') {
        const gbp = fxMap.get('GBP') ?? 1.17;
        return upper === 'GBX' ? gbp / 100 : gbp;
      }
      return fxMap.get(upper) ?? (upper === 'USD' ? 0.92 : 1);
    };

    const quotes = quotesRes.data?.quotes ?? {};
    for (const [symbol, q] of Object.entries(quotes)) {
      if (!q || !Number.isFinite(q.price) || q.price <= 0) continue;
      const rate = toEurRate(q.currency || 'EUR');
      const priceEur = q.price * rate;
      const previousCloseEur =
        Number.isFinite(q.previousClose) && q.previousClose > 0
          ? q.previousClose * rate
          : null;
      result.set(symbol, { priceEur, previousCloseEur });
    }
  } catch {
    // Non-critical: fall back to report prices
  }
  return result;
};

const deterministicUuid = (seed: string): string => {
  let h1 = 0xdeadbeef ^ seed.length;
  let h2 = 0x41c6ce57 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const hex3 = ((h1 ^ h2) >>> 0).toString(16).padStart(8, '0');
  const hex4 = ((h1 + h2) >>> 0).toString(16).padStart(8, '0');
  return `${hex1}-${hex2.slice(0, 4)}-4${hex2.slice(5, 8)}-a${hex3.slice(1, 4)}-${hex3.slice(4, 8)}${hex4}`;
};

const resolveOrCreateInstruments = async (
  parsed: XtbParsedReport,
): Promise<{
  idByXtbTicker: Map<string, string>;
  metaById: Map<
    string,
    { ticker: string; yahooSymbol: string; name: string; sector: string | null }
  >;
  dbInstrumentIds: Set<string>;
}> => {
  const { data: existing } = await supabase
    .from('instruments')
    .select('id, ticker, name, yahoo_symbol, sector');

  const byTicker = new Map<string, { id: string; sector: string | null }>();
  const byYahoo = new Map<string, { id: string; sector: string | null }>();
  const dbInstrumentIds = new Set<string>();

  for (const row of existing ?? []) {
    dbInstrumentIds.add(row.id);
    byTicker.set(row.ticker.toUpperCase(), { id: row.id, sector: row.sector });
    if (row.yahoo_symbol) {
      byYahoo.set(row.yahoo_symbol.toUpperCase(), {
        id: row.id,
        sector: row.sector,
      });
    }
  }

  const idByXtbTicker = new Map<string, string>();
  const metaById = new Map<
    string,
    { ticker: string; yahooSymbol: string; name: string; sector: string | null }
  >();

  for (const [xtbTicker, info] of parsed.instruments.entries()) {
    const match =
      byYahoo.get(info.yahooSymbol.toUpperCase()) ??
      byTicker.get(info.bareTicker.toUpperCase()) ??
      byTicker.get(xtbTicker.toUpperCase());

    if (match) {
      idByXtbTicker.set(xtbTicker, match.id);
      metaById.set(match.id, {
        ticker: info.bareTicker,
        yahooSymbol: info.yahooSymbol,
        name: info.name,
        sector: match.sector,
      });
      continue;
    }

    const { data: inserted, error } = await supabase
      .from('instruments')
      .insert({
        ticker: info.bareTicker,
        name: info.name,
        currency: 'EUR',
        yahoo_symbol: info.yahooSymbol,
      })
      .select('id, sector')
      .single();

    if (!error && inserted) {
      dbInstrumentIds.add(inserted.id);
      idByXtbTicker.set(xtbTicker, inserted.id);
      metaById.set(inserted.id, {
        ticker: info.bareTicker,
        yahooSymbol: info.yahooSymbol,
        name: info.name,
        sector: inserted.sector ?? null,
      });
    } else {
      const localId = deterministicUuid(`xtb-instrument:${xtbTicker}`);
      idByXtbTicker.set(xtbTicker, localId);
      metaById.set(localId, {
        ticker: info.bareTicker,
        yahooSymbol: info.yahooSymbol,
        name: info.name,
        sector: null,
      });
    }
  }

  return { idByXtbTicker, metaById, dbInstrumentIds };
};

const syncXtbToDatabase = async (
  holdings: XtbStoredHolding[],
  freeCash: number,
  invested: number,
  ppl: number,
  total: number,
): Promise<void> => {
  // 1. Try upserting holdings with provider = 'xtb' (Migration 0036)
  try {
    await supabase.from('holdings').delete().eq('provider', 'xtb');
    if (holdings.length > 0) {
      const rowsWithProvider = holdings.map((h) => ({
        instrument_id: h.instrumentId,
        provider: 'xtb',
        quantity: h.quantity.toFixed(8),
        average_price: h.averagePrice.toFixed(6),
        current_price: h.currentPrice.toFixed(6),
        previous_close:
          h.previousClose !== null ? h.previousClose.toFixed(6) : null,
        currency: h.currency,
      }));
      const { error } = await supabase.from('holdings').upsert(rowsWithProvider, {
        onConflict: 'user_id,instrument_id,provider',
      });
      if (error) {
        // Fallback if provider column is not yet migrated on remote DB
        const rowsWithoutProvider = holdings.map((h) => ({
          instrument_id: h.instrumentId,
          quantity: h.quantity.toFixed(8),
          average_price: h.averagePrice.toFixed(6),
          current_price: h.currentPrice.toFixed(6),
          previous_close:
            h.previousClose !== null ? h.previousClose.toFixed(6) : null,
          currency: h.currency,
        }));
        await supabase.from('holdings').upsert(rowsWithoutProvider, {
          onConflict: 'user_id,instrument_id',
        });
      }
    }
  } catch {
    // Handled via local state mirror if RLS not yet migrated
  }

  // 2. Try upserting broker_accounts for provider = 'xtb'
  try {
    await supabase.from('broker_accounts').upsert(
      {
        provider: 'xtb',
        free: freeCash.toFixed(4),
        invested: invested.toFixed(4),
        ppl: ppl.toFixed(4),
        total: total.toFixed(4),
        currency: 'EUR',
      },
      { onConflict: 'user_id,provider' },
    );
  } catch {
    // Handled via local state mirror if RLS not yet migrated
  }
};

export interface ImportXtbResult {
  accountId: string;
  insertedTransactions: number;
  openPositionsCount: number;
  freeCash: number;
  totalValue: number;
}

export const useImportXtbReport = () => {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      fileData?: string | ArrayBuffer | Uint8Array;
      csvText?: string;
      accountId?: string;
    }): Promise<ImportXtbResult> => {
      const payload = input.fileData ?? input.csvText ?? '';
      const parsed = await parseXtbFile(payload);
      if (
        parsed.openPositions.length === 0 &&
        parsed.cashOperations.length === 0 &&
        parsed.closedPositions.length === 0
      ) {
        throw new Error(
          'No valid XTB positions or cash operations found in the selected file.',
        );
      }

      const accountId = await ensureXtbAccount(input.accountId);
      const { idByXtbTicker, metaById, dbInstrumentIds } =
        await resolveOrCreateInstruments(parsed);

      // Deduplicate and insert Cash Operations into transactions
      const { data: existingTx } = await supabase
        .from('transactions')
        .select('external_id, amount')
        .eq('account_id', accountId);

      const existingExternalIds = new Set(
        (existingTx ?? [])
          .map((t) => t.external_id)
          .filter((id): id is string => Boolean(id)),
      );

      const newTxRows = parsed.cashOperations
        .filter((op) => !existingExternalIds.has(op.externalId))
        .map((op) => {
          const resolvedInstId = op.xtbTicker
            ? (idByXtbTicker.get(op.xtbTicker) ?? null)
            : null;
          const validDbInstId =
            resolvedInstId && dbInstrumentIds.has(resolvedInstId)
              ? resolvedInstId
              : null;
          return {
            account_id: accountId,
            instrument_id: validDbInstId,
            kind: op.kind,
            amount: op.amount.toFixed(4),
            quantity: op.quantity !== null ? op.quantity.toFixed(8) : null,
            currency: 'EUR',
            fx_rate: '1',
            occurred_at: op.occurredAt,
            note: op.note,
            source: 'csv_import' as const,
            external_id: op.externalId,
          };
        });

      let insertedTransactions = 0;
      if (newTxRows.length > 0) {
        const { error: txErr } = await supabase
          .from('transactions')
          .insert(newTxRows);
        if (txErr) throw txErr;
        insertedTransactions = newTxRows.length;
      }

      // Compute authoritative free cash from account ledger
      const { data: allAccountTx } = await supabase
        .from('transactions')
        .select('amount, occurred_at, external_id')
        .eq('account_id', accountId);

      let ledgerCash = (allAccountTx ?? []).reduce(
        (sum, t) => sum + Number(t.amount),
        0,
      );

      // If a partial 30-day report had buys funded by earlier deposits outside the report window,
      // insert an initial balance adjustment so free cash isn't negative.
      const expectedCash = Math.max(0, parsed.cashOperationsTotal);
      if (
        ledgerCash < -0.005 &&
        !(allAccountTx ?? []).some((t) => t.external_id === 'xtb:initial-balance')
      ) {
        const diff = expectedCash - ledgerCash;
        if (diff > 0.005) {
          const earliestIso =
            parsed.cashOperations.length > 0
              ? new Date(
                  Math.min(
                    ...parsed.cashOperations.map((op) =>
                      new Date(op.occurredAt).getTime(),
                    ),
                  ) - 60_000,
                ).toISOString()
              : new Date().toISOString();
          const { error: adjErr } = await supabase.from('transactions').insert({
            account_id: accountId,
            kind: 'deposit',
            amount: diff.toFixed(4),
            currency: 'EUR',
            fx_rate: '1',
            occurred_at: earliestIso,
            note: 'Initial XTB balance prior to report window',
            source: 'csv_import',
            external_id: 'xtb:initial-balance',
          });
          if (!adjErr) {
            ledgerCash += diff;
            insertedTransactions += 1;
          }
        }
      }

      const freeCash = Math.max(0, Math.round(ledgerCash * 100) / 100);

      // Enrich Open Positions with live Yahoo Finance quotes + previousClose
      const yahooSymbols = parsed.openPositions.map((p) => p.yahooSymbol);
      const liveQuotes = await fetchYahooQuotesInEur(yahooSymbols);

      const storedHoldings: XtbStoredHolding[] = parsed.openPositions.map((pos) => {
        const instrumentId =
          idByXtbTicker.get(pos.xtbTicker) ??
          deterministicUuid(`xtb-instrument:${pos.xtbTicker}`);
        const meta = metaById.get(instrumentId);
        const live = liveQuotes.get(pos.yahooSymbol);

        const currentPrice =
          live &&
          pos.averagePriceEur > 0 &&
          live.priceEur / pos.averagePriceEur >= 0.2 &&
          live.priceEur / pos.averagePriceEur <= 5
            ? live.priceEur
            : pos.currentPriceEur;

        const previousClose =
          live?.previousCloseEur &&
          currentPrice > 0 &&
          Math.abs(live.previousCloseEur - currentPrice) / currentPrice <= 0.35
            ? live.previousCloseEur
            : null;

        return {
          instrumentId,
          ticker: pos.bareTicker,
          yahooSymbol: pos.yahooSymbol,
          name: pos.name,
          sector: meta?.sector ?? null,
          quantity: pos.quantity,
          averagePrice: pos.averagePriceEur,
          currentPrice,
          previousClose,
          currency: 'EUR',
          provider: 'xtb',
        };
      });

      const invested = storedHoldings.reduce(
        (sum, h) => sum + h.quantity * h.averagePrice,
        0,
      );
      const marketValue = storedHoldings.reduce(
        (sum, h) => sum + h.quantity * h.currentPrice,
        0,
      );
      const ppl = marketValue - invested;
      const total = freeCash + marketValue;

      const localState: XtbLocalState = {
        accountId,
        accountNumber: parsed.accountNumber,
        generatedAt: parsed.generatedAt,
        importedAt: new Date().toISOString(),
        openPositionsCount: storedHoldings.length,
        cashOperationsCount: parsed.cashOperations.length,
        closedPositionsCount: parsed.closedPositions.length,
        freeCash,
        invested,
        ppl,
        total,
        holdings: storedHoldings,
      };
      setLocalXtbState(localState);

      await syncXtbToDatabase(storedHoldings, freeCash, invested, ppl, total);

      await supabase.functions
        .invoke('market', { body: { action: 'refresh' } })
        .catch(() => undefined);

      return {
        accountId,
        insertedTransactions,
        openPositionsCount: storedHoldings.length,
        freeCash,
        totalValue: total,
      };
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['accounts'] });
      void client.invalidateQueries({ queryKey: ['transactions'] });
      void client.invalidateQueries({ queryKey: ['positions'] });
      void client.invalidateQueries({ queryKey: ['instruments'] });
      void client.invalidateQueries({ queryKey: ['broker-accounts'] });
      void client.invalidateQueries({ queryKey: ['net-worth-history'] });
      void client.invalidateQueries({ queryKey: xtbStateKey });
    },
  });
};

export interface ManualHoldingInput {
  accountId?: string;
  symbol: string;
  name: string;
  quantity: number;
  averagePriceEur: number;
}

export const useUpsertXtbHolding = () => {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (input: ManualHoldingInput) => {
      const accountId = await ensureXtbAccount(input.accountId);
      const { bareTicker, yahooSymbol } = xtbTickerToYahooSymbol(input.symbol);
      const cleanName = input.name.trim() || bareTicker;

      const liveMap = await fetchYahooQuotesInEur([yahooSymbol]);
      const live = liveMap.get(yahooSymbol);
      const currentPrice = live?.priceEur ?? input.averagePriceEur;
      const previousClose = live?.previousCloseEur ?? null;

      // Try resolving or creating in DB instruments
      let instrumentId = deterministicUuid(`xtb-instrument:${yahooSymbol}`);
      let sector: string | null = null;
      try {
        const { data: existing } = await supabase
          .from('instruments')
          .select('id, sector')
          .or(`yahoo_symbol.eq.${yahooSymbol},ticker.eq.${bareTicker}`)
          .limit(1)
          .maybeSingle();

        if (existing) {
          instrumentId = existing.id;
          sector = existing.sector;
        } else {
          const { data: inserted } = await supabase
            .from('instruments')
            .insert({
              ticker: bareTicker,
              name: cleanName,
              currency: 'EUR',
              yahoo_symbol: yahooSymbol,
            })
            .select('id, sector')
            .single();
          if (inserted) {
            instrumentId = inserted.id;
            sector = inserted.sector;
          }
        }
      } catch {
        // Fallback to deterministic local ID
      }

      const prev = getLocalXtbState();
      const existingHoldings = (prev?.holdings ?? []).filter(
        (h) =>
          h.instrumentId !== instrumentId &&
          h.yahooSymbol.toUpperCase() !== yahooSymbol.toUpperCase(),
      );

      const nextHolding: XtbStoredHolding = {
        instrumentId,
        ticker: bareTicker,
        yahooSymbol,
        name: cleanName,
        sector,
        quantity: input.quantity,
        averagePrice: input.averagePriceEur,
        currentPrice,
        previousClose,
        currency: 'EUR',
        provider: 'xtb',
      };

      const holdings =
        input.quantity > 0 ? [...existingHoldings, nextHolding] : existingHoldings;

      const freeCash = prev?.freeCash ?? 0;
      const invested = holdings.reduce(
        (sum, h) => sum + h.quantity * h.averagePrice,
        0,
      );
      const marketValue = holdings.reduce(
        (sum, h) => sum + h.quantity * h.currentPrice,
        0,
      );
      const ppl = marketValue - invested;
      const total = freeCash + marketValue;

      const nextState: XtbLocalState = {
        accountId,
        accountNumber: prev?.accountNumber ?? null,
        generatedAt: prev?.generatedAt ?? null,
        importedAt: new Date().toISOString(),
        openPositionsCount: holdings.length,
        cashOperationsCount: prev?.cashOperationsCount ?? 0,
        closedPositionsCount: prev?.closedPositionsCount ?? 0,
        freeCash,
        invested,
        ppl,
        total,
        holdings,
      };
      setLocalXtbState(nextState);
      await syncXtbToDatabase(holdings, freeCash, invested, ppl, total);
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['positions'] });
      void client.invalidateQueries({ queryKey: ['instruments'] });
      void client.invalidateQueries({ queryKey: ['broker-accounts'] });
      void client.invalidateQueries({ queryKey: xtbStateKey });
    },
  });
};

export const useDeleteXtbHolding = () => {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async (instrumentId: string) => {
      const prev = getLocalXtbState();
      const holdings = (prev?.holdings ?? []).filter(
        (h) => h.instrumentId !== instrumentId,
      );
      const freeCash = prev?.freeCash ?? 0;
      const invested = holdings.reduce(
        (sum, h) => sum + h.quantity * h.averagePrice,
        0,
      );
      const marketValue = holdings.reduce(
        (sum, h) => sum + h.quantity * h.currentPrice,
        0,
      );
      const ppl = marketValue - invested;
      const total = freeCash + marketValue;

      if (prev) {
        setLocalXtbState({
          ...prev,
          openPositionsCount: holdings.length,
          invested,
          ppl,
          total,
          holdings,
        });
      }

      try {
        await supabase
          .from('holdings')
          .delete()
          .eq('instrument_id', instrumentId)
          .eq('provider', 'xtb');
      } catch {
        // ignore if provider column not yet migrated
      }

      await syncXtbToDatabase(holdings, freeCash, invested, ppl, total);
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['positions'] });
      void client.invalidateQueries({ queryKey: ['broker-accounts'] });
      void client.invalidateQueries({ queryKey: xtbStateKey });
    },
  });
};

export const refreshLocalXtbQuotes = async (): Promise<void> => {
  const state = getLocalXtbState();
  if (!state || state.holdings.length === 0) return;

  const symbols = state.holdings.map((h) => h.yahooSymbol).filter(Boolean);
  const liveQuotes = await fetchYahooQuotesInEur(symbols);
  if (liveQuotes.size === 0) return;

  const updatedHoldings = state.holdings.map((h) => {
    const live = liveQuotes.get(h.yahooSymbol);
    if (!live) return h;

    const currentPrice =
      h.averagePrice > 0 &&
      live.priceEur / h.averagePrice >= 0.1 &&
      live.priceEur / h.averagePrice <= 10
        ? live.priceEur
        : h.currentPrice;

    const previousClose =
      live.previousCloseEur &&
      currentPrice > 0 &&
      Math.abs(live.previousCloseEur - currentPrice) / currentPrice <= 0.35
        ? live.previousCloseEur
        : h.previousClose;

    return {
      ...h,
      currentPrice,
      previousClose,
    };
  });

  const invested = updatedHoldings.reduce(
    (sum, h) => sum + h.quantity * h.averagePrice,
    0,
  );
  const marketValue = updatedHoldings.reduce(
    (sum, h) => sum + h.quantity * h.currentPrice,
    0,
  );
  const ppl = marketValue - invested;
  const total = state.freeCash + marketValue;

  setLocalXtbState({
    ...state,
    invested,
    ppl,
    total,
    holdings: updatedHoldings,
  });

  await syncXtbToDatabase(
    updatedHoldings,
    state.freeCash,
    invested,
    ppl,
    total,
  );
};

export const useResetXtbData = () => {
  const client = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const prev = getLocalXtbState();
      setLocalXtbState(null);

      try {
        await supabase.from('holdings').delete().eq('provider', 'xtb');
      } catch {
        // ignore
      }
      try {
        await supabase.from('broker_accounts').delete().eq('provider', 'xtb');
      } catch {
        // ignore
      }
      if (prev?.accountId) {
        try {
          await supabase
            .from('transactions')
            .delete()
            .eq('account_id', prev.accountId)
            .eq('source', 'csv_import');
        } catch {
          // ignore
        }
      }
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['accounts'] });
      void client.invalidateQueries({ queryKey: ['transactions'] });
      void client.invalidateQueries({ queryKey: ['positions'] });
      void client.invalidateQueries({ queryKey: ['broker-accounts'] });
      void client.invalidateQueries({ queryKey: xtbStateKey });
    },
  });
};

