import { describe, expect, it } from 'vitest';
import {
  extractCardmarketPrice,
  extractTcgPlayerPrice,
  getCardImageUrl,
  type PokemonCardDetail,
} from './tcgdex';

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
});
