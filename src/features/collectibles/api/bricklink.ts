import { supabase } from '@/db/supabase';

export interface BricklinkCredentials {
  consumerKey: string;
  consumerSecret: string;
  tokenValue: string;
  tokenSecret: string;
}

export interface BricklinkPriceParams {
  itemNo: string;
  itemType?: 'SET' | 'MINIFIG' | 'PART';
  guideType?: 'sold' | 'stock';
  condition?: 'N' | 'U';
  currency?: string;
  credentials?: BricklinkCredentials;
  skipEdgeFunction?: boolean;
}

export interface BricklinkPriceResult {
  itemNo: string;
  itemType: 'SET' | 'MINIFIG' | 'PART';
  currency: string;
  guideType: 'sold' | 'stock';
  condition: 'N' | 'U';
  avgPrice: number;
  qtyAvgPrice: number;
  minPrice: number;
  maxPrice: number;
  unitQuantity: number;
  totalQuantity: number;
  dateFetched: string;
}

const LOCAL_STORAGE_KEY = 'strata_bricklink_credentials';

export const getCachedBricklinkCredentials = (): BricklinkCredentials | null => {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed.consumerKey &&
      parsed.consumerSecret &&
      parsed.tokenValue &&
      parsed.tokenSecret
    ) {
      return parsed as BricklinkCredentials;
    }
  } catch {
    return null;
  }
  return null;
};

export const setCachedBricklinkCredentials = (
  creds: BricklinkCredentials | null,
): void => {
  if (typeof localStorage === 'undefined') return;
  if (!creds) {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } else {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(creds));
  }
};

export const rfc3986 = (str: string): string =>
  encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );

export const generateNonce = (len = 16): string => {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const randomBytes = new Uint8Array(len);
    crypto.getRandomValues(randomBytes);
    for (let i = 0; i < len; i++) {
      const byte = randomBytes[i] ?? 0;
      result += chars.charAt(byte % chars.length);
    }
  } else {
    for (let i = 0; i < len; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  return result;
};

export const detectBricklinkItemType = (
  raw: string,
  explicitType?: string,
): 'SET' | 'MINIFIG' | 'PART' => {
  if (explicitType === 'minifig' || explicitType === 'MINIFIG') return 'MINIFIG';
  if (explicitType === 'part' || explicitType === 'PART') return 'PART';
  if (explicitType === 'set' || explicitType === 'SET') return 'SET';

  const cleaned = raw.trim().toLowerCase();
  // Known minifig prefix patterns in BrickLink & LEGO
  if (
    /^(sw|col|sh|fig|hp|cas|lor|sc|tlm|cty|adv|spd|dis|moch|poc|njo|idea|gen|hol|uab|pj)-?\d+[a-z]?$/i.test(
      cleaned,
    )
  ) {
    return 'MINIFIG';
  }
  return 'SET';
};

export const normalizeBricklinkItemNumber = (
  raw: string,
  type?: 'SET' | 'MINIFIG' | 'PART',
): string => {
  const cleaned = raw.trim();
  const resolvedType = type ?? detectBricklinkItemType(cleaned);
  if (resolvedType === 'SET') {
    // Sets in BrickLink Price Guide must end in variant suffix (usually -1)
    return /-\d+$/.test(cleaned) ? cleaned : `${cleaned}-1`;
  }
  if (resolvedType === 'MINIFIG') {
    // Minifigures in BrickLink do NOT have the -1 suffix
    return cleaned.replace(/-\d+$/, '');
  }
  return cleaned;
};

export const generateOAuthHeader = async (
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
    const val = allParams[k];
    if (val !== undefined) {
      normalizedParamPairs.push(`${rfc3986(k)}=${rfc3986(val)}`);
    }
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
    const b = bytes[i];
    if (b !== undefined) {
      binary += String.fromCharCode(b);
    }
  }
  const signature = btoa(binary);

  const headerParams: Record<string, string> = {
    realm: '',
    ...oauthParams,
    oauth_signature: signature,
  };

  const headerParts = Object.keys(headerParams)
    .sort()
    .map((k) => {
      const val = headerParams[k] ?? '';
      return `${k}="${rfc3986(val)}"`;
    });

  return `OAuth ${headerParts.join(',')}`;
};

export const fetchBricklinkPrice = async (
  params: BricklinkPriceParams,
): Promise<BricklinkPriceResult> => {
  const creds = params.credentials || getCachedBricklinkCredentials();
  const type =
    params.itemType || detectBricklinkItemType(params.itemNo, params.itemType);
  const normalizedNo = normalizeBricklinkItemNumber(params.itemNo, type);
  const guideType = params.guideType || 'sold';
  const condition = params.condition || 'N';
  const currency = (params.currency || 'EUR').toUpperCase();

  // 1. Try Supabase Edge Function first if not skipped
  if (!params.skipEdgeFunction) {
    try {
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke(
        'bricklink-price',
        {
          body: {
            itemNo: normalizedNo,
            itemType: type,
            guideType,
            condition,
            currency,
            credentials: creds || undefined,
          },
        },
      );

      if (!edgeError && edgeData && !edgeData.error && edgeData.avgPrice !== undefined) {
        return edgeData as BricklinkPriceResult;
      }
    } catch {
      // Fall back to client direct request via Vite proxy if Edge Function is offline
    }
  }

  // 2. Direct client fetch via dev server proxy or direct if credentials are available
  if (!creds) {
    throw new Error(
      'BrickLink credentials not configured. Please add your API keys in Settings → Integrations.',
    );
  }

  const upstreamBaseUrl = `https://api.bricklink.com/api/store/v1/items/${type}/${normalizedNo}/price`;
  const queryParams: Record<string, string> = {
    guide_type: guideType,
    new_or_used: condition,
    currency_code: currency,
  };

  const authHeader = await generateOAuthHeader(
    'GET',
    upstreamBaseUrl,
    queryParams,
    creds,
  );

  // In dev mode in the browser, route through Vite proxy to bypass CORS
  const isTest =
    typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
  const fetchUrl =
    import.meta.env.DEV && !isTest
      ? `/api/bricklink/api/store/v1/items/${type}/${normalizedNo}/price?guide_type=${guideType}&new_or_used=${condition}&currency_code=${currency}`
      : `${upstreamBaseUrl}?guide_type=${guideType}&new_or_used=${condition}&currency_code=${currency}`;

  const response = await fetch(fetchUrl, {
    method: 'GET',
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
    },
  });

  const resJson = await response.json().catch(() => null);

  if (!response.ok || resJson?.meta?.code !== 200) {
    const errMsg =
      resJson?.meta?.message ||
      resJson?.meta?.description ||
      `BrickLink API returned HTTP ${response.status}`;
    throw new Error(errMsg);
  }

  const d = resJson.data;
  const avgPrice = parseFloat(d?.avg_price || '0');
  const qtyAvgPrice = parseFloat(d?.qty_avg_price || '0');
  const minPrice = parseFloat(d?.min_price || '0');
  const maxPrice = parseFloat(d?.max_price || '0');
  const unitQuantity = parseInt(d?.unit_quantity || '0', 10);
  const totalQuantity = parseInt(d?.total_quantity || '0', 10);

  return {
    itemNo: normalizedNo,
    itemType: type,
    currency,
    guideType,
    condition,
    avgPrice,
    qtyAvgPrice: qtyAvgPrice > 0 ? qtyAvgPrice : avgPrice,
    minPrice,
    maxPrice,
    unitQuantity,
    totalQuantity,
    dateFetched: new Date().toISOString(),
  };
};
