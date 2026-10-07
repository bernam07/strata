import { supabase } from '@/db/supabase';
import { getUsdToEurRate } from './tcgdex';

export interface WatchSpecs {
  caseMaterial?: string;
  caseDiameter?: string;
  movement?: string;
  caliber?: string;
  dialColor?: string;
  bezelMaterial?: string;
  waterResistance?: string;
}

export interface WatchDetailsResult {
  referenceNumber: string;
  brand: string;
  model: string;
  fullName: string;
  imageUrl?: string;
  priceUsd?: number;
  priceEur: number;
  fxRateUsed: number;
  specs: WatchSpecs;
  source: 'thewatchapi';
  dateFetched: string;
}

const LOCAL_STORAGE_KEY = 'strata_thewatchapi_key';

export const getCachedTheWatchApiKey = (): string | null => {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(LOCAL_STORAGE_KEY) || null;
};

export const setCachedTheWatchApiKey = (key: string | null): void => {
  if (typeof localStorage === 'undefined') return;
  if (key) localStorage.setItem(LOCAL_STORAGE_KEY, key.trim());
  else localStorage.removeItem(LOCAL_STORAGE_KEY);
};

/**
 * Normalizes watch reference numbers by stripping leading '#' or URLs
 * and trimming whitespace.
 */
export const cleanWatchReference = (raw: string): string => {
  if (!raw) return '';
  let cleaned = raw.trim();

  // If a URL was pasted, extract the last path segment or query param
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    try {
      const url = new URL(cleaned);
      const pathname = url.pathname.replace(/\/+$/, '');
      const segments = pathname.split('/');
      const last = segments[segments.length - 1];
      if (last) cleaned = decodeURIComponent(last);
    } catch {
      // Keep original if URL parsing fails
    }
  }

  // Remove leading '#' or 'ref:' prefix
  cleaned = cleaned.replace(/^#+/, '').replace(/^ref:\s*/i, '').trim();

  return cleaned.toUpperCase();
};

/**
 * Common luxury watch references for fast offline lookup and instant preview.
 */
const CURATED_WATCH_CATALOG: Record<
  string,
  {
    brand: string;
    model: string;
    imageUrl: string;
    priceUsd: number;
    specs: WatchSpecs;
  }
