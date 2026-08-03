import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

const admin = (): SupabaseClient =>
  createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

const yFetch = async (url: string): Promise<Response> =>
  fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });

interface Quote {
  symbol: string;
  price: number;
  previousClose: number;
  currency: string;
}

const fetchQuote = async (symbol: string, range = '1d'): Promise<
  { quote: Quote; history: { date: string; value: number }[] } | null
> => {
  const res = await yFetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`,
  );
  if (!res.ok) return null;
  const body = await res.json();
  const result = body?.chart?.result?.[0];
  if (!result?.meta) return null;
  const meta = result.meta;
  const price = Number(meta.regularMarketPrice);
  if (!Number.isFinite(price)) return null;

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

const search = async (q: string) => {
  const res = await yFetch(
    `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`,
  );
  if (!res.ok) return [];
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

const refresh = async (db: SupabaseClient): Promise<{ updated: number; errors: string[] }> => {
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
  const priceByInstrument = new Map<string, { price: number; currency: string }>();
  let updated = 0;

  for (const instrument of instruments ?? []) {
    try {
      const symbol = await resolveSymbol(
        instrument.isin,
        instrument.ticker,
        instrument.yahoo_symbol,
      );
      if (!symbol) continue;
      if (!instrument.yahoo_symbol) {
        await db.rpc('set_instrument_yahoo', { p_id: instrument.id, p_symbol: symbol });
      }
      const quoted = await fetchQuote(symbol);
      if (!quoted) {
        errors.push(`${instrument.ticker}: no quote`);
        continue;
      }
      priceByInstrument.set(instrument.id, {
        price: quoted.quote.price,
        currency: quoted.quote.currency,
      });
      updated += 1;
    } catch (error) {
      errors.push(`${instrument.ticker}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const priceRows: Record<string, unknown>[] = [];
  for (const holding of holdings) {
    const quoted = priceByInstrument.get(holding.instrument_id);
    if (!quoted) continue;
    await db
      .from('holdings')
      .update({ current_price: quoted.price })
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
  const db = admin();

  try {
    if (action === 'search') {
      return json({ results: await search(params.q ?? '') });
    }
    if (action === 'quote') {
      const data = await fetchQuote(params.symbol ?? '', params.range ?? '1y');
      if (!data) return json({ error: 'not found' }, 404);
      return json(data);
    }
    const result = await refresh(db);
    return json({ ok: true, ...result });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
