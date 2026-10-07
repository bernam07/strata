import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  cleanWatchReference,
  getCachedTheWatchApiKey,
  setCachedTheWatchApiKey,
  resolveWatchPrice,
} from './theWatchApi';

describe('theWatchApi client', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('normalizes reference numbers cleanly', () => {
    expect(cleanWatchReference('#126610LN')).toBe('126610LN');
    expect(cleanWatchReference('ref: 126710blro')).toBe('126710BLRO');
    expect(cleanWatchReference('  310.30.42.50.01.002  ')).toBe('310.30.42.50.01.002');
    expect(cleanWatchReference('https://www.chrono24.com/rolex/submariner-date--126610ln')).toBe(
      'SUBMARINER-DATE--126610LN',
    );
  });

  it('gets and sets cached API key in localStorage', () => {
    expect(getCachedTheWatchApiKey()).toBeNull();
    setCachedTheWatchApiKey('test_token_123');
    expect(getCachedTheWatchApiKey()).toBe('test_token_123');
    setCachedTheWatchApiKey(null);
    expect(getCachedTheWatchApiKey()).toBeNull();
  });

  it('resolves curated watches accurately with FX conversion', async () => {
    const res = await resolveWatchPrice({
      referenceNumber: '126610LN',
      fxRate: 0.90,
    });

    expect(res).not.toBeNull();
    expect(res?.brand).toBe('Rolex');
    expect(res?.model).toBe('Submariner Date 41mm');
    expect(res?.referenceNumber).toBe('126610LN');
    expect(res?.priceUsd).toBe(14200);
    expect(res?.priceEur).toBe(14200 * 0.9);
    expect(res?.specs.caseMaterial).toBe('Oystersteel (904L)');
  });

  it('resolves Tissot PRX Powermatic reference cleanly with or without dots', async () => {
    const resWithDots = await resolveWatchPrice({
      referenceNumber: 'T137.407.11.091.00',
      fxRate: 0.90,
    });
    expect(resWithDots).not.toBeNull();
    expect(resWithDots?.brand).toBe('Tissot');
    expect(resWithDots?.model).toContain('PRX Powermatic 80');
    expect(resWithDots?.specs.caseDiameter).toBe('40 mm');

    const resWithoutDots = await resolveWatchPrice({
      referenceNumber: 'T1374071109100',
      fxRate: 0.90,
    });
    expect(resWithoutDots).not.toBeNull();
    expect(resWithoutDots?.brand).toBe('Tissot');
    expect(resWithoutDots?.model).toContain('PRX Powermatic 80');
  });

  it('queries TheWatchAPI REST endpoint when API key is provided', async () => {
    const fakeWatch = {
      brand: 'Tudor',
      model: 'Black Bay 58',
      reference_number: 'M79030N-0001',
      price_usd: 3950,
      image_url: 'https://example.com/tudor.jpg',
      case_material: 'Steel',
      case_diameter: '39 mm',
      movement: 'Manufacture Calibre MT5402',
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [fakeWatch] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await resolveWatchPrice({
      referenceNumber: 'M79030N-0001',
      apiKey: 'valid_api_key_456',
      fxRate: 0.92,
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(res).not.toBeNull();
    expect(res?.brand).toBe('Tudor');
    expect(res?.model).toBe('Black Bay 58');
    expect(res?.priceUsd).toBe(3950);
    expect(res?.priceEur).toBe(Math.round(3950 * 0.92 * 100) / 100);
    expect(res?.specs.caseDiameter).toBe('39 mm');
  });

  it('returns null for unknown reference when no key is set', async () => {
    const res = await resolveWatchPrice({
      referenceNumber: 'UNKNOWN-REF-99999',
    });
    expect(res).toBeNull();
  });
});
