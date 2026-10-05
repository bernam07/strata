export interface PokemonCardSummary {
  id: string;
  localId: string;
  name: string;
  image?: string;
  imageUrl?: string;
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
      unit?: string;
      avg?: number;
      low?: number;
      trend?: number;
      avg30?: number;
      'avg-holo'?: number;
      'trend-holo'?: number;
    };
    tcgplayer?: {
      unit?: string;
      normal?: { marketPrice?: number; midPrice?: number; lowPrice?: number };
      holofoil?: { marketPrice?: number; midPrice?: number; lowPrice?: number };
      'reverse-holofoil'?: { marketPrice?: number; midPrice?: number; lowPrice?: number };
    };
  };
}

export const getCardImageUrl = (
  baseUrl?: string,
  quality: 'high' | 'low' = 'high',
): string | undefined => {
  if (!baseUrl) return undefined;
  if (baseUrl.endsWith('.webp') || baseUrl.endsWith('.png') || baseUrl.endsWith('.jpg')) {
    return baseUrl;
  }
  return `${baseUrl.replace(/\/+$/, '')}/${quality}.webp`;
};

export const extractCardmarketPrice = (
  pricing?: PokemonCardDetail['pricing'],
): number | null => {
  if (!pricing?.cardmarket) return null;
  const cm = pricing.cardmarket;
  // Trend is usually the most accurate current market average on Cardmarket
  const price = cm.trend ?? cm.avg ?? cm.avg30 ?? cm.low ?? null;
  return price !== null && Number.isFinite(price) && price > 0 ? Number(price) : null;
};

export const extractTcgPlayerPrice = (
  pricing?: PokemonCardDetail['pricing'],
): number | null => {
  if (!pricing?.tcgplayer) return null;
  const tp = pricing.tcgplayer;
  const normal = tp.normal?.marketPrice ?? tp.normal?.midPrice;
  const holo = tp.holofoil?.marketPrice ?? tp.holofoil?.midPrice;
  const revHolo = tp['reverse-holofoil']?.marketPrice ?? tp['reverse-holofoil']?.midPrice;
  const price = normal ?? holo ?? revHolo ?? null;
  return price !== null && Number.isFinite(price) && price > 0 ? Number(price) : null;
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

  const res = await fetch(`https://api.tcgdex.net/v2/${lang}/cards/${encodeURIComponent(id)}`);
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
