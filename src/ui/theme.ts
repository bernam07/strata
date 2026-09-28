import { useEffect, useState } from 'react';

export type AccentTheme = 'gold' | 'emerald' | 'sapphire' | 'crimson';

export interface AccentOption {
  id: AccentTheme;
  label: string;
  hint: string;
  swatch: string;
}

export const accentOptions: readonly AccentOption[] = [
  {
    id: 'gold',
    label: 'Bronze Gold',
    hint: 'Signature Strata onyx & warm gold',
    swatch: '#e0a44a',
  },
  {
    id: 'emerald',
    label: 'Emerald',
    hint: 'Private banking mint & deep obsidian',
    swatch: '#34d399',
  },
  {
    id: 'sapphire',
    label: 'Electric Blue',
    hint: 'Crisp cobalt & high-contrast slate',
    swatch: '#60a5fa',
  },
  {
    id: 'crimson',
    label: 'Crimson',
    hint: 'Warm ruby & dark charcoal',
    swatch: '#f87171',
  },
];

const KEY = 'strata-accent';
const VALID = new Set<AccentTheme>(['gold', 'emerald', 'sapphire', 'crimson']);

const readInitial = (): AccentTheme => {
  try {
    const raw = localStorage.getItem(KEY) as AccentTheme | null;
    if (raw && VALID.has(raw)) return raw;
  } catch {
    // ignore storage failures
  }
  return 'gold';
};

let currentAccent: AccentTheme = readInitial();
const listeners = new Set<(value: AccentTheme) => void>();

const applyAccent = () => {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.accent = currentAccent;
  }
};

applyAccent();

export const getAccentTheme = (): AccentTheme => currentAccent;

export const setAccentTheme = (next: AccentTheme): void => {
  if (!VALID.has(next)) return;
  currentAccent = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // ignore storage failures
  }
  applyAccent();
  for (const listener of listeners) listener(currentAccent);
};

export const useAccentTheme = (): [AccentTheme, (next: AccentTheme) => void] => {
  const [value, setValue] = useState<AccentTheme>(currentAccent);
  useEffect(() => {
    const listener = (next: AccentTheme) => setValue(next);
    listeners.add(listener);
    setValue(currentAccent);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return [value, setAccentTheme];
};
