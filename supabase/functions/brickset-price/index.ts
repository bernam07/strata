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

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const cleanLegoInput = (rawInput: string, hintedType?: 'SET' | 'MINIFIG') => {
  let cleaned = (rawInput || '').trim();

  // 1. BrickLink URLs (?M= for minifigs or ?S= for sets)
  const blMinifig = cleaned.match(/bricklink\.com.*?[\?&]M=([a-z0-9_-]+)/i);
  if (blMinifig) {
    const rawCode = blMinifig[1].toLowerCase();
    const code = rawCode.startsWith('fig-') ? rawCode : rawCode.replace(/-\d+$/, '');
    return {
      raw: rawInput,
      itemNo: code,
      itemType: 'MINIFIG' as const,
      bricksetSlug: code,
    };
  }

  const blSet = cleaned.match(/bricklink\.com.*?[\?&]S=([a-z0-9_-]+)/i);
  if (blSet) {
    const rawNum = blSet[1];
    const withVariant = rawNum.includes('-') ? rawNum : `${rawNum}-1`;
    return {
      raw: rawInput,
      itemNo: withVariant,
      itemType: 'SET' as const,
      bricksetSlug: withVariant,
    };
  }

  // 2. Minifigure URL or slug path
  const minifigUrl =
    cleaned.match(/brickset\.com\/minifigs\/([a-z0-9_-]+)/i) ||
    cleaned.match(/^minifigs\/([a-z0-9_-]+)/i);
  if (minifigUrl) {
    const matched = minifigUrl[1];
    if (matched.toLowerCase().startsWith('in-')) {
      const setNo = matched.slice(3);
      const withVariant = setNo.includes('-') ? setNo : `${setNo}-1`;
      return {
        raw: rawInput,
        itemNo: withVariant,
        itemType: 'SET' as const,
        bricksetSlug: withVariant,
      };
    }
    const rawCode = matched.toLowerCase();
    const code = rawCode.startsWith('fig-') ? rawCode : rawCode.replace(/-\d+$/, '');
    return {
      raw: rawInput,
      itemNo: code,
      itemType: 'MINIFIG' as const,
      bricksetSlug: code,
    };
  }

  // 3. Set URL or slug path
  const setUrl =
    cleaned.match(/brickset\.com\/sets\/([a-z0-9]+(?:-[0-9]+)?)/i) ||
    cleaned.match(/^sets\/([a-z0-9]+(?:-[0-9]+)?)/i);
  if (setUrl) {
    const rawNum = setUrl[1];
    const withVariant = rawNum.includes('-') ? rawNum : `${rawNum}-1`;
    return {
      raw: rawInput,
      itemNo: withVariant,
      itemType: 'SET' as const,
      bricksetSlug: withVariant,
    };
  }

  cleaned = cleaned.replace(/^#/, '').trim();

  // 4. Minifigure code patterns:
  const isMinifigPattern =
    /^(fig-\d+|[a-z]{2,5}\d+[a-z]?|col[a-z0-9]+)(-\d+)?$/i.test(cleaned);
  if (isMinifigPattern || hintedType === 'MINIFIG') {
    const rawCode = cleaned.toLowerCase();
    const code = rawCode.startsWith('fig-') ? rawCode : rawCode.replace(/-\d+$/, '');
    return {
      raw: rawInput,
      itemNo: code,
      itemType: 'MINIFIG' as const,
      bricksetSlug: code,
    };
  }

  // 5. Set number
  const cleanNum = cleaned.replace(/\s+/g, '');
  const withVariant = cleanNum.includes('-') ? cleanNum : `${cleanNum}-1`;
  return {
    raw: rawInput,
    itemNo: withVariant,
    itemType: 'SET' as const,
    bricksetSlug: withVariant,
  };
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

interface MinifigScrapeResult {
  itemNo: string;
  name?: string;
  theme?: string;
  year?: number;
  currency: string;
  retailPrice: number;
  priceNew?: number;
  priceUsed?: number;
  appearsIn?: string[];
  source: 'brickset';
  itemType: 'MINIFIG';
}

const fetchMinifigValuation = async (
  itemNo: string,
  condition?: string,
  targetCurrency = 'EUR',
): Promise<MinifigScrapeResult | null> => {
  try {
    const cleanNo = itemNo.trim().replace(/-\d+$/, '').toLowerCase();
    const url = `https://brickset.com/minifigs/${encodeURIComponent(cleanNo)}`;
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) return null;
    const html = await response.text();

    const h1Match = html.match(/<h1[^>]*>\s*([A-Za-z0-9_-]+)(?::\s*|\s+)([\s\S]*?)<\/h1>/i);
    const dtNameMatch = html.match(/<dt>Name<\/dt>\s*<dd>([^<]+)<\/dd>/i);
    const name = dtNameMatch ? dtNameMatch[1].trim() : (h1Match ? h1Match[2].replace(/\s+/g, ' ').trim() : undefined);

    // Search for New and Used market values displayed by Brickset
    const valNewMatch =
      html.match(/New:\s*<a[^>]*>~([^\d\s]*)\s*([\d,.]+)/i) ||
      html.match(/Value new<\/dt>\s*<dd><a[^>]*>~([^\d\s]*)\s*([\d,.]+)/i);
    const valUsedMatch =
      html.match(/Used:\s*<a[^>]*>~([^\d\s]*)\s*([\d,.]+)/i) ||
      html.match(/Value used<\/dt>\s*<dd><a[^>]*>~([^\d\s]*)\s*([\d,.]+)/i);

    const rawNew = valNewMatch ? numberValue(valNewMatch[2]) : undefined;
    const rawUsed = valUsedMatch ? numberValue(valUsedMatch[2]) : undefined;

    if (!rawNew && !rawUsed) return null;

    const rawSym = (valNewMatch ? valNewMatch[1] : valUsedMatch?.[1] ?? '').trim();
    const sourceCurr = rawSym.includes('£')
      ? 'GBP'
      : rawSym.includes('$')
        ? 'USD'
        : 'EUR';

    const priceNew = rawNew ? convertCurrency(rawNew, sourceCurr, targetCurrency) : undefined;
    const priceUsed = rawUsed ? convertCurrency(rawUsed, sourceCurr, targetCurrency) : undefined;

    const condLower = (condition || '').toLowerCase();
    const isUsed =
      condLower.includes('used') ||
      condLower.includes('good') ||
      condLower.includes('fair') ||
      condLower.includes('loose');
    const selectedPrice =
      isUsed && priceUsed !== undefined
        ? priceUsed
        : (priceNew ?? priceUsed ?? 0);

    // Appears in set list
    const sets = Array.from(new Set(Array.from(html.matchAll(/\/sets\/(\d+-\d+)/g), (m) => m[1])));

    // Year released
    const yearMatch = html.match(/Year released<\/dt>\s*<dd><a[^>]*>(\d{4})<\/a>/i);
    const year = yearMatch ? Number(yearMatch[1]) : undefined;

    // Category / theme
    const catMatch = html.match(/Category<\/dt>\s*<dd><a[^>]*>([^<]+)<\/a>/i);
    const theme = catMatch ? catMatch[1].trim() : 'Minifigures';

    return {
      itemNo: cleanNo,
      name,
      theme,
      year,
      currency: targetCurrency,
      retailPrice: selectedPrice,
      priceNew,
      priceUsed,
      appearsIn: sets.slice(0, 5),
      source: 'brickset',
      itemType: 'MINIFIG',
    };
  } catch {
    return null;
  }
};

const fetchSetFromBricksetPage = async (
  itemNo: string,
  condition?: string,
  targetCurrency = 'EUR',
): Promise<Record<string, unknown> | null> => {
  try {
    const cleanNo = itemNo.trim().replace(/\s+/g, '');
    const slug = cleanNo.includes('-') ? cleanNo : `${cleanNo.replace(/-\d+$/, '')}-1`;
    const url = `https://brickset.com/sets/${slug}`;
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) return null;
    const html = await response.text();

    const h1Match = html.match(/<h1[^>]*>\s*([A-Za-z0-9_-]+)(?::\s*|\s+)([\s\S]*?)<\/h1>/i);
    const dtNameMatch = html.match(/<dt>Name<\/dt>\s*<dd>([^<]+)<\/dd>/i);
    const name = dtNameMatch ? dtNameMatch[1].trim() : (h1Match ? h1Match[2].replace(/\s+/g, ' ').trim() : undefined);

    const themeMatch = html.match(/Theme<\/dt>\s*<dd><a[^>]*>([^<]+)<\/a>/i);
    const theme = themeMatch ? themeMatch[1].trim() : undefined;

    const yearMatch = html.match(/Year released<\/dt>\s*<dd><a[^>]*>(\d{4})<\/a>/i);
    const year = yearMatch ? Number(yearMatch[1]) : undefined;

    const piecesMatch = html.match(/Pieces<\/dt>\s*<dd[^>]*>(\d+)<\/dd>/i);
    const pieces = piecesMatch ? Number(piecesMatch[1]) : undefined;

    // 1. Market value New / Used
    const valNewMatch =
      html.match(/New:\s*<a[^>]*>~([^\d\s]*)\s*([\d,.]+)/i) ||
      html.match(/Value new<\/dt>\s*<dd><a[^>]*>~([^\d\s]*)\s*([\d,.]+)/i);
    const valUsedMatch =
      html.match(/Used:\s*<a[^>]*>~([^\d\s]*)\s*([\d,.]+)/i) ||
      html.match(/Value used<\/dt>\s*<dd><a[^>]*>~([^\d\s]*)\s*([\d,.]+)/i);

    const rawNew = valNewMatch ? numberValue(valNewMatch[2]) : undefined;
    const rawUsed = valUsedMatch ? numberValue(valUsedMatch[2]) : undefined;

    let priceNew: number | undefined;
    let priceUsed: number | undefined;
    if (rawNew !== undefined || rawUsed !== undefined) {
      const rawSym = (valNewMatch ? valNewMatch[1] : valUsedMatch?.[1] ?? '').trim();
      const sourceCurr = rawSym.includes('£')
        ? 'GBP'
        : rawSym.includes('$')
          ? 'USD'
          : 'EUR';
      priceNew = rawNew ? convertCurrency(rawNew, sourceCurr, targetCurrency) : undefined;
      priceUsed = rawUsed ? convertCurrency(rawUsed, sourceCurr, targetCurrency) : undefined;
    }

    // 2. Official LEGO RRP
    const rrpMatch = html.match(/RRP<\/dt>\s*<dd>([^<]+)<\/dd>/i);
    const rrpText = rrpMatch ? rrpMatch[1].trim() : '';

    const gbpMatch = rrpText.match(/[£]\s*([\d,.]+)/);
    const usdMatch = rrpText.match(/[\$]\s*([\d,.]+)/);
    const eurMatch = rrpText.match(/([\d,.]+)\s*[€]|€\s*([\d,.]+)/);

    const eurVal = eurMatch ? numberValue(eurMatch[1] || eurMatch[2]) : undefined;
    const usdVal = usdMatch ? numberValue(usdMatch[1]) : undefined;
    const gbpVal = gbpMatch ? numberValue(gbpMatch[1]) : undefined;

    let rrpAmount: number | undefined;
    if (targetCurrency === 'EUR') {
      rrpAmount =
        eurVal ??
        (usdVal ? convertCurrency(usdVal, 'USD', 'EUR') : undefined) ??
        (gbpVal ? convertCurrency(gbpVal, 'GBP', 'EUR') : undefined);
    } else if (targetCurrency === 'USD') {
      rrpAmount =
        usdVal ??
        (eurVal ? convertCurrency(eurVal, 'EUR', 'USD') : undefined) ??
        (gbpVal ? convertCurrency(gbpVal, 'GBP', 'USD') : undefined);
    } else if (targetCurrency === 'GBP') {
      rrpAmount =
        gbpVal ??
        (eurVal ? convertCurrency(eurVal, 'EUR', 'GBP') : undefined) ??
        (usdVal ? convertCurrency(usdVal, 'USD', 'GBP') : undefined);
    }

    // 3. Minifigures inside set
    const minifigsMatch = html.match(/<dt>Minifigs<\/dt>\s*<dd><a[^>]*href=['"]\/minifigs\/in-([^'"]+)['"][^>]*>(\d+)<\/a>/i);
    const minifigCount = minifigsMatch ? Number(minifigsMatch[2]) : undefined;
    let singleMinifigCode: string | undefined;

    if (minifigCount === 1) {
      try {
        const inSetUrl = `https://brickset.com/minifigs/in-${slug}`;
        const inRes = await fetch(inSetUrl, { headers: { 'User-Agent': USER_AGENT } });
        if (inRes.ok) {
          const inHtml = await inRes.text();
          const singleMfMatch = inHtml.match(/\/minifigs\/([a-z]{2,5}\d+[a-z]?|fig-\d+|col[a-z0-9]+)/i);
          if (singleMfMatch) {
            singleMinifigCode = singleMfMatch[1].toLowerCase();
          }
        }
      } catch {
        // non-blocking
      }
    }

    const condLower = (condition || '').toLowerCase();
    const isUsed =
      condLower.includes('used') ||
      condLower.includes('good') ||
      condLower.includes('fair') ||
      condLower.includes('loose');

    // Prefer current market value for the condition, fallback to RRP
    const finalPrice = isUsed
      ? (priceUsed ?? priceNew ?? rrpAmount)
      : (priceNew ?? rrpAmount ?? priceUsed);

    if (!finalPrice || finalPrice <= 0) return null;

    return {
      itemNo: slug,
      queriedItemNo: slug,
      name,
      theme,
      year,
      pieces,
      currency: targetCurrency,
      retailPrice: finalPrice,
      priceNew,
      priceUsed,
      rrp: rrpAmount,
      containedMinifig: minifigCount
        ? { code: singleMinifigCode || slug, count: minifigCount }
        : undefined,
      source: 'brickset',
      itemType: 'SET',
    };
  } catch {
    return null;
  }
};

