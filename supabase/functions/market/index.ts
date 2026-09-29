import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendPush } from '../_shared/push.ts';
import {
  reconstructInvestments,
  type LedgerEntry,
  type PricePoint,
} from '../_shared/history/reconstruct.ts';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const cors: HeadersInit = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

const msg = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// Run `fn` over items with bounded concurrency — fast without hammering Yahoo
// into rate limits.
const mapLimit = async <T>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> => {
  const queue = [...items];
  const worker = async () => {
    for (;;) {
      const item = queue.shift();
      if (item === undefined) return;
      await fn(item);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, worker),
  );
};

const admin = (): SupabaseClient =>
  createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

const bearer = (req: Request): string =>
  (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();

// Cron passes the service-role key → refresh everyone. A user's JWT → scope to
// that user, so a client can never trigger a global refresh or fan-out.
const callerScope = async (
  req: Request,
): Promise<{ all: boolean; userId?: string }> => {
  const token = bearer(req);
  if (token && token === (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')) {
    return { all: true };
  }
  const scoped = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } },
  );
  const { data } = await scoped.auth.getUser();
  return { all: false, userId: data.user?.id };
};

interface YahooAuth {
  cookie: string;
  crumb: string;
}

let authPromise: Promise<YahooAuth> | null = null;

const buildAuth = async (): Promise<YahooAuth> => {
  const seed = await fetch('https://fc.yahoo.com/', {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
  });
  await seed.body?.cancel();
  const cookie = (seed.headers.getSetCookie?.() ?? [])
    .map((entry) => entry.split(';')[0])
    .filter(Boolean)
    .join('; ');

  const crumbRes = await fetch(
    'https://query1.finance.yahoo.com/v1/test/getcrumb',
    { headers: { 'User-Agent': UA, Accept: 'text/plain', Cookie: cookie } },
  );
  const crumb = (await crumbRes.text()).trim();
  return { cookie, crumb };
};

