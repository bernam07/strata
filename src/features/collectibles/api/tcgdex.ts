import {
  clearCollectiblesDb,
  getCachedFromDb,
  setCachedInDb,
} from './collectiblesDb';

export interface PokemonCardSummary {
  id: string;
  localId: string;
  name: string;
  image?: string;
  imageUrl?: string;
  language?: 'en' | 'ja';
  setId?: string;
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

type CatalogSet = {
  id: string;
  name: string;
};

const catalogCache = new Map<'en' | 'ja', Promise<CatalogCard[]>>();
const setCatalogCache = new Map<'en' | 'ja', Promise<CatalogSet[]>>();

export const getCardCatalog = async (lang: 'en' | 'ja'): Promise<CatalogCard[]> => {
  const cached = catalogCache.get(lang);
  if (cached) return cached;

  const promise = (async () => {
    const dbCached = await getCachedFromDb<CatalogCard>('pokemon_cards', lang);
    if (dbCached && dbCached.length > 0) {
      return dbCached;
    }

    try {
      const res = await fetch(`https://api.tcgdex.net/v2/${lang}/cards`);
      if (res.ok) {
        const data = (await res.json()) as CatalogCard[];
        if (Array.isArray(data) && data.length > 0) {
          void setCachedInDb('pokemon_cards', lang, data);
          return data;
        }
      }
    } catch {
      // ignore
    }

    return [];
  })();

  catalogCache.set(lang, promise);
  return promise;
};

export const getSetCatalog = async (lang: 'en' | 'ja'): Promise<CatalogSet[]> => {
  const cached = setCatalogCache.get(lang);
  if (cached) return cached;

  const promise = (async () => {
    const dbCached = await getCachedFromDb<CatalogSet>('pokemon_sets', lang);
    if (dbCached && dbCached.length > 0) {
      return dbCached;
    }

    try {
      const res = await fetch(`https://api.tcgdex.net/v2/${lang}/sets`);
      if (res.ok) {
        const data = (await res.json()) as CatalogSet[];
        if (Array.isArray(data) && data.length > 0) {
          void setCachedInDb('pokemon_sets', lang, data);
          return data;
        }
      }
    } catch {
      // ignore
    }

    return [];
  })();

  setCatalogCache.set(lang, promise);
  return promise;
};

export const clearTcgdexCacheForTesting = (): void => {
  searchCache.clear();
  catalogCache.clear();
  setCatalogCache.clear();
  void clearCollectiblesDb();
};

const SET_ALIASES: Record<string, string[]> = {
  'sv03.5': ['151', 'scarlet & violet 151', 'pokemon 151'],
  sv2a: ['151', 'pokemon card 151', 'ポケモンカード151'],
  'sv08.5': ['prismatic evolutions'],
  sv8a: ['terastal festival', 'テラスタルフェスex'],
  sv08: ['surging sparks'],
  sv8: ['supercharged breaker', '超電ブレイカー'],
  'sv06.5': ['shrouded fable'],
  sv6a: ['night wanderer', 'ナイトワンダラー'],
  sv06: ['twilight masquerade'],
  sv6: ['mask of change', '変幻の仮面'],
  'sv04.5': ['paldean fates'],
  sv4a: ['shiny treasure ex', 'シャイニートレジャーex'],
  sv02: ['paldea evolved'],
  sv2d: ['clay burst', 'クレイバースト'],
  sv2p: ['snow hazard', 'スノーハザード'],
  swsh12pt5: ['crown zenith'],
  s12a: ['vstar universe', 'vstarユニバース'],
  swsh07: ['evolving skies'],
  s6a: ['eevee heroes', 'イーブイヒーローズ'],
  sm12a: ['tag all stars', 'タッグオールスターズ'],
};

const POPULAR_POKEMON_JA: Record<string, string> = {
  charizard: 'リザードン',
  pikachu: 'ピカチュウ',
  mew: 'ミュウ',
  mewtwo: 'ミュウツー',
  gengar: 'ゲンガー',
  blastoise: 'カメックス',
  venusaur: 'フシギバナ',
  eevee: 'イーブイ',
  umbreon: 'ブラッキー',
  rayquaza: 'レックウザ',
  lugia: 'ルギア',
  giratina: 'ギラティナ',
  arceus: 'アルセウス',
  garchomp: 'ガブリアス',
  lucario: 'ルカリオ',
  gardevoir: 'サーナイト',
  dragonite: 'カイリュー',
  tyranitar: 'バンギラス',
  snorlax: 'カビゴン',
  squirtle: 'ゼニガメ',
  bulbasaur: 'フシギダネ',
  charmander: 'ヒトカゲ',
  gyarados: 'ギャラドス',
  alakazam: 'フーディン',
  zapdos: 'サンダー',
  articuno: 'フリーザー',
  moltres: 'ファイヤー',
  dialga: 'ディアルガ',
  palkia: 'パルキア',
  mimikyu: 'ミミッキュ',
  greninja: 'ゲッコウガ',
  zoroark: 'ゾロアーク',
  sylveon: 'ニンフィア',
  espeon: 'エーフィ',
  leafeon: 'リーフィア',
  glaceon: 'グレイシア',
  vaporeon: 'シャワーズ',
  jolteon: 'サンダース',
  flareon: 'ブースター',
  magikarp: 'コイキング',
  raichu: 'ライチュウ',
  slowpoke: 'ヤドン',
  psyduck: 'コダック',
  scizor: 'ハッサム',
  lapras: 'ラプラス',
  ditto: 'メタモン',
  machamp: 'カイリキー',
  suicune: 'スイクン',
  entei: 'エンテイ',
  raikou: 'ライコウ',
  celebi: 'セレビィ',
  hooh: 'ホウオウ',
  darkrai: 'ダークライ',
  deoxys: 'デオキシス',
  jirachi: 'ジラーチ',
  latios: 'ラティオス',
  latias: 'ラティアス',
  kyogre: 'カイオーガ',
  groudon: 'グラードン',
  torterra: 'ドダイトス',
  infernape: 'ゴウカザル',
  empoleon: 'エンペルト',
};

const getJapanesePokemonName = async (query: string): Promise<string | null> => {
  const normalized = query
    .toLowerCase()
    .replace(/['’]s\b/g, '')
    .replace(/\b(ex|gx|vstar|v|break)\b/gi, '')
    .trim()
    .split(/\s+/)[0];
  if (!normalized) return null;
  if (POPULAR_POKEMON_JA[normalized]) return POPULAR_POKEMON_JA[normalized];

  const lastWord = query.toLowerCase().trim().split(/\s+/).pop();
  if (lastWord && POPULAR_POKEMON_JA[lastWord]) return POPULAR_POKEMON_JA[lastWord];

  if (/[^a-z-]/i.test(normalized)) return null;
  try {
    const res = await fetch(
      `https://pokeapi.co/api/v2/pokemon-species/${encodeURIComponent(normalized)}`,
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

export const isJapaneseId = (id: string): boolean => {
  if (!id) return false;
  // Japanese set codes in TCGdex start with capital letter: SV2a, S12a, PMCG1, CP6, etc.
  if (/^[A-Z][a-zA-Z0-9.]*-/u.test(id)) return true;
  // Also handle case-insensitively for user inputs like sv2a-201, s12a-001, sm12a-001, etc.
  if (/^(sv\d+[a-z]|s\d+[a-z]|sm\d+[a-z]|cp\d|pmcg|pcg|adv)-/i.test(id)) return true;
  return false;
};

export const isJapanesePokemonItem = (item: {
  identifier?: string | null;
  metadata?: Record<string, unknown> | null;
  name?: string;
}): boolean => {
  if (item.metadata?.language === 'ja') return true;
  if (item.metadata?.language === 'en') return false;
  if (item.identifier && isJapaneseId(item.identifier)) return true;
  if (
    item.name &&
    (/\[ja\]/i.test(item.name) ||
      /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF]/.test(item.name))
  ) {
    return true;
  }
  return false;
};

const toSummary = (
  card: CatalogCard,
  language: 'en' | 'ja',
): PokemonCardSummary => {
  const setId = card.id.includes('-')
    ? card.id.slice(0, card.id.lastIndexOf('-'))
    : undefined;
  let imageUrl = getCardImageUrl(card.image, 'low');
  if (!imageUrl && language === 'en' && setId) {
    imageUrl = `https://images.pokemontcg.io/${setId.replace('.', '')}/${card.localId}.png`;
  }
  return {
    id: card.id,
    localId: card.localId,
    name: card.name,
    image: card.image,
    imageUrl,
    language,
    setId,
  };
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
            setId: card.set?.id || card.id.split('-')[0],
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

  const queryLower = trimmed.toLowerCase();
  const rawTokens = queryLower.split(/\s+/).filter(Boolean);

  const scoreCard = (card: CatalogCard): number => {
    let score = 0;
    // 1. CARDS WITH IMAGES COME FIRST
    if (card.image) score += 2000;

    // 2. Exact or prefix name match
    const nameLower = card.name.toLowerCase();
    if (nameLower === queryLower || (japaneseQuery && card.name === japaneseQuery)) {
      score += 500;
    } else if (nameLower.startsWith(queryLower) || (japaneseQuery && card.name.startsWith(japaneseQuery))) {
      score += 300;
    }

    // 3. Generation recency: Scarlet & Violet (SV) > Sword & Shield (S) > Sun & Moon (SM)
    const idUpper = card.id.toUpperCase();
    if (idUpper.startsWith('SV')) score += 300;
    else if (idUpper.startsWith('S') || idUpper.startsWith('SWSH')) score += 200;
    else if (idUpper.startsWith('SM')) score += 100;
    else if (idUpper.startsWith('XY')) score += 50;

    // 4. Secret Rare / High-number cards
    const num = parseInt(card.localId, 10);
    if (!Number.isNaN(num) && num > 150) score += 50;

    return score;
  };

  const findCards = async (
    language: 'en' | 'ja',
  ): Promise<PokemonCardSummary[]> => {
    const [catalog, sets] = await Promise.all([
      getCardCatalog(language),
      getSetCatalog(language),
    ]);
    const setMap = new Map<string, string>();
    for (const s of sets) {
      setMap.set(s.id, s.name);
      setMap.set(s.id.toLowerCase(), s.name);
    }

    const filtered = catalog.filter((card) => {
      const setId = card.id.includes('-')
        ? card.id.slice(0, card.id.lastIndexOf('-'))
        : '';
      const setIdLower = setId.toLowerCase();
      const setName = setMap.get(setIdLower) || setMap.get(setId) || '';
      const aliases = (SET_ALIASES[setIdLower] || SET_ALIASES[setId] || []).join(' ');
      const searchable = `${card.name} ${card.id} ${card.localId} ${setId} ${setName} ${aliases}`.toLowerCase();

      if (language === 'ja') {
        if (japaneseQuery && searchable.includes(japaneseQuery.toLowerCase())) return true;
        if (searchable.includes(queryLower)) return true;

        return rawTokens.every((token) => {
          const jaWord = POPULAR_POKEMON_JA[token];
          if (jaWord && searchable.includes(jaWord)) return true;
          if (japaneseQuery && searchable.includes(japaneseQuery.toLowerCase())) return true;
          return searchable.includes(token);
        });
      }

      if (searchable.includes(queryLower)) return true;
      return rawTokens.every((token) => searchable.includes(token));
    });

    const sorted = [...filtered].sort((a, b) => {
      const scoreDiff = scoreCard(b) - scoreCard(a);
      if (scoreDiff !== 0) return scoreDiff;
      const aNum = parseInt(a.localId, 10);
      const bNum = parseInt(b.localId, 10);
      if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
      return a.localId.localeCompare(b.localId);
    });

    return sorted.slice(0, 120).map((c) => toSummary(c, language));
  };

  const [enResults, jaResults] = await Promise.all([
    lang === 'ja' ? Promise.resolve([]) : findCards('en'),
    lang === 'en' ? Promise.resolve([]) : findCards('ja'),
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

  const results = lang === 'all' ? combined : lang === 'ja' ? jaResults : enResults;
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
