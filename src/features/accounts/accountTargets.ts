import { useEffect, useState } from 'react';

export interface AccountTarget {
  targetAmount: number;
  targetDate?: string | null;
  note?: string | null;
}

const STORAGE_KEY = 'strata-account-targets-v1';
const CHANGE_EVENT = 'strata-account-targets-changed';

export const loadAccountTargets = (): Record<string, AccountTarget> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, AccountTarget>;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
};

export const saveAccountTargets = (
  map: Record<string, AccountTarget>,
): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
    }
  } catch {
    // ignore storage errors
  }
};

export const useAccountTargets = () => {
  const [targets, setTargets] = useState<Record<string, AccountTarget>>(() =>
    loadAccountTargets(),
  );

  useEffect(() => {
    const sync = () => setTargets(loadAccountTargets());
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setTarget = (accountId: string, target: AccountTarget | null) => {
    const next = { ...loadAccountTargets() };
    if (!target || !(target.targetAmount > 0)) {
      delete next[accountId];
    } else {
      next[accountId] = target;
    }
    saveAccountTargets(next);
    setTargets(next);
  };

  return { targets, setTarget };
};
