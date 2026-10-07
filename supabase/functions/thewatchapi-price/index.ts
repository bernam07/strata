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

interface WatchSearchItem {
  brand?: string;
  model?: string;
  reference_number?: string;
  price_usd?: number;
  price?: number;
  average_price?: number;
  image_url?: string;
  image?: string;
  images?: string[];
  case_material?: string;
  material?: string;
  case_diameter?: string;
  diameter?: string;
  movement?: string;
  caliber?: string;
  calibre?: string;
  dial_color?: string;
  dial?: string;
  bezel_material?: string;
  bezel?: string;
  water_resistance?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      referenceNumber?: string;
      apiKey?: string;
    };

    const ref = (body.referenceNumber || '').trim().toUpperCase();
    if (!ref) {
      return json({ error: 'Missing referenceNumber' }, 400);
    }

    let apiKey = (body.apiKey || '').trim();

    // If apiKey was not supplied, try fetching from Supabase Vault
    if (!apiKey) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const client = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          { global: { headers: { Authorization: authHeader } } },
        );
        const { data } = await client.rpc('get_thewatchapi_api_key');
        if (typeof data === 'string' && data.trim()) {
          apiKey = data.trim();
        }
      }
    }

    if (!apiKey) {
      return json({ error: 'Missing TheWatchAPI API token' }, 401);
    }

    // Try variations of the query to maximize match rate:
    // 1. Exact reference filter on /v1/model/search
    // 2. Reference without dots (e.g. T137.407.11.091.00 -> T1374071109100)
    // 3. Search query with search_attributes=reference_number,model
    // 4. Fallback to /v1/reference/search
    const refNoDots = ref.replace(/\./g, '');
    const queries = [
      `https://api.thewatchapi.com/v1/model/search?api_token=${encodeURIComponent(apiKey)}&reference_number=${encodeURIComponent(ref)}`,
      ...(refNoDots !== ref
        ? [`https://api.thewatchapi.com/v1/model/search?api_token=${encodeURIComponent(apiKey)}&reference_number=${encodeURIComponent(refNoDots)}`]
        : []),
      `https://api.thewatchapi.com/v1/model/search?api_token=${encodeURIComponent(apiKey)}&search=${encodeURIComponent(ref)}&search_attributes=reference_number,model`,
      ...(refNoDots !== ref
        ? [`https://api.thewatchapi.com/v1/model/search?api_token=${encodeURIComponent(apiKey)}&search=${encodeURIComponent(refNoDots)}&search_attributes=reference_number,model`]
        : []),
      `https://api.thewatchapi.com/v1/reference/search?api_token=${encodeURIComponent(apiKey)}&reference_number=${encodeURIComponent(ref)}`,
    ];

    let matchedWatch: WatchSearchItem | null = null;

    for (const url of queries) {
      try {
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (res.ok) {
          const payload = await res.json();
          const items: WatchSearchItem[] = Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.results)
              ? payload.results
              : payload?.data
                ? [payload.data]
                : [];

          if (items.length > 0 && items[0]) {
            matchedWatch = items[0];
            break;
          }
        }
      } catch {
        // continue trying next query variation
      }
    }

    if (matchedWatch) {
      const brand = matchedWatch.brand || 'Luxury Watch';
      const model = matchedWatch.model || ref;
      const fullName = `${brand} ${model} (#${ref})`;

      const priceUsd =
        typeof matchedWatch.price_usd === 'number'
          ? matchedWatch.price_usd
          : typeof matchedWatch.price === 'number'
            ? matchedWatch.price
            : typeof matchedWatch.average_price === 'number'
              ? matchedWatch.average_price
              : undefined;

      const imageUrl =
        matchedWatch.image_url ||
        matchedWatch.image ||
        (Array.isArray(matchedWatch.images) ? matchedWatch.images[0] : undefined);

      return json({
        referenceNumber: ref,
        brand,
        model,
        fullName,
        imageUrl,
        priceUsd,
        specs: {
          caseMaterial: matchedWatch.case_material || matchedWatch.material,
          caseDiameter: matchedWatch.case_diameter || matchedWatch.diameter,
          movement: matchedWatch.movement,
          caliber: matchedWatch.caliber || matchedWatch.calibre,
          dialColor: matchedWatch.dial_color || matchedWatch.dial,
          bezelMaterial: matchedWatch.bezel_material || matchedWatch.bezel,
          waterResistance: matchedWatch.water_resistance,
        },
        source: 'thewatchapi',
        dateFetched: new Date().toISOString(),
      });
    }

    return json({ error: `No watch found for reference ${ref}` }, 404);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
