import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  detectSources,
  enrichAdvisorContext,
  type AdvisorSource,
  type EnrichedAdvisorContext,
  type RawAdvisorData,
} from '../_shared/advisor/context.ts';

const MAX_QUESTION_LENGTH = 2000;
const DEFAULT_MODEL = 'gemini-3.8-flash';

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

const loadContext = async (
  db: SupabaseClient,
  userId: string,
): Promise<EnrichedAdvisorContext> => {
  const [
    accounts,
    transactions,
    holdings,
    instruments,
    snapshots,
    brokers,
    crypto,
    categories,
    txCategories,
    budgets,
  ] = await Promise.all([
    db
      .from('accounts')
      .select('name, type, currency, institution_id')
      .eq('user_id', userId)
      .is('archived_at', null),
    db
      .from('transactions')
      .select('id, kind, amount, currency, occurred_at, note, source, instrument_id')
      .eq('user_id', userId)
      .order('occurred_at', { ascending: false })
      .limit(40),
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
    db
      .from('crypto_holdings')
      .select('symbol, name, quantity, current_price, currency, coin_id')
      .eq('user_id', userId),
    db
      .from('categories')
      .select('id, name, type')
      .eq('user_id', userId),
    db
      .from('transaction_categories')
      .select('transaction_id, category_id')
      .eq('user_id', userId),
    db
      .from('budgets')
      .select('category_id, amount_limit, currency, period')
      .eq('user_id', userId),
  ]);

  const raw: RawAdvisorData = {
    accounts: accounts.data ?? [],
    transactions: transactions.data ?? [],
    holdings: holdings.data ?? [],
    instruments: instruments.data ?? [],
    snapshots: snapshots.data ?? [],
    brokers: brokers.data ?? [],
    crypto: crypto.data ?? [],
    categories: categories.data ?? [],
    txCategories: txCategories.data ?? [],
    budgets: budgets.data ?? [],
  };

  return enrichAdvisorContext(raw);
};

const systemInstructions = `You are Strata Advisor, an intelligent read-only personal finance advisor integrated into Strata wealth-management app.
You have direct read access to the user's financial context JSON: bank/cash accounts, stock/ETF holdings, crypto holdings, budgets, recent transactions with categories, and net worth history.

Guidelines:
1. Always base answers strictly on the supplied financial context JSON. Never invent numbers, tickers, transactions, or dates.
2. If data is missing or incomplete to answer a specific question, state so plainly.
3. Language: ALWAYS reply in the language the user writes in (European Portuguese if the user asks in Portuguese, English if asked in English, etc.).
4. Format: Use clean, concise Markdown formatting (bullet points, bold figures, small tables when appropriate).
5. When relevant, you may reference or suggest checking these app sections using exact tags: [Overview], [Portfolio], [Transactions], [Dividends], [Crypto], [Expenses].
6. Financial disclaimer: You provide factual analysis, summaries, calculations, and insights from the user's data; avoid making regulated financial advice, buy/sell directives, or tax guarantees.`;

const resolveModel = (): string => {
  const envModel = Deno.env.get('GEMINI_MODEL')?.trim();
  if (!envModel) return DEFAULT_MODEL;
  // If user had set a deprecated 2.5, 2.0 or 1.5 model in their env secrets, safely upgrade:
  if (
    envModel.includes('2.5') ||
    envModel.includes('2.0') ||
    envModel.includes('1.5')
  ) {
    console.warn(
      `Configured GEMINI_MODEL "${envModel}" is deprecated. Falling back to "${DEFAULT_MODEL}".`,
    );
    return DEFAULT_MODEL;
  }
  return envModel;
};

