import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const admin = (): SupabaseClient =>
  createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
  });

const round2 = (value: number): number => Math.round(value * 100) / 100;

const corsHeaders: HeadersInit = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  if (!token) return json({ error: 'missing token' }, 400);

  const db = admin();

  const { data: owner } = await db
    .from('widget_tokens')
    .select('user_id')
    .eq('token', token)
    .maybeSingle<{ user_id: string }>();
  if (!owner) return json({ error: 'invalid token' }, 401);

  // POST endpoint: log expense automatically from Apple Shortcuts / Wallet / webhook
  if (req.method === 'POST') {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return json({ error: 'invalid json body' }, 400);
    }

    const rawAmount = Math.abs(Number(body.amount));
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      return json({ error: 'invalid or missing amount' }, 400);
    }

    const merchant = String(
      body.merchant ?? body.note ?? body.description ?? '',
    ).trim();
    const note = merchant || 'Apple Pay / Wallet';
    const occurredAt = body.date
      ? new Date(String(body.date)).toISOString()
      : new Date().toISOString();

    const { data: accounts } = await db
      .from('accounts')
      .select('id, name, type, currency, institution_id')
      .eq('user_id', owner.user_id)
      .is('archived_at', null)
      .order('created_at', { ascending: true });

    if (!accounts || accounts.length === 0) {
      return json({ error: 'no active accounts found to record expense' }, 400);
    }

    // If card/account was specified by shortcut, try to match by name or institution
    const targetQuery = String(body.account ?? body.card ?? '')
      .toLowerCase()
      .trim();
    let targetAccount = targetQuery
      ? accounts.find(
          (a) =>
            a.name.toLowerCase().includes(targetQuery) ||
            a.institution_id.toLowerCase().includes(targetQuery),
        )
      : undefined;

    // Otherwise, pick the primary cash account, or the first account
    if (!targetAccount) {
      targetAccount = accounts.find((a) => a.type === 'cash') ?? accounts[0]!;
    }

    const externalId = body.transactionId ? String(body.transactionId) : null;

    const { data: inserted, error: insertError } = await db
      .from('transactions')
      .insert({
        user_id: owner.user_id,
        account_id: targetAccount.id,
        kind: 'expense',
        amount: rawAmount,
        currency: targetAccount.currency || 'EUR',
        fx_rate: 1,
        occurred_at: occurredAt,
        note,
        source: 'manual',
        external_id: externalId,
      })
      .select('id, amount, note, occurred_at')
      .single();

    if (insertError) {
      return json({ error: insertError.message }, 500);
    }

    return json({
      ok: true,
      message: `Expense logged in ${targetAccount.name}`,
      transaction: inserted,
      account: targetAccount.name,
      amount: rawAmount,
    });
  }

  const [holdingsRes, instrumentsRes, fxRes, historyRes] = await Promise.all([
    db
      .from('holdings')
      .select(
        'instrument_id, quantity, average_price, current_price, previous_close, currency',
      )
      .eq('user_id', owner.user_id),
    db
      .from('instruments')
      .select('id, ticker, name')
      .eq('user_id', owner.user_id),
    db
      .from('fx_rates')
      .select('base, rate, as_of')
      .eq('quote', 'EUR')
      .order('as_of', { ascending: false }),
    db
      .from('net_worth_snapshots')
      .select('as_of, investments')
      .eq('user_id', owner.user_id)
      .order('as_of', { ascending: false })
      .limit(30),
  ]);

  const names = new Map(
    (instrumentsRes.data ?? []).map((row) => [
      row.id,
      { ticker: (row.ticker ?? '').split('_')[0] ?? row.ticker, name: row.name },
    ]),
  );
  const fx = new Map<string, number>();
  for (const row of fxRes.data ?? []) {
    if (!fx.has(row.base)) fx.set(row.base, Number(row.rate));
  }
  const rateOf = (currency: string) =>
    currency === 'EUR' ? 1 : (fx.get(currency) ?? 1);

  let totalValue = 0;
  let totalCost = 0;
  let dayBase = 0; // value at yesterday's close, for the day move
  const positions = (holdingsRes.data ?? []).map((holding) => {
    const rate = rateOf(holding.currency);
    const qty = Number(holding.quantity);
    const avg = Number(holding.average_price);
    const current = Number(holding.current_price);
    const prevClose = Number(holding.previous_close ?? 0);
    const value = qty * current * rate;
    const cost = qty * avg * rate;
    totalValue += value;
    totalCost += cost;
    if (prevClose > 0) dayBase += qty * prevClose * rate;
    const meta = names.get(holding.instrument_id);
    return {
      ticker: meta?.ticker ?? '',
      name: meta?.name ?? meta?.ticker ?? '',
      value: round2(value),
      changePct: avg > 0 ? round2(((current - avg) / avg) * 100) : 0,
      dayPct: prevClose > 0 ? round2(((current - prevClose) / prevClose) * 100) : 0,
    };
  });

  positions.sort((a, b) => b.value - a.value);

  const dayChange = dayBase > 0 ? totalValue - dayBase : 0;

  // Oldest → newest investment values for the sparkline. Ends on the live total
  // so the line always meets the number shown above it.
  const history = (historyRes.data ?? [])
    .map((row) => round2(Number(row.investments)))
    .filter((value) => value > 0)
    .reverse();
  if (history.length > 0) history[history.length - 1] = round2(totalValue);

  return json({
    updatedAt: new Date().toISOString(),
    total: round2(totalValue),
    totalChangePct:
      totalCost > 0 ? round2(((totalValue - totalCost) / totalCost) * 100) : 0,
    dayChange: round2(dayChange),
    dayChangePct: dayBase > 0 ? round2((dayChange / dayBase) * 100) : 0,
    positions,
    history,
  });
});
