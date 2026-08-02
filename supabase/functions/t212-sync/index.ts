import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { backoffDelayMs, retryAfterMs, sleep } from '../_shared/t212/backoff.ts';
import { extractCursor } from '../_shared/t212/cursor.ts';
import {
  cashTransactionToRow,
  dividendToTransactionRow,
  orderToTransactionRow,
  toInstrumentRow,
} from '../_shared/t212/map.ts';
import type {
  InstrumentResolver,
} from '../_shared/t212/map.ts';
import {
  portfolioToPriceRows,
  type T212Position,
} from '../_shared/t212/portfolio.ts';
import {
  invertToEur,
  type FrankfurterResponse,
} from '../_shared/fx/frankfurter.ts';
import type {
  T212CashTransaction,
  T212Dividend,
  T212Instrument,
  T212Order,
  T212Page,
  TransactionRow,
} from '../_shared/t212/types.ts';

const PAGE_LIMIT = 50;
const MAX_PAGES = 200;
const MAX_ATTEMPTS = 6;

const baseUrl = (useDemo: boolean): string =>
  useDemo
    ? 'https://demo.trading212.com/api/v0'
    : 'https://live.trading212.com/api/v0';

const t212Fetch = async (
  url: string,
  apiKey: string,
): Promise<Response> => {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${btoa(apiKey)}`,
        Accept: 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      },
    });
    if (response.status !== 429 && response.status < 500) return response;
    const wait = retryAfterMs(
      response.headers.get('retry-after'),
      backoffDelayMs(attempt),
    );
    await response.body?.cancel();
    await sleep(wait);
  }
  throw new Error(`Trading 212 esgotou as tentativas para ${url}`);
};

const httpError = async (response: Response): Promise<string> => {
  const body = await response.text().catch(() => '');
  const detail = body.trim().slice(0, 200);
  return `HTTP ${response.status}${detail ? ` ${detail}` : ''}`;
};

const admin = (): SupabaseClient =>
  createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

interface Credential {
  secret: string;
  use_demo: boolean;
}

const loadCredential = async (
  db: SupabaseClient,
  userId: string,
): Promise<Credential> => {
  const { data, error } = await db
    .rpc('provider_secret', { p_user: userId, p_provider: 't212' })
    .single<Credential>();
  if (error || !data) throw new Error('No Trading 212 key configured.');
  return { secret: (data.secret ?? '').trim(), use_demo: data.use_demo };
};

const findAccount = async (
  db: SupabaseClient,
  userId: string,
): Promise<string> => {
  const { data, error } = await db
    .from('accounts')
    .select('id')
    .eq('user_id', userId)
    .eq('institution_id', 'trading212')
    .is('archived_at', null)
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (error) throw error;
  if (!data) throw new Error('Nenhuma conta Trading 212. Cria uma primeiro.');
  return data.id;
};

const buildResolver = async (
  db: SupabaseClient,
  userId: string,
): Promise<Map<string, string>> => {
  const { data, error } = await db
    .from('instruments')
    .select('id, t212_ticker')
    .eq('user_id', userId)
    .not('t212_ticker', 'is', null);
  if (error) throw error;
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.t212_ticker) map.set(row.t212_ticker, row.id);
  }
  return map;
};

const refreshInstruments = async (
  db: SupabaseClient,
  userId: string,
  apiKey: string,
  useDemo: boolean,
  relevantTickers: ReadonlySet<string>,
): Promise<Map<string, string>> => {
  if (relevantTickers.size === 0) return buildResolver(db, userId);
  const response = await t212Fetch(
    `${baseUrl(useDemo)}/equity/metadata/instruments`,
    apiKey,
  );
  if (!response.ok) return buildResolver(db, userId);
  const instruments = (await response.json()) as T212Instrument[];
  const existing = await buildResolver(db, userId);
  const missing = instruments
    .filter(
      (instrument) =>
        relevantTickers.has(instrument.ticker) &&
        !existing.has(instrument.ticker),
    )
    .map((instrument) => toInstrumentRow(userId, instrument));
  if (missing.length > 0) {
    const { error } = await db.from('instruments').insert(missing);
    if (error) throw error;
  }
  return buildResolver(db, userId);
};

const fetchPositions = async (
  apiKey: string,
  useDemo: boolean,
): Promise<T212Position[]> => {
  const response = await t212Fetch(`${baseUrl(useDemo)}/equity/portfolio`, apiKey);
  if (!response.ok) throw new Error(await httpError(response));
  return (await response.json()) as T212Position[];
};

const syncPortfolio = async (
  db: SupabaseClient,
  userId: string,
  positions: readonly T212Position[],
): Promise<void> => {
  const { data: instruments } = await db
    .from('instruments')
    .select('id, t212_ticker, currency')
    .eq('user_id', userId)
    .not('t212_ticker', 'is', null);

  const idByTicker = new Map<string, string>();
  const currencyById = new Map<string, string>();
  for (const row of instruments ?? []) {
    if (row.t212_ticker) idByTicker.set(row.t212_ticker, row.id);
    currencyById.set(row.id, row.currency);
  }

  const asOf = new Date().toISOString().slice(0, 10);

  const priceRows = portfolioToPriceRows(
    userId,
    asOf,
    positions,
    (ticker) => idByTicker.get(ticker) ?? null,
    (instrumentId) => currencyById.get(instrumentId) ?? 'EUR',
  );

  const currencies = [...new Set(priceRows.map((row) => row.currency))].filter(
    (currency) => currency !== 'EUR',
  );

  if (currencies.length > 0) {
    const fxResponse = await fetch(
      `https://api.frankfurter.app/latest?from=EUR&to=${currencies.join(',')}`,
    );
    if (fxResponse.ok) {
      const fx = (await fxResponse.json()) as FrankfurterResponse;
      await db.rpc('upsert_fx_rates', { p_rows: invertToEur(fx) });
    }
  }

  if (priceRows.length > 0) {
    await db.rpc('upsert_prices', { p_rows: priceRows });
  }

  const holdingRows = positions
    .map((position) => {
      const instrumentId = idByTicker.get(position.ticker);
      if (!instrumentId) return null;
      return {
        user_id: userId,
        instrument_id: instrumentId,
        quantity: position.quantity,
        average_price: position.averagePrice,
        current_price: position.currentPrice,
        currency: currencyById.get(instrumentId) ?? 'EUR',
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  await db.rpc('replace_holdings', { p_user: userId, p_rows: holdingRows });
};

const ingest = async (
  db: SupabaseClient,
  rows: TransactionRow[],
): Promise<number> => {
  if (rows.length === 0) return 0;
  const { data, error } = await db.rpc('ingest_transactions', { p_rows: rows });
  if (error) throw error;
  return (data as number) ?? 0;
};

const readWatermark = async (
  db: SupabaseClient,
  userId: string,
  stream: string,
): Promise<string | null> => {
  const { data } = await db
    .from('sync_state')
    .select('cursor')
    .eq('user_id', userId)
    .eq('provider', 't212')
    .eq('stream', stream)
    .maybeSingle<{ cursor: string | null }>();
  return data?.cursor ?? null;
};

const writeWatermark = async (
  db: SupabaseClient,
  userId: string,
  stream: string,
  cursor: string,
): Promise<void> => {
  await db.from('sync_state').upsert(
    {
      user_id: userId,
      provider: 't212',
      stream,
      cursor,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,provider,stream' },
  );
};

interface StreamConfig<T> {
  stream: string;
  path: string;
  identify: (item: T) => string;
  toRow: (item: T) => TransactionRow;
}

const syncStream = async <T>(
  db: SupabaseClient,
  userId: string,
  apiKey: string,
  useDemo: boolean,
  config: StreamConfig<T>,
): Promise<number> => {
  const watermark = await readWatermark(db, userId, config.stream);
  let cursor: string | null = null;
  let inserted = 0;
  let newestSeen: string | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = new URL(`${baseUrl(useDemo)}${config.path}`);
    url.searchParams.set('limit', String(PAGE_LIMIT));
    if (cursor) url.searchParams.set('cursor', cursor);

    const response = await t212Fetch(url.toString(), apiKey);
    if (!response.ok) throw new Error(await httpError(response));
    const body = (await response.json()) as T212Page<T>;
    const items = body.items ?? [];
    if (items.length === 0) break;

    if (newestSeen === null && items[0]) newestSeen = config.identify(items[0]);

    const rows = items.map(config.toRow);
    const added = await ingest(db, rows);
    inserted += added;

    if (watermark && added === 0) break;

    cursor = extractCursor(body.nextPagePath);
    if (!cursor) break;
  }

  if (newestSeen) await writeWatermark(db, userId, config.stream, newestSeen);
  return inserted;
};

const syncUser = async (db: SupabaseClient, userId: string): Promise<number> => {
  const { data: run, error: runError } = await db
    .from('sync_runs')
    .insert({ user_id: userId, provider: 't212', status: 'running' })
    .select('id')
    .single<{ id: string }>();
  if (runError || !run) throw runError ?? new Error('Falha a iniciar sync.');

  const errors: string[] = [];
  const skipped: string[] = [];
  const step = async (label: string, run: () => Promise<void>): Promise<void> => {
    try {
      await run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('HTTP 403')) {
        skipped.push(`${label}: no API scope`);
      } else {
        errors.push(`${label}: ${message}`);
      }
    }
  };

  try {
    const credential = await loadCredential(db, userId);
    const accountId = await findAccount(db, userId);
    const diag = `env=${credential.use_demo ? 'demo' : 'live'} keylen=${credential.secret.length}`;

    let positions: T212Position[] = [];
    await step('portfolio-fetch', async () => {
      positions = await fetchPositions(credential.secret, credential.use_demo);
    });
    const heldTickers = new Set(positions.map((position) => position.ticker));

    await step('instruments', () =>
      refreshInstruments(
        db,
        userId,
        credential.secret,
        credential.use_demo,
        heldTickers,
      ).then(() => undefined),
    );
    const resolverMap = await buildResolver(db, userId);
    const resolve: InstrumentResolver = (ticker) => resolverMap.get(ticker) ?? null;

    let inserted = 0;
    await step('orders', async () => {
      inserted += await syncStream<T212Order>(db, userId, credential.secret, credential.use_demo, {
        stream: 'orders',
        path: '/equity/history/orders',
        identify: (order) => `order:${order.id}`,
        toRow: (order) => orderToTransactionRow(userId, accountId, order, resolve),
      });
    });
    await step('dividends', async () => {
      inserted += await syncStream<T212Dividend>(db, userId, credential.secret, credential.use_demo, {
        stream: 'dividends',
        path: '/history/dividends',
        identify: (dividend) => `dividend:${dividend.reference}`,
        toRow: (dividend) => dividendToTransactionRow(userId, accountId, dividend, resolve),
      });
    });
    await step('cash', async () => {
      inserted += await syncStream<T212CashTransaction>(db, userId, credential.secret, credential.use_demo, {
        stream: 'cash',
        path: '/history/transactions',
        identify: (cash) => `cash:${cash.reference}`,
        toRow: (cash) => cashTransactionToRow(userId, accountId, cash),
      });
    });

    await step('portfolio', () => syncPortfolio(db, userId, positions));

    await db
      .from('sync_runs')
      .update({
        status: errors.length > 0 ? 'error' : 'success',
        finished_at: new Date().toISOString(),
        inserted_rows: inserted,
        error_message:
          errors.length > 0
            ? `${diag} | ${[...errors, ...skipped].join(' | ')}`
            : skipped.length > 0
              ? skipped.join(' | ')
              : null,
      })
      .eq('id', run.id);
    return inserted;
  } catch (error) {
    await db
      .from('sync_runs')
      .update({
        status: 'error',
        finished_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : String(error),
      })
      .eq('id', run.id);
    throw error;
  }
};

const resolveUserId = async (req: Request, db: SupabaseClient): Promise<string | null> => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  if (token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) return null;
  const { data } = await db.auth.getUser(token);
  return data.user?.id ?? null;
};

const corsHeaders: HeadersInit = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const db = admin();

  try {
    const requestedUser = await resolveUserId(req, db);

    if (requestedUser) {
      const inserted = await syncUser(db, requestedUser);
      return json({ ok: true, inserted });
    }

    const { data: credentials } = await db
      .from('provider_credentials')
      .select('user_id')
      .eq('provider', 't212');

    let total = 0;
    for (const credential of credentials ?? []) {
      total += await syncUser(db, credential.user_id);
    }
    return json({ ok: true, users: credentials?.length ?? 0, inserted: total });
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      500,
    );
  }
});