const getAuth = (force = false): Promise<YahooAuth> => {
  if (force || !authPromise) authPromise = buildAuth();
  return authPromise;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const yFetch = async (url: string, attempt = 0): Promise<Response> => {
  const { cookie } = await getAuth();
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
  if ((res.status === 429 || res.status === 503) && attempt < 3) {
    await res.body?.cancel();
    await sleep(500 * 2 ** attempt);
    return yFetch(url, attempt + 1);
  }
  if ((res.status === 401 || res.status === 403) && attempt < 2) {
    await res.body?.cancel();
    await getAuth(true);
    return yFetch(url, attempt + 1);
  }
  return res;
};

interface Quote {
  symbol: string;
  price: number;
  previousClose: number;
  currency: string;
}

interface QuoteResult {
  quote: Quote;
  history: { date: string; value: number }[];
}

const normalizeMinorCurrency = (
  rawCurrency: string,
): { currency: string; scale: number } => {
  if (rawCurrency === 'GBp' || rawCurrency === 'GBX') {
    return { currency: 'GBP', scale: 0.01 };
  }
  if (rawCurrency === 'ZAc') {
    return { currency: 'ZAR', scale: 0.01 };
  }
  if (rawCurrency === 'ILA') {
    return { currency: 'ILS', scale: 0.01 };
  }
  return { currency: rawCurrency, scale: 1 };
};

const fetchQuote = async (symbol: string, range = '1y'): Promise<QuoteResult> => {
  const res = await yFetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`,
  );
  if (!res.ok) throw new Error(`chart ${symbol}: HTTP ${res.status}`);
  const body = await res.json();
  const result = body?.chart?.result?.[0];
  if (!result?.meta) {
    const detail = body?.chart?.error?.description;
    throw new Error(`chart ${symbol}: ${detail ?? 'no data'}`);
  }
  const meta = result.meta;
  const rawPrice = Number(meta.regularMarketPrice);
  if (!Number.isFinite(rawPrice)) throw new Error(`chart ${symbol}: no price`);

  const { currency, scale } = normalizeMinorCurrency(
    String(meta.currency ?? 'USD'),
  );
  const price = rawPrice * scale;
  const rawPrev = Number(meta.chartPreviousClose ?? meta.previousClose ?? rawPrice);
  const previousClose = rawPrev * scale;

  const timestamps: number[] = result.timestamp ?? [];
  const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
  const history = timestamps
    .map((t, i) => ({ t, c: closes[i] }))
    .filter((p) => typeof p.c === 'number')
    .map((p) => ({
      date: new Date(p.t * 1000).toISOString().slice(0, 10),
      value: Number(p.c) * scale,
    }));

  return {
    quote: {
      symbol,
      price,
      previousClose,
      currency,
    },
    history,
  };
};

interface SearchHit {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

const search = async (q: string): Promise<SearchHit[]> => {
  if (q.trim().length < 1) return [];
  const { crumb } = await getAuth();
  const res = await yFetch(
    `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=12&newsCount=0&crumb=${encodeURIComponent(crumb)}`,
  );
  if (!res.ok) throw new Error(`search: HTTP ${res.status}`);
  const body = await res.json();
  return (body?.quotes ?? [])
    .filter((x: Record<string, unknown>) =>
      ['EQUITY', 'ETF', 'CRYPTOCURRENCY'].includes(String(x.quoteType)),
    )
    .map((x: Record<string, unknown>) => ({
      symbol: String(x.symbol),
      name: String(x.shortname ?? x.longname ?? x.symbol),
      exchange: String(x.exchDisp ?? ''),
      type: String(x.quoteType),
    }));
};

const fetchSector = async (symbol: string): Promise<string | null> => {
  const { crumb } = await getAuth();
  const res = await yFetch(
    `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=assetProfile&crumb=${encodeURIComponent(crumb)}`,
  );
  if (!res.ok) {
    await res.body?.cancel();
    return null;
  }
  const body = await res.json();
  const sector = body?.quoteSummary?.result?.[0]?.assetProfile?.sector;
  return typeof sector === 'string' && sector.trim().length > 0
    ? sector.trim()
    : null;
};

// Yahoo wraps every figure as { raw, fmt, longFmt }; we only ever want raw.
const rawNumber = (node: unknown): number | null => {
  const value = (node as { raw?: unknown } | null | undefined)?.raw;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

// Dates arrive as epoch seconds. Return a plain YYYY-MM-DD so the client does
// no timezone maths on a date that has no time-of-day meaning anyway.
const rawDate = (node: unknown): string | null => {
  const seconds = rawNumber(node);
  return seconds === null
    ? null
    : new Date(seconds * 1000).toISOString().slice(0, 10);
};

interface InstrumentProfile {
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

const fetchProfile = async (symbol: string): Promise<InstrumentProfile> => {
  const { crumb } = await getAuth();
  const modules =
    'calendarEvents,summaryDetail,defaultKeyStatistics,assetProfile';
  const res = await yFetch(
    `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}&crumb=${encodeURIComponent(crumb)}`,
  );
  if (!res.ok) throw new Error(`profile ${symbol}: HTTP ${res.status}`);
  const body = await res.json();
  const result = body?.quoteSummary?.result?.[0];
  if (!result) throw new Error(`profile ${symbol}: no data`);

  const detail = result.summaryDetail ?? {};
  const stats = result.defaultKeyStatistics ?? {};
  const events = result.calendarEvents ?? {};
  const asset = result.assetProfile ?? {};
  // earningsDate is a list — the next scheduled one is the first entry.
  const earnings = events.earnings?.earningsDate?.[0];

  return {
    symbol,
    currency: typeof detail.currency === 'string' ? detail.currency : null,
    fiftyTwoWeekHigh: rawNumber(detail.fiftyTwoWeekHigh),
    fiftyTwoWeekLow: rawNumber(detail.fiftyTwoWeekLow),
    dayHigh: rawNumber(detail.dayHigh),
    dayLow: rawNumber(detail.dayLow),
    marketCap: rawNumber(detail.marketCap),
    trailingPe: rawNumber(detail.trailingPE),
    forwardPe: rawNumber(stats.forwardPE),
    dividendYield: rawNumber(detail.dividendYield),
    dividendRate: rawNumber(detail.dividendRate),
    beta: rawNumber(detail.beta),
    earningsDate: rawDate(earnings),
    exDividendDate: rawDate(events.exDividendDate ?? detail.exDividendDate),
    dividendDate: rawDate(events.dividendDate),
    sector: typeof asset.sector === 'string' ? asset.sector : null,
    industry: typeof asset.industry === 'string' ? asset.industry : null,
  };
};

const resolveSymbol = async (
  isin: string | null,
  ticker: string,
  yahooSymbol: string | null,
): Promise<string | null> => {
  if (yahooSymbol) return yahooSymbol;
  if (isin) {
    const matches = await search(isin);
    if (matches[0]) return matches[0].symbol;
  }
  const bare = ticker.split('_')[0];
  return bare || null;
};

const candidateSymbols = async (
  isin: string | null,
  ticker: string,
  yahooSymbol: string | null,
): Promise<string[]> => {
  const list: string[] = [];
  const push = (symbol: string | null | undefined) => {
    if (symbol && !list.includes(symbol)) list.push(symbol);
  };
  push(yahooSymbol);
  if (isin) {
    try {
      for (const match of await search(isin)) push(match.symbol);
    } catch {
      // ignore, fall through to ticker
    }
  }
  push(ticker.split('_')[0]);
  return list;
};

const quoteForInstrument = async (
  isin: string | null,
  ticker: string,
  yahooSymbol: string | null,
  range: string,
): Promise<QuoteResult & { symbol: string }> => {
  const candidates = await candidateSymbols(isin, ticker, yahooSymbol);
  if (candidates.length === 0) throw new Error(`no symbol for ${ticker || isin}`);
  let lastError = `no data for ${ticker || isin}`;
  for (const symbol of candidates) {
    try {
      const data = await fetchQuote(symbol, range);
      if (data.history.length >= 2) return { ...data, symbol };
      lastError = `chart ${symbol}: only ${data.history.length} points`;
    } catch (error) {
      lastError = msg(error);
    }
  }
  throw new Error(lastError);
};

const round2 = (value: number): number => Math.round(value * 100) / 100;

// Persist a daily investment snapshot so the net-worth history fills in even
// on days the app is never opened. Only the investment value is authoritative
// here; cash and liabilities are carried from the user's most recent snapshot.
// ignoreDuplicates means a precise value the client already wrote for today is
// never clobbered by this approximation.
const recordSnapshots = async (
  db: SupabaseClient,
  investmentByUser: Map<string, { free: number; market: number }>,
): Promise<void> => {
  const userIds = [...investmentByUser.keys()];
  if (userIds.length === 0) return;
  const asOf = new Date().toISOString().slice(0, 10);

  const { data: prev } = await db
    .from('net_worth_snapshots')
    .select('user_id, as_of, net, investments')
    .in('user_id', userIds)
    .order('as_of', { ascending: false });
  const lastByUser = new Map<string, { net: number; investments: number }>();
  for (const row of prev ?? []) {
    if (!lastByUser.has(row.user_id)) {
      lastByUser.set(row.user_id, {
        net: Number(row.net),
        investments: Number(row.investments ?? 0),
      });
    }
  }

  const rows = userIds.map((uid) => {
    const entry = investmentByUser.get(uid)!;
    const investments = round2(entry.market);
    const last = lastByUser.get(uid);
    const nonInvestment = last ? last.net - last.investments : entry.free;
    const net = round2(investments + nonInvestment);
    return {
      user_id: uid,
      as_of: asOf,
      net,
      assets: round2(Math.max(net, 0)),
      liabilities: 0,
      investments,
    };
  });

  await db
    .from('net_worth_snapshots')
    .upsert(rows, { onConflict: 'user_id,as_of', ignoreDuplicates: true });
};

const refresh = async (
  db: SupabaseClient,
  userId?: string,
): Promise<{ updated: number; stale: number; errors: string[] }> => {
  const errors: string[] = [];
  let holdingsQuery = db
    .from('holdings')
    .select('user_id, instrument_id, quantity, average_price, current_price, currency');
  if (userId) holdingsQuery = holdingsQuery.eq('user_id', userId);
  const { data: holdings } = await holdingsQuery;
  if (!holdings || holdings.length === 0) return { updated: 0, stale: 0, errors };

  const ids = [...new Set(holdings.map((h) => h.instrument_id))];
  const { data: instruments } = await db
    .from('instruments')
    .select('id, isin, ticker, yahoo_symbol, sector')
    .in('id', ids);

  const { data: fxRows } = await db
    .from('fx_rates')
    .select('base, rate, as_of')
    .eq('quote', 'EUR')
    .order('as_of', { ascending: false });
  const fx = new Map<string, number>();
  for (const row of fxRows ?? []) if (!fx.has(row.base)) fx.set(row.base, Number(row.rate));
  const rate = (c: string) => (c === 'EUR' ? 1 : (fx.get(c) ?? 1));

  const asOf = new Date().toISOString().slice(0, 10);
  const priceByInstrument = new Map<
    string,
    { price: number; previousClose: number; currency: string }
  >();
  let updated = 0;

  await mapLimit(instruments ?? [], 6, async (instrument) => {
    try {
      const symbol = await resolveSymbol(
        instrument.isin,
        instrument.ticker,
        instrument.yahoo_symbol,
      );
      if (!symbol) return;
      const quoted = await fetchQuote(symbol);
      if (!instrument.yahoo_symbol) {
        await db.rpc('set_instrument_yahoo', { p_id: instrument.id, p_symbol: symbol });
      }
      if (!instrument.sector) {
        try {
          const sector = await fetchSector(symbol);
          if (sector) {
            await db.rpc('set_instrument_sector', { p_id: instrument.id, p_sector: sector });
          }
        } catch {
          // sector is best-effort
        }
      }
      priceByInstrument.set(instrument.id, {
        price: quoted.quote.price,
        previousClose: quoted.quote.previousClose,
        currency: quoted.quote.currency,
      });
      updated += 1;
    } catch (error) {
      errors.push(`${instrument.ticker}: ${msg(error)}`);
    }
  });

  const priceRows: Record<string, unknown>[] = [];
  const validHoldingPrice = new Map<string, number>();

  await mapLimit(holdings, 8, async (holding) => {
    const quoted = priceByInstrument.get(holding.instrument_id);
    if (!quoted) return;

    const targetCurrency = String(holding.currency || 'EUR');
    const quoteCurrency = String(quoted.currency || 'USD');

    // If the quote currency differs from the holding currency and we don't have
    // FX rates for both, reject the quote rather than treating 1 JPY/MXN/ARS as 1 EUR.
    if (
      quoteCurrency !== targetCurrency &&
      ((quoteCurrency !== 'EUR' && !fx.has(quoteCurrency)) ||
        (targetCurrency !== 'EUR' && !fx.has(targetCurrency)))
    ) {
      return;
    }

    const conversionFactor =
      quoteCurrency === targetCurrency
        ? 1
        : rate(quoteCurrency) / rate(targetCurrency);
    const convertedPrice = quoted.price * conversionFactor;
    const convertedPrev = quoted.previousClose * conversionFactor;

    const avgPrice = Number(holding.average_price ?? 0);
    if (avgPrice > 0) {
      const ratioToAvg = convertedPrice / avgPrice;
      if (ratioToAvg > 8 || ratioToAvg < 0.08) {
        // Mismatched listing or wrong ticker — clear the cached Yahoo symbol
        // and keep the holding's authoritative broker price untouched.
        await db
          .rpc('set_instrument_yahoo', {
            p_id: holding.instrument_id,
            p_symbol: null,
          })
          .then(() => undefined, () => undefined);
        return;
      }
    }

    validHoldingPrice.set(
      `${holding.user_id}:${holding.instrument_id}`,
      convertedPrice,
    );

    await db
      .from('holdings')
      .update({ current_price: convertedPrice, previous_close: convertedPrev })
      .eq('user_id', holding.user_id)
      .eq('instrument_id', holding.instrument_id);
    priceRows.push({
      user_id: holding.user_id,
      instrument_id: holding.instrument_id,
      as_of: asOf,
      close: convertedPrice,
      currency: targetCurrency,
    });
  });
  if (priceRows.length > 0) await db.rpc('upsert_prices', { p_rows: priceRows });

  const byUser = new Map<string, { free: number; market: number; stale: number }>();
  let brokersQuery = db
    .from('broker_accounts')
    .select('user_id, free')
    .eq('provider', 't212');
  if (userId) brokersQuery = brokersQuery.eq('user_id', userId);
  const { data: brokers } = await brokersQuery;
  for (const b of brokers ?? [])
    byUser.set(b.user_id, { free: Number(b.free), market: 0, stale: 0 });
  for (const holding of holdings) {
    const entry = byUser.get(holding.user_id);
    if (!entry) continue;
    const validPrice = validHoldingPrice.get(
      `${holding.user_id}:${holding.instrument_id}`,
    );
    // Use the validated fresh quote when we have one, else the last-known stored price,
    // so a holding that failed to quote cleanly isn't dropped or corrupted.
    const price =
      validPrice !== undefined ? validPrice : Number(holding.current_price ?? 0);
    if (validPrice === undefined) entry.stale += 1;
    entry.market += Number(holding.quantity) * price * rate(holding.currency);
  }
  // Keep the broker account total in step with the live Portfolio value: free
  // cash + holdings at the same prices the Portfolio shows. But only overwrite
  // the authoritative account total when every holding priced cleanly this run.
  // A partial refresh (some quotes failed) would silently drift from Trading
  // 212's real figure, so we leave the last authoritative total in place rather
  // than corrupt it — a T212 sync always resets both to T212's own numbers.
  for (const [uid, entry] of byUser) {
    if (entry.stale > 0) continue;
    await db.rpc('set_broker_total', {
      p_user: uid,
      p_total: round2(entry.free + entry.market),
    });
  }

  await recordSnapshots(db, byUser).catch(() => undefined);

  const stale = [...byUser.values()].reduce((sum, entry) => sum + entry.stale, 0);
  return { updated, stale, errors };
};

// --- CoinGecko -------------------------------------------------------------
// Yahoo quotes crypto only as trading pairs, which made search a list of
// BTC-EUR / BTC-USD duplicates and left thinner coins uncovered. CoinGecko
// identifies a coin by slug and prices directly in euro, so there is no pair
// to pick and no second FX conversion.

const COINGECKO = 'https://api.coingecko.com/api/v3';

const cgFetch = async (path: string, attempt = 0): Promise<Response> => {
  const res = await fetch(`${COINGECKO}${path}`, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  // The free tier rate-limits by minute; back off rather than dropping prices.
  if (res.status === 429 && attempt < 3) {
    await res.body?.cancel();
    await sleep(1000 * 2 ** attempt);
    return cgFetch(path, attempt + 1);
  }
  return res;
};

interface CoinHit {
  id: string;
  symbol: string;
  name: string;
  rank: number | null;
  image: string | null;
}

const cryptoSearch = async (query: string): Promise<CoinHit[]> => {
  const q = query.trim();
  if (q.length < 1) return [];
  const res = await cgFetch(`/search?query=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error(`coingecko search: HTTP ${res.status}`);
  const body = await res.json();
  return (body?.coins ?? [])
    .slice(0, 12)
    .map((coin: Record<string, unknown>) => ({
      id: String(coin.id),
      symbol: String(coin.symbol ?? '').toUpperCase(),
      name: String(coin.name ?? coin.id),
      rank:
        typeof coin.market_cap_rank === 'number' ? coin.market_cap_rank : null,
      image: typeof coin.thumb === 'string' ? coin.thumb : null,
    }));
};

