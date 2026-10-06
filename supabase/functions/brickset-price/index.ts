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

const isMinifigIdentifier = (itemNo: string, itemType?: string): boolean => {
  if (itemType === 'MINIFIG') return true;
  if (itemType === 'SET') return false;
  const clean = itemNo.trim().toLowerCase();
  return /^(fig-\d+|[a-z]{2,5}\d+[a-z]?|col[a-z0-9]+)$/i.test(clean);
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
    const url = `https://brickset.com/minifigs/${encodeURIComponent(itemNo.trim())}`;
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) return null;
    const html = await response.text();

    const nameMatch = html.match(/<h1>\s*([A-Za-z0-9_-]+):\s*([^<]+)<\/h1>/i);
    const name = nameMatch ? nameMatch[2].trim() : undefined;

    // Search for New and Used market values displayed by Brickset
    const valNewMatch =
      html.match(/New:\s*<a[^>]*>~([^\d\s]*)\s*([\d,.]+)/i) ||
      html.match(/Value new<\/dt>\s*<dd><a[^>]*>~([^\d\s]*)\s*([\d,.]+)/i);
    const valUsedMatch =
      html.match(/Used:\s*<a[^>]*>~([^\d\s]*)\s*([\d,.]+)/i) ||
      html.match(/Value used<\/dt>\s*<dd><a[^>]*>~([^\d\s]*)\s*([\d,.]+)/i);

    const priceNew = valNewMatch ? numberValue(valNewMatch[2]) : undefined;
    const priceUsed = valUsedMatch ? numberValue(valUsedMatch[2]) : undefined;

    if (!priceNew && !priceUsed) return null;

    const rawSym = (valNewMatch ? valNewMatch[1] : valUsedMatch?.[1] ?? '').trim();
    const sourceCurr = rawSym.includes('£')
      ? 'GBP'
      : rawSym.includes('$')
        ? 'USD'
        : rawSym.includes('€')
          ? 'EUR'
          : 'GBP';

    const condLower = (condition || '').toLowerCase();
    const isUsed =
      condLower.includes('used') ||
      condLower.includes('good') ||
      condLower.includes('fair') ||
      condLower.includes('loose');
    const selectedRawPrice =
      isUsed && priceUsed !== undefined
        ? priceUsed
        : (priceNew ?? priceUsed ?? 0);

    const convertedPrice = convertCurrency(selectedRawPrice, sourceCurr, targetCurrency);

    // Appears in set list
    const sets = Array.from(new Set(Array.from(html.matchAll(/\/sets\/(\d+-\d+)/g), (m) => m[1])));

    // Year released
    const yearMatch = html.match(/Year released<\/dt>\s*<dd><a[^>]*>(\d{4})<\/a>/i);
    const year = yearMatch ? Number(yearMatch[1]) : undefined;

    // Category / theme
    const catMatch = html.match(/Category<\/dt>\s*<dd><a[^>]*>([^<]+)<\/a>/i);
    const theme = catMatch ? catMatch[1].trim() : 'Minifigures';

    return {
      itemNo,
      name,
      theme,
      year,
      currency: targetCurrency,
      retailPrice: convertedPrice,
      priceNew: priceNew ? convertCurrency(priceNew, sourceCurr, targetCurrency) : undefined,
      priceUsed: priceUsed ? convertCurrency(priceUsed, sourceCurr, targetCurrency) : undefined,
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
  targetCurrency = 'EUR',
): Promise<Record<string, unknown> | null> => {
  try {
    const cleanNo = itemNo.trim().replace(/-\d+$/, '');
    const slug = `${cleanNo}-1`;
    const url = `https://brickset.com/sets/${slug}`;
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!response.ok) return null;
    const html = await response.text();

    const titleMatch = html.match(/<h1>\s*([A-Za-z0-9_-]+):\s*([^<]+)<\/h1>/i);
    const name = titleMatch ? titleMatch[2].trim() : undefined;

    const themeMatch = html.match(/Theme<\/dt>\s*<dd><a[^>]*>([^<]+)<\/a>/i);
    const theme = themeMatch ? themeMatch[1].trim() : undefined;

    const yearMatch = html.match(/Year released<\/dt>\s*<dd><a[^>]*>(\d{4})<\/a>/i);
    const year = yearMatch ? Number(yearMatch[1]) : undefined;

    const piecesMatch = html.match(/Pieces<\/dt>\s*<dd[^>]*>(\d+)<\/dd>/i);
    const pieces = piecesMatch ? Number(piecesMatch[1]) : undefined;

    const rrpMatch = html.match(/RRP<\/dt>\s*<dd>([^<]+)<\/dd>/i);
    const rrpText = rrpMatch ? rrpMatch[1].trim() : '';

    const gbpMatch = rrpText.match(/[£]\s*([\d,.]+)/);
    const usdMatch = rrpText.match(/[\$]\s*([\d,.]+)/);
    const eurMatch = rrpText.match(/([\d,.]+)\s*[€]|€\s*([\d,.]+)/);

    const eurVal = eurMatch ? numberValue(eurMatch[1] || eurMatch[2]) : undefined;
    const usdVal = usdMatch ? numberValue(usdMatch[1]) : undefined;
    const gbpVal = gbpMatch ? numberValue(gbpMatch[1]) : undefined;

    let finalPrice: number | undefined;
    if (targetCurrency === 'EUR') {
      finalPrice =
        eurVal ??
        (usdVal ? convertCurrency(usdVal, 'USD', 'EUR') : undefined) ??
        (gbpVal ? convertCurrency(gbpVal, 'GBP', 'EUR') : undefined);
    } else if (targetCurrency === 'USD') {
      finalPrice =
        usdVal ??
        (eurVal ? convertCurrency(eurVal, 'EUR', 'USD') : undefined) ??
        (gbpVal ? convertCurrency(gbpVal, 'GBP', 'USD') : undefined);
    } else if (targetCurrency === 'GBP') {
      finalPrice =
        gbpVal ??
        (eurVal ? convertCurrency(eurVal, 'EUR', 'GBP') : undefined) ??
        (usdVal ? convertCurrency(usdVal, 'USD', 'GBP') : undefined);
    }

    if (!finalPrice || finalPrice <= 0) return null;

    return {
      itemNo: cleanNo,
      queriedItemNo: slug,
      name,
      theme,
      year,
      pieces,
      currency: targetCurrency,
      retailPrice: finalPrice,
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

    const rawItemNo = body.itemNo?.trim();
    if (!rawItemNo) return json({ error: 'Missing itemNo parameter' }, 400);

    const currency = (body.currency || 'EUR').toUpperCase();
    const isMinifig = isMinifigIdentifier(rawItemNo, body.itemType);

    // 1. If it is a Minifigure, first try Brickset's minifigure lookup
    if (isMinifig) {
      const minifigResult = await fetchMinifigValuation(rawItemNo, body.condition, currency);
      if (minifigResult && minifigResult.retailPrice > 0) {
        return json({
          ...minifigResult,
          queriedItemNo: rawItemNo,
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

    // 3. If API key is available, query Brickset API v3 getSets
    const cleanItemNo = rawItemNo.replace(/-\d+$/, '');
    const setNumberWithVariant = rawItemNo.includes('-') ? rawItemNo : `${cleanItemNo}-1`;

    if (apiKey) {
      // First try exact setNumber search
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

      // If no match by exact setNumber, try query search
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
        const retailPrice = resolveApiSetPrice(set, currency);
        if (retailPrice && retailPrice > 0) {
          return json({
            itemNo: cleanItemNo,
            queriedItemNo: setNumberWithVariant,
            itemType: isMinifig ? 'MINIFIG' : 'SET',
            name: typeof set.name === 'string' ? set.name : undefined,
            currency,
            retailPrice,
            year: numberValue(set.year),
            pieces: numberValue(set.pieces),
            theme: typeof set.theme === 'string' ? set.theme : undefined,
            dateFetched: new Date().toISOString(),
            source: 'brickset',
          });
        }
      }
    }

    // 4. Fallback to scraping the public Brickset set page (works even when API key is missing or set is unpriced in API)
    const pageSet = await fetchSetFromBricksetPage(rawItemNo, currency);
    if (pageSet && (pageSet.retailPrice as number) > 0) {
      return json({
        ...pageSet,
        dateFetched: new Date().toISOString(),
      });
    }

    // 5. If it was a set and failed, try minifig lookup as last resort
    if (!isMinifig) {
      const minifigResult = await fetchMinifigValuation(rawItemNo, body.condition, currency);
      if (minifigResult && minifigResult.retailPrice > 0) {
        return json({
          ...minifigResult,
          queriedItemNo: rawItemNo,
          dateFetched: new Date().toISOString(),
        });
      }
    }

    return json({ error: `Could not retrieve valuation for LEGO item ${rawItemNo} from Brickset.` }, 404);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