> = {
  '126610LN': {
    brand: 'Rolex',
    model: 'Submariner Date 41mm',
    imageUrl: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=600&q=80',
    priceUsd: 14200,
    specs: {
      caseMaterial: 'Oystersteel (904L)',
      caseDiameter: '41 mm',
      movement: 'Automatic',
      caliber: 'Calibre 3235',
      dialColor: 'Black',
      bezelMaterial: 'Cerachrom Ceramic',
      waterResistance: '300 m / 1,000 ft',
    },
  },
  '126710BLRO': {
    brand: 'Rolex',
    model: 'GMT-Master II "Pepsi" Jubilee',
    imageUrl: 'https://images.unsplash.com/photo-1547996160-71dfabb1d5b3?auto=format&fit=crop&w=600&q=80',
    priceUsd: 20500,
    specs: {
      caseMaterial: 'Oystersteel',
      caseDiameter: '40 mm',
      movement: 'Automatic',
      caliber: 'Calibre 3285',
      dialColor: 'Black',
      bezelMaterial: 'Red & Blue Cerachrom Ceramic',
      waterResistance: '100 m / 330 ft',
    },
  },
  '116500LN': {
    brand: 'Rolex',
    model: 'Cosmograph Daytona Ceramic',
    imageUrl: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=600&q=80',
    priceUsd: 28900,
    specs: {
      caseMaterial: 'Oystersteel',
      caseDiameter: '40 mm',
      movement: 'Automatic Chronograph',
      caliber: 'Calibre 4130',
      dialColor: 'White "Panda"',
      bezelMaterial: 'Black Cerachrom Ceramic',
      waterResistance: '100 m / 330 ft',
    },
  },
  '310.30.42.50.01.002': {
    brand: 'Omega',
    model: 'Speedmaster Professional Moonwatch Sapphire Sandwich',
    imageUrl: 'https://images.unsplash.com/photo-1533139502658-0198f920d8e8?auto=format&fit=crop&w=600&q=80',
    priceUsd: 7600,
    specs: {
      caseMaterial: 'Stainless Steel',
      caseDiameter: '42 mm',
      movement: 'Manual-winding Master Chronometer',
      caliber: 'Calibre 3861',
      dialColor: 'Step Black',
      bezelMaterial: 'Anodized Aluminum with Dot over 90',
      waterResistance: '50 m / 167 ft',
    },
  },
  '210.30.42.20.01.001': {
    brand: 'Omega',
    model: 'Seamaster Diver 300M Co-Axial Master Chronometer',
    imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80',
    priceUsd: 5200,
    specs: {
      caseMaterial: 'Stainless Steel',
      caseDiameter: '42 mm',
      movement: 'Automatic Master Chronometer',
      caliber: 'Calibre 8800',
      dialColor: 'Black Laser-Engraved Wave',
      bezelMaterial: 'Black Ceramic with White Enamel Scale',
      waterResistance: '300 m / 1,000 ft',
    },
  },
  'WSSA0029': {
    brand: 'Cartier',
    model: 'Santos de Cartier Medium',
    imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80',
    priceUsd: 6800,
    specs: {
      caseMaterial: 'Stainless Steel',
      caseDiameter: '35.1 mm',
      movement: 'Automatic',
      caliber: 'Calibre 1847 MC',
      dialColor: 'Silvered Opaline',
      waterResistance: '100 m / 330 ft',
    },
  },
  '5711/1A': {
    brand: 'Patek Philippe',
    model: 'Nautilus Stainless Steel',
    imageUrl: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=600&q=80',
    priceUsd: 95000,
    specs: {
      caseMaterial: 'Stainless Steel',
      caseDiameter: '40 mm',
      movement: 'Automatic',
      caliber: 'Calibre 26-330 S C',
      dialColor: 'Blue Horizontal Ribbed',
      waterResistance: '120 m / 400 ft',
    },
  },
  '15500ST': {
    brand: 'Audemars Piguet',
    model: 'Royal Oak Selfwinding 41mm',
    imageUrl: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=600&q=80',
    priceUsd: 38000,
    specs: {
      caseMaterial: 'Stainless Steel',
      caseDiameter: '41 mm',
      movement: 'Automatic',
      caliber: 'Calibre 4302',
      dialColor: 'Grande Tapisserie Blue',
      waterResistance: '50 m / 165 ft',
    },
  },
  'T137.407.11.091.00': {
    brand: 'Tissot',
    model: 'PRX Powermatic 80 Green 40mm',
    imageUrl: 'https://www.tissotwatches.com/dw/image/v2/BKKD_PRD/on/demandware.static/-/Sites-Tissot-Catalogue/default/dw783ceb3e/product-pictures/6c313b76-3e79-466d-83a5-042e47b276d5_T137-407-11-091-00_shadow.png?sm=fit&sw=800&sh=800',
    priceUsd: 725,
    specs: {
      caseMaterial: '316L Stainless Steel',
      caseDiameter: '40 mm',
      movement: 'Automatic (Powermatic 80.111)',
      caliber: 'Calibre 11 1/2\'\'\' (80h power reserve)',
      dialColor: 'Emerald Green Waffle',
      bezelMaterial: 'Polished Stainless Steel',
      waterResistance: '100 m / 330 ft (10 bar)',
    },
  },
  'T1374071109100': {
    brand: 'Tissot',
    model: 'PRX Powermatic 80 Green 40mm',
    imageUrl: 'https://www.tissotwatches.com/dw/image/v2/BKKD_PRD/on/demandware.static/-/Sites-Tissot-Catalogue/default/dw783ceb3e/product-pictures/6c313b76-3e79-466d-83a5-042e47b276d5_T137-407-11-091-00_shadow.png?sm=fit&sw=800&sh=800',
    priceUsd: 725,
    specs: {
      caseMaterial: '316L Stainless Steel',
      caseDiameter: '40 mm',
      movement: 'Automatic (Powermatic 80.111)',
      caliber: 'Calibre 11 1/2\'\'\' (80h power reserve)',
      dialColor: 'Emerald Green Waffle',
      bezelMaterial: 'Polished Stainless Steel',
      waterResistance: '100 m / 330 ft (10 bar)',
    },
  },
  'T137.407.11.041.00': {
    brand: 'Tissot',
    model: 'PRX Powermatic 80 Blue 40mm',
    imageUrl: 'https://www.tissotwatches.com/dw/image/v2/BKKD_PRD/on/demandware.static/-/Sites-Tissot-Catalogue/default/dw783ceb3e/product-pictures/6c313b76-3e79-466d-83a5-042e47b276d5_T137-407-11-091-00_shadow.png?sm=fit&sw=800&sh=800',
    priceUsd: 725,
    specs: {
      caseMaterial: '316L Stainless Steel',
      caseDiameter: '40 mm',
      movement: 'Automatic (Powermatic 80.111)',
      caliber: 'Calibre 11 1/2\'\'\' (80h power reserve)',
      dialColor: 'Sunray Blue Waffle',
      bezelMaterial: 'Polished Stainless Steel',
      waterResistance: '100 m / 330 ft (10 bar)',
    },
  },
  'T137.407.11.051.00': {
    brand: 'Tissot',
    model: 'PRX Powermatic 80 Black 40mm',
    imageUrl: 'https://www.tissotwatches.com/dw/image/v2/BKKD_PRD/on/demandware.static/-/Sites-Tissot-Catalogue/default/dw783ceb3e/product-pictures/6c313b76-3e79-466d-83a5-042e47b276d5_T137-407-11-091-00_shadow.png?sm=fit&sw=800&sh=800',
    priceUsd: 725,
    specs: {
      caseMaterial: '316L Stainless Steel',
      caseDiameter: '40 mm',
      movement: 'Automatic (Powermatic 80.111)',
      caliber: 'Calibre 11 1/2\'\'\' (80h power reserve)',
      dialColor: 'Classic Black Waffle',
      bezelMaterial: 'Polished Stainless Steel',
      waterResistance: '100 m / 330 ft (10 bar)',
    },
  },
  'T137.407.11.351.00': {
    brand: 'Tissot',
    model: 'PRX Powermatic 80 Ice Blue 40mm',
    imageUrl: 'https://www.tissotwatches.com/dw/image/v2/BKKD_PRD/on/demandware.static/-/Sites-Tissot-Catalogue/default/dw783ceb3e/product-pictures/6c313b76-3e79-466d-83a5-042e47b276d5_T137-407-11-091-00_shadow.png?sm=fit&sw=800&sh=800',
    priceUsd: 725,
    specs: {
      caseMaterial: '316L Stainless Steel',
      caseDiameter: '40 mm',
      movement: 'Automatic (Powermatic 80.111)',
      caliber: 'Calibre 11 1/2\'\'\' (80h power reserve)',
      dialColor: 'Ice Blue Waffle',
      bezelMaterial: 'Polished Stainless Steel',
      waterResistance: '100 m / 330 ft (10 bar)',
    },
  },
};