interface CoinMarket {
  id: string;
  price: number;
  changePct: number | null;
  symbol: string;
  name: string;
  image: string | null;
}

const cryptoMarkets = async (
  ids: readonly string[],
): Promise<Map<string, CoinMarket>> => {
  const out = new Map<string, CoinMarket>();
  if (ids.length === 0) return out;
  // Chunked so a long id list can't overflow the query string.
  for (let start = 0; start < ids.length; start += 100) {
    const chunk = ids.slice(start, start + 100);
    const res = await cgFetch(
      `/coins/markets?vs_currency=eur&ids=${encodeURIComponent(chunk.join(','))}&per_page=100&page=1`,
    );
    if (!res.ok) throw new Error(`coingecko markets: HTTP ${res.status}`);
    for (const row of (await res.json()) ?? []) {
      const price = Number(row?.current_price);
      if (!Number.isFinite(price)) continue;
      out.set(String(row.id), {
        id: String(row.id),
        price,
        changePct:
          typeof row.price_change_percentage_24h === 'number'
            ? row.price_change_percentage_24h
            : null,
        symbol: String(row.symbol ?? '').toUpperCase(),
        name: String(row.name ?? row.id),
        image: typeof row.image === 'string' ? row.image : null,
      });
    }
  }
  return out;
};

