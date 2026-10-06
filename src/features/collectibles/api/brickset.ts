import { supabase } from '@/db/supabase';

export interface BricksetPriceParams {
  itemNo: string;
  itemType?: 'SET' | 'MINIFIG';
  condition?: string;
  bricksetSetNumber?: string;
  currency?: string;
  apiKey?: string;
}

export interface BricksetPriceResult {
  itemNo: string;
  queriedItemNo?: string;
  name?: string;
  currency: string;
  retailPrice: number;
  priceNew?: number;
  priceUsed?: number;
  year?: number;
  pieces?: number;
  theme?: string;
  dateFetched: string;
  source: 'brickset';
  itemType?: 'SET' | 'MINIFIG';
  appearsIn?: string[];
}

const LOCAL_STORAGE_KEY = 'strata_brickset_key';

export const getCachedBricksetKey = (): string | null => {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(LOCAL_STORAGE_KEY) || null;
};

export const setCachedBricksetKey = (key: string | null): void => {
  if (typeof localStorage === 'undefined') return;
  if (key) localStorage.setItem(LOCAL_STORAGE_KEY, key.trim());
  else localStorage.removeItem(LOCAL_STORAGE_KEY);
};

export const isMinifigCode = (raw: string, type?: string): boolean => {
  if (type === 'MINIFIG') return true;
  if (type === 'SET') return false;
  return /^(fig-\d+|[a-z]{2,5}\d+[a-z]?|col[a-z0-9]+)$/i.test(raw.trim());
};

export const fetchBricksetPrice = async (
  params: BricksetPriceParams,
): Promise<BricksetPriceResult> => {
  const itemNo = params.itemNo.trim();
  const queriedItemNo = params.bricksetSetNumber?.trim() || itemNo;
  const currency = (params.currency || 'EUR').toUpperCase();
  const apiKey = params.apiKey || getCachedBricksetKey();
  const isMinifig = isMinifigCode(itemNo, params.itemType);

  // 1. Try Supabase Edge Function
  try {
    const { data, error } = await supabase.functions.invoke('brickset-price', {
      body: {
        itemNo: queriedItemNo,
        itemType: isMinifig ? 'MINIFIG' : 'SET',
        condition: params.condition,
        currency,
        apiKey: apiKey || undefined,
      },
    });

    if (!error && data && !data.error && Number(data.retailPrice) > 0) {
      return {
        ...(data as BricksetPriceResult),
        itemNo,
        queriedItemNo: queriedItemNo !== itemNo ? queriedItemNo : undefined,
      };
    }
  } catch {
    // Edge function failed or not available; proceed to local proxy fallback below
  }

  // 2. Client-side fallback via Vite proxy (useful in dev/local environments)
  if (typeof window !== 'undefined') {
    try {
      if (isMinifig) {
        const res = await fetch(`/api/brickset/minifigs/${encodeURIComponent(queriedItemNo)}`);
        if (res.ok) {
          const html = await res.text();
          const nameMatch = html.match(/<h1>\s*([A-Za-z0-9_-]+):\s*([^<]+)<\/h1>/i);
          const valNewMatch =
            html.match(/New:\s*<a[^>]*>~([^\d\s]*)\s*([\d,.]+)/i) ||
            html.match(/Value new<\/dt>\s*<dd><a[^>]*>~([^\d\s]*)\s*([\d,.]+)/i);
          const valUsedMatch =
            html.match(/Used:\s*<a[^>]*>~([^\d\s]*)\s*([\d,.]+)/i) ||
            html.match(/Value used<\/dt>\s*<dd><a[^>]*>~([^\d\s]*)\s*([\d,.]+)/i);

          const pNew = valNewMatch?.[2] ? parseFloat(valNewMatch[2].replace(/,/g, '')) : undefined;
          const pUsed = valUsedMatch?.[2] ? parseFloat(valUsedMatch[2].replace(/,/g, '')) : undefined;

          if (pNew !== undefined || pUsed !== undefined) {
            const isUsed = (params.condition || '').toLowerCase().includes('used');
            const chosen = (isUsed && pUsed !== undefined) ? pUsed : (pNew ?? pUsed ?? 0);
            return {
              itemNo,
              queriedItemNo: queriedItemNo !== itemNo ? queriedItemNo : undefined,
              name: nameMatch?.[2] ? nameMatch[2].trim() : undefined,
              currency,
              retailPrice: chosen,
              priceNew: pNew,
              priceUsed: pUsed,
              dateFetched: new Date().toISOString(),
              source: 'brickset',
              itemType: 'MINIFIG',
            };
          }
        }
      } else {
        const cleanNo = queriedItemNo.replace(/-\d+$/, '');
        const res = await fetch(`/api/brickset/sets/${cleanNo}-1`);
        if (res.ok) {
          const html = await res.text();
          const titleMatch = html.match(/<h1>\s*([A-Za-z0-9_-]+):\s*([^<]+)<\/h1>/i);
          const rrpMatch = html.match(/RRP<\/dt>\s*<dd>([^<]+)<\/dd>/i);
          const rrpText = rrpMatch?.[1] ? rrpMatch[1].trim() : '';

          const eurMatch = rrpText.match(/([\d,.]+)\s*[€]|€\s*([\d,.]+)/);
          const usdMatch = rrpText.match(/[\$]\s*([\d,.]+)/);
          const gbpMatch = rrpText.match(/[£]\s*([\d,.]+)/);

          const rawEur = eurMatch?.[1] || eurMatch?.[2];
          const eurVal = rawEur ? parseFloat(rawEur.replace(/,/g, '')) : undefined;
          const usdVal = usdMatch?.[1] ? parseFloat(usdMatch[1].replace(/,/g, '')) : undefined;
          const gbpVal = gbpMatch?.[1] ? parseFloat(gbpMatch[1].replace(/,/g, '')) : undefined;

          const price = eurVal ?? (usdVal ? Math.round(usdVal * 0.92 * 100) / 100 : undefined) ?? (gbpVal ? Math.round(gbpVal * 1.17 * 100) / 100 : undefined);
          if (price && price > 0) {
            return {
              itemNo,
              queriedItemNo: `${cleanNo}-1`,
              name: titleMatch?.[2] ? titleMatch[2].trim() : undefined,
              currency,
              retailPrice: price,
              dateFetched: new Date().toISOString(),
              source: 'brickset',
              itemType: 'SET',
            };
          }
        }
      }
    } catch {
      // Fallback failed
    }
  }

  throw new Error(`Brickset price lookup failed for LEGO item ${itemNo}`);
};