const askGemini = async (
  question: string,
  context: EnrichedAdvisorContext,
): Promise<string> => {
  const apiKey = Deno.env.get('GEMINI_API_KEY')?.trim();
  if (!apiKey) {
    throw new Error(
      'Advisor is not configured: GEMINI_API_KEY secret is missing in Supabase Edge Functions.',
    );
  }

  const model = resolveModel();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstructions }] },
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Question:\n${question}\n\nFinancial context (JSON):\n${JSON.stringify(context, null, 2)}`,
            },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.2,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error(`Gemini API error (${response.status}):`, errorText);
    let detail = errorText;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.error?.message) {
        detail = parsed.error.message;
      }
    } catch {
      // keep raw detail
    }
    throw new Error(
      `Gemini API request failed (${response.status}): ${detail.slice(0, 200)}`,
    );
  }

  const body = await response.json();
  const candidate = body?.candidates?.[0];
  if (!candidate) {
    console.error('Gemini returned no candidates:', JSON.stringify(body));
    const blockReason = body?.promptFeedback?.blockReason;
    if (blockReason) {
      throw new Error(`Gemini blocked the request: ${blockReason}`);
    }
    throw new Error('Gemini returned no response candidates.');
  }

  const parts = candidate.content?.parts;
  let answer = '';
  if (Array.isArray(parts)) {
    const textParts = parts
      .filter(
        (part: { text?: string; thought?: boolean }) =>
          typeof part.text === 'string' && !part.thought,
      )
      .map((part: { text: string }) => part.text);

    answer =
      textParts.length > 0
        ? textParts.join('').trim()
        : parts
            .map((p: { text?: string }) => p.text ?? '')
            .join('')
            .trim();
  }

  if (!answer) {
    if (candidate.finishReason && candidate.finishReason !== 'STOP') {
      throw new Error(`Gemini finished with reason: ${candidate.finishReason}`);
    }
    throw new Error('Advisor returned an empty answer.');
  }

  return answer;
};

interface ScannedReceipt {
  amount: number | null;
  merchant: string | null;
  date: string | null;
  kind: 'expense' | 'income';
  category: string | null;
  institutionId: string | null;
}

const scanReceiptWithGemini = async (
  imageBase64: string,
  mimeType: string,
  categories: string[],
): Promise<ScannedReceipt> => {
  const apiKey = Deno.env.get('GEMINI_API_KEY')?.trim();
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY secret is missing in Supabase Edge Functions.',
    );
  }

  const model = resolveModel();
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const todayIso = new Date().toISOString().slice(0, 10);

  const prompt = `Analyze this receipt, invoice, or banking/MB WAY screenshot.
Return ONLY a valid JSON object with these exact keys (no markdown fences, no extra text):
{
  "amount": number (positive decimal, total paid/transferred in EUR, e.g. 14.50),
  "merchant": string (short clean merchant or description, e.g. "Continente", "Galp", "MB WAY Café", "Pingo Doce"),
  "date": string (YYYY-MM-DD format; if no year or date is visible, use "${todayIso}"),
  "kind": "expense" | "income",
  "category": string | null (pick the single best match from this list: ${JSON.stringify(categories)}, or null),
  "institutionId": string | null (if a bank/card brand is clearly visible, pick from ["cgd","revolut","edenred","moey","bpi","millennium","novo_banco","santander","activobank"], otherwise null)
}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType || 'image/jpeg',
                data: imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 512,
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Gemini Vision failed (${response.status}): ${errorText.slice(0, 180)}`);
  }

  const body = await response.json();
  const parts = body?.candidates?.[0]?.content?.parts ?? [];
  const rawText = parts
    .filter((p: { text?: string; thought?: boolean }) => typeof p.text === 'string' && !p.thought)
    .map((p: { text: string }) => p.text)
    .join('')
    .trim();

  const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  const parsed = JSON.parse(cleanJson);
  return {
    amount: typeof parsed.amount === 'number' && parsed.amount > 0 ? parsed.amount : null,
    merchant: typeof parsed.merchant === 'string' ? parsed.merchant.trim() : null,
    date: typeof parsed.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : todayIso,
    kind: parsed.kind === 'income' ? 'income' : 'expense',
    category: typeof parsed.category === 'string' ? parsed.category : null,
    institutionId: typeof parsed.institutionId === 'string' ? parsed.institutionId : null,
  };
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  try {
    const db = admin();
    const userId = await readUserId(request, db);
    if (!userId) return json({ error: 'unauthorized' }, 401);

    const body = (await request.json().catch(() => null)) as {
      action?: unknown;
      imageBase64?: unknown;
      mimeType?: unknown;
      categories?: unknown;
      question?: unknown;
    } | null;

    if (body?.action === 'scan_receipt') {
      const imageBase64 =
        typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : '';
      const mimeType =
        typeof body.mimeType === 'string' ? body.mimeType.trim() : 'image/jpeg';
      const categories = Array.isArray(body.categories)
        ? body.categories.filter((c): c is string => typeof c === 'string')
        : [];
      if (!imageBase64) {
        return json({ error: 'imageBase64 is required' }, 400);
      }
      const receipt = await scanReceiptWithGemini(
        imageBase64,
        mimeType,
        categories,
      );
      return json({ receipt });
    }

    const question =
      typeof body?.question === 'string' ? body.question.trim() : '';
    if (!question) return json({ error: 'question is required' }, 400);
    if (question.length > MAX_QUESTION_LENGTH) {
      return json(
        { error: `question must be ${MAX_QUESTION_LENGTH} characters or fewer` },
        400,
      );
    }

    const context = await loadContext(db, userId);
    const answer = await askGemini(question, context);
    const sources: AdvisorSource[] = detectSources(answer, question);

    return json({ answer, sources });
  } catch (error) {
    console.error('Advisor error:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to answer that question right now.';
    return json({ error: message }, 500);
  }
});
