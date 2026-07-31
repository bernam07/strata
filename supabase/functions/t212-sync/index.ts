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
      headers: { Authorization: apiKey },
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
  if (error || !data) throw new Error('Sem chave Trading 212 configurada.');
  return data;
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
): Promise<Map<string, string>> => {
  const response = await t212Fetch(
    `${baseUrl(useDemo)}/equity/metadata/instruments`,
    apiKey,
  );
  if (!response.ok) return buildResolver(db, userId);
  const instruments = (await response.json()) as T212Instrument[];
  const existing = await buildResolver(db, userId);
  const missing = instruments
    .filter((instrument) => !existing.has(instrument.ticker))
    .map((instrument) => toInstrumentRow(userId, instrument));
  if (missing.length > 0) {
    const { error } = await db.from('instruments').insert(missing);
    if (error) throw error;
  }
  return buildResolver(db, userId);
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
    if (!response.ok) throw new Error(`${config.stream}: HTTP ${response.status}`);
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

  try {
    const credential = await loadCredential(db, userId);
    const accountId = await findAccount(db, userId);
    const resolverMap = await refreshInstruments(
      db,
      userId,
      credential.secret,
      credential.use_demo,
    );
    const resolve: InstrumentResolver = (ticker) =>
      resolverMap.get(ticker) ?? null;

    let inserted = 0;
    inserted += await syncStream<T212Order>(db, userId, credential.secret, credential.use_demo, {
      stream: 'orders',
      path: '/history/orders',
      identify: (order) => `order:${order.id}`,
      toRow: (order) => orderToTransactionRow(userId, accountId, order, resolve),
    });
    inserted += await syncStream<T212Dividend>(db, userId, credential.secret, credential.use_demo, {
      stream: 'dividends',
      path: '/history/dividends',
      identify: (dividend) => `dividend:${dividend.reference}`,
      toRow: (dividend) => dividendToTransactionRow(userId, accountId, dividend, resolve),
    });
    inserted += await syncStream<T212CashTransaction>(db, userId, credential.secret, credential.use_demo, {
      stream: 'cash',
      path: '/history/transactions',
      identify: (cash) => `cash:${cash.reference}`,
      toRow: (cash) => cashTransactionToRow(userId, accountId, cash),
    });

    await db
      .from('sync_runs')
      .update({
        status: 'success',
        finished_at: new Date().toISOString(),
        inserted_rows: inserted,
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

Deno.serve(async (req) => {
  const db = admin();

  try {
    const requestedUser = await resolveUserId(req, db);

    if (requestedUser) {
      const inserted = await syncUser(db, requestedUser);
      return Response.json({ ok: true, inserted });
    }

    const { data: credentials } = await db
      .from('provider_credentials')
      .select('user_id')
      .eq('provider', 't212');

    let total = 0;
    for (const credential of credentials ?? []) {
      total += await syncUser(db, credential.user_id);
    }
    return Response.json({ ok: true, users: credentials?.length ?? 0, inserted: total });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
});
