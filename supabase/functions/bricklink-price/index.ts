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

interface BricklinkCredentials {
  consumerKey: string;
  consumerSecret: string;
  tokenValue: string;
  tokenSecret: string;
}

const rfc3986 = (str: string): string =>
  encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );

const generateNonce = (len = 16): string => {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomBytes = new Uint8Array(len);
  crypto.getRandomValues(randomBytes);
  for (let i = 0; i < len; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
};

const generateOAuthHeader = async (
  method: string,
  url: string,
  queryParams: Record<string, string>,
  creds: BricklinkCredentials,
): Promise<string> => {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = generateNonce(16);

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: creds.tokenValue,
    oauth_version: '1.0',
  };

  const allParams: Record<string, string> = {
    ...queryParams,
    ...oauthParams,
  };

  const sortedKeys = Object.keys(allParams).sort();
  const normalizedParamPairs: string[] = [];
  for (const k of sortedKeys) {
    normalizedParamPairs.push(`${rfc3986(k)}=${rfc3986(allParams[k])}`);
  }
  const normalizedParams = normalizedParamPairs.join('&');

  const baseString = `${method.toUpperCase()}&${rfc3986(url)}&${rfc3986(normalizedParams)}`;
  const signingKeyStr = `${rfc3986(creds.consumerSecret)}&${rfc3986(creds.tokenSecret)}`;

  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signingKeyStr),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );

  const sigBuffer = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(baseString),
  );

  let binary = '';
  const bytes = new Uint8Array(sigBuffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const signature = btoa(binary);

  const headerParams: Record<string, string> = {
    realm: '',
    ...oauthParams,
    oauth_signature: signature,
  };

  const headerParts = Object.keys(headerParams)
    .sort()
    .map((k) => `${k}="${rfc3986(headerParams[k])}"`);

  return `OAuth ${headerParts.join(',')}`;
};

const normalizeItemNo = (raw: string, type: 'SET' | 'MINIFIG' | 'PART'): string => {
  const cleaned = raw.trim();
  if (type === 'SET') {
    return /-\d+$/.test(cleaned) ? cleaned : `${cleaned}-1`;
  }
  if (type === 'MINIFIG') {
    return cleaned.replace(/-\d+$/, '');
  }
  return cleaned;
};