// The ledger keeps previous_close, and the day change is derived from it
// downstream. CoinGecko reports a 24h percentage instead, so convert back.
const closeFromChange = (price: number, changePct: number | null): number | null =>
  changePct === null || changePct <= -100 ? null : price / (1 + changePct / 100);

const refreshCrypto = async (
  db: SupabaseClient,
  userId?: string,
): Promise<void> => {
  let query = db.from('crypto_holdings').select('user_id, symbol, coin_id');
  if (userId) query = query.eq('user_id', userId);
  const { data: rows } = await query;
  if (!rows || rows.length === 0) return;

  // Holdings added before the CoinGecko switch have no slug. Resolve it once
  // from the ticker and store it, so the change self-heals rather than
  // silently leaving those coins stale.
  for (const row of rows) {
    if (row.coin_id) continue;
    try {
      const hits = await cryptoSearch(row.symbol);
      const match =
        hits.find((hit) => hit.symbol === String(row.symbol).toUpperCase()) ??
        hits[0];
      if (!match) continue;
      row.coin_id = match.id;
      await db
        .from('crypto_holdings')
        .update({ coin_id: match.id, image_url: match.image })
        .eq('user_id', row.user_id)
        .eq('symbol', row.symbol);
    } catch {
      // leave unresolved; the next run tries again
    }
  }

  const ids = [
    ...new Set(rows.map((row) => row.coin_id).filter(Boolean)),
  ] as string[];
  const markets = await cryptoMarkets(ids);

  for (const row of rows) {
    const market = row.coin_id ? markets.get(row.coin_id) : undefined;
    if (!market) continue;
    await db
      .from('crypto_holdings')
      .update({
        current_price: market.price,
        previous_close: closeFromChange(market.price, market.changePct),
        currency: 'EUR',
        image_url: market.image,
      })
      .eq('user_id', row.user_id)
      .eq('symbol', row.symbol);
  }
};

