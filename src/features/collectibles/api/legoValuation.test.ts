import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveLegoPrice } from './legoValuation';
import * as brickeconomyModule from './brickeconomy';
import * as bricklinkModule from './bricklink';

describe('resolveLegoPrice', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('resolves price from BrickEconomy when key is present', async () => {
    vi.spyOn(brickeconomyModule, 'getCachedBrickeconomyKey').mockReturnValue('be-test-key');
    vi.spyOn(brickeconomyModule, 'fetchBrickEconomyPrice').mockResolvedValue({
      itemNo: '75192-1',
      itemType: 'SET',
      name: 'Millennium Falcon',
      currency: 'EUR',
      condition: 'N',
      marketValue: 980.0,
      retailPrice: 849.99,
      growthPercent: 15.3,
      dateFetched: new Date().toISOString(),
      source: 'brickeconomy',
    });

    const res = await resolveLegoPrice({ itemNo: '75192', condition: 'Factory Sealed' });

    expect(res.source).toBe('brickeconomy');
    expect(res.resolvedEur).toBe(980.0);
    expect(res.retailPrice).toBe(849.99);
    expect(res.growthPercent).toBe(15.3);
  });

  it('falls back to BrickLink when BrickEconomy key is not set', async () => {
    vi.spyOn(brickeconomyModule, 'getCachedBrickeconomyKey').mockReturnValue(null);
    vi.spyOn(bricklinkModule, 'getCachedBricklinkCredentials').mockReturnValue({
      consumerKey: 'k',
      consumerSecret: 's',
      tokenValue: 'tv',
      tokenSecret: 'ts',
    });
    vi.spyOn(bricklinkModule, 'fetchBricklinkPrice').mockResolvedValue({
      itemNo: '75192-1',
      itemType: 'SET',
      currency: 'EUR',
      guideType: 'sold',
      condition: 'N',
      avgPrice: 890.0,
      qtyAvgPrice: 880.0,
      minPrice: 800.0,
      maxPrice: 1000.0,
      unitQuantity: 10,
      totalQuantity: 20,
      dateFetched: new Date().toISOString(),
    });

    const res = await resolveLegoPrice({ itemNo: '75192' });

    expect(res.source).toBe('bricklink');
    expect(res.resolvedEur).toBe(890.0);
  });

  it('falls back to local curated database when no API keys are present', async () => {
    vi.spyOn(brickeconomyModule, 'getCachedBrickeconomyKey').mockReturnValue(null);
    vi.spyOn(bricklinkModule, 'getCachedBricklinkCredentials').mockReturnValue(null);

    const res = await resolveLegoPrice({ itemNo: '75192' });

    expect(res.source).toBe('catalog');
    expect(res.resolvedEur).toBe(849.99);
  });

  it('returns source manual and resolvedEur 0 when set is unknown and no keys set', async () => {
    vi.spyOn(brickeconomyModule, 'getCachedBrickeconomyKey').mockReturnValue(null);
    vi.spyOn(bricklinkModule, 'getCachedBricklinkCredentials').mockReturnValue(null);

    const res = await resolveLegoPrice({ itemNo: 'unknown-set-999999' });

    expect(res.source).toBe('manual');
    expect(res.resolvedEur).toBe(0);
  });
});
