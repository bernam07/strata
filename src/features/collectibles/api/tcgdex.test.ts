import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearTcgdexCacheForTesting,
  extractCardmarketPrice,
  extractCollectrPrice,
  extractTcgPlayerPrice,
  getCardImageUrl,
  getPokemonCard,
  isJapaneseId,
  isJapanesePokemonItem,
  resolvePokemonPrice,
  searchPokemonCards,
  type PokemonCardDetail,
} from './tcgdex';

afterEach(() => {
  vi.restoreAllMocks();
  clearTcgdexCacheForTesting();
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
        if (url.includes('/v2/en/cards')) {
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
        if (url.includes('pokeapi.co/api/v2/pokemon-species/zoroark')) {
          return new Response(
            JSON.stringify({
              names: [{ language: { name: 'ja' }, name: 'ゾロアーク' }],
            }),
            { status: 200 },
          );
        }
        if (url.includes('/v2/ja/cards')) {
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

    it('searches cards by set alias e.g. 151 across EN and JA', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/v2/en/sets')) {
          return new Response(JSON.stringify([{ id: 'sv03.5', name: '151' }]), { status: 200 });
        }
        if (url.includes('/v2/ja/sets')) {
          return new Response(JSON.stringify([{ id: 'sv2a', name: 'ポケモンカード151' }]), { status: 200 });
        }
        if (url.includes('/v2/en/cards')) {
          return new Response(
            JSON.stringify([
              {
                id: 'sv03.5-006',
                localId: '006',
                name: 'Charizard ex',
                image: 'https://assets.tcgdex.net/en/sv/sv03.5/006',
              },
            ]),
            { status: 200 },
          );
        }
        if (url.includes('/v2/ja/cards')) {
          return new Response(
            JSON.stringify([
              {
                id: 'SV2a-201',
                localId: '201',
                name: 'リザードンex',
                image: 'https://assets.tcgdex.net/ja/SV/SV2a/201',
              },
            ]),
            { status: 200 },
          );
        }
        return new Response('[]', { status: 200 });
      });

      const results = await searchPokemonCards('Charizard 151', 'all');
      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.some((c) => c.id === 'sv03.5-006')).toBe(true);
      expect(results.some((c) => c.id === 'SV2a-201')).toBe(true);
    });

    it('prioritizes cards with images before cards without images', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/v2/en/sets') || url.includes('/v2/ja/sets')) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        if (url.includes('/v2/en/cards')) {
          return new Response(
            JSON.stringify([
              { id: 'base1-4', localId: '4', name: 'Charizard' },
              {
                id: 'sv03-125',
                localId: '125',
                name: 'Charizard ex',
                image: 'https://assets.tcgdex.net/en/sv/sv03/125',
              },
            ]),
            { status: 200 },
          );
        }
        if (url.includes('/v2/ja/cards')) {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        return new Response('[]', { status: 200 });
      });

      const results = await searchPokemonCards('charizard', 'en');
      expect(results.length).toBe(2);
      expect(results[0]?.id).toBe('sv03-125');
      expect(results[1]?.id).toBe('base1-4');
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

    describe('isJapaneseId and isJapanesePokemonItem', () => {
      it('correctly identifies Japanese card identifiers with mixed-case and specific prefixes', () => {
        expect(isJapaneseId('SV2a-201')).toBe(true);
        expect(isJapaneseId('sv2a-001')).toBe(true);
        expect(isJapaneseId('S12a-001')).toBe(true);
        expect(isJapaneseId('s12a-001')).toBe(true);
        expect(isJapaneseId('PMCG1-001')).toBe(true);
        expect(isJapaneseId('CP6-001')).toBe(true);
        expect(isJapaneseId('SV7a-050')).toBe(true);

        expect(isJapaneseId('sv03.5-199')).toBe(false);
        expect(isJapaneseId('swsh12-100')).toBe(false);
        expect(isJapaneseId('base1-4')).toBe(false);
      });

      it('correctly distinguishes Japanese vs English portfolio items', () => {
        expect(
          isJapanesePokemonItem({
            identifier: 'SV2a-201',
            metadata: { language: 'ja' },
            name: 'Charizard ex [JA]',
          }),
        ).toBe(true);

        expect(
          isJapanesePokemonItem({
            identifier: 'SV2a-201',
            metadata: {},
            name: 'Charizard ex',
          }),
        ).toBe(true);

        expect(
          isJapanesePokemonItem({
            identifier: 'sv03.5-199',
            metadata: { language: 'en' },
            name: 'Charizard ex (#199 - 151)',
          }),
        ).toBe(false);

        expect(
          isJapanesePokemonItem({
            identifier: 'sv03.5-199',
            metadata: {},
            name: 'Charizard ex',
          }),
        ).toBe(false);
      });
    });
  });
});
