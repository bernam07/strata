import {
  fetchBricksetPrice,
  getCachedBricksetKey,
  isMinifigCode,
  type BricksetPriceResult,
} from './brickset';
import {
  getBricksetSetNumber,
  ALL_CURATED_LEGO_ITEMS,
  normalizeSetNumber,
} from './lego';

export interface LegoValuationResult {
  itemNo: string;
  itemType: 'SET' | 'MINIFIG' | 'PART';
  name?: string;
  currency: string;
  resolvedEur: number;
  retailPrice?: number;
  growthPercent?: number;
  source: 'brickset' | 'catalog' | 'manual';
  brickset?: BricksetPriceResult;
  bricksetSetNumber?: string;
}

export interface ResolveLegoPriceParams {
  itemNo: string;
  itemType?: 'SET' | 'MINIFIG';
  bricksetSetNumber?: string;
  condition?: string; // 'Factory Sealed (MISB)', 'Used', etc.
  currency?: string;
}

export const resolveLegoPrice = async (
  params: ResolveLegoPriceParams,
): Promise<LegoValuationResult> => {
  const currency = (params.currency || 'EUR').toUpperCase();
  const isMinifig =
    params.itemType === 'MINIFIG' || isMinifigCode(params.itemNo, params.itemType);
  const bricksetSetNumber = isMinifig
    ? params.bricksetSetNumber || getBricksetSetNumber(params.itemNo)
    : undefined;
  const bricksetKey = getCachedBricksetKey();

  // Try Brickset (works for both Sets and Minifigures)
  try {
    const bricksetRes = await fetchBricksetPrice({
      itemNo: params.itemNo,
      itemType: isMinifig ? 'MINIFIG' : 'SET',
      condition: params.condition,
      bricksetSetNumber,
      currency,
      apiKey: bricksetKey || undefined,
    });

    if (bricksetRes.retailPrice > 0) {
      return {
        itemNo: bricksetRes.itemNo,
        itemType: isMinifig ? 'MINIFIG' : 'SET',
        name: bricksetRes.name,
        currency,
        resolvedEur: bricksetRes.retailPrice,
        retailPrice: bricksetRes.retailPrice,
        source: 'brickset',
        brickset: bricksetRes,
        bricksetSetNumber: bricksetRes.queriedItemNo || bricksetSetNumber,
      };
    }
  } catch {
    // Continue to curated catalog fallback
  }

  // Fallback to internal curated database (both sets and minifigures)
  const norm = normalizeSetNumber(params.itemNo);
  const localItem = ALL_CURATED_LEGO_ITEMS.find(
    (s) =>
      s.setNumber.toLowerCase() === norm.toLowerCase() ||
      s.setNumber.toLowerCase() === params.itemNo.toLowerCase(),
  );

  if (localItem && localItem.rrpEur && localItem.rrpEur > 0) {
    return {
      itemNo: localItem.setNumber,
      itemType: localItem.type === 'minifig' ? 'MINIFIG' : 'SET',
      name: localItem.name,
      currency: 'EUR',
      resolvedEur: localItem.rrpEur,
      retailPrice: localItem.rrpEur,
      source: 'catalog',
    };
  }

  return {
    itemNo: params.itemNo,
    itemType: isMinifig ? 'MINIFIG' : params.itemType || 'SET',
    currency,
    resolvedEur: 0,
    source: 'manual',
  };
};
