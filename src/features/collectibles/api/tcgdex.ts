export interface PokemonCardSummary {
  id: string;
  localId: string;
  name: string;
  image?: string;
  imageUrl?: string;
}

export type PokemonCardFinish =
  | 'holofoil'
  | 'reverse-holofoil'
  | 'normal'
  | '1st-edition'
  | '1st-edition-holofoil';

export const FINISH_LABELS: Record<PokemonCardFinish, string> = {
  holofoil: 'Holo',
  'reverse-holofoil': 'Reverse Holo',
  normal: 'Normal',
  '1st-edition': '1st Edition',
  '1st-edition-holofoil': '1st Ed Holo',
};

export interface TcgplayerPriceEntry {
  productId?: number;
  lowPrice?: number;
  midPrice?: number;
  highPrice?: number;
  marketPrice?: number;
  directLowPrice?: number | null;
}

export interface PokemonCardDetail {
  id: string;
  localId: string;
  name: string;
  rarity?: string;
  image?: string;
  imageUrl?: string;
  set?: {
    id: string;
    name: string;
    logo?: string;
    symbol?: string;
  };
  pricing?: {
    cardmarket?: {
      updated?: string;
      unit?: string;
      idProduct?: number;
      avg?: number;
      low?: number;
      trend?: number;
      avg1?: number;
      avg7?: number;
      avg30?: number;
      'avg-holo'?: number | null;
      'low-holo'?: number | null;
      'trend-holo'?: number | null;
      'avg1-holo'?: number | null;
      'avg7-holo'?: number | null;
      'avg30-holo'?: number | null;
    };
    tcgplayer?: {
      unit?: string;
      updated?: string;
      normal?: TcgplayerPriceEntry;
      holofoil?: TcgplayerPriceEntry;
      'reverse-holofoil'?: TcgplayerPriceEntry;
      '1st-edition'?: TcgplayerPriceEntry;
      '1st-edition-holofoil'?: TcgplayerPriceEntry;
    };
  };
}

export interface FinishPriceOption {
  finish: PokemonCardFinish;
  label: string;
  priceUsd: number;
  priceEur: number;
}

export interface PokemonPriceBreakdown {
  resolvedEur: number;
  source: 'collectr' | 'cardmarket';
  selectedFinish: PokemonCardFinish;
  finishes: FinishPriceOption[];
  collectr?: {
    priceEur: number;
    priceUsd: number;
    finish: PokemonCardFinish;
  };
  cardmarket?: {
    priceEur: number;
    avgEur?: number;
    trendEur?: number;
    lowEur?: number;
  };
  fxRateUsed: number;
}

let cachedUsdToEurRate: number | null = null;
let lastFxFetch = 0;

export const getUsdToEurRate = async (): Promise<number> => {
  const now = Date.now();
  if (cachedUsdToEurRate !== null && now - lastFxFetch < 6 * 3600 * 1000) {
    return cachedUsdToEurRate;
  }

  try {
    const res = await fetch('https://api.frankfurter.dev/v1/latest?from=USD&to=EUR');
    if (res.ok) {
      const data = (await res.json()) as { rates?: { EUR?: number } };
      const rate = data?.rates?.EUR;
      if (typeof rate === 'number' && rate > 0) {
        cachedUsdToEurRate = rate;
        lastFxFetch = now;
        return rate;
      }
    }
  } catch {
    // fallback to sensible default
  }

  return cachedUsdToEurRate ?? 0.893;
};

export const getCachedUsdToEurRate = (): number => cachedUsdToEurRate ?? 0.893;

export const getCardImageUrl = (
  baseUrl?: string,
  quality: 'high' | 'low' = 'high',
): string | undefined => {
  if (!baseUrl) return undefined;
  if (
    baseUrl.endsWith('.webp') ||
    baseUrl.endsWith('.png') ||
    baseUrl.endsWith('.jpg')
  ) {
    return baseUrl;
  }
  return `${baseUrl.replace(/\/+$/, '')}/${quality}.webp`;
};

export const extractCardmarketPrice = (
  pricing?: PokemonCardDetail['pricing'],
): number | null => {
  if (!pricing?.cardmarket) return null;
  const cm = pricing.cardmarket;
  // Trend or 30-day average on Cardmarket
  const price = cm.trend ?? cm.avg ?? cm.avg30 ?? cm.low ?? null;
  return price !== null && Number.isFinite(price) && price > 0
    ? Number(price)
    : null;
};

export const extractTcgPlayerPrice = (
  pricing?: PokemonCardDetail['pricing'],
  targetFinish?: PokemonCardFinish,
  fxRate?: number,
): number | null => {
  if (!pricing?.tcgplayer) return null;
  const tp = pricing.tcgplayer;

  let chosenEntry: TcgplayerPriceEntry | undefined;
  if (targetFinish && tp[targetFinish]) {
    chosenEntry = tp[targetFinish];
  } else {
    chosenEntry =
      tp.normal ??
      tp.holofoil ??
      tp['reverse-holofoil'] ??
      tp['1st-edition-holofoil'] ??
      tp['1st-edition'];
  }

  const rawUsd = chosenEntry?.marketPrice ?? chosenEntry?.midPrice ?? null;
  if (rawUsd === null || !Number.isFinite(rawUsd) || rawUsd <= 0) {
    return null;
  }

  if (fxRate && fxRate > 0) {
    return Math.round(rawUsd * fxRate * 100) / 100;
  }
  return Number(rawUsd);
};

