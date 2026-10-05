import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectBrickeconomyItemType,
  normalizeBrickeconomyItemNumber,
  fetchBrickEconomyPrice,
  getCachedBrickeconomyKey,
  setCachedBrickeconomyKey,
} from './brickeconomy';

describe('brickeconomy API', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('detectBrickeconomyItemType', () => {
    it('detects numeric items as SET by default', () => {
      expect(detectBrickeconomyItemType('75192')).toBe('SET');
      expect(detectBrickeconomyItemType('10316-1')).toBe('SET');
      expect(detectBrickeconomyItemType('21338')).toBe('SET');
    });

    it('detects minifig code patterns as MINIFIG', () => {
      expect(detectBrickeconomyItemType('sw0001')).toBe('MINIFIG');
      expect(detectBrickeconomyItemType('sw0509')).toBe('MINIFIG');
      expect(detectBrickeconomyItemType('col001')).toBe('MINIFIG');
      expect(detectBrickeconomyItemType('sh001')).toBe('MINIFIG');
      expect(detectBrickeconomyItemType('hp001')).toBe('MINIFIG');
      expect(detectBrickeconomyItemType('fig-000123')).toBe('MINIFIG');
    });

    it('honors explicit type overrides', () => {
      expect(detectBrickeconomyItemType('sw0001', 'set')).toBe('SET');
      expect(detectBrickeconomyItemType('75192', 'minifig')).toBe('MINIFIG');
    });
  });

  describe('normalizeBrickeconomyItemNumber', () => {
    it('appends -1 to LEGO set numbers if missing', () => {
      expect(normalizeBrickeconomyItemNumber('75192')).toBe('75192-1');
      expect(normalizeBrickeconomyItemNumber('75192-1')).toBe('75192-1');
      expect(normalizeBrickeconomyItemNumber('10316-2')).toBe('10316-2');
    });

    it('removes -1 suffix from minifigures', () => {
      expect(normalizeBrickeconomyItemNumber('sw0001-1')).toBe('sw0001');
      expect(normalizeBrickeconomyItemNumber('sw0001')).toBe('sw0001');
      expect(normalizeBrickeconomyItemNumber('fig-000001')).toBe('fig-000001');
    });
  });

  describe('localStorage caching', () => {
    it('saves and reads the API key', () => {
      expect(getCachedBrickeconomyKey()).toBeNull();
      setCachedBrickeconomyKey('my-secret-key-123');
      expect(getCachedBrickeconomyKey()).toBe('my-secret-key-123');
      setCachedBrickeconomyKey(null);
      expect(getCachedBrickeconomyKey()).toBeNull();
    });
  });

  describe('fetchBrickEconomyPrice', () => {
    it('throws error when no API key is configured', async () => {
      await expect(
        fetchBrickEconomyPrice({
          itemNo: '75192',
          skipEdgeFunction: true,
        }),
      ).rejects.toThrow(/BrickEconomy API key not configured/);
    });

    it('fetches and normalizes a LEGO set successfully', async () => {
      const mockResponse = {
        name: 'Millennium Falcon (UCS)',
        set_number: '75192-1',
        retail_price: 849.99,
        market_value: 950.0,
        growth_percent: 11.7,
        year: 2017,
        pieces: 7541,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as unknown as Response);

      const result = await fetchBrickEconomyPrice({
        itemNo: '75192',
        apiKey: 'test-key',
        currency: 'EUR',
        skipEdgeFunction: true,
      });

      expect(result.itemNo).toBe('75192-1');
      expect(result.itemType).toBe('SET');
      expect(result.name).toBe('Millennium Falcon (UCS)');
      expect(result.marketValue).toBe(950);
      expect(result.retailPrice).toBe(849.99);
      expect(result.growthPercent).toBe(11.7);
      expect(result.source).toBe('brickeconomy');
    });

    it('fetches a minifigure with used condition valuation', async () => {
      const mockResponse = {
        data: {
          name: 'Darth Vader (Light Gray)',
          minifig_number: 'sw0004',
          new_price: 45.0,
          used_price: 22.5,
          release_year: 1999,
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as unknown as Response);

      const result = await fetchBrickEconomyPrice({
        itemNo: 'sw0004',
        apiKey: 'test-key',
        condition: 'U',
        currency: 'EUR',
        skipEdgeFunction: true,
      });

      expect(result.itemNo).toBe('sw0004');
      expect(result.itemType).toBe('MINIFIG');
      expect(result.marketValue).toBe(22.5);
      expect(result.condition).toBe('U');
    });
  });
});
