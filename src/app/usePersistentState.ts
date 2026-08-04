import { useEffect, useState } from 'react';

export const usePersistentState = <T>(
  key: string,
  initial: T,
): [T, (value: T) => void] => {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage unavailable — keep in-memory only
    }
  }, [key, value]);

  return [value, setValue];
};
