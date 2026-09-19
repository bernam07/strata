import { useEffect, useRef, useState } from 'react';

const entryPattern = /\/assets\/index-[\w-]+\.js/;

const loadedEntry = (): string | null => {
  const script = document.querySelector<HTMLScriptElement>(
    'script[type="module"][src^="/assets/index-"]',
  );
  return script?.getAttribute('src') ?? null;
};

const latestEntry = async (): Promise<string | null> => {
  const res = await fetch('/', { cache: 'no-store' });
  if (!res.ok) return null;
  const match = (await res.text()).match(entryPattern);
  return match ? match[0] : null;
};

export const useAppUpdate = (): { available: boolean; apply: () => void } => {
  const reloading = useRef(false);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const loaded = loadedEntry();
    if (!loaded) return;

    const check = async () => {
      if (reloading.current || document.visibilityState !== 'visible') return;
      try {
        const latest = await latestEntry();
        if (latest && latest !== loaded) {
          setAvailable(true);
        }
      } catch {
        // offline or blocked — try again next time
      }
    };

    const onVisibility = () => void check();
    document.addEventListener('visibilitychange', onVisibility);
    const interval = window.setInterval(() => void check(), 60_000);
    void check();

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(interval);
    };
  }, []);

  const apply = () => {
    if (reloading.current) return;
    reloading.current = true;
    window.location.reload();
  };

  return { available, apply };
};
