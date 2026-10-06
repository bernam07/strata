import {
  cleanLegoInput,
  fetchBricksetPrice,
  getCachedBricksetKey,
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
  priceNew?: number;
  priceUsed?: number;
  rrp?: number;
  growthPercent?: number;
  source: 'brickset' | 'catalog' | 'manual';
  brickset?: BricksetPriceResult;
  bricksetSetNumber?: string;
  appearsIn?: string[];
  containedMinifig?: {
    code: string;
    count?: number;
  };
}

export interface ResolveLegoPriceParams {
  itemNo: string;
  itemType?: 'SET' | 'MINIFIG';
  bricksetSetNumber?: string;
  condition?: string; // 'Factory Sealed (MISB)', 'Used', etc.
  currency?: string;
}

const isUsedCondition = (cond?: string): boolean => {
  if (!cond) return false;
  const l = cond.toLowerCase();
  return (
    l.includes('used') ||
    l.includes('loose') ||
    l.includes('played') ||
    l.includes('fair') ||
    l.includes('good')
  );
};

export const resolveLegoPrice = async (
  params: ResolveLegoPriceParams,
): Promise<LegoValuationResult> => {
  const currency = (params.currency || 'EUR').toUpperCase();
  const normalized = cleanLegoInput(params.itemNo, params.itemType);
  const isMinifig = normalized.itemType === 'MINIFIG';
  const bricksetSetNumber = isMinifig
    ? params.bricksetSetNumber || getBricksetSetNumber(normalized.itemNo)
    : undefined;
  const bricksetKey = getCachedBricksetKey();

  // Try Brickset (works for both Sets and Minifigures)
  try {
    const bricksetRes = await fetchBricksetPrice({
      itemNo: normalized.itemNo,
      itemType: isMinifig ? 'MINIFIG' : 'SET',
      condition: params.condition,
      bricksetSetNumber,
      currency,
      apiKey: bricksetKey || undefined,
    });

    if (
      bricksetRes.retailPrice > 0 ||
      (bricksetRes.priceNew && bricksetRes.priceNew > 0) ||
      (bricksetRes.priceUsed && bricksetRes.priceUsed > 0)
    ) {
      const isUsed = isUsedCondition(params.condition);
      const chosenPrice = isUsed
        ? (bricksetRes.priceUsed ?? bricksetRes.priceNew ?? bricksetRes.rrp ?? bricksetRes.retailPrice)
        : (bricksetRes.priceNew ?? bricksetRes.rrp ?? bricksetRes.retailPrice);

      return {
        itemNo: bricksetRes.itemNo,
        itemType: isMinifig ? 'MINIFIG' : 'SET',
        name: bricksetRes.name,
        currency,
        resolvedEur: chosenPrice,
        retailPrice: chosenPrice,
        priceNew: bricksetRes.priceNew,
        priceUsed: bricksetRes.priceUsed,
        rrp: bricksetRes.rrp,
        source: 'brickset',
        brickset: bricksetRes,
        bricksetSetNumber: bricksetRes.queriedItemNo || bricksetSetNumber,
        appearsIn: bricksetRes.appearsIn,
        containedMinifig: bricksetRes.containedMinifig,
      };
    }
  } catch {
    // Continue to curated catalog fallback
  }

  // Fallback to internal curated database (both sets and minifigures)
  const norm = normalizeSetNumber(normalized.itemNo);
  const localItem = ALL_CURATED_LEGO_ITEMS.find(
    (s) =>
      s.setNumber.toLowerCase() === norm.toLowerCase() ||
      s.setNumber.toLowerCase() === normalized.itemNo.toLowerCase() ||
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
      rrp: localItem.rrpEur,
      source: 'catalog',
    };
  }

  return {
    itemNo: normalized.itemNo,
    itemType: isMinifig ? 'MINIFIG' : 'SET',
    currency,
    resolvedEur: 0,
    source: 'manual',
  };
};