export const findCuratedWatch = (referenceNumber: string) => {
  const ref = cleanWatchReference(referenceNumber);
  if (!ref) return undefined;
  if (CURATED_WATCH_CATALOG[ref]) return CURATED_WATCH_CATALOG[ref];
  const noDots = ref.replace(/\./g, '');
  if (CURATED_WATCH_CATALOG[noDots]) return CURATED_WATCH_CATALOG[noDots];
  const alphaNum = ref.replace(/[^A-Z0-9]/g, '');
  for (const [key, val] of Object.entries(CURATED_WATCH_CATALOG)) {
    if (key.replace(/[^A-Z0-9]/g, '') === alphaNum) {
      return val;
    }
  }
  return undefined;
};

export const resolveCuratedWatchImage = (referenceNumber: string): string | undefined => {
  return findCuratedWatch(referenceNumber)?.imageUrl;
};

/**
 * Fetches watch details, specifications, official image and current market value
 * from TheWatchAPI with currency conversion to EUR.
 */
export const resolveWatchPrice = async ({
  referenceNumber,
  apiKey,
  fxRate,
}: {
  referenceNumber: string;
  apiKey?: string;
  fxRate?: number;
}): Promise<WatchDetailsResult | null> => {
  const ref = cleanWatchReference(referenceNumber);
  if (!ref) return null;

  const key = apiKey?.trim() || getCachedTheWatchApiKey();
  const rate = fxRate ?? (await getUsdToEurRate());

  const curated = findCuratedWatch(ref);

  // 1. If an API key is available, query TheWatchAPI (Edge function first, then proxy, then direct)
  if (key) {
    // 1A. Try Supabase Edge Function (avoids browser CORS)
    try {
      const { data, error } = await supabase.functions.invoke('thewatchapi-price', {
        body: { referenceNumber: ref, apiKey: key },
      });
      if (!error && data && data.brand && !data.error) {
        const priceUsd = (typeof data.priceUsd === 'number' ? data.priceUsd : undefined) ?? curated?.priceUsd;
        const priceEur = priceUsd && priceUsd > 0
          ? Math.round(priceUsd * rate * 100) / 100
          : (curated ? Math.round(curated.priceUsd * rate * 100) / 100 : 0);
        const imageUrl = (data.imageUrl as string | undefined) || curated?.imageUrl;
        return {
          referenceNumber: ref,
          brand: data.brand,
          model: data.model || curated?.model || ref,
          fullName: data.fullName || `${data.brand} ${data.model || curated?.model || ref} (#${ref})`,
          imageUrl,
          priceUsd,
          priceEur,
          fxRateUsed: rate,
          specs: {
            caseMaterial: data.specs?.caseMaterial || curated?.specs.caseMaterial,
            caseDiameter: data.specs?.caseDiameter || curated?.specs.caseDiameter,
            movement: data.specs?.movement || curated?.specs.movement,
            caliber: data.specs?.caliber || curated?.specs.caliber,
            dialColor: data.specs?.dialColor || curated?.specs.dialColor,
            bezelMaterial: data.specs?.bezelMaterial || curated?.specs.bezelMaterial,
            waterResistance: data.specs?.waterResistance || curated?.specs.waterResistance,
          },
          source: 'thewatchapi',
          dateFetched: new Date().toISOString(),
        };
      }
    } catch {
      // Edge function not deployed or network error; fall back to proxy
    }

    // 1B. Client-side fetch via Vite proxy (/api/thewatchapi) or direct
    const refNoDots = ref.replace(/\./g, '');
    const endpoints = [
      `/api/thewatchapi/v1/model/search?api_token=${encodeURIComponent(key)}&reference_number=${encodeURIComponent(ref)}`,
      ...(refNoDots !== ref
        ? [`/api/thewatchapi/v1/model/search?api_token=${encodeURIComponent(key)}&reference_number=${encodeURIComponent(refNoDots)}`]
        : []),
      `/api/thewatchapi/v1/model/search?api_token=${encodeURIComponent(key)}&search=${encodeURIComponent(ref)}&search_attributes=reference_number,model`,
      ...(refNoDots !== ref
        ? [`/api/thewatchapi/v1/model/search?api_token=${encodeURIComponent(key)}&search=${encodeURIComponent(refNoDots)}&search_attributes=reference_number,model`]
        : []),
      `https://api.thewatchapi.com/v1/model/search?api_token=${encodeURIComponent(key)}&reference_number=${encodeURIComponent(ref)}`,
    ];

    for (const url of endpoints) {
      try {
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (response.ok) {
          const payload = await response.json();
          const items: Array<Record<string, unknown>> = Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload?.results)
              ? payload.results
              : payload?.data
                ? [payload.data]
                : [];

          const watch = items[0];
          if (watch && (watch.brand || watch.model || watch.reference_number)) {
            const brand = (watch.brand as string) || curated?.brand || 'Luxury Watch';
            const model = (watch.model as string) || curated?.model || ref;
            const fullName = `${brand} ${model} (#${ref})`;
            const priceUsd =
              (typeof watch.price_usd === 'number'
                ? watch.price_usd
                : typeof watch.price === 'number'
                  ? watch.price
                  : typeof watch.average_price === 'number'
                    ? watch.average_price
                    : undefined) ?? curated?.priceUsd;

            const priceEur =
              priceUsd && priceUsd > 0
                ? Math.round(priceUsd * rate * 100) / 100
                : (curated ? Math.round(curated.priceUsd * rate * 100) / 100 : 0);

            const imageUrl =
              (watch.image_url as string) ||
              (watch.image as string) ||
              (Array.isArray(watch.images) ? (watch.images[0] as string) : undefined) ||
              curated?.imageUrl;

            return {
              referenceNumber: ref,
              brand,
              model,
              fullName,
              imageUrl,
              priceUsd,
              priceEur,
              fxRateUsed: rate,
              specs: {
                caseMaterial: (watch.case_material as string) || (watch.material as string) || curated?.specs.caseMaterial,
                caseDiameter: (watch.case_diameter as string) || (watch.diameter as string) || curated?.specs.caseDiameter,
                movement: (watch.movement as string) || curated?.specs.movement,
                caliber: (watch.caliber as string) || (watch.calibre as string) || curated?.specs.caliber,
                dialColor: (watch.dial_color as string) || (watch.dial as string) || curated?.specs.dialColor,
                bezelMaterial: (watch.bezel_material as string) || (watch.bezel as string) || curated?.specs.bezelMaterial,
                waterResistance: (watch.water_resistance as string) || curated?.specs.waterResistance,
              },
              source: 'thewatchapi',
              dateFetched: new Date().toISOString(),
            };
          }
        }
      } catch {
        // continue trying next endpoint
      }
    }
  }

  // 2. Fall back to curated reference database if match exists
  if (curated) {
    const priceEur = Math.round(curated.priceUsd * rate * 100) / 100;
    return {
      referenceNumber: ref,
      brand: curated.brand,
      model: curated.model,
      fullName: `${curated.brand} ${curated.model} (#${ref})`,
      imageUrl: curated.imageUrl,
      priceUsd: curated.priceUsd,
      priceEur,
      fxRateUsed: rate,
      specs: curated.specs,
      source: 'thewatchapi',
      dateFetched: new Date().toISOString(),
    };
  }

  return null;
};
