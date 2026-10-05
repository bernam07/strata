import { describe, expect, it } from 'vitest';
import {
  getLegoImageUrl,
  normalizeSetNumber,
  POPULAR_LEGO_SETS,
  searchLegoSets,
} from './lego';

describe('LEGO api and utilities', () => {
  describe('normalizeSetNumber', () => {
    it('strips whitespace', () => {
      expect(normalizeSetNumber(' 75192 ')).toBe('75192');
    });

    it('strips -1 suffix from set numbers', () => {
      expect(normalizeSetNumber('75192-1')).toBe('75192');
      expect(normalizeSetNumber('10316-2')).toBe('10316');
    });

    it('leaves clean numbers untouched', () => {
      expect(normalizeSetNumber('10316')).toBe('10316');
    });

    it('preserves minifigure set numbers with prefixes and hyphens', () => {
      expect(normalizeSetNumber('fig-000001')).toBe('fig-000001');
      expect(normalizeSetNumber('sw0107')).toBe('sw0107');
    });
  });

  describe('getLegoImageUrl', () => {
    it('generates high-res Brickset CDN image URL from set number', () => {
      expect(getLegoImageUrl('75192')).toBe(
        'https://images.brickset.com/sets/images/75192-1.jpg',
      );
      expect(getLegoImageUrl('10316-1')).toBe(
        'https://images.brickset.com/sets/images/10316-1.jpg',
      );
    });
  });

  describe('searchLegoSets', () => {
    it('returns empty array if query has less than 2 characters', async () => {
      const results = await searchLegoSets('a');
      expect(results).toEqual([]);
    });

    it('finds Millennium Falcon by set number', async () => {
      const results = await searchLegoSets('75192');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.name).toContain('Millennium Falcon');
      expect(results[0]?.pieces).toBe(7541);
      expect(results[0]?.rrpEur).toBe(849.99);
    });

    it('finds Rivendell by name', async () => {
      const results = await searchLegoSets('Rivendell');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.setNumber).toBe('10316');
      expect(results[0]?.theme).toBe('Icons');
    });

    it('finds Technic supercars by theme', async () => {
      const results = await searchLegoSets('Technic');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((s) => s.name.includes('Lamborghini'))).toBe(true);
    });

    it('synthesizes unknown 4-6 digit set numbers with official image URL', async () => {
      const results = await searchLegoSets('99999');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.setNumber).toBe('99999');
      expect(results[0]?.imageUrl).toBe(
        'https://images.brickset.com/sets/images/99999-1.jpg',
      );
    });

    it('finds curated minifigures like Boba Fett Cloud City', async () => {
      const results = await searchLegoSets('Boba Fett');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((s) => s.setNumber === 'sw0107')).toBe(true);
      expect(results.some((s) => s.type === 'minifig')).toBe(true);
    });
  });

  describe('POPULAR_LEGO_SETS catalog', () => {
    it('has valid structure and image URLs for all curated sets', () => {
      expect(POPULAR_LEGO_SETS.length).toBeGreaterThan(20);
      for (const set of POPULAR_LEGO_SETS) {
        expect(set.setNumber).toBeTruthy();
        expect(set.name).toBeTruthy();
        expect(set.imageUrl).toContain('images.brickset.com');
      }
    });
  });
});
