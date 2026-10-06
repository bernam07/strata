import { fetchBricksetPrice, getCachedBricksetKey, type BricksetPriceResult } from './brickset';
import { getBricksetSetNumber, POPULAR_LEGO_SETS, normalizeSetNumber } from './lego';

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

  // Brickset stores minifigures as sets, so query their containing set while
  // keeping the minifigure code as the asset identifier.
  const bricksetKey = getCachedBricksetKey();
  const isMinifig = params.itemType === 'MINIFIG';
  const bricksetSetNumber = isMinifig
    ? params.bricksetSetNumber || getBricksetSetNumber(params.itemNo)
    : undefined;
  if (bricksetKey && (!isMinifig || bricksetSetNumber)) {
    try {
      const bricksetRes = await fetchBricksetPrice({
        itemNo: params.itemNo,
        itemType: params.itemType,
        bricksetSetNumber,
        currency,
        apiKey: bricksetKey,
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
          bricksetSetNumber,
        };
      }
    } catch {
      // Continue to the local catalog fallback.
    }
  }

  // Fallback to the local catalog when Brickset has no key or no EUR price.
  const norm = normalizeSetNumber(params.itemNo);
  const localSet = POPULAR_LEGO_SETS.find(
    (s) => s.setNumber === norm || s.setNumber === params.itemNo,
  );

  if (localSet && localSet.rrpEur && localSet.rrpEur > 0) {
    return {
      itemNo: localSet.setNumber,
      itemType: localSet.type === 'minifig' ? 'MINIFIG' : 'SET',
      name: localSet.name,
      currency: 'EUR',
      resolvedEur: localSet.rrpEur,
      retailPrice: localSet.rrpEur,
      source: 'catalog',
    };
  }

  return {
    itemNo: params.itemNo,
    itemType: params.itemType || 'SET',
    currency,
    resolvedEur: 0,
    source: 'manual',
  };
};
