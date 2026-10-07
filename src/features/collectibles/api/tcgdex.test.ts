import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  extractCardmarketPrice,
  extractCollectrPrice,
  extractTcgPlayerPrice,
  getCardImageUrl,
  getPokemonCard,
  resolvePokemonPrice,
  searchPokemonCards,
  type PokemonCardDetail,
} from './tcgdex';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('tcgdex utilities', () => {
  describe('getCardImageUrl', () => {
    it('returns undefined if no url provided', () => {
      expect(getCardImageUrl(undefined)).toBeUndefined();
      expect(getCardImageUrl('')).toBeUndefined();
    });

    it('returns direct url if already ends with an image extension', () => {
      expect(getCardImageUrl('https://example.com/card.webp')).toBe(
        'https://example.com/card.webp',
      );
      expect(getCardImageUrl('https://example.com/card.png')).toBe(
        'https://example.com/card.png',
      );
    });

    it('appends quality.webp to tcgdex asset path', () => {
      expect(getCardImageUrl('https://assets.tcgdex.net/en/swsh/swsh4/25')).toBe(
        'https://assets.tcgdex.net/en/swsh/swsh4/25/high.webp',
      );
      expect(
        getCardImageUrl('https://assets.tcgdex.net/en/swsh/swsh4/25/', 'low'),
      ).toBe('https://assets.tcgdex.net/en/swsh/swsh4/25/low.webp');
    });
  });

  describe('extractCardmarketPrice', () => {
    it('returns null if pricing or cardmarket is missing', () => {
      expect(extractCardmarketPrice(undefined)).toBeNull();
      expect(extractCardmarketPrice({})).toBeNull();
    });

    it('extracts trend price as priority', () => {
      const pricing: PokemonCardDetail['pricing'] = {
        cardmarket: {
          unit: 'EUR',
          trend: 12.5,
          avg: 15.0,
          low: 8.0,
        },
      };
      expect(extractCardmarketPrice(pricing)).toBe(12.5);
    });

    it('falls back to avg if trend is missing', () => {
      const pricing: PokemonCardDetail['pricing'] = {
        cardmarket: {
          unit: 'EUR',
          avg: 18.25,
          low: 10.0,
        },
      };
      expect(extractCardmarketPrice(pricing)).toBe(18.25);
    });
  });

  describe('extractTcgPlayerPrice', () => {
    it('returns null if pricing or tcgplayer is missing', () => {
      expect(extractTcgPlayerPrice(undefined)).toBeNull();
      expect(extractTcgPlayerPrice({})).toBeNull();
    });

    it('extracts normal market price', () => {
      const pricing: PokemonCardDetail['pricing'] = {
        tcgplayer: {
          unit: 'USD',
          normal: { marketPrice: 25.5 },
        },
      };
      expect(extractTcgPlayerPrice(pricing)).toBe(25.5);
    });

    it('falls back to holofoil market price if normal is missing', () => {
      const pricing: PokemonCardDetail['pricing'] = {
        tcgplayer: {
          unit: 'USD',
          holofoil: { marketPrice: 42.0 },
        },
      };
      expect(extractTcgPlayerPrice(pricing)).toBe(42.0);
    });
  });

  describe('resolvePokemonPrice (Collectr valuation)', () => {
    const mockPricing: PokemonCardDetail['pricing'] = {
      tcgplayer: {
        unit: 'USD',
        normal: { marketPrice: 5.0, midPrice: 5.5 },
        'reverse-holofoil': { marketPrice: 12.0, midPrice: 13.0 },
        holofoil: { marketPrice: 20.0, midPrice: 22.0 },
      },
      cardmarket: {
        unit: 'EUR',
        trend: 18.0,
      },
    };

    it('converts TCGplayer market price to EUR at given fxRate', () => {
      const res = resolvePokemonPrice(mockPricing, { fxRate: 0.9, rarity: 'Common' });
      expect(res.source).toBe('collectr');
      // For common with normal finish, normal market price is 5.0 -> 5.0 * 0.9 = 4.5
      expect(res.resolvedEur).toBe(4.5);
      expect(res.selectedFinish).toBe('normal');
      expect(res.fxRateUsed).toBe(0.9);
      expect(res.finishes).toHaveLength(3);
    });

    it('defaults to holofoil for ultra rare / secret / special illustration cards', () => {
      const res = resolvePokemonPrice(mockPricing, {
        fxRate: 0.9,
        rarity: 'Special Illustration Rare',
      });
      expect(res.selectedFinish).toBe('holofoil');
      expect(res.resolvedEur).toBe(18.0); // 20.0 * 0.9
    });

    it('respects user-specified preferredFinish', () => {
      const res = resolvePokemonPrice(mockPricing, {
        preferredFinish: 'reverse-holofoil',
        fxRate: 0.9,
      });
      expect(res.selectedFinish).toBe('reverse-holofoil');
      expect(res.resolvedEur).toBe(10.8); // 12.0 * 0.9
    });

    it('falls back to cardmarket when tcgplayer pricing is missing', () => {
      const cardmarketOnlyPricing: PokemonCardDetail['pricing'] = {
        cardmarket: {
          unit: 'EUR',
          trend: 25.5,
        },
      };
      const res = resolvePokemonPrice(cardmarketOnlyPricing, { fxRate: 0.9 });
      expect(res.source).toBe('cardmarket');
      expect(res.resolvedEur).toBe(25.5);
      expect(res.cardmarket?.priceEur).toBe(25.5);
      expect(res.collectr).toBeUndefined();
    });
  });

  describe('extractCollectrPrice', () => {
    it('returns resolved EUR price asynchronously', async () => {
      const pricing: PokemonCardDetail['pricing'] = {
        tcgplayer: {
          unit: 'USD',
          holofoil: { marketPrice: 100.0 },
        },
      };
      const price = await extractCollectrPrice(pricing, { fxRate: 0.89 });
      expect(price).toBe(89.0);
    });

    it('returns null if no pricing available', async () => {
      const price = await extractCollectrPrice({});
      expect(price).toBeNull();
    });
  });

  describe('multilingual Japanese card support', () => {
    it('provides Japanese mappings for iconic pokemon', async () => {
      const { POKEMON_JA_NAMES, JAPANESE_SETS } = await import('./tcgdex');
      expect(POKEMON_JA_NAMES.charizard).toBe('リザードン');
      expect(POKEMON_JA_NAMES.pikachu).toBe('ピカチュウ');
      expect(POKEMON_JA_NAMES.mew).toBe('ミュウ');
      expect(JAPANESE_SETS['151']).toBe('sv2a');
      expect(JAPANESE_SETS.sv4a).toBe('sv4a');
    });

    it('resolves Japanese card pricing via Cardmarket trend when TCGplayer is null', () => {
      const japanesePricing: PokemonCardDetail['pricing'] = {
        tcgplayer: undefined,
        cardmarket: {
          unit: 'EUR',
          trend: 357.44,
          avg: 382.53,
          low: 239.0,
        },
      };
      const res = resolvePokemonPrice(japanesePricing, { fxRate: 0.893 });
      expect(res.source).toBe('cardmarket');
      expect(res.resolvedEur).toBe(357.44);
      expect(res.cardmarket?.priceEur).toBe(357.44);
    });

    it('searches Japanese Zoroark cards from an English query', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/v2/en/cards?name=zoroark')) {
          return new Response(
            JSON.stringify([
              {
                id: 'sv09-098',
                localId: '098',
                name: "N's Zoroark ex",
                image: 'https://assets.tcgdex.net/en/sv/sv09/098',
              },
            ]),
            { status: 200 },
          );
        }
        if (url.includes('/v2/ja/cards?name=%E3%82%BE%E3%83%AD%E3%82%A2%E3%83%BC%E3%82%AF')) {
          return new Response(
            JSON.stringify([
              {
                id: 'SV9-127',
                localId: '127',
                name: 'Nのゾロアークex',
                image: 'https://assets.tcgdex.net/ja/SV/SV9/127',
              },
            ]),
            { status: 200 },
          );
        }
        throw new Error(`Unexpected URL: ${url}`);
      });

      const results = await searchPokemonCards('zoroark', 'all');
      expect(results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'SV9-127',
            language: 'ja',
            imageUrl: 'https://assets.tcgdex.net/ja/SV/SV9/127/low.webp',
          }),
        ]),
      );
      expect(fetchMock).toHaveBeenCalled();
    });

    it('uses the language returned by the fallback for an unpadded Japanese ID', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/v2/en/cards/sv9-127')) return new Response('', { status: 404 });
        if (url.includes('/v2/ja/cards/sv9-127')) {
          return new Response(
            JSON.stringify({
              id: 'SV9-127',
              localId: '127',
              name: 'Nのゾロアークex',
              image: 'https://assets.tcgdex.net/ja/SV/SV9/127',
            }),
            { status: 200 },
          );
        }
        throw new Error(`Unexpected URL: ${url}`);
      });

      const card = await getPokemonCard('sv9-127');
      expect(card?.id).toBe('SV9-127');
      expect(card?.language).toBe('ja');
      expect(card?.imageUrl).toContain('/ja/SV/SV9/127');
    });
  });
});
