import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MAX_QUESTION_LENGTH = 2000;
const DEFAULT_MODEL = 'gemini-2.5-flash';

const cors: HeadersInit = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

const bearer = (request: Request): string =>
  (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();

const readUserId = async (
  request: Request,
  db: SupabaseClient,
): Promise<string | null> => {
  const token = bearer(request);
  if (!token) return null;
  const { data } = await db.auth.getUser(token);
  return data.user?.id ?? null;
};

interface AdvisorContext {
  accounts: unknown[];
  recentTransactions: unknown[];
  holdings: unknown[];
  instruments: unknown[];
  netWorthSnapshots: unknown[];
  brokerAccounts: unknown[];
}

const loadContext = async (
  db: SupabaseClient,
  userId: string,
): Promise<AdvisorContext> => {
  const [accounts, transactions, holdings, instruments, snapshots, brokers] =
    await Promise.all([
      db
        .from('accounts')
        .select('name, type, currency, institution_id')
        .eq('user_id', userId)
        .is('archived_at', null),
      db
        .from('transactions')
        .select('kind, amount, currency, occurred_at, note, source')
        .eq('user_id', userId)
        .order('occurred_at', { ascending: false })
        .limit(30),
      db
        .from('holdings')
        .select(
          'instrument_id, quantity, average_price, current_price, previous_close, currency, updated_at',
        )
        .eq('user_id', userId),
      db
        .from('instruments')
        .select('id, ticker, name, currency, sector')
        .eq('user_id', userId),
      db
        .from('net_worth_snapshots')
        .select('as_of, net, assets, liabilities, investments')
        .eq('user_id', userId)
        .order('as_of', { ascending: false })
        .limit(12),
      db
        .from('broker_accounts')
        .select('provider, free, invested, ppl, total, currency, updated_at')
        .eq('user_id', userId),
    ]);

  const results = [accounts, transactions, holdings, instruments, snapshots, brokers];
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;

  return {
    accounts: accounts.data ?? [],
    recentTransactions: transactions.data ?? [],
    holdings: holdings.data ?? [],
    instruments: instruments.data ?? [],
    netWorthSnapshots: snapshots.data ?? [],
    brokerAccounts: brokers.data ?? [],
  };
};

const systemInstructions = `You are Strata Advisor, a read-only assistant inside a personal wealth-management app.
Use only the supplied financial context. Never invent numbers, transactions, holdings, dates, or facts.
State clearly when the context is missing, stale, or insufficient to answer.
You may summarize, compare, calculate transparently from supplied values, and suggest questions to investigate.
Do not execute actions or imply that you can change data. Avoid personalized regulated financial advice,
recommendations to buy or sell, guarantees, or tax/legal advice. Use careful, plain English and keep answers concise.
The currency is shown on each value when available; do not silently convert currencies.`;

const askGemini = async (
  question: string,
  context: AdvisorContext,
): Promise<string> => {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Advisor is not configured');
  const model = Deno.env.get('GEMINI_MODEL')?.trim() || DEFAULT_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstructions }] },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Question:\n${question}\n\nFinancial context (JSON):\n${JSON.stringify(context)}`,
            },
          ],
        },
      ],
      generationConfig: { maxOutputTokens: 800, temperature: 0.2 },
    }),
  });

  if (!response.ok) {
    await response.body?.cancel();
    throw new Error('Advisor request failed');
  }
  const body = await response.json();
  const answer = body?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: unknown }) => part.text)
    .filter((text: unknown): text is string => typeof text === 'string')
    .join('')
    .trim();
  if (!answer) throw new Error('Advisor returned no answer');
  return answer;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  try {
    const db = admin();
    const userId = await readUserId(request, db);
    if (!userId) return json({ error: 'unauthorized' }, 401);

    const body = await request.json().catch(() => null) as { question?: unknown } | null;
    const question = typeof body?.question === 'string' ? body.question.trim() : '';
    if (!question) return json({ error: 'question is required' }, 400);
    if (question.length > MAX_QUESTION_LENGTH) {
      return json({ error: `question must be ${MAX_QUESTION_LENGTH} characters or fewer` }, 400);
    }

    const context = await loadContext(db, userId);
    return json({ answer: await askGemini(question, context) });
  } catch {
    return json({ error: 'Unable to answer that question right now' }, 500);
  }
});
