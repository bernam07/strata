import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useSyncExternalStore } from 'react';

const useLatestDataUpdatedAt = (): number => {
  const client = useQueryClient();
  return useSyncExternalStore(
    (onStoreChange) => client.getQueryCache().subscribe(onStoreChange),
    () =>
      client.getQueryCache().getAll().reduce(
        (latest, query) => Math.max(latest, query.state.dataUpdatedAt),
        0,
      ),
    () => 0,
  );
};

const formatAge = (timestamp: number): string => {
  const age = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(age / 60_000);
  if (minutes < 1) return 'Updated just now';
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  return `Updated ${Math.floor(hours / 24)}d ago`;
};

export const DataFreshness = () => {
  const latest = useLatestDataUpdatedAt();
  const fetching = useIsFetching() > 0;
  const [, setClock] = useState(0);
  useEffect(() => {
    const interval = window.setInterval(() => setClock((value) => value + 1), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  if (latest === 0) return null;

  return (
    <p
      className="mb-3 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]"
      aria-live="polite"
    >
      {fetching ? 'Updating…' : formatAge(latest)}
    </p>
  );
};