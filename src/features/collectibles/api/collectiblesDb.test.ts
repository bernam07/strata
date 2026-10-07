import { afterEach, describe, expect, it } from 'vitest';
import {
  clearCollectiblesDb,
  getCachedFromDb,
  setCachedInDb,
} from './collectiblesDb';

afterEach(async () => {
  await clearCollectiblesDb();
});

describe('collectiblesDb', () => {
  it('gracefully returns null if IndexedDB is empty or unavailable', async () => {
    const res = await getCachedFromDb('pokemon_cards', 'en');
    expect(res).toBeNull();
  });

  it('safely handles setCachedInDb with empty arrays', async () => {
    await expect(setCachedInDb('pokemon_cards', 'en', [])).resolves.toBeUndefined();
  });

  it('safely clears database without error', async () => {
    await expect(clearCollectiblesDb()).resolves.toBeUndefined();
  });
});
