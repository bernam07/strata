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
    });

    const result = await resolveLegoPrice({ itemNo: '75192' });

    expect(result.source).toBe('brickset');
    expect(result.resolvedEur).toBe(849.99);
  });

  it('does not request a Brickset price for minifigures', async () => {
    vi.spyOn(bricksetModule, 'getCachedBricksetKey').mockReturnValue('brickset-key');
    const fetchPrice = vi.spyOn(bricksetModule, 'fetchBricksetPrice');

    const result = await resolveLegoPrice({ itemNo: 'sw0107', itemType: 'MINIFIG' });

    expect(fetchPrice).not.toHaveBeenCalled();
    expect(result.source).toBe('manual');
  });

  it('uses the containing Brickset set for a minifigure', async () => {
    vi.spyOn(bricksetModule, 'getCachedBricksetKey').mockReturnValue('brickset-key');
    const fetchPrice = vi.spyOn(bricksetModule, 'fetchBricksetPrice').mockResolvedValue({
      itemNo: 'COLSPI01',
      queriedItemNo: '71050',
      name: 'Collectible Minifigure',
      currency: 'EUR',
      retailPrice: 3.99,
      dateFetched: new Date().toISOString(),
      source: 'brickset',
    });

    const result = await resolveLegoPrice({ itemNo: 'COLSPI01', itemType: 'MINIFIG' });

    expect(fetchPrice).toHaveBeenCalledWith({
      itemNo: 'COLSPI01',
      itemType: 'MINIFIG',
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

    const result = await resolveLegoPrice({ itemNo: '75192' });

    expect(result.source).toBe('catalog');
    expect(result.resolvedEur).toBe(849.99);
  });
});
