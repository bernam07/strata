import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders: HeadersInit = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const numberValue = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return undefined;
  const parsed = Number(value.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const getEurPrice = (set: Record<string, unknown>): number | undefined => {
  const legoCom = set.LEGOCom;
  if (legoCom && typeof legoCom === 'object') {
    const prices = legoCom as Record<string, unknown>;
    for (const country of ['PT', 'ES', 'DE', 'FR', 'BE', 'IT', 'NL', 'EUR']) {
      const countryData = prices[country];
      const price =
        numberValue(countryData) ||
        (countryData && typeof countryData === 'object'
          ? numberValue((countryData as Record<string, unknown>).retailPrice)
          : undefined);
      if (price !== undefined && price > 0) return price;
    }
  }
  for (const field of ['EURetailPrice', 'euroRetailPrice', 'retailPrice']) {
    const price = numberValue(set[field]);
    if (price !== undefined && price > 0) return price;
  }
  return undefined;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const body = (await req.json().catch(() => ({}))) as {
      itemNo?: string;
      itemType?: 'SET' | 'MINIFIG';
      currency?: string;
      apiKey?: string;
    };
    const itemNo = body.itemNo?.trim().replace(/-\d+$/, '');
    if (!itemNo) return json({ error: 'Missing itemNo parameter' }, 400);

    let apiKey = body.apiKey?.trim();
    if (!apiKey) {
      const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
      if (token) {
        const client = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          { global: { headers: { Authorization: `Bearer ${token}` } } },
        );
        const { data } = await client.rpc('get_brickset_api_key');
        if (typeof data === 'string') apiKey = data.trim();
      }
    }
    if (!apiKey) return json({ error: 'Brickset API key is not configured.' }, 400);

    const params = encodeURIComponent(
      JSON.stringify({ query: itemNo, pageSize: 1, extendedData: true }),
    );
    const url = `https://brickset.com/api/v3.asmx/getSets?apiKey=${encodeURIComponent(apiKey)}&userHash=&params=${params}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    const payload = (await response.json().catch(() => null)) as {
      status?: string;
      message?: string;
      sets?: Array<Record<string, unknown>>;
    } | null;

    if (!response.ok || payload?.status === 'error') {
      return json({ error: payload?.message || `Brickset API returned HTTP ${response.status}` }, response.status || 502);
    }

    const set = payload?.sets?.[0];
    if (!set) return json({ error: `LEGO set ${itemNo} was not found in Brickset.` }, 404);
    const retailPrice = getEurPrice(set);
    if (!retailPrice) return json({ error: `Brickset has no EUR retail price for ${itemNo}.` }, 404);

    return json({
      itemNo,
      queriedItemNo: itemNo,
      itemType: body.itemType,
      name: typeof set.name === 'string' ? set.name : undefined,
      currency: (body.currency || 'EUR').toUpperCase(),
      retailPrice,
      year: numberValue(set.year),
      pieces: numberValue(set.pieces),
      theme: typeof set.theme === 'string' ? set.theme : undefined,
      dateFetched: new Date().toISOString(),
      source: 'brickset',
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
