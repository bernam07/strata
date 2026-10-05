import {
  fetchBrickEconomyPrice,
  getCachedBrickeconomyKey,
  type BrickeconomyPriceResult,
} from './brickeconomy';
import {
  fetchBricklinkPrice,
  getCachedBricklinkCredentials,
  type BricklinkPriceResult,
} from './bricklink';
import { POPULAR_LEGO_SETS, normalizeSetNumber } from './lego';

export interface LegoValuationResult {
  itemNo: string;
  itemType: 'SET' | 'MINIFIG' | 'PART';
  name?: string;
  currency: string;
  resolvedEur: number;
  retailPrice?: number;
  growthPercent?: number;
  source: 'brickeconomy' | 'bricklink' | 'catalog' | 'manual';
  brickeconomy?: BrickeconomyPriceResult;
  bricklink?: BricklinkPriceResult;
}

export interface ResolveLegoPriceParams {
  itemNo: string;
  itemType?: 'SET' | 'MINIFIG';
  condition?: string; // 'Factory Sealed (MISB)', 'Used', etc.
  currency?: string;
}

export const resolveLegoPrice = async (
  params: ResolveLegoPriceParams,
): Promise<LegoValuationResult> => {
  const currency = (params.currency || 'EUR').toUpperCase();
  const isUsed = /used|opened|loose|incomplete/i.test(params.condition || '');
  const condCode: 'N' | 'U' = isUsed ? 'U' : 'N';

  // 1. Try BrickEconomy if API key is present
  const beKey = getCachedBrickeconomyKey();
  if (beKey) {
    try {
      const beRes = await fetchBrickEconomyPrice({
        itemNo: params.itemNo,
        itemType: params.itemType,
        condition: condCode,
        currency,
        apiKey: beKey,
      });

      if (beRes && beRes.marketValue > 0) {
        return {
          itemNo: beRes.itemNo,
          itemType: beRes.itemType,
          name: beRes.name,
          currency,
          resolvedEur: beRes.marketValue,
          retailPrice: beRes.retailPrice,
          growthPercent: beRes.growthPercent,
          source: 'brickeconomy',
          brickeconomy: beRes,
        };
      }
    } catch {
      // Continue to next provider
    }
  }

  // 2. Try BrickLink if 4 credentials are present
  const blCreds = getCachedBricklinkCredentials();
  if (blCreds) {
    try {
      const blRes = await fetchBricklinkPrice({
        itemNo: params.itemNo,
        itemType: params.itemType,
        condition: condCode,
        currency,
        guideType: 'sold',
        credentials: blCreds,
      });

      const p =
        blRes.avgPrice > 0
          ? blRes.avgPrice
          : blRes.qtyAvgPrice > 0
            ? blRes.qtyAvgPrice
            : blRes.minPrice;

      if (p > 0) {
        return {
          itemNo: blRes.itemNo,
          itemType: blRes.itemType,
          currency,
          resolvedEur: p,
          source: 'bricklink',
          bricklink: blRes,
        };
      }
    } catch {
      // Continue to next provider
    }
  }

  // 3. Fallback to Popular Catalog Database (for iconic sets with known RRP)
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