const evaluateAlerts = async (
  db: SupabaseClient,
  userId?: string,
): Promise<void> => {
  let alertsQuery = db
    .from('price_alerts')
    .select('id, user_id, symbol, name, direction, target, currency, triggered_at');
  if (userId) alertsQuery = alertsQuery.eq('user_id', userId);
  const { data: alerts } = await alertsQuery;
  if (!alerts || alerts.length === 0) return;

  const symbols = [...new Set(alerts.map((a) => a.symbol))];
  const priceBySymbol = new Map<string, number>();
  await mapLimit(symbols, 6, async (symbol) => {
    try {
      const data = await fetchQuote(symbol, '5d');
      priceBySymbol.set(symbol, data.quote.price);
    } catch {
      // skip unresolved symbols
    }
  });

  for (const alert of alerts) {
    const price = priceBySymbol.get(alert.symbol);
    if (price === undefined) continue;
    const met =
      alert.direction === 'above'
        ? price >= Number(alert.target)
        : price <= Number(alert.target);
    const already = alert.triggered_at !== null;

    if (met && !already) {
      await db
        .from('price_alerts')
        .update({ triggered_at: new Date().toISOString() })
        .eq('id', alert.id);
      const { data: subs } = await db
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth')
        .eq('user_id', alert.user_id);
      if (subs && subs.length > 0) {
        await sendPush(
          subs,
          {
            title: 'Price alert',
            body: `${alert.name} is ${alert.direction} ${alert.target} ${alert.currency}`,
            url: '/search',
            tag: alert.id,
          },
          async (id) => {
            await db.from('push_subscriptions').delete().eq('id', id);
          },
        );
      }
    } else if (!met && already) {
      await db.from('price_alerts').update({ triggered_at: null }).eq('id', alert.id);
    }
  }
};

