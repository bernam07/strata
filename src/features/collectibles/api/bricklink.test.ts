import { describe, expect, it, vi } from 'vitest';
import {
  detectBricklinkItemType,
  generateOAuthHeader,
  normalizeBricklinkItemNumber,
  rfc3986,
  fetchBricklinkPrice,
  type BricklinkCredentials,
} from './bricklink';

describe('BrickLink API & Utilities', () => {
  describe('rfc3986', () => {
    it('properly encodes RFC 3986 reserved characters', () => {
      expect(rfc3986("Hello World! (Test's *))")).toBe(
        'Hello%20World%21%20%28Test%27s%20%2A%29%29',
      );
    });

    it('preserves unreserved characters', () => {
      expect(rfc3986('abc-123_XYZ.~')).toBe('abc-123_XYZ.~');
    });
  });

  describe('detectBricklinkItemType', () => {
    it('detects minifigure prefix codes', () => {
      expect(detectBricklinkItemType('sw0107')).toBe('MINIFIG');
      expect(detectBricklinkItemType('col143')).toBe('MINIFIG');
      expect(detectBricklinkItemType('sh030')).toBe('MINIFIG');
      expect(detectBricklinkItemType('fig-000001')).toBe('MINIFIG');
      expect(detectBricklinkItemType('hp012')).toBe('MINIFIG');
      expect(detectBricklinkItemType('cas001')).toBe('MINIFIG');
      expect(detectBricklinkItemType('lor001')).toBe('MINIFIG');
    });

    it('defaults standard numeric sets to SET', () => {
      expect(detectBricklinkItemType('75192')).toBe('SET');
      expect(detectBricklinkItemType('10316')).toBe('SET');
      expect(detectBricklinkItemType('21318-1')).toBe('SET');
    });

    it('honors explicit type parameter', () => {
      expect(detectBricklinkItemType('75192', 'minifig')).toBe('MINIFIG');
      expect(detectBricklinkItemType('sw0107', 'set')).toBe('SET');
      expect(detectBricklinkItemType('3001', 'part')).toBe('PART');
    });
  });

  describe('normalizeBricklinkItemNumber', () => {
    it('appends -1 to sets without variant suffix', () => {
      expect(normalizeBricklinkItemNumber('75192', 'SET')).toBe('75192-1');
      expect(normalizeBricklinkItemNumber('10316')).toBe('10316-1');
    });

    it('preserves existing set variant suffix', () => {
      expect(normalizeBricklinkItemNumber('75192-1')).toBe('75192-1');
      expect(normalizeBricklinkItemNumber('10316-2')).toBe('10316-2');
    });

    it('does not append -1 to minifigures', () => {
      expect(normalizeBricklinkItemNumber('sw0107')).toBe('sw0107');
      expect(normalizeBricklinkItemNumber('col143')).toBe('col143');
    });

    it('strips -1 from minifigures if accidentally passed', () => {
      expect(normalizeBricklinkItemNumber('sw0107-1', 'MINIFIG')).toBe('sw0107');
    });
  });

  describe('generateOAuthHeader', () => {
    const creds: BricklinkCredentials = {
      consumerKey: 'test_consumer_key',
      consumerSecret: 'test_consumer_secret',
      tokenValue: 'test_token_value',
      tokenSecret: 'test_token_secret',
    };

    it('generates a valid OAuth 1.0 Authorization header', async () => {
      const header = await generateOAuthHeader(
        'GET',
        'https://api.bricklink.com/api/store/v1/items/SET/75192-1/price',
        { guide_type: 'sold', new_or_used: 'N', currency_code: 'EUR' },
        creds,
      );

      expect(header).toMatch(/^OAuth /);
      expect(header).toContain('oauth_consumer_key="test_consumer_key"');
      expect(header).toContain('oauth_token="test_token_value"');
      expect(header).toContain('oauth_signature_method="HMAC-SHA1"');
      expect(header).toContain('oauth_version="1.0"');
      expect(header).toContain('oauth_signature="');
      expect(header).toContain('oauth_nonce="');
      expect(header).toContain('oauth_timestamp="');
    });
  });

  describe('fetchBricklinkPrice', () => {
    const creds: BricklinkCredentials = {
      consumerKey: 'mock_key',
      consumerSecret: 'mock_secret',
      tokenValue: 'mock_token',
      tokenSecret: 'mock_token_secret',
    };

    it('parses valid BrickLink response correctly', async () => {
      const mockApiResponse = {
        meta: { code: 200, message: 'OK', description: 'OK' },
        data: {
          item: { no: '75192-1', type: 'SET' },
          new_or_used: 'N',
          currency_code: 'EUR',
          avg_price: '820.5000',
          max_price: '950.0000',
          min_price: '749.0000',
          qty_avg_price: '815.0000',
          unit_quantity: 42,
          total_quantity: 48,
        },
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockApiResponse,
      } as Response);

      const result = await fetchBricklinkPrice({
        itemNo: '75192',
        itemType: 'SET',
        guideType: 'sold',
        condition: 'N',
        currency: 'EUR',
        credentials: creds,
        skipEdgeFunction: true,
      });

      expect(result.itemNo).toBe('75192-1');
      expect(result.itemType).toBe('SET');
      expect(result.currency).toBe('EUR');
      expect(result.avgPrice).toBe(820.5);
      expect(result.qtyAvgPrice).toBe(815.0);
      expect(result.minPrice).toBe(749.0);
      expect(result.maxPrice).toBe(950.0);
      expect(result.unitQuantity).toBe(42);
      expect(result.totalQuantity).toBe(48);

      fetchSpy.mockRestore();
    });

    it('handles BrickLink errors gracefully', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          meta: { code: 404, message: 'ITEM_NOT_FOUND' },
        }),
      } as Response);

      await expect(
        fetchBricklinkPrice({
          itemNo: 'nonexistent9999',
          credentials: creds,
          skipEdgeFunction: true,
        }),
      ).rejects.toThrow('ITEM_NOT_FOUND');

      fetchSpy.mockRestore();
    });
  });
});
