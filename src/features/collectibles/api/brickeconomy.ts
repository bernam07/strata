import { supabase } from '@/db/supabase';

export interface BrickeconomyPriceParams {
  itemNo: string;
  itemType?: 'SET' | 'MINIFIG';
  currency?: string;
  apiKey?: string;
  condition?: 'N' | 'U';
  skipEdgeFunction?: boolean;
}

export interface BrickeconomyPriceResult {
  itemNo: string;
  itemType: 'SET' | 'MINIFIG';
  name?: string;
  currency: string;
  condition: 'N' | 'U';
  marketValue: number;
  retailPrice?: number;
  growthPercent?: number;
  year?: number;
  pieces?: number;
  dateFetched: string;
  source: 'brickeconomy';
}

const LOCAL_STORAGE_KEY = 'strata_brickeconomy_key';

export const getCachedBrickeconomyKey = (): string | null => {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(LOCAL_STORAGE_KEY) || null;
};

export const setCachedBrickeconomyKey = (key: string | null): void => {
  if (typeof localStorage === 'undefined') return;
  if (!key) {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } else {
    localStorage.setItem(LOCAL_STORAGE_KEY, key.trim());
  }
};

export const detectBrickeconomyItemType = (
  raw: string,
  explicitType?: string,
): 'SET' | 'MINIFIG' => {
  if (explicitType === 'minifig' || explicitType === 'MINIFIG') return 'MINIFIG';
  if (explicitType === 'set' || explicitType === 'SET') return 'SET';

  const cleaned = raw.trim().toLowerCase();
  // Minifig prefix patterns: sw0001, fig-000001, col001, sh001, sw0001-1, etc.
  if (
    /^(sw|col|sh|fig|hp|cas|lor|sc|tlm|cty|adv|spd|dis|moch|poc|njo|idea|gen|hol|uab|pj)-?\d+[a-z]?(-\d+)?$/i.test(
      cleaned,
    )
  ) {
    return 'MINIFIG';
  }
  return 'SET';
};

export const normalizeBrickeconomyItemNumber = (
  raw: string,
  type?: 'SET' | 'MINIFIG',
): string => {
  const cleaned = raw.trim();
  const resolvedType = type ?? detectBrickeconomyItemType(cleaned);
  if (resolvedType === 'SET') {
    // Sets in BrickEconomy must end in variant suffix (usually -1)
    return /-\d+$/.test(cleaned) ? cleaned : `${cleaned}-1`;
  }
  if (resolvedType === 'MINIFIG') {
    // If it's e.g. sw0001-1, col001-1, or sh001-1, strip the trailing set variant suffix (-1)
    if (/^[a-z]{2,5}\d+[a-z]?-\d+$/i.test(cleaned)) {
      return cleaned.replace(/-\d+$/, '');
    }
    return cleaned;
  }
  return cleaned;
};

// Flexible extractor for numbers from API response fields
const parseNumericField = (val: unknown): number | undefined => {
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    if (!Number.isNaN(num)) return num;
  }
  return undefined;
};

export const fetchBrickEconomyPrice = async (
  params: BrickeconomyPriceParams,
): Promise<BrickeconomyPriceResult> => {
  const apiKey = params.apiKey || getCachedBrickeconomyKey();
  const type =
    params.itemType || detectBrickeconomyItemType(params.itemNo, params.itemType);
  const normalizedNo = normalizeBrickeconomyItemNumber(params.itemNo, type);
  const condition = params.condition || 'N';
  const currency = (params.currency || 'EUR').toUpperCase();

  // 1. Try Supabase Edge Function first if available and not skipped
  if (!params.skipEdgeFunction) {
    try {
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke(
        'brickeconomy-price',
        {
          body: {
            itemNo: normalizedNo,
            itemType: type,
            condition,
            currency,
            apiKey: apiKey || undefined,
          },
        },
      );

      if (
        !edgeError &&
        edgeData &&
        !edgeData.error &&
        typeof edgeData.marketValue === 'number' &&
        edgeData.marketValue > 0
      ) {
        return edgeData as BrickeconomyPriceResult;
      }
    } catch {
      // Fallback to client direct fetch
    }
  }

  // 2. Direct client fetch via dev server proxy or direct if key is present
  if (!apiKey) {
    throw new Error(
      'BrickEconomy API key not configured. Add your key in Settings → Integrations.',
    );
  }

  const endpointSegment = type === 'SET' ? 'set' : 'minifig';
  const upstreamUrl = `https://www.brickeconomy.com/api/v1/${endpointSegment}/${encodeURIComponent(
    normalizedNo,
  )}?currency=${encodeURIComponent(currency)}`;

  const isTest =
    typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
  const fetchUrl =
    import.meta.env.DEV && !isTest
      ? `/api/brickeconomy/api/v1/${endpointSegment}/${encodeURIComponent(
          normalizedNo,
        )}?currency=${encodeURIComponent(currency)}`
      : upstreamUrl;

  const response = await fetch(fetchUrl, {
    method: 'GET',
    headers: {
      'x-apikey': apiKey,
      Accept: 'application/json',
      'User-Agent': 'StrataPortfolioApp/1.0',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(
      `BrickEconomy API returned HTTP ${response.status}${errorBody ? `: ${errorBody}` : ''}`,
    );
  }

  const data = (await response.json()) as Record<string, unknown>;

  // Handle nested object if BrickEconomy wraps response in 'data'
  const target = (typeof data.data === 'object' && data.data !== null
    ? (data.data as Record<string, unknown>)
    : data) as Record<string, unknown>;

  const usedVal = parseNumericField(target.used_price ?? target.used_value);
  const newVal = parseNumericField(
    target.new_price ??
      target.market_value ??
      target.current_value ??
      target.value ??
      target.market_price,
  );

  const marketValue = condition === 'U' && usedVal ? usedVal : (newVal ?? usedVal ?? 0);
  const retailPrice = parseNumericField(
    target.retail_price ??
      target.retail_price_eur ??
      target.retail_price_usd ??
      target.rrp ??
      target.msrp,
  );
  const growthPercent = parseNumericField(
    target.growth ?? target.growth_percent ?? target.cagr ?? target.growth_1yr,
  );
  const year = parseNumericField(target.year ?? target.release_year);
  const pieces = parseNumericField(target.pieces ?? target.num_parts);
  const name =
    typeof target.name === 'string'
      ? target.name
      : typeof target.set_name === 'string'
        ? target.set_name
        : typeof target.minifig_name === 'string'
          ? target.minifig_name
          : undefined;

  return {
    itemNo: normalizedNo,
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
  };
};