const sendDailyBriefings = async (db: SupabaseClient): Promise<void> => {
  const { data: preferences } = await db
    .from('user_preferences')
    .select('user_id')
    .eq('daily_briefing', true);
  for (const preference of preferences ?? []) {
    const userId = preference.user_id;
    const [{ data: holdings }, { data: instruments }, { data: subscriptions }] =
      await Promise.all([
        db
          .from('holdings')
          .select('instrument_id, quantity, current_price, previous_close, currency')
          .eq('user_id', userId),
        db.from('instruments').select('id, name, ticker').eq('user_id', userId),
        db
          .from('push_subscriptions')
          .select('id, endpoint, p256dh, auth')
          .eq('user_id', userId),
      ]);
    if (!subscriptions || subscriptions.length === 0) continue;

    const names = new Map((instruments ?? []).map((item) => [item.id, item.name || item.ticker]));
    let total = 0;
    let dayChange = 0;
    let leader: { name: string; change: number } | null = null;
    for (const holding of holdings ?? []) {
      const quantity = Number(holding.quantity);
      const current = quantity * Number(holding.current_price);
      const previous = quantity * Number(holding.previous_close ?? holding.current_price);
      const change = current - previous;
      total += current;
      dayChange += change;
      if (!leader || Math.abs(change) > Math.abs(leader.change)) {
        leader = { name: names.get(holding.instrument_id) ?? 'A holding', change };
      }
    }
    const direction = dayChange >= 0 ? 'up' : 'down';
    const leadText = leader
      ? ` ${leader.name} led with ${leader.change >= 0 ? '+' : '−'}€${Math.abs(leader.change).toFixed(2)}.`
      : '';
    await sendPush(
      subscriptions,
      {
        title: 'Daily portfolio briefing',
        body: `Portfolio €${total.toFixed(2)} · ${direction} €${Math.abs(dayChange).toFixed(2)} today.${leadText}`,
        url: '/',
        tag: `daily-briefing-${new Date().toISOString().slice(0, 10)}`,
      },
      async (id) => {
        await db.from('push_subscriptions').delete().eq('id', id);
      },
    );
  }
};

