import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders: HeadersInit = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const parseNumeric = (val: unknown): number | undefined => {
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    if (!Number.isNaN(num)) return num;
  }
  return undefined;
};

const normalizeItemNo = (raw: string, type: 'SET' | 'MINIFIG'): string => {
  const cleaned = raw.trim();
  if (type === 'SET') {
    return /-\d+$/.test(cleaned) ? cleaned : `${cleaned}-1`;
  }
  if (type === 'MINIFIG') {
    if (/^[a-z]{2,5}\d+[a-z]?-\d+$/i.test(cleaned)) {
      return cleaned.replace(/-\d+$/, '');
    }
  }
  return cleaned;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      itemNo?: string;
      itemType?: 'SET' | 'MINIFIG';
      condition?: 'N' | 'U';
      currency?: string;
      apiKey?: string;
    };

    if (!body.itemNo) {
      return json({ error: 'Missing itemNo parameter' }, 400);
    }

    let apiKey = body.apiKey?.trim();

    // If apiKey wasn't passed directly, check user's Vault in Supabase
    if (!apiKey) {
      const authHeader = req.headers.get('Authorization') ?? '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (token) {
        const client = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          { global: { headers: { Authorization: `Bearer ${token}` } } },
        );

        const { data: rawKey } = await client.rpc('get_brickeconomy_api_key');
        if (rawKey && typeof rawKey === 'string') {
          apiKey = rawKey.trim();
        }
      }
    }

    if (!apiKey) {
      return json(
        {
          error:
            'No BrickEconomy API key provided. Please add your key in Settings → Integrations.',
        },
        400,
      );
    }

    const type: 'SET' | 'MINIFIG' = body.itemType || 'SET';
    const normNo = normalizeItemNo(body.itemNo, type);
    const condition = body.condition || 'N';
    const currency = (body.currency || 'EUR').toUpperCase();

    const segment = type === 'SET' ? 'set' : 'minifig';
    const url = `https://www.brickeconomy.com/api/v1/${segment}/${encodeURIComponent(
      normNo,
    )}?currency=${encodeURIComponent(currency)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-apikey': apiKey,
        Accept: 'application/json',
        'User-Agent': 'StrataPortfolioApp/1.0',
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return json(
        {
          error: `BrickEconomy API returned status ${response.status}${text ? `: ${text}` : ''}`,
        },
        response.status,
      );
    }

    const rawData = (await response.json()) as Record<string, unknown>;
    const target = (typeof rawData.data === 'object' && rawData.data !== null
      ? (rawData.data as Record<string, unknown>)
      : rawData) as Record<string, unknown>;

    const usedVal = parseNumeric(target.used_price ?? target.used_value);
    const newVal = parseNumeric(
      target.new_price ??
        target.market_value ??
        target.current_value ??
        target.value ??
        target.market_price,
    );

    const marketValue = condition === 'U' && usedVal ? usedVal : (newVal ?? usedVal ?? 0);
    const retailPrice = parseNumeric(
      target.retail_price ??
        target.retail_price_eur ??
        target.retail_price_usd ??
        target.rrp ??
        target.msrp,
    );
    const growthPercent = parseNumeric(
      target.growth ?? target.growth_percent ?? target.cagr ?? target.growth_1yr,
    );
    const year = parseNumeric(target.year ?? target.release_year);
    const pieces = parseNumeric(target.pieces ?? target.num_parts);
    const name =
      typeof target.name === 'string'
        ? target.name
        : typeof target.set_name === 'string'
          ? target.set_name
          : typeof target.minifig_name === 'string'
            ? target.minifig_name
            : undefined;

    return json({
      itemNo: normNo,
      itemType: type,
      name,
      currency,
      condition,
      marketValue,
      retailPrice,
      growthPercent,
      year,
      pieces,
      dateFetched: new Date().toISOString(),
      source: 'brickeconomy',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});
