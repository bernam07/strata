import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendPush } from '../_shared/push.ts';

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

const admin = (): SupabaseClient =>
  createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

interface YahooAuth {
  cookie: string;
  crumb: string;
}

let cachedAuth: YahooAuth | null = null;

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

const getAuth = async (): Promise<YahooAuth> => {
  if (cachedAuth) return cachedAuth;
  cachedAuth = await buildAuth();
  return cachedAuth;
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
    cachedAuth = await buildAuth();
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
      ['EQUITY', 'ETF'].includes(String(x.quoteType)),
    )
    .map((x: Record<string, unknown>) => ({
      symbol: String(x.symbol),
      name: String(x.shortname ?? x.longname ?? x.symbol),
      exchange: String(x.exchDisp ?? ''),
      type: String(x.quoteType),
    }));
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

const refresh = async (
  db: SupabaseClient,
): Promise<{ updated: number; errors: string[] }> => {
  const errors: string[] = [];
  const { data: holdings } = await db
    .from('holdings')
    .select('user_id, instrument_id, quantity, average_price, currency');
  if (!holdings || holdings.length === 0) return { updated: 0, errors };

  const ids = [...new Set(holdings.map((h) => h.instrument_id))];
  const { data: instruments } = await db
    .from('instruments')
    .select('id, isin, ticker, yahoo_symbol')
    .in('id', ids);
  const meta = new Map((instruments ?? []).map((i) => [i.id, i]));

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

  for (const instrument of instruments ?? []) {
    try {
      const symbol = await resolveSymbol(
        instrument.isin,
        instrument.ticker,
        instrument.yahoo_symbol,
      );
      if (!symbol) continue;
      const quoted = await fetchQuote(symbol);
      if (!instrument.yahoo_symbol) {
        await db.rpc('set_instrument_yahoo', { p_id: instrument.id, p_symbol: symbol });
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
  }

  const priceRows: Record<string, unknown>[] = [];
  for (const holding of holdings) {
    const quoted = priceByInstrument.get(holding.instrument_id);
    if (!quoted) continue;
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
  }
  if (priceRows.length > 0) await db.rpc('upsert_prices', { p_rows: priceRows });

  const byUser = new Map<string, { free: number; market: number }>();
  const { data: brokers } = await db
    .from('broker_accounts')
    .select('user_id, free')
    .eq('provider', 't212');
  for (const b of brokers ?? []) byUser.set(b.user_id, { free: Number(b.free), market: 0 });
  for (const holding of holdings) {
    const quoted = priceByInstrument.get(holding.instrument_id);
    const entry = byUser.get(holding.user_id);
    if (!quoted || !entry) continue;
    const m = meta.get(holding.instrument_id);
    entry.market += Number(holding.quantity) * quoted.price * rate(m?.currency ?? 'EUR');
  }
  for (const [userId, entry] of byUser) {
    await db.rpc('set_broker_total', {
      p_user: userId,
      p_total: Math.round((entry.free + entry.market) * 100) / 100,
    });
  }

  return { updated, errors };
};

const evaluateAlerts = async (db: SupabaseClient): Promise<void> => {
  const { data: alerts } = await db
    .from('price_alerts')
    .select('id, user_id, symbol, name, direction, target, currency, triggered_at');
  if (!alerts || alerts.length === 0) return;

  const symbols = [...new Set(alerts.map((a) => a.symbol))];
  const priceBySymbol = new Map<string, number>();
  for (const symbol of symbols) {
    try {
      const data = await fetchQuote(symbol, '5d');
      priceBySymbol.set(symbol, data.quote.price);
    } catch {
      // skip unresolved symbols
    }
  }

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
    await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const data = await fetchQuote(symbol, '5d');
          quotes[symbol] = data.quote;
        } catch {
          // skip symbols that fail
        }
      }),
    );
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

  try {
    const db = admin();
    const result = await refresh(db);
    await evaluateAlerts(db).catch(() => undefined);
    return json({ ok: true, ...result });
  } catch (error) {
    return json({ ok: false, error: msg(error) }, 500);
  }
});