const queryBricklink = async (
  itemNo: string,
  type: 'SET' | 'MINIFIG' | 'PART',
  guideType: 'sold' | 'stock',
  condition: 'N' | 'U',
  currency: string,
  creds: BricklinkCredentials,
) => {
  const normNo = normalizeItemNo(itemNo, type);
  const baseUrl = `https://api.bricklink.com/api/store/v1/items/${type}/${normNo}/price`;
  const queryParams: Record<string, string> = {
    guide_type: guideType,
    new_or_used: condition,
    currency_code: currency,
  };

  const authHeader = await generateOAuthHeader(
    'GET',
    baseUrl,
    queryParams,
    creds,
  );

  const urlWithQuery = `${baseUrl}?guide_type=${guideType}&new_or_used=${condition}&currency_code=${currency}`;
  const response = await fetch(urlWithQuery, {
    method: 'GET',
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
    },
  });

  const resJson = await response.json().catch(() => null);
  return { status: response.status, data: resJson, normNo };
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      itemNo?: string;
      itemType?: 'SET' | 'MINIFIG' | 'PART';
      guideType?: 'sold' | 'stock';
      condition?: 'N' | 'U';
      currency?: string;
      credentials?: Partial<BricklinkCredentials>;
    };

    if (!body.itemNo) {
      return json({ error: 'Missing itemNo parameter' }, 400);
    }

    let creds: BricklinkCredentials | null = null;

    if (
      body.credentials?.consumerKey &&
      body.credentials?.consumerSecret &&
      body.credentials?.tokenValue &&
      body.credentials?.tokenSecret
    ) {
      creds = {
        consumerKey: body.credentials.consumerKey.trim(),
        consumerSecret: body.credentials.consumerSecret.trim(),
        tokenValue: body.credentials.tokenValue.trim(),
        tokenSecret: body.credentials.tokenSecret.trim(),
      };
    } else {
      // Lookup in Supabase Vault for caller
      const authHeader = req.headers.get('Authorization') ?? '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (!token) {
        return json(
          { error: 'Missing BrickLink credentials and unauthorized' },
          401,
        );
      }

      const client = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: `Bearer ${token}` } } },
      );

      const { data: rawCreds, error: rpcError } = await client.rpc(
        'get_bricklink_credentials',
      );
      if (rpcError || !rawCreds) {
        return json(
          {
            error:
              'No BrickLink credentials found in Vault. Please connect BrickLink in Settings → Integrations.',
          },
          400,
        );
      }

      try {
        creds = JSON.parse(rawCreds);
      } catch {
        return json(
          { error: 'Failed to decode BrickLink credentials from Vault' },
          500,
        );
      }
    }

    if (
      !creds?.consumerKey ||
      !creds?.consumerSecret ||
      !creds?.tokenValue ||
      !creds?.tokenSecret
    ) {
      return json(
        { error: 'Incomplete BrickLink credentials. All 4 tokens are required.' },
        400,
      );
    }

    let type: 'SET' | 'MINIFIG' | 'PART' = body.itemType || 'SET';
    const rawNo = body.itemNo.trim();
    // Auto-detect minifigure by pattern if not explicitly defined
    if (
      !body.itemType &&
      /^(sw|col|sh|fig|hp|cas|lor|sc|tlm|cty|adv|spd|dis|moch)-?\d+[a-z]?$/i.test(
        rawNo,
      )
    ) {
      type = 'MINIFIG';
    }

    const guideType: 'sold' | 'stock' = body.guideType || 'sold';
    const condition: 'N' | 'U' = body.condition || 'N';
    const currency = (body.currency || 'EUR').toUpperCase();

    // 1. First attempt with primary guide type & item type
    let blRes = await queryBricklink(
      rawNo,
      type,
      guideType,
      condition,
      currency,
      creds,
    );

    // If 404 or item not found, try opposite type (SET <-> MINIFIG)
    if (
      blRes.status === 404 ||
      blRes.data?.meta?.code === 404 ||
      (blRes.data?.meta?.code === 400 && blRes.data?.meta?.message?.includes('ITEM_NOT_FOUND'))
    ) {
      const altType = type === 'SET' ? 'MINIFIG' : 'SET';
      const altRes = await queryBricklink(
        rawNo,
        altType,
        guideType,
        condition,
        currency,
        creds,
      );
      if (altRes.status === 200 && altRes.data?.meta?.code === 200) {
        type = altType;
        blRes = altRes;
      }
    }

    // If sold data had 0 items, fallback to stock guide to at least get market value
    if (
      blRes.status === 200 &&
      blRes.data?.meta?.code === 200 &&
      guideType === 'sold' &&
      Number(blRes.data?.data?.total_quantity ?? 0) === 0
    ) {
      const stockRes = await queryBricklink(
        rawNo,
        type,
        'stock',
        condition,
        currency,
        creds,
      );
      if (
        stockRes.status === 200 &&
        Number(stockRes.data?.data?.total_quantity ?? 0) > 0
      ) {
        blRes = stockRes;
      }
    }

    if (blRes.status !== 200 || blRes.data?.meta?.code !== 200) {
      const errMsg =
        blRes.data?.meta?.message ||
        blRes.data?.meta?.description ||
        `BrickLink API error (${blRes.status})`;
      return json({ error: errMsg, details: blRes.data }, blRes.status || 400);
    }

    const d = blRes.data?.data;
    const avgPrice = parseFloat(d?.avg_price || '0');
    const qtyAvgPrice = parseFloat(d?.qty_avg_price || '0');
    const minPrice = parseFloat(d?.min_price || '0');
    const maxPrice = parseFloat(d?.max_price || '0');
    const unitQuantity = parseInt(d?.unit_quantity || '0', 10);
    const totalQuantity = parseInt(d?.total_quantity || '0', 10);

    return json({
      itemNo: blRes.normNo,
      itemType: type,
      currency,
      guideType: d?.guide_type || guideType,
      condition,
      avgPrice,
      qtyAvgPrice: qtyAvgPrice > 0 ? qtyAvgPrice : avgPrice,
      minPrice,
      maxPrice,
      unitQuantity,
      totalQuantity,
      dateFetched: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
});