const backfill = async (
  db: SupabaseClient,
  userId: string,
  range: string,
): Promise<{ inserted: number }> => {
  // Current holdings anchor the recent end and give today's investment value.
  const { data: holdings } = await db
    .from('holdings')
    .select('instrument_id, quantity, current_price, currency')
    .eq('user_id', userId);

  // The ledger drives the quantity actually held on each historical date, so
  // the reconstruction reflects when you bought and sold — not today's shape.
  const { data: txRows } = await db
    .from('transactions')
    .select('instrument_id, quantity, occurred_at')
    .eq('user_id', userId)
    .not('instrument_id', 'is', null)
    .not('quantity', 'is', null)
    .order('occurred_at', { ascending: true });
  const ledger: LedgerEntry[] = (txRows ?? [])
    .filter((row) => row.instrument_id && row.quantity !== null)
    .map((row) => ({
      instrumentId: row.instrument_id as string,
      quantity: Number(row.quantity),
      date: String(row.occurred_at).slice(0, 10),
    }));
  if (ledger.length === 0) return { inserted: 0 };

  const ids = [...new Set(ledger.map((entry) => entry.instrumentId))];
  const { data: instruments } = await db
    .from('instruments')
    .select('id, isin, ticker, yahoo_symbol, currency')
    .in('id', ids);
  const metaById = new Map((instruments ?? []).map((i) => [i.id, i]));

  const { data: fxRows } = await db
    .from('fx_rates')
    .select('base, rate, as_of')
    .eq('quote', 'EUR')
    .order('as_of', { ascending: false });
  const fx = new Map<string, number>();
  for (const row of fxRows ?? []) if (!fx.has(row.base)) fx.set(row.base, Number(row.rate));
  const rate = (c: string) => (c === 'EUR' ? 1 : (fx.get(c) ?? 1));

  // Historical closes per instrument, converted to EUR at the latest FX rate
  // (historical FX isn't stored — a small, acknowledged approximation).
  const pricesByInstrument = new Map<string, PricePoint[]>();
  await mapLimit(ids, 5, async (id) => {
    const meta = metaById.get(id);
    if (!meta) return;
    try {
      const symbol = await resolveSymbol(meta.isin, meta.ticker, meta.yahoo_symbol);
      if (!symbol) return;
      const quoted = await fetchQuote(symbol, range);
      const r = rate(meta.currency ?? 'EUR');
      pricesByInstrument.set(
        id,
        quoted.history.map((point) => ({ date: point.date, price: point.value * r })),
      );
    } catch {
      // instrument without resolvable history is skipped
    }
  });

  const daily = reconstructInvestments(ledger, pricesByInstrument);
  if (daily.length === 0) return { inserted: 0 };

  let currentInvestments = 0;
  for (const holding of holdings ?? []) {
    currentInvestments +=
      Number(holding.quantity) * Number(holding.current_price) * rate(holding.currency);
  }

  const { data: snaps } = await db
    .from('net_worth_snapshots')
    .select('as_of, net')
    .eq('user_id', userId)
    .order('as_of', { ascending: true });
  const existing = new Set((snaps ?? []).map((s) => s.as_of));
  const earliest = snaps && snaps.length > 0 ? snaps[0].as_of : null;
  const anchorNet =
    snaps && snaps.length > 0 ? Number(snaps[snaps.length - 1].net) : currentInvestments;
  // Everything that isn't tracked investments — cash, liabilities, and any
  // holding we couldn't price historically — is carried flat from today.
  const nonInvestment = anchorNet - currentInvestments;

  const rows: Record<string, unknown>[] = [];
  for (const { date, investments } of daily) {
    if (earliest && date >= earliest) continue;
    if (existing.has(date)) continue;
    const net = investments + nonInvestment;
    rows.push({
      user_id: userId,
      as_of: date,
      net: round2(net),
      assets: round2(Math.max(net, 0)),
      liabilities: 0,
      investments: round2(investments),
    });
  }

  if (rows.length === 0) return { inserted: 0 };
  await db.from('net_worth_snapshots').upsert(rows, { onConflict: 'user_id,as_of' });
  return { inserted: rows.length };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = new URL(req.url);
  let params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => (params[key] = value));
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      params = { ...params, ...body };
    } catch {
      // no body
    }
  }
  const action = params.action ?? 'refresh';

  if (action === 'search') {
    try {
      return json({ results: await search(params.q ?? '') });
    } catch (error) {
      return json({ results: [], error: msg(error) });
    }
  }

  if (action === 'quotes') {
    const symbols = (params.symbols ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 25);
    const quotes: Record<string, { price: number; previousClose: number; currency: string }> = {};
    await mapLimit(symbols, 8, async (symbol) => {
      try {
        const data = await fetchQuote(symbol, '5d');
        quotes[symbol] = data.quote;
      } catch {
        // skip symbols that fail
      }
    });
    return json({ quotes });
  }

  if (action === 'crypto-search') {
    try {
      return json({ coins: await cryptoSearch(params.q ?? '') });
    } catch (error) {
      return json({ coins: [], error: msg(error) });
    }
  }

  if (action === 'crypto-markets') {
    const ids = (params.ids ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 100);
    try {
      const markets = await cryptoMarkets(ids);
      return json({ markets: Object.fromEntries(markets) });
    } catch (error) {
      return json({ markets: {}, error: msg(error) });
    }
  }

  if (action === 'profile') {
    try {
      const symbol =
        params.symbol ||
        (await resolveSymbol(
          params.isin || null,
          params.ticker || '',
          params.yahoo || null,
        ));
      if (!symbol) return json({ error: 'no symbol' });
      return json({ profile: await fetchProfile(symbol) });
    } catch (error) {
      return json({ error: msg(error) });
    }
  }

  if (action === 'quote') {
    const range = params.range ?? '1y';
    try {
      if (params.symbol) {
        const data = await fetchQuote(params.symbol, range);
        return json({ ...data, symbol: params.symbol });
      }
      if (params.isin || params.ticker || params.yahoo) {
        const data = await quoteForInstrument(
          params.isin || null,
          params.ticker || '',
          params.yahoo || null,
          range,
        );
        return json(data);
      }
      return json({ error: 'no symbol' });
    } catch (error) {
      return json({ error: msg(error) });
    }
  }

  if (action === 'backfill') {
    try {
      const scope = await callerScope(req);
      if (!scope.userId) return json({ ok: false, error: 'unauthorized' }, 401);
      const result = await backfill(admin(), scope.userId, params.range ?? '2y');
      return json({ ok: true, ...result });
    } catch (error) {
      return json({ ok: false, error: msg(error) }, 500);
    }
  }

  if (action === 'daily-briefing') {
    try {
      const scope = await callerScope(req);
      if (!scope.all) return json({ ok: false, error: 'unauthorized' }, 401);
      await sendDailyBriefings(admin());
      return json({ ok: true });
    } catch (error) {
      return json({ ok: false, error: msg(error) }, 500);
    }
  }

  if (action === 'ensure-institutions') {
    try {
      const scope = await callerScope(req);
      if (!scope.all && !scope.userId) {
        return json({ ok: false, error: 'unauthorized' }, 401);
      }
      await admin()
        .from('institutions')
        .upsert(
          [
            {
              id: 'edenred',
              display_name: 'Edenred',
              brand_color: '#F72717',
              logo_path: '/institutions/edenred.svg',
              sort_order: 105,
            },
          ],
          { onConflict: 'id' },
        );
      return json({ ok: true });
    } catch (error) {
      return json({ ok: false, error: msg(error) }, 500);
    }
  }

  try {
    const scope = await callerScope(req);
    if (!scope.all && !scope.userId) {
      return json({ ok: false, error: 'unauthorized' }, 401);
    }
    const db = admin();
    await db
      .from('institutions')
      .upsert(
        [
          {
            id: 'edenred',
            display_name: 'Edenred',
            brand_color: '#F72717',
            logo_path: '/institutions/edenred.svg',
            sort_order: 105,
          },
        ],
        { onConflict: 'id' },
      )
      .then(() => undefined, () => undefined);
    const result = await refresh(db, scope.userId);
    await refreshCrypto(db, scope.userId).catch(() => undefined);
    await evaluateAlerts(db, scope.userId).catch(() => undefined);
    return json({ ok: true, ...result });
  } catch (error) {
    return json({ ok: false, error: msg(error) }, 500);
  }
});
