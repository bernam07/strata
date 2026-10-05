import { useEffect, useState } from 'react';
import { TextInput } from '@/ui/Field';
import {
  getPokemonCard,
  searchPokemonCards,
  type PokemonCardDetail,
  type PokemonCardSummary,
} from '../api/tcgdex';

interface PokemonCardSearchProps {
  onSelect: (card: PokemonCardDetail) => void;
}

export const PokemonCardSearch = ({ onSelect }: PokemonCardSearchProps) => {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [results, setResults] = useState<PokemonCardSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text), 350);
    return () => clearTimeout(timer);
  }, [text]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    searchPokemonCards(query)
      .then((cards) => {
        if (active) {
          setResults(cards);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to search cards');
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [query]);

  const handleSelect = async (cardSummary: PokemonCardSummary) => {
    try {
      setLoadingDetail(cardSummary.id);
      const detail = await getPokemonCard(cardSummary.id);
      if (detail) {
        onSelect(detail);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load card details');
    } finally {
      setLoadingDetail(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <TextInput
        value={text}
        placeholder="Search Pokémon card (e.g. Charizard, Umbreon, Pikachu)..."
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />

      {loading && (
        <div className="flex items-center gap-2 px-1 text-xs text-[var(--text-muted)]">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
          <span>Searching TCGdex catalog…</span>
        </div>
      )}

      {error && (
        <p className="px-1 text-xs text-[var(--negative)]">{error}</p>
      )}

      {!loading && query.trim().length >= 2 && results.length === 0 && (
        <p className="px-1 text-xs text-[var(--text-muted)]">
          No cards found for &ldquo;{query}&rdquo;.
        </p>
      )}

      {results.length > 0 && (
        <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
          {results.map((card) => {
            const isSelecting = loadingDetail === card.id;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => handleSelect(card)}
                disabled={isSelecting}
                className="tap group flex flex-col items-center gap-1.5 rounded-[var(--radius-field)] neu-flat p-2 text-left transition hover:border-[var(--accent)] hover:shadow-md disabled:opacity-50"
              >
                <div className="relative aspect-[2.5/3.5] w-full overflow-hidden rounded bg-[var(--surface-sunken)] p-1">
                  {card.imageUrl ? (
                    <img
                      src={card.imageUrl}
                      alt={card.name}
                      loading="lazy"
                      className="h-full w-full object-contain transition duration-200 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-[var(--text-muted)]">
                      No image
                    </div>
                  )}
                  {isSelecting && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs">
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    </div>
                  )}
                </div>
                <div className="w-full text-center">
                  <p className="truncate text-xs font-bold text-[var(--text-strong)]">
                    {card.name}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] font-mono">
                    #{card.localId}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
