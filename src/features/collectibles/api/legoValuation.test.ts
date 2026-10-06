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
      itemNo: 'colspi01',
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

  it('selects Used market value when condition is used or loose', async () => {
    vi.spyOn(bricksetModule, 'getCachedBricksetKey').mockReturnValue('brickset-key');
    vi.spyOn(bricksetModule, 'fetchBricksetPrice').mockResolvedValue({
      itemNo: '682303-1',
      name: 'Miles Morales Foil Pack',
      currency: 'EUR',
      retailPrice: 5.0,
      priceNew: 5.0,
      priceUsed: 4.0,
      dateFetched: new Date().toISOString(),
      source: 'brickset',
      itemType: 'SET',
    });

    const result = await resolveLegoPrice({
      itemNo: '682303-1',
      condition: 'Loose / Parts',
    });

    expect(result.resolvedEur).toBe(4.0);
    expect(result.priceNew).toBe(5.0);
    expect(result.priceUsed).toBe(4.0);
  });

  it('selects New market value when condition is factory sealed', async () => {
    vi.spyOn(bricksetModule, 'getCachedBricksetKey').mockReturnValue('brickset-key');
    vi.spyOn(bricksetModule, 'fetchBricksetPrice').mockResolvedValue({
      itemNo: '682303-1',
      name: 'Miles Morales Foil Pack',
      currency: 'EUR',
      retailPrice: 5.0,
      priceNew: 5.0,
      priceUsed: 4.0,
      dateFetched: new Date().toISOString(),
      source: 'brickset',
      itemType: 'SET',
    });

    const result = await resolveLegoPrice({
      itemNo: '682303-1',
      condition: 'Factory Sealed (MISB)',
    });

    expect(result.resolvedEur).toBe(5.0);
  });
});

describe('cleanLegoInput', () => {
  it('extracts set number from Brickset set URLs', () => {
    const cleaned = bricksetModule.cleanLegoInput(
      'https://brickset.com/sets/682303-1/Miles-Morales',
    );
    expect(cleaned.itemNo).toBe('682303-1');
    expect(cleaned.itemType).toBe('SET');
  });

  it('extracts minifigure code from Brickset minifig URLs', () => {
    const cleaned = bricksetModule.cleanLegoInput(
      'https://brickset.com/minifigs/sh0679/spider-man-(miles-morales)-dark-red-hood-black-lower-legs',
    );
    expect(cleaned.itemNo).toBe('sh0679');
    expect(cleaned.itemType).toBe('MINIFIG');
  });

  it('extracts minifigure code from BrickLink URLs', () => {
    const cleaned = bricksetModule.cleanLegoInput(
      'https://www.bricklink.com/v2/catalog/catalogitem.page?M=sh0679#T=P',
    );
    expect(cleaned.itemNo).toBe('sh0679');
    expect(cleaned.itemType).toBe('MINIFIG');
  });

  it('extracts set number from BrickLink URLs', () => {
    const cleaned = bricksetModule.cleanLegoInput(
      'https://www.bricklink.com/v2/catalog/catalogitem.page?S=682303-1#T=P',
    );
    expect(cleaned.itemNo).toBe('682303-1');
    expect(cleaned.itemType).toBe('SET');
  });

  it('extracts set number from in-set minifig URLs', () => {
    const cleaned = bricksetModule.cleanLegoInput(
      'https://brickset.com/minifigs/in-682303-1',
    );
    expect(cleaned.itemNo).toBe('682303-1');
    expect(cleaned.itemType).toBe('SET');
  });

  it('cleans minifig codes with -1 or #', () => {
    expect(bricksetModule.cleanLegoInput('sh0679-1').itemNo).toBe('sh0679');
    expect(bricksetModule.cleanLegoInput('#sh0679').itemNo).toBe('sh0679');
    expect(bricksetModule.cleanLegoInput('sw0107').itemType).toBe('MINIFIG');
    expect(bricksetModule.cleanLegoInput('fig-000001').itemNo).toBe('fig-000001');
  });

  it('appends -1 variant to bare set numbers', () => {
    expect(bricksetModule.cleanLegoInput('682303').itemNo).toBe('682303-1');
    expect(bricksetModule.cleanLegoInput('#75192').itemNo).toBe('75192-1');
    expect(bricksetModule.cleanLegoInput('75192-1').itemNo).toBe('75192-1');
  });
});

