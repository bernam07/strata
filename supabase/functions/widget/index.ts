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

  // Auto-correct any legacy/erroneous positive expense amounts for this user
  try {
    const { data: positiveExpenses } = await db
      .from('transactions')
      .select('id, amount')
      .eq('user_id', owner.user_id)
      .eq('kind', 'expense')
      .gt('amount', 0);

    if (positiveExpenses && positiveExpenses.length > 0) {
      for (const tx of positiveExpenses) {
        await db
          .from('transactions')
          .update({ amount: -Math.abs(Number(tx.amount)) })
          .eq('id', tx.id);
      }
    }
  } catch {
    // Non-critical auto-heal
  }

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

    const kind = String(body.kind ?? 'expense').toLowerCase();
    const isOutflow = ['expense', 'withdrawal', 'fee', 'buy'].includes(kind);
    const signedAmount = isOutflow ? -rawAmount : rawAmount;

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

    // If card wasn't explicitly matched, try to infer account from user's transaction history for this merchant
    if (!targetAccount && note && note !== 'Apple Pay / Wallet') {
      try {
        const { data: pastMerchantTx } = await db
          .from('transactions')
          .select('account_id')
          .eq('user_id', owner.user_id)
          .ilike('note', note)
          .order('occurred_at', { ascending: false })
          .limit(1);

        if (pastMerchantTx && pastMerchantTx.length > 0 && pastMerchantTx[0]?.account_id) {
          targetAccount = accounts.find((a) => a.id === pastMerchantTx[0].account_id);
        }
      } catch {
        // Non-critical auto-account detection
      }
    }

    // Otherwise, pick the primary cash account, or the first account
    if (!targetAccount) {
      targetAccount = accounts.find((a) => a.type === 'cash') ?? accounts[0]!;
    }

    const isExplicitlyConfirmed = body.pending === false || body.confirmed === true;
    const rawExternalId = body.transactionId ? String(body.transactionId) : crypto.randomUUID();
    const externalId = isExplicitlyConfirmed
      ? `wallet:confirmed:${rawExternalId}`
      : `wallet:pending:${rawExternalId}`;

    const { data: inserted, error: insertError } = await db
      .from('transactions')
      .insert({
        user_id: owner.user_id,
        account_id: targetAccount.id,
        kind,
        amount: signedAmount,
        currency: targetAccount.currency || 'EUR',
        fx_rate: 1,
        occurred_at: occurredAt,
        note,
        source: 'manual',
        external_id: externalId,
      })
      .select('id, amount, note, occurred_at, external_id')
      .single();

    if (insertError) {
      return json({ error: insertError.message }, 500);
    }

    // Optional auto-categorization
    if (inserted?.id) {
      try {
        const catQuery = String(body.category ?? '').toLowerCase().trim();
        const { data: userCategories } = await db
          .from('categories')
          .select('id, name')
          .eq('user_id', owner.user_id);

        let matchedCat =
          catQuery && userCategories
            ? userCategories.find((c) => c.name.toLowerCase() === catQuery)
            : undefined;

        if (!matchedCat && note && note !== 'Apple Pay / Wallet') {
          const { data: prior } = await db
            .from('transactions')
            .select('id')
            .eq('user_id', owner.user_id)
            .eq('note', note)
            .neq('id', inserted.id)
            .limit(5);

          if (prior && prior.length > 0) {
            const priorIds = prior.map((p) => p.id);
            const { data: priorCat } = await db
              .from('transaction_categories')
              .select('category_id')
              .in('transaction_id', priorIds)
              .limit(1);

            if (priorCat && priorCat[0]) {
              matchedCat = userCategories?.find(
                (c) => c.id === priorCat[0]!.category_id,
              );
            }
          }
        }

        if (matchedCat) {
          await db.from('transaction_categories').insert({
            transaction_id: inserted.id,
            user_id: owner.user_id,
            category_id: matchedCat.id,
          });
        }
      } catch {
        // Non-critical auto-categorization
      }
    }

    return json({
      ok: true,
      message: `Expense of €${rawAmount.toFixed(2)} logged in ${targetAccount.name}`,
      transaction: inserted,
      account: targetAccount.name,
      amount: signedAmount,
      pending: !isExplicitlyConfirmed,
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
