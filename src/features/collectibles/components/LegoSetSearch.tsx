import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { TextInput } from '@/ui/Field';
import { searchLegoSets, type LegoSetResult } from '../api/lego';
import { useRebrickableKey } from '@/features/integrations/api/useRebrickable';
import { useBricksetConnection } from '@/features/integrations/api/useBrickset';

interface LegoSetSearchProps {
  onSelect: (set: LegoSetResult) => void;
}

export const LegoSetSearch = ({ onSelect }: LegoSetSearchProps) => {
  const { data: rebrickableKey } = useRebrickableKey();
  const bricksetConnection = useBricksetConnection();
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<LegoSetResult[]>([]);
  const [typeFilter, setTypeFilter] = useState<'all' | 'set' | 'minifig'>('all');

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text), 250);
    return () => clearTimeout(timer);
  }, [text]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    let active = true;
    setLoading(true);

    searchLegoSets(query, rebrickableKey ?? undefined)
      .then((sets) => {
        if (active) {
          setResults(sets);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [query, rebrickableKey]);

  const filteredResults = useMemo(() => {
    if (typeFilter === 'all') return results;
    return results.filter((item) => (item.type || 'set') === typeFilter);
  }, [results, typeFilter]);

  const setCount = useMemo(
    () => results.filter((r) => (r.type || 'set') === 'set').length,
    [results],
  );
  const minifigCount = useMemo(
    () => results.filter((r) => r.type === 'minifig').length,
    [results],
  );

  return (
    <div className="flex flex-col gap-3">
      <TextInput
        value={text}
        placeholder="Search sets & minifigures (e.g. 75192, Rivendell, sw0107, Boba Fett)..."
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-[var(--text-muted)]">
        <span className="flex items-center gap-1.5">
          <span>
            Tip: Type set number (e.g. <code className="text-[var(--accent)]">10294</code>) or minifigure code (e.g. <code className="text-[var(--accent)]">sw0107</code>).
          </span>
        </span>

        <div className="flex flex-wrap items-center gap-3">
          {rebrickableKey ? (
            <span className="inline-flex items-center gap-1 font-semibold text-[var(--positive)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--positive)]" />
              Rebrickable Active
            </span>
          ) : (
            <NavLink
              to="/integrations"
              className="tap font-semibold text-[var(--accent)] hover:underline"
            >
              Connect Rebrickable →
            </NavLink>
          )}

          {bricksetConnection.data ? (
            <span className="inline-flex items-center gap-1 font-semibold text-[var(--positive)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--positive)]" />
              Brickset RRP Active
            </span>
          ) : (
            <NavLink
              to="/integrations"
              className="tap font-semibold text-[var(--accent)] hover:underline"
            >
              Connect Brickset →
            </NavLink>
          )}
        </div>
      </div>

      {results.length > 0 && (
        <div className="flex items-center gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => setTypeFilter('all')}
            className={`tap rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${
              typeFilter === 'all'
                ? 'neu-raised bg-[var(--surface-raised)] text-[var(--accent)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'
            }`}
          >
            All ({results.length})
          </button>
          {setCount > 0 && (
            <button
              type="button"
              onClick={() => setTypeFilter('set')}
              className={`tap rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${
                typeFilter === 'set'
                  ? 'neu-raised bg-[var(--surface-raised)] text-[var(--accent)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'
              }`}
            >
              Sets ({setCount})
            </button>
          )}
          {minifigCount > 0 && (
            <button
              type="button"
              onClick={() => setTypeFilter('minifig')}
              className={`tap rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${
                typeFilter === 'minifig'
                  ? 'neu-raised bg-[var(--surface-raised)] text-[var(--accent)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'
              }`}
            >
              Minifigures ({minifigCount})
            </button>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 px-1 text-xs text-[var(--text-muted)]">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
          <span>Searching LEGO sets &amp; minifigures…</span>
        </div>
      )}

      {!loading && query.trim().length >= 2 && filteredResults.length === 0 && (
        <p className="px-1 text-xs text-[var(--text-muted)]">
          No matches found for &ldquo;{query}&rdquo;. You can add details manually below.
        </p>
      )}

      {filteredResults.length > 0 && (
        <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {filteredResults.map((item) => {
            const isMinifig = item.type === 'minifig';
            return (
              <button
                key={`${item.type || 'set'}-${item.setNumber}`}
                type="button"
                onClick={() => onSelect(item)}
                className="tap group flex items-center gap-3 rounded-[var(--radius-field)] neu-flat p-2.5 text-left transition hover:border-[var(--accent)] hover:shadow-md"
              >
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded bg-[var(--surface-sunken)] p-1">
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    loading="lazy"
                    className="h-full w-full object-contain transition duration-200 group-hover:scale-105"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[11px] font-bold text-[var(--accent)]">
                      #{item.setNumber}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider ${
                        isMinifig
                          ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                          : 'bg-[var(--surface-sunken)] text-[var(--text-muted)]'
                      }`}
                    >
                      {isMinifig ? 'Minifig' : 'Set'}
                    </span>
                    <span className="truncate text-[10px] text-[var(--text-muted)]">
                      {item.theme} {item.year ? `(${item.year})` : ''}
                    </span>
                  </div>
                  <p className="line-clamp-1 text-xs font-bold text-[var(--text-strong)] group-hover:text-[var(--accent)]">
                    {item.name}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                    {item.pieces && (
                      <span>
                        {item.pieces.toLocaleString()} {isMinifig ? 'parts' : 'pieces'}
                      </span>
                    )}
                    {item.rrpEur && (
                      <span className="font-semibold text-[var(--positive)]">
                        RRP: €{item.rrpEur.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
