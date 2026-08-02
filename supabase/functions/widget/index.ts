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

Deno.serve(async (req) => {
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

  const [holdingsRes, instrumentsRes, fxRes] = await Promise.all([
    db
      .from('holdings')
      .select('instrument_id, quantity, average_price, current_price, currency')
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
  const positions = (holdingsRes.data ?? []).map((holding) => {
    const rate = rateOf(holding.currency);
    const qty = Number(holding.quantity);
    const avg = Number(holding.average_price);
    const current = Number(holding.current_price);
    const value = qty * current * rate;
    const cost = qty * avg * rate;
    totalValue += value;
    totalCost += cost;
    const meta = names.get(holding.instrument_id);
    return {
      ticker: meta?.ticker ?? '',
      name: meta?.name ?? meta?.ticker ?? '',
      value: round2(value),
      changePct: avg > 0 ? round2(((current - avg) / avg) * 100) : 0,
    };
  });

  positions.sort((a, b) => b.value - a.value);

  return json({
    updatedAt: new Date().toISOString(),
    total: round2(totalValue),
    totalChangePct:
      totalCost > 0 ? round2(((totalValue - totalCost) / totalCost) * 100) : 0,
    positions,
  });
});
