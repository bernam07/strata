import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveLegoPrice } from './legoValuation';
import * as bricksetModule from './brickset';

describe('resolveLegoPrice', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('resolves a set from Brickset official retail price', async () => {
    vi.spyOn(bricksetModule, 'getCachedBricksetKey').mockReturnValue('brickset-key');
    vi.spyOn(bricksetModule, 'fetchBricksetPrice').mockResolvedValue({
      itemNo: '75192',
      name: 'Millennium Falcon',
      currency: 'EUR',
      retailPrice: 849.99,
      dateFetched: new Date().toISOString(),
      source: 'brickset',
      itemType: 'SET',
    });

    const result = await resolveLegoPrice({ itemNo: '75192' });

    expect(result.source).toBe('brickset');
    expect(result.resolvedEur).toBe(849.99);
    expect(result.itemType).toBe('SET');
  });

  it('resolves a minifigure directly from Brickset market valuation', async () => {
    vi.spyOn(bricksetModule, 'getCachedBricksetKey').mockReturnValue('brickset-key');
    const fetchPrice = vi.spyOn(bricksetModule, 'fetchBricksetPrice').mockResolvedValue({
      itemNo: 'sw0107',
      name: 'Boba Fett (Cloud City)',
      currency: 'EUR',
      retailPrice: 1716.3,
      priceNew: 1716.3,
      priceUsed: 1229.19,
      dateFetched: new Date().toISOString(),
      source: 'brickset',
      itemType: 'MINIFIG',
    });

    const result = await resolveLegoPrice({ itemNo: 'sw0107', itemType: 'MINIFIG' });

    expect(fetchPrice).toHaveBeenCalledWith({
      itemNo: 'sw0107',
      itemType: 'MINIFIG',
      condition: undefined,
      bricksetSetNumber: undefined,
      currency: 'EUR',
      apiKey: 'brickset-key',
    });
    expect(result.source).toBe('brickset');
    expect(result.resolvedEur).toBe(1716.3);
    expect(result.itemType).toBe('MINIFIG');
  });

  it('uses the containing Brickset set for a minifigure when configured', async () => {
    vi.spyOn(bricksetModule, 'getCachedBricksetKey').mockReturnValue('brickset-key');
    const fetchPrice = vi.spyOn(bricksetModule, 'fetchBricksetPrice').mockResolvedValue({
      itemNo: 'COLSPI01',
      queriedItemNo: '71050',
      name: 'Collectible Minifigure',
      currency: 'EUR',
      retailPrice: 3.99,
      dateFetched: new Date().toISOString(),
      source: 'brickset',
      itemType: 'MINIFIG',
    });

    const result = await resolveLegoPrice({ itemNo: 'COLSPI01', itemType: 'MINIFIG' });

    expect(fetchPrice).toHaveBeenCalledWith({
      itemNo: 'COLSPI01',
      itemType: 'MINIFIG',
      condition: undefined,
      bricksetSetNumber: '71050',
      currency: 'EUR',
      apiKey: 'brickset-key',
    });
    expect(result.itemNo).toBe('COLSPI01');
    expect(result.itemType).toBe('MINIFIG');
    expect(result.resolvedEur).toBe(3.99);
    expect(result.bricksetSetNumber).toBe('71050');
  });

  it('falls back to the local catalog without a Brickset key', async () => {
    vi.spyOn(bricksetModule, 'getCachedBricksetKey').mockReturnValue(null);
    vi.spyOn(bricksetModule, 'fetchBricksetPrice').mockRejectedValue(new Error('no key'));

    const result = await resolveLegoPrice({ itemNo: '75192' });

    expect(result.source).toBe('catalog');
    expect(result.resolvedEur).toBe(849.99);
  });

  it('falls back to curated minifigures when Brickset lookup fails', async () => {
    vi.spyOn(bricksetModule, 'getCachedBricksetKey').mockReturnValue(null);
    vi.spyOn(bricksetModule, 'fetchBricksetPrice').mockRejectedValue(new Error('failed'));

    const result = await resolveLegoPrice({ itemNo: 'sw0107', itemType: 'MINIFIG' });

    expect(result.source).toBe('catalog');
    expect(result.resolvedEur).toBe(1800.0);
    expect(result.itemType).toBe('MINIFIG');
  });
});
