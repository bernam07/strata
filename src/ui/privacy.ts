import { useEffect, useState } from 'react';

// "Hide amounts" mode. A single attribute on <html> drives a CSS rule that
// blurs every monetary/percentage value (they all carry the `tabular-nums`
// class), so we can hide balances app-wide without touching each call site.

const KEY = 'strata-privacy';

const readInitial = (): boolean => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

let hidden = readInitial();
const listeners = new Set<(value: boolean) => void>();

const apply = () => {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.privacy = hidden ? 'on' : 'off';
  }
};

apply();

export const isPrivacyOn = (): boolean => hidden;

export const setPrivacy = (value: boolean): void => {
  hidden = value;
  try {
    localStorage.setItem(KEY, value ? '1' : '0');
  } catch {
    // ignore storage failures (private mode, etc.)
  }
  apply();
  for (const listener of listeners) listener(hidden);
};

export const togglePrivacy = (): void => setPrivacy(!hidden);

export const usePrivacy = (): boolean => {
  const [value, setValue] = useState(hidden);
  useEffect(() => {
    const listener = (next: boolean) => setValue(next);
    listeners.add(listener);
    setValue(hidden);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return value;
};
