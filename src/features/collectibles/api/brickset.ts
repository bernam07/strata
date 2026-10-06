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
  rrp?: number;
  year?: number;
  pieces?: number;
  theme?: string;
  dateFetched: string;
  source: 'brickset';
  itemType?: 'SET' | 'MINIFIG';
  appearsIn?: string[];
  containedMinifig?: {
    code: string;
    count?: number;
  };
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

export interface CleanedLegoIdentifier {
  raw: string;
  itemNo: string;
  itemType: 'SET' | 'MINIFIG';
  bricksetSlug: string;
}

/**
 * Normalizes any LEGO input string (full Brickset/BrickLink URLs, slugs,
 * minifig codes with/without -1, or set numbers with/without -1).
 */
export const cleanLegoInput = (
  rawInput: string,
  hintedType?: 'SET' | 'MINIFIG',
): CleanedLegoIdentifier => {
  let cleaned = (rawInput || '').trim();

  // 1. BrickLink URLs (e.g. ?M=sh0679 for minifigs or ?S=682303-1 for sets)
  const blMinifig = cleaned.match(/bricklink\.com.*?[\?&]M=([a-z0-9_-]+)/i);
  if (blMinifig?.[1]) {
    const rawCode = blMinifig[1].toLowerCase();
    const code = rawCode.startsWith('fig-') ? rawCode : rawCode.replace(/-\d+$/, '');
    return {
      raw: rawInput,
      itemNo: code,
      itemType: 'MINIFIG',
      bricksetSlug: code,
    };
  }

  const blSet = cleaned.match(/bricklink\.com.*?[\?&]S=([a-z0-9_-]+)/i);
  if (blSet?.[1]) {
    const rawNum = blSet[1];
    const withVariant = rawNum.includes('-') ? rawNum : `${rawNum}-1`;
    return {
      raw: rawInput,
      itemNo: withVariant,
      itemType: 'SET',
      bricksetSlug: withVariant,
    };
  }

  // 2. Minifigure URL or slug path
  // e.g. https://brickset.com/minifigs/sh0679/spider-man-(miles-morales)...
  // or /minifigs/in-682303-1 (all minifigs in set)
  const minifigUrl =
    cleaned.match(/brickset\.com\/minifigs\/([a-z0-9_-]+)/i) ||
    cleaned.match(/^minifigs\/([a-z0-9_-]+)/i);
  if (minifigUrl?.[1]) {
    const matched = minifigUrl[1];
    if (matched.toLowerCase().startsWith('in-')) {
      const setNo = matched.slice(3);
      const withVariant = setNo.includes('-') ? setNo : `${setNo}-1`;
      return {
        raw: rawInput,
        itemNo: withVariant,
        itemType: 'SET',
        bricksetSlug: withVariant,
      };
    }
    const rawCode = matched.toLowerCase();
    const code = rawCode.startsWith('fig-') ? rawCode : rawCode.replace(/-\d+$/, '');
    return {
      raw: rawInput,
      itemNo: code,
      itemType: 'MINIFIG',
      bricksetSlug: code,
    };
  }

  // 3. Set URL or slug path
  // e.g. https://brickset.com/sets/682303-1/Miles-Morales or /sets/682303-1
  const setUrl =
    cleaned.match(/brickset\.com\/sets\/([a-z0-9]+(?:-[0-9]+)?)/i) ||
    cleaned.match(/^sets\/([a-z0-9]+(?:-[0-9]+)?)/i);
  if (setUrl?.[1]) {
    const rawNum = setUrl[1];
    const withVariant = rawNum.includes('-') ? rawNum : `${rawNum}-1`;
    return {
      raw: rawInput,
      itemNo: withVariant,
      itemType: 'SET',
      bricksetSlug: withVariant,
    };
  }

  // Strip leading '#' if user typed #75192 or #sh0679
  cleaned = cleaned.replace(/^#/, '').trim();

  // 4. Minifigure code patterns:
  // e.g. sh0679, sh0679-1, sw0107, colspi01, fig-000001, hp001, bat001, etc.
  const isMinifigPattern =
    /^(fig-\d+|[a-z]{2,5}\d+[a-z]?|col[a-z0-9]+)(-\d+)?$/i.test(cleaned);
  if (isMinifigPattern || hintedType === 'MINIFIG') {
    const rawCode = cleaned.toLowerCase();
    const code = rawCode.startsWith('fig-') ? rawCode : rawCode.replace(/-\d+$/, '');
    return {
      raw: rawInput,
      itemNo: code,
      itemType: 'MINIFIG',
      bricksetSlug: code,
    };
  }

  // 5. Set number (e.g. 75192, 75192-1, 682303, 682303-1)
  const cleanNum = cleaned.replace(/\s+/g, '');
  const withVariant = cleanNum.includes('-') ? cleanNum : `${cleanNum}-1`;
  return {
    raw: rawInput,
    itemNo: withVariant,
    itemType: 'SET',
    bricksetSlug: withVariant,
  };
};

export const isMinifigCode = (raw: string, type?: string): boolean => {
  if (type === 'MINIFIG') return true;
  const cleaned = raw.trim().replace(/^#/, '');
  if (/brickset\.com\/minifigs\//i.test(cleaned)) return true;
  return /^(fig-\d+|[a-z]{2,5}\d+[a-z]?|col[a-z0-9]+)(-\d+)?$/i.test(cleaned);
};

const FX_RATES: Record<string, Record<string, number>> = {
  GBP: { EUR: 1.17, USD: 1.27, GBP: 1.0 },
  USD: { EUR: 0.92, GBP: 0.79, USD: 1.0 },
  EUR: { GBP: 0.85, USD: 1.09, EUR: 1.0 },
};

const convertCurrency = (amount: number, from: string, to: string): number => {
  if (from === to) return amount;
  const rate = FX_RATES[from]?.[to];
  if (rate) return Math.round(amount * rate * 100) / 100;
  return amount;
};

export const fetchBricksetPrice = async (
  params: BricksetPriceParams,
): Promise<BricksetPriceResult> => {
  const normalized = cleanLegoInput(params.itemNo, params.itemType);
  const itemNo = normalized.itemNo;
  const isMinifig = normalized.itemType === 'MINIFIG';
  const queriedSlug = params.bricksetSetNumber?.trim() || normalized.bricksetSlug;
  const currency = (params.currency || 'EUR').toUpperCase();
  const apiKey = params.apiKey || getCachedBricksetKey();

  // 1. Try Supabase Edge Function
  try {
    const { data, error } = await supabase.functions.invoke('brickset-price', {
      body: {
        itemNo: queriedSlug,
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
        queriedItemNo: queriedSlug !== itemNo ? queriedSlug : undefined,
      };
    }
  } catch {
    // Edge function failed or not available; proceed to local proxy fallback below
  }

  // 2. Client-side fallback via Vite proxy (useful in dev/local environments)
  if (typeof window !== 'undefined') {
    try {
      if (isMinifig) {
        const res = await fetch(`/api/brickset/minifigs/${encodeURIComponent(itemNo)}`);
        if (res.ok) {
          const html = await res.text();
          const h1Match = html.match(/<h1[^>]*>\s*([A-Za-z0-9_-]+)(?::\s*|\s+)([\s\S]*?)<\/h1>/i);
          const dtNameMatch = html.match(/<dt>Name<\/dt>\s*<dd>([^<]+)<\/dd>/i);
          const name = dtNameMatch?.[1] ? dtNameMatch[1].trim() : (h1Match?.[2] ? h1Match[2].replace(/\s+/g, ' ').trim() : undefined);

          const valNewMatch =
            html.match(/New:\s*<a[^>]*>~([^\d\s]*)\s*([\d,.]+)/i) ||
            html.match(/Value new<\/dt>\s*<dd><a[^>]*>~([^\d\s]*)\s*([\d,.]+)/i);
          const valUsedMatch =
            html.match(/Used:\s*<a[^>]*>~([^\d\s]*)\s*([\d,.]+)/i) ||
            html.match(/Value used<\/dt>\s*<dd><a[^>]*>~([^\d\s]*)\s*([\d,.]+)/i);

          const rawNew = valNewMatch?.[2] ? parseFloat(valNewMatch[2].replace(/,/g, '')) : undefined;
          const rawUsed = valUsedMatch?.[2] ? parseFloat(valUsedMatch[2].replace(/,/g, '')) : undefined;

          if (rawNew !== undefined || rawUsed !== undefined) {
            const rawSym = (valNewMatch?.[1] ? valNewMatch[1] : valUsedMatch?.[1] ?? '').trim();
            const sourceCurr = rawSym.includes('£')
              ? 'GBP'
              : rawSym.includes('$')
                ? 'USD'
                : 'EUR';

            const pNew = rawNew ? convertCurrency(rawNew, sourceCurr, currency) : undefined;
            const pUsed = rawUsed ? convertCurrency(rawUsed, sourceCurr, currency) : undefined;

            const isUsed = (params.condition || '').toLowerCase().includes('used');
            const chosen = isUsed && pUsed !== undefined ? pUsed : (pNew ?? pUsed ?? 0);

            const sets = Array.from(
              new Set(Array.from(html.matchAll(/\/sets\/(\d+-\d+)/g), (m) => m[1])),
            ).filter((s): s is string => Boolean(s));

            return {
              itemNo,
              queriedItemNo: queriedSlug !== itemNo ? queriedSlug : undefined,
              name,
              currency,
              retailPrice: chosen,
              priceNew: pNew,
              priceUsed: pUsed,
              appearsIn: sets.slice(0, 5),
              dateFetched: new Date().toISOString(),
              source: 'brickset',
              itemType: 'MINIFIG',
            };
          }
        }
      } else {
        const setSlug = queriedSlug.includes('-') ? queriedSlug : `${queriedSlug}-1`;
        const res = await fetch(`/api/brickset/sets/${setSlug}`);
        if (res.ok) {
          const html = await res.text();
          const h1Match = html.match(/<h1[^>]*>\s*([A-Za-z0-9_-]+)(?::\s*|\s+)([\s\S]*?)<\/h1>/i);
          const dtNameMatch = html.match(/<dt>Name<\/dt>\s*<dd>([^<]+)<\/dd>/i);
          const name = dtNameMatch?.[1] ? dtNameMatch[1].trim() : (h1Match?.[2] ? h1Match[2].replace(/\s+/g, ' ').trim() : undefined);

          // 1. Current Market Values (New & Used from BrickLink / Brickset)
          const valNewMatch =
            html.match(/New:\s*<a[^>]*>~([^\d\s]*)\s*([\d,.]+)/i) ||
            html.match(/Value new<\/dt>\s*<dd><a[^>]*>~([^\d\s]*)\s*([\d,.]+)/i);
          const valUsedMatch =
            html.match(/Used:\s*<a[^>]*>~([^\d\s]*)\s*([\d,.]+)/i) ||
            html.match(/Value used<\/dt>\s*<dd><a[^>]*>~([^\d\s]*)\s*([\d,.]+)/i);

          const rawNew = valNewMatch?.[2] ? parseFloat(valNewMatch[2].replace(/,/g, '')) : undefined;
          const rawUsed = valUsedMatch?.[2] ? parseFloat(valUsedMatch[2].replace(/,/g, '')) : undefined;

          let pNew: number | undefined;
          let pUsed: number | undefined;
          if (rawNew !== undefined || rawUsed !== undefined) {
            const rawSym = (valNewMatch?.[1] ? valNewMatch[1] : valUsedMatch?.[1] ?? '').trim();
            const sourceCurr = rawSym.includes('£')
              ? 'GBP'
              : rawSym.includes('$')
                ? 'USD'
                : 'EUR';
            pNew = rawNew ? convertCurrency(rawNew, sourceCurr, currency) : undefined;
            pUsed = rawUsed ? convertCurrency(rawUsed, sourceCurr, currency) : undefined;
          }

          // 2. Official LEGO RRP (if available)
          const rrpMatch = html.match(/RRP<\/dt>\s*<dd>([^<]+)<\/dd>/i);
          const rrpText = rrpMatch?.[1] ? rrpMatch[1].trim() : '';
          const eurMatch = rrpText.match(/([\d,.]+)\s*[€]|€\s*([\d,.]+)/);
          const usdMatch = rrpText.match(/[\$]\s*([\d,.]+)/);
          const gbpMatch = rrpText.match(/[£]\s*([\d,.]+)/);

          const rawEur = eurMatch?.[1] || eurMatch?.[2];
          const eurVal = rawEur ? parseFloat(rawEur.replace(/,/g, '')) : undefined;
          const usdVal = usdMatch?.[1] ? parseFloat(usdMatch[1].replace(/,/g, '')) : undefined;
          const gbpVal = gbpMatch?.[1] ? parseFloat(gbpMatch[1].replace(/,/g, '')) : undefined;

          let rrpEur: number | undefined;
          if (currency === 'EUR') {
            rrpEur = eurVal ?? (usdVal ? convertCurrency(usdVal, 'USD', 'EUR') : undefined) ?? (gbpVal ? convertCurrency(gbpVal, 'GBP', 'EUR') : undefined);
          } else if (currency === 'USD') {
            rrpEur = usdVal ?? (eurVal ? convertCurrency(eurVal, 'EUR', 'USD') : undefined) ?? (gbpVal ? convertCurrency(gbpVal, 'GBP', 'USD') : undefined);
          } else {
            rrpEur = gbpVal ?? (eurVal ? convertCurrency(eurVal, 'EUR', 'GBP') : undefined) ?? (usdVal ? convertCurrency(usdVal, 'USD', 'GBP') : undefined);
          }

          // 3. Minifigures inside set
          const minifigsMatch = html.match(/<dt>Minifigs<\/dt>\s*<dd><a[^>]*href=['"]\/minifigs\/in-([^'"]+)['"][^>]*>(\d+)<\/a>/i);
          const minifigCount = minifigsMatch ? Number(minifigsMatch[2]) : undefined;
          let singleMinifigCode: string | undefined;

          if (minifigCount === 1) {
            try {
              const inRes = await fetch(`/api/brickset/minifigs/in-${setSlug}`);
              if (inRes.ok) {
                const inHtml = await inRes.text();
                const singleMfMatch = inHtml.match(/\/minifigs\/([a-z]{2,5}\d+[a-z]?|fig-\d+|col[a-z0-9]+)/i);
                if (singleMfMatch?.[1]) {
                  singleMinifigCode = singleMfMatch[1].toLowerCase();
                }
              }
            } catch {
              // non-blocking
            }
          }

          // 4. Pieces & Year
          const yearMatch = html.match(/Year released<\/dt>\s*<dd><a[^>]*>(\d{4})<\/a>/i);
          const piecesMatch = html.match(/Pieces<\/dt>\s*<dd[^>]*>(\d+)<\/dd>/i);

          const isUsed = (params.condition || '').toLowerCase().includes('used');
          // Prefer current market value for condition, fallback to RRP
          const chosen = isUsed
            ? (pUsed ?? pNew ?? rrpEur ?? 0)
            : (pNew ?? rrpEur ?? pUsed ?? 0);

          if (chosen > 0) {
            return {
              itemNo,
              queriedItemNo: setSlug,
              name,
              currency,
              retailPrice: chosen,
              priceNew: pNew,
              priceUsed: pUsed,
              rrp: rrpEur,
              year: yearMatch ? Number(yearMatch[1]) : undefined,
              pieces: piecesMatch ? Number(piecesMatch[1]) : undefined,
              dateFetched: new Date().toISOString(),
              source: 'brickset',
              itemType: 'SET',
              containedMinifig: minifigCount
                ? { code: singleMinifigCode || setSlug, count: minifigCount }
                : undefined,
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
