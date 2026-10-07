/**
 * Client-side IndexedDB persistence for Pokémon card and set catalogs.
 * Enables 0ms repeat searches, reduced CDN bandwidth, and offline catalog access.
 */

export interface CachedCatalog<T> {
  lang: 'en' | 'ja';
  data: T[];
  timestamp: number;
}

const DB_NAME = 'strata_collectibles_cache';
const DB_VERSION = 1;
const CARDS_STORE = 'pokemon_cards';
const SETS_STORE = 'pokemon_sets';

// 7 days in milliseconds
export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const openDb = (): Promise<IDBDatabase | null> => {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(CARDS_STORE)) {
          db.createObjectStore(CARDS_STORE, { keyPath: 'lang' });
        }
        if (!db.objectStoreNames.contains(SETS_STORE)) {
          db.createObjectStore(SETS_STORE, { keyPath: 'lang' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
};

export const getCachedFromDb = async <T>(
  storeName: typeof CARDS_STORE | typeof SETS_STORE,
  lang: 'en' | 'ja',
): Promise<T[] | null> => {
  try {
    const db = await openDb();
    if (!db) return null;

    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(lang);

      req.onsuccess = () => {
        const entry = req.result as CachedCatalog<T> | undefined;
        if (!entry || !Array.isArray(entry.data)) {
          resolve(null);
          return;
        }

        const isExpired = Date.now() - entry.timestamp > CACHE_TTL_MS;
        // Even if expired, if we are offline or fast-pathing, return data
        if (isExpired && typeof navigator !== 'undefined' && navigator.onLine) {
          resolve(null);
        } else {
          resolve(entry.data);
        }
      };

      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};

export const setCachedInDb = async <T>(
  storeName: typeof CARDS_STORE | typeof SETS_STORE,
  lang: 'en' | 'ja',
  data: T[],
): Promise<void> => {
  if (!Array.isArray(data) || data.length === 0) return;

  try {
    const db = await openDb();
    if (!db) return;

    await new Promise<void>((resolve) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const entry: CachedCatalog<T> = {
        lang,
        data,
        timestamp: Date.now(),
      };
      store.put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Non-critical; ignore database write errors
  }
};

export const clearCollectiblesDb = async (): Promise<void> => {
  try {
    const db = await openDb();
    if (!db) return;

    await new Promise<void>((resolve) => {
      const tx = db.transaction([CARDS_STORE, SETS_STORE], 'readwrite');
      tx.objectStore(CARDS_STORE).clear();
      tx.objectStore(SETS_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore errors
  }
};