const resolveApiSetPrice = (
  set: Record<string, unknown>,
  targetCurrency = 'EUR',
): number | undefined => {
  const legoCom = set.LEGOCom;
  if (legoCom && typeof legoCom === 'object') {
    const prices = legoCom as Record<string, unknown>;
    const getCountryPrice = (c: string): number | undefined => {
      const data = prices[c];
      if (!data) return undefined;
      return (
        numberValue(data) ||
        (typeof data === 'object'
          ? numberValue((data as Record<string, unknown>).retailPrice)
          : undefined)
      );
    };

    const deEur = getCountryPrice('DE') || getCountryPrice('PT') || getCountryPrice('ES');
    const usUsd = getCountryPrice('US');
    const ukGbp = getCountryPrice('UK');

    if (targetCurrency === 'EUR') {
      if (deEur && deEur > 0) return deEur;
      if (usUsd && usUsd > 0) return convertCurrency(usUsd, 'USD', 'EUR');
      if (ukGbp && ukGbp > 0) return convertCurrency(ukGbp, 'GBP', 'EUR');
    } else if (targetCurrency === 'USD') {
      if (usUsd && usUsd > 0) return usUsd;
      if (deEur && deEur > 0) return convertCurrency(deEur, 'EUR', 'USD');
      if (ukGbp && ukGbp > 0) return convertCurrency(ukGbp, 'GBP', 'USD');
    } else if (targetCurrency === 'GBP') {
      if (ukGbp && ukGbp > 0) return ukGbp;
      if (deEur && deEur > 0) return convertCurrency(deEur, 'EUR', 'GBP');
      if (usUsd && usUsd > 0) return convertCurrency(usUsd, 'USD', 'GBP');
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
      condition?: string;
      currency?: string;
      apiKey?: string;
    };

    const rawInput = body.itemNo?.trim();
    if (!rawInput) return json({ error: 'Missing itemNo parameter' }, 400);

    const currency = (body.currency || 'EUR').toUpperCase();
    const normalized = cleanLegoInput(rawInput, body.itemType);
    const isMinifig = normalized.itemType === 'MINIFIG';
    const itemNo = normalized.itemNo;

    // 1. If it is a Minifigure, try Brickset's minifigure page lookup
    if (isMinifig) {
      const minifigResult = await fetchMinifigValuation(itemNo, body.condition, currency);
      if (minifigResult && minifigResult.retailPrice > 0) {
        return json({
          ...minifigResult,
          queriedItemNo: itemNo,
          dateFetched: new Date().toISOString(),
        });
      }
    }

    // 2. Resolve Brickset API key (either from body or user vault)
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

    // 3. Fallback to scraping the public Brickset set page (fetches Current Market Values New & Used + RRP)
    const pageSet = await fetchSetFromBricksetPage(itemNo, body.condition, currency);
    if (pageSet && (pageSet.retailPrice as number) > 0) {
      return json({
        ...pageSet,
        dateFetched: new Date().toISOString(),
      });
    }

    // 4. If scraping page didn't have current value, query Brickset API v3 getSets
    if (apiKey) {
      const cleanItemNo = itemNo.replace(/-\d+$/, '');
      const setNumberWithVariant = itemNo.includes('-') ? itemNo : `${cleanItemNo}-1`;

      let setParams = encodeURIComponent(
        JSON.stringify({ setNumber: setNumberWithVariant, pageSize: 1 }),
      );
      let url = `https://brickset.com/api/v3.asmx/getSets?apiKey=${encodeURIComponent(apiKey)}&userHash=&params=${setParams}`;
      let response = await fetch(url, { headers: { Accept: 'application/json' } });
      let payload = (await response.json().catch(() => null)) as {
        status?: string;
        message?: string;
        sets?: Array<Record<string, unknown>>;
      } | null;

      if (!payload?.sets?.length) {
        setParams = encodeURIComponent(JSON.stringify({ query: cleanItemNo, pageSize: 1 }));
        url = `https://brickset.com/api/v3.asmx/getSets?apiKey=${encodeURIComponent(apiKey)}&userHash=&params=${setParams}`;
        response = await fetch(url, { headers: { Accept: 'application/json' } });
        payload = (await response.json().catch(() => null)) as {
          status?: string;
          message?: string;
          sets?: Array<Record<string, unknown>>;
        } | null;
      }

      if (response.ok && payload?.status === 'success' && payload.sets?.[0]) {
        const set = payload.sets[0];
        const apiRetailPrice = resolveApiSetPrice(set, currency);
        if (apiRetailPrice && apiRetailPrice > 0) {
          return json({
            itemNo: cleanItemNo,
            queriedItemNo: setNumberWithVariant,
            itemType: isMinifig ? 'MINIFIG' : 'SET',
            name: typeof set.name === 'string' ? set.name : undefined,
            currency,
            retailPrice: apiRetailPrice,
            rrp: apiRetailPrice,
            year: numberValue(set.year),
            pieces: numberValue(set.pieces),
            theme: typeof set.theme === 'string' ? set.theme : undefined,
            dateFetched: new Date().toISOString(),
            source: 'brickset',
          });
        }
      }
    }

    // 5. If it was classified as set and failed, try minifig lookup as last resort
    if (!isMinifig) {
      const minifigResult = await fetchMinifigValuation(itemNo, body.condition, currency);
      if (minifigResult && minifigResult.retailPrice > 0) {
        return json({
          ...minifigResult,
          queriedItemNo: itemNo,
          dateFetched: new Date().toISOString(),
        });
      }
    }

    return json({ error: `Could not retrieve valuation for LEGO item ${rawInput} from Brickset.` }, 404);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
