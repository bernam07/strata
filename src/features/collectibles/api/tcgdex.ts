export interface PokemonCardSummary {
  id: string;
  localId: string;
  name: string;
  image?: string;
  imageUrl?: string;
  language?: 'en' | 'ja';
}

export type PokemonCardLanguage = 'en' | 'ja' | 'all';

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
  language?: 'en' | 'ja';
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

// Fast in-memory search cache to eliminate repeat latency
const searchCache = new Map<string, PokemonCardSummary[]>();

type CatalogCard = {
  id: string;
  localId: string;
  name: string;
  image?: string;
};

const catalogCache = new Map<'en' | 'ja', Promise<CatalogCard[]>>();

const getCardCatalog = (lang: 'en' | 'ja'): Promise<CatalogCard[]> => {
  const cached = catalogCache.get(lang);
  if (cached) return cached;
  const request = fetch(`https://api.tcgdex.net/v2/${lang}/cards`)
    .then(async (res) => {
      if (!res.ok) return [];
      const data = (await res.json()) as CatalogCard[];
      return Array.isArray(data) ? data : [];
    })
    .catch(() => []);
  catalogCache.set(lang, request);
  return request;
};

const getJapanesePokemonName = async (query: string): Promise<string | null> => {
  const pokemonName = query
    .toLowerCase()
    .replace(/['’]s\b/g, '')
    .replace(/\b(ex|gx|vstar|v|break)\b/gi, '')
    .trim()
    .split(/\s+/)
    .pop();
  if (!pokemonName || /[^a-z-]/i.test(pokemonName)) return null;
  try {
    const res = await fetch(
      `https://pokeapi.co/api/v2/pokemon-species/${encodeURIComponent(pokemonName)}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      names?: Array<{ language?: { name?: string }; name?: string }>;
    };

    return (
      data.names?.find((entry) => entry.language?.name === 'ja')?.name ?? null
    );
  } catch {
    return null;
  }
};

const isJapaneseId = (id: string): boolean =>
  /^[A-Z][A-Z0-9.]*-/u.test(id);

const toSummary = (card: CatalogCard, language: 'en' | 'ja'): PokemonCardSummary => ({
  id: card.id,
  localId: card.localId,
  name: card.name,
  image: card.image,
  imageUrl: getCardImageUrl(card.image, 'low'),
  language,
});

const hydrateSummary = async (
  card: CatalogCard,
  language: 'en' | 'ja',
): Promise<PokemonCardSummary> => {
  if (card.image) return toSummary(card, language);

  try {
    const response = await fetch(
      `https://api.tcgdex.net/v2/${language}/cards/${encodeURIComponent(card.id)}`,
    );
    if (response.ok) {
      const detail = (await response.json()) as CatalogCard;
      return toSummary({ ...card, ...detail }, language);
    }
  } catch {
    // Keep the card visible even when its image request fails.
  }

  return toSummary(card, language);
};

export const searchPokemonCards = async (
  query: string,
  lang: PokemonCardLanguage = 'all',
): Promise<PokemonCardSummary[]> => {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const cacheKey = `${lang}:${trimmed.toLowerCase()}`;
  const cached = searchCache.get(cacheKey);
  if (cached) return cached;

  // Direct card ID check (e.g. SV2a-201 or sv03.5-199)
  if (/^[a-z0-9.]+-([a-z0-9]+)$/i.test(trimmed)) {
    try {
      const card = await getPokemonCard(
        trimmed,
        lang === 'en' ? 'en' : lang === 'ja' ? 'ja' : undefined,
      );
      if (card) {
        const directResult: PokemonCardSummary[] = [
          {
            id: card.id,
            localId: card.localId,
            name: card.name,
            image: card.image,
            imageUrl: card.imageUrl,
            language: card.language,
          },
        ];
        searchCache.set(cacheKey, directResult);
        return directResult;
      }
    } catch {
      // fallback to regular search
    }
  }

  const isJapaneseText = /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF]/.test(trimmed);
  const japaneseQuery = isJapaneseText ? trimmed : await getJapanesePokemonName(trimmed);

  const findCards = async (
    language: 'en' | 'ja',
    searchTerms: Array<string | null>,
  ): Promise<PokemonCardSummary[]> => {
    const catalog = await getCardCatalog(language);
    const terms = searchTerms
      .filter((term): term is string => Boolean(term))
      .map((term) => term.toLocaleLowerCase());
    const matches = catalog
      .filter((card) => {
        const searchable = `${card.name} ${card.id} ${card.localId}`.toLocaleLowerCase();
        return terms.some((term) => searchable.includes(term));
      })
      .map((card) => hydrateSummary(card, language));
    return Promise.all(matches);
  };

  const [enResults, jaResults] = await Promise.all([
    lang === 'ja' ? Promise.resolve([]) : findCards('en', [trimmed]),
    lang === 'en' ? Promise.resolve([]) : findCards('ja', [trimmed, japaneseQuery]),
  ]);

  // Combine and deduplicate
  const combined: PokemonCardSummary[] = [];
  const seen = new Set<string>();

  // If query is specifically in Japanese, prioritize Japanese results first
  const ordered =
    isJapaneseText || lang === 'ja'
      ? [...jaResults, ...enResults]
      : [...enResults, ...jaResults];

  for (const c of ordered) {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      combined.push(c);
    }
  }

  const results = lang === 'all' ? [...enResults, ...jaResults] : combined;
  searchCache.set(cacheKey, results);
  return results;
};

export const getPokemonCard = async (
  id: string,
  lang?: 'en' | 'ja',
): Promise<PokemonCardDetail | null> => {
  if (!id) return null;

  // Auto-detect Japanese ID patterns (e.g. SV2a-201, S12a-001, PMCG4-001, etc.)
  const isJapaneseCard = lang === 'ja' || isJapaneseId(id);

  const primaryLang = lang || (isJapaneseCard ? 'ja' : 'en');
  const fallbackLang = primaryLang === 'en' ? 'ja' : 'en';

  try {
    const res = await fetch(
      `https://api.tcgdex.net/v2/${primaryLang}/cards/${encodeURIComponent(id)}`,
    );
    if (res.ok) {
      const card = (await res.json()) as PokemonCardDetail;
      return {
        ...card,
        language: primaryLang,
        imageUrl: getCardImageUrl(card.image, 'high') || getCardImageUrl(card.image, 'low'),
      };
    }
  } catch {
    // try fallback
  }

  // Fallback to the alternative language if primary returned 404
  try {
    const fallbackRes = await fetch(
      `https://api.tcgdex.net/v2/${fallbackLang}/cards/${encodeURIComponent(id)}`,
    );
    if (fallbackRes.ok) {
      const card = (await fallbackRes.json()) as PokemonCardDetail;
      return {
        ...card,
        language: fallbackLang,
        imageUrl: getCardImageUrl(card.image, 'high') || getCardImageUrl(card.image, 'low'),
      };
    }
  } catch {
    // card not found in either
  }

  return null;
};