export const resolvePokemonPrice = (
  pricing?: PokemonCardDetail['pricing'],
  options?: {
    preferredFinish?: PokemonCardFinish;
    condition?: string;
    rarity?: string;
    fxRate?: number;
  },
): PokemonPriceBreakdown => {
  const fxRate = options?.fxRate ?? getCachedUsdToEurRate();
  const finishes: FinishPriceOption[] = [];
  const tp = pricing?.tcgplayer;

  if (tp) {
    const finishKeys: PokemonCardFinish[] = [
      'holofoil',
      'reverse-holofoil',
      'normal',
      '1st-edition-holofoil',
      '1st-edition',
    ];

    for (const key of finishKeys) {
      const entry = tp[key];
      if (entry) {
        const usd = entry.marketPrice ?? entry.midPrice ?? entry.lowPrice;
        if (typeof usd === 'number' && usd > 0) {
          finishes.push({
            finish: key,
            label: FINISH_LABELS[key],
            priceUsd: usd,
            priceEur: Math.round(usd * fxRate * 100) / 100,
          });
        }
      }
    }
  }

  // Determine best finish
  let selectedFinish: PokemonCardFinish = options?.preferredFinish || 'holofoil';

  if (!options?.preferredFinish) {
    const isReverse = /reverse/i.test(options?.condition || '');
    if (isReverse && finishes.some((f) => f.finish === 'reverse-holofoil')) {
      selectedFinish = 'reverse-holofoil';
    } else {
      const isUltraRareOrHolo =
        /rare holo|ultra|secret|illustration|special|vmax|vstar|ex|promo/i.test(
          options?.rarity || '',
        );
      if (
        isUltraRareOrHolo &&
        finishes.some((f) => f.finish === 'holofoil')
      ) {
        selectedFinish = 'holofoil';
      } else if (finishes.some((f) => f.finish === 'normal')) {
        selectedFinish = 'normal';
      } else if (finishes[0]) {
        selectedFinish = finishes[0].finish;
      }
    }
  }

  const selectedFinishOption =
    finishes.find((f) => f.finish === selectedFinish) || finishes[0];

  const cm = pricing?.cardmarket;
  const cmPrice =
    cm?.trend && cm.trend > 0
      ? cm.trend
      : cm?.avg && cm.avg > 0
        ? cm.avg
        : cm?.avg30 && cm.avg30 > 0
          ? cm.avg30
          : cm?.low && cm.low > 0
            ? cm.low
            : undefined;

  // Collectr standard = TCGplayer Market in EUR
  let collectrData: PokemonPriceBreakdown['collectr'];
  if (selectedFinishOption) {
    collectrData = {
      priceEur: selectedFinishOption.priceEur,
      priceUsd: selectedFinishOption.priceUsd,
      finish: selectedFinishOption.finish,
    };
  }

  let cardmarketData: PokemonPriceBreakdown['cardmarket'];
  if (cmPrice !== undefined) {
    cardmarketData = {
      priceEur: cmPrice,
      avgEur: cm?.avg,
      trendEur: cm?.trend,
      lowEur: cm?.low,
    };
  }

  // Prioritize Collectr / TCGplayer Market Price (matching the user's Collectr app)
  // Fall back to Cardmarket if TCGplayer is unavailable for this card
  let resolvedEur = 0;
  let source: 'collectr' | 'cardmarket' = 'collectr';

  if (collectrData && collectrData.priceEur > 0) {
    resolvedEur = collectrData.priceEur;
    source = 'collectr';
  } else if (cardmarketData && cardmarketData.priceEur > 0) {
    resolvedEur = cardmarketData.priceEur;
    source = 'cardmarket';
  }

  return {
    resolvedEur,
    source,
    selectedFinish: selectedFinishOption?.finish || selectedFinish,
    finishes,
    collectr: collectrData,
    cardmarket: cardmarketData,
    fxRateUsed: fxRate,
  };
};

export const extractCollectrPrice = async (
  pricing?: PokemonCardDetail['pricing'],
  options?: {
    preferredFinish?: PokemonCardFinish;
    condition?: string;
    rarity?: string;
    fxRate?: number;
  },
): Promise<number | null> => {
  const fx = options?.fxRate ?? (await getUsdToEurRate());
  const breakdown = resolvePokemonPrice(pricing, { ...options, fxRate: fx });
  return breakdown.resolvedEur > 0 ? breakdown.resolvedEur : null;
};

export const searchPokemonCards = async (
  query: string,
  lang = 'en',
): Promise<PokemonCardSummary[]> => {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const res = await fetch(
    `https://api.tcgdex.net/v2/${lang}/cards?name=${encodeURIComponent(trimmed)}`,
  );
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`TCGdex search failed with status ${res.status}`);
  }

  const data = (await res.json()) as Array<{
    id: string;
    localId: string;
    name: string;
    image?: string;
  }>;

  if (!Array.isArray(data)) return [];

  return data.slice(0, 24).map((card) => ({
    id: card.id,
    localId: card.localId,
    name: card.name,
    image: card.image,
    imageUrl: getCardImageUrl(card.image, 'low'),
  }));
};

export const getPokemonCard = async (
  id: string,
  lang = 'en',
): Promise<PokemonCardDetail | null> => {
  if (!id) return null;

  const res = await fetch(
    `https://api.tcgdex.net/v2/${lang}/cards/${encodeURIComponent(id)}`,
  );
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`TCGdex lookup failed with status ${res.status}`);
  }

  const card = (await res.json()) as PokemonCardDetail;
  return {
    ...card,
    imageUrl: getCardImageUrl(card.image, 'high'),
  };
};
