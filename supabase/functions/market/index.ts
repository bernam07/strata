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
  const price = Number(meta.regularMarketPrice);
  if (!Number.isFinite(price)) throw new Error(`chart ${symbol}: no price`);

  const timestamps: number[] = result.timestamp ?? [];
  const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
  const history = timestamps
    .map((t, i) => ({ t, c: closes[i] }))
    .filter((p) => typeof p.c === 'number')
    .map((p) => ({
      date: new Date(p.t * 1000).toISOString().slice(0, 10),
      value: Number(p.c),
    }));

  return {
    quote: {
      symbol,
      price,
      previousClose: Number(meta.chartPreviousClose ?? meta.previousClose ?? price),
      currency: String(meta.currency ?? 'USD'),
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
): Promise<{ updated: number; errors: string[] }> => {
  const errors: string[] = [];
  let holdingsQuery = db
    .from('holdings')
    .select('user_id, instrument_id, quantity, average_price, currency');
  if (userId) holdingsQuery = holdingsQuery.eq('user_id', userId);
  const { data: holdings } = await holdingsQuery;
  if (!holdings || holdings.length === 0) return { updated: 0, errors };

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
  await mapLimit(holdings, 8, async (holding) => {
    const quoted = priceByInstrument.get(holding.instrument_id);
    if (!quoted) return;
    await db
      .from('holdings')
      .update({ current_price: quoted.price, previous_close: quoted.previousClose })
      .eq('user_id', holding.user_id)
      .eq('instrument_id', holding.instrument_id);
    priceRows.push({
      user_id: holding.user_id,
      instrument_id: holding.instrument_id,
      as_of: asOf,
      close: quoted.price,
      currency: quoted.currency,
    });
  });
  if (priceRows.length > 0) await db.rpc('upsert_prices', { p_rows: priceRows });

  const byUser = new Map<string, { free: number; market: number }>();
  let brokersQuery = db
    .from('broker_accounts')
    .select('user_id, free')
    .eq('provider', 't212');
  if (userId) brokersQuery = brokersQuery.eq('user_id', userId);
  const { data: brokers } = await brokersQuery;
  for (const b of brokers ?? []) byUser.set(b.user_id, { free: Number(b.free), market: 0 });
  for (const holding of holdings) {
    const quoted = priceByInstrument.get(holding.instrument_id);
    const entry = byUser.get(holding.user_id);
    if (!quoted || !entry) continue;
    entry.market += Number(holding.quantity) * quoted.price * rate(quoted.currency);
  }
  for (const [userId, entry] of byUser) {
    await db.rpc('set_broker_total', {
      p_user: userId,
      p_total: Math.round((entry.free + entry.market) * 100) / 100,
    });
  }

  await recordSnapshots(db, byUser).catch(() => undefined);

  return { updated, errors };
};

const refreshCrypto = async (
  db: SupabaseClient,
  userId?: string,
): Promise<void> => {
  let query = db.from('crypto_holdings').select('symbol');
  if (userId) query = query.eq('user_id', userId);
  const { data: rows } = await query;
  if (!rows || rows.length === 0) return;

  const symbols = [...new Set(rows.map((r) => r.symbol))];
  await mapLimit(symbols, 6, async (symbol) => {
    try {
      const quoted = await fetchQuote(symbol, '5d');
      let update = db
        .from('crypto_holdings')
        .update({
          current_price: quoted.quote.price,
          previous_close: quoted.quote.previousClose,
          currency: quoted.quote.currency,
        })
        .eq('symbol', symbol);
      if (userId) update = update.eq('user_id', userId);
      await update;
    } catch {
      // skip symbols that fail to quote
    }
  });
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

  try {
    const scope = await callerScope(req);
    if (!scope.all && !scope.userId) {
      return json({ ok: false, error: 'unauthorized' }, 401);
    }
    const db = admin();
    const result = await refresh(db, scope.userId);
    await refreshCrypto(db, scope.userId).catch(() => undefined);
    await evaluateAlerts(db, scope.userId).catch(() => undefined);
    return json({ ok: true, ...result });
  } catch (error) {
    return json({ ok: false, error: msg(error) }, 500);
  }
});
