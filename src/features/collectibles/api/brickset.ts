import { supabase } from '@/db/supabase';

export interface BricksetPriceParams {
  itemNo: string;
  itemType?: 'SET' | 'MINIFIG';
  bricksetSetNumber?: string;
  currency?: string;
  apiKey?: string;
}

export interface BricksetPriceResult {
  itemNo: string;
  queriedItemNo?: string;
  name?: string;
  currency: string;
  retailPrice: number;
  year?: number;
  pieces?: number;
  theme?: string;
  dateFetched: string;
  source: 'brickset';
}

const LOCAL_STORAGE_KEY = 'strata_brickset_key';

export const getCachedBricksetKey = (): string | null => {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(LOCAL_STORAGE_KEY) || null;
};

export const setCachedBricksetKey = (key: string | null): void => {
  if (typeof localStorage === 'undefined') return;
  if (key) localStorage.setItem(LOCAL_STORAGE_KEY, key.trim());
  else localStorage.removeItem(LOCAL_STORAGE_KEY);
};

export const fetchBricksetPrice = async (
  params: BricksetPriceParams,
): Promise<BricksetPriceResult> => {
  const itemNo = params.itemNo.trim().replace(/-\d+$/, '');
  const queriedItemNo = params.bricksetSetNumber?.trim().replace(/-\d+$/, '') || itemNo;
  const currency = (params.currency || 'EUR').toUpperCase();
  const apiKey = params.apiKey || getCachedBricksetKey();

  const { data, error } = await supabase.functions.invoke('brickset-price', {
    body: {
      itemNo: queriedItemNo,
      itemType: params.itemType,
      currency,
      apiKey: apiKey || undefined,
    },
  });

  if (error || !data || data.error) {
    throw new Error(data?.error || error?.message || 'Brickset price lookup failed');
  }

  return {
    ...(data as BricksetPriceResult),
    itemNo,
    queriedItemNo: queriedItemNo !== itemNo ? queriedItemNo : undefined,
  };
};
