import { useEffect, useState } from 'react';
import { TextInput } from '@/ui/Field';
import {
  getPokemonCard,
  searchPokemonCards,
  type PokemonCardDetail,
  type PokemonCardLanguage,
  type PokemonCardSummary,
} from '../api/tcgdex';

interface PokemonCardSearchProps {
  onSelect: (card: PokemonCardDetail) => void;
}

const CardImageThumbnail = ({
  card,
  isSelecting,
}: {
  card: PokemonCardSummary;
  isSelecting: boolean;
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string | undefined>(card.imageUrl);

  useEffect(() => {
    setLoaded(false);
    setError(false);
    setCurrentSrc(card.imageUrl);
  }, [card.imageUrl]);

  const handleError = () => {
    // If low.webp failed, attempt high.webp or .png fallback
    if (currentSrc && currentSrc.includes('/low.webp')) {
      setCurrentSrc(currentSrc.replace('/low.webp', '/high.webp'));
      return;
    }
    setError(true);
  };

  const isJapanese = card.language === 'ja';

  return (
    <div className="relative aspect-[2.5/3.5] w-full overflow-hidden rounded bg-[var(--surface-sunken)] p-1">
      {/* Skeleton placeholder while loading */}
      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface-sunken)]">
          <div className="h-full w-full animate-pulse rounded bg-[var(--surface-flat)] opacity-60" />
        </div>
      )}

      {currentSrc && !error ? (
        <img
          src={currentSrc}
          alt={card.name}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={handleError}
          className={`h-full w-full object-contain transition duration-200 group-hover:scale-105 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center text-[10px] text-[var(--text-muted)]">
          <span className="font-mono text-[9px] opacity-70">#{card.localId}</span>
          <span className="truncate max-w-full text-[9px]">{card.name}</span>
        </div>
      )}

      {/* Language badge */}
      <div className="absolute right-1 top-1">
        <span
          className={`rounded px-1 py-0.2 text-[9px] font-bold uppercase tracking-wider shadow-xs ${
            isJapanese
              ? 'bg-rose-950/80 text-rose-300 border border-rose-500/30'
              : 'bg-indigo-950/80 text-indigo-300 border border-indigo-500/30'
          }`}
        >
          {isJapanese ? 'JA' : 'EN'}
        </span>
      </div>

      {isSelecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
        </div>
      )}
    </div>
  );
};

export const PokemonCardSearch = ({ onSelect }: PokemonCardSearchProps) => {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState<PokemonCardLanguage>('all');
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [results, setResults] = useState<PokemonCardSummary[]>([]);
  const [visibleCount, setVisibleCount] = useState(12);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text), 250);
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
    setVisibleCount(12);

    searchPokemonCards(query, language)
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
  }, [query, language]);

  const handleSelect = async (cardSummary: PokemonCardSummary) => {
    try {
      setLoadingDetail(cardSummary.id);
      const detail = await getPokemonCard(cardSummary.id, cardSummary.language);
      if (detail) {
        onSelect(detail);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load card details');
    } finally {
      setLoadingDetail(null);
    }
  };

  const displayedResults = results.slice(0, visibleCount);

  return (
    <div className="flex flex-col gap-3">
      {/* Search Bar & Language Switcher */}
      <div className="flex flex-col gap-2">
        <TextInput
          value={text}
          placeholder="Search card by name, set code or ID (e.g. Charizard, 151, SV2a, S12a-262)..."
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-[var(--text-muted)]">
              Language:
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setLanguage('all')}
                className={`tap rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
                  language === 'all'
                    ? 'neu-raised border border-[var(--accent)] bg-[var(--surface-raised)] text-[var(--accent)]'
                    : 'neu-sunken text-[var(--text-muted)] hover:text-[var(--text-strong)]'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`tap rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
                  language === 'en'
                    ? 'neu-raised border border-[var(--accent)] bg-[var(--surface-raised)] text-[var(--accent)]'
                    : 'neu-sunken text-[var(--text-muted)] hover:text-[var(--text-strong)]'
                }`}
              >
                English (EN)
              </button>
              <button
                type="button"
                onClick={() => setLanguage('ja')}
                className={`tap rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
                  language === 'ja'
                    ? 'neu-raised border border-[var(--accent)] bg-[var(--surface-raised)] text-[var(--accent)]'
                    : 'neu-sunken text-[var(--text-muted)] hover:text-[var(--text-strong)]'
                }`}
              >
                Japanese (JA)
              </button>
            </div>
          </div>

          {results.length > 0 && (
            <span className="text-[11px] text-[var(--text-muted)]">
              {results.length} card{results.length > 1 ? 's' : ''} found
            </span>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 px-1 text-xs text-[var(--text-muted)]">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
          <span>Searching Pokémon catalog (EN &amp; JA)…</span>
        </div>
      )}

      {error && (
        <p className="px-1 text-xs text-[var(--negative)]">{error}</p>
      )}

      {!loading && query.trim().length >= 2 && results.length === 0 && (
        <p className="px-1 text-xs text-[var(--text-muted)]">
          No cards found for &ldquo;{query}&rdquo; in {language.toUpperCase()}. Try searching by set code (e.g. 151, SV2a) or card ID.
        </p>
      )}

      {displayedResults.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
            {displayedResults.map((card) => {
              const isSelecting = loadingDetail === card.id;
              return (
                <button
                  key={`${card.language || 'en'}-${card.id}`}
                  type="button"
                  onClick={() => handleSelect(card)}
                  disabled={isSelecting}
                  className="tap group flex flex-col items-center gap-1.5 rounded-[var(--radius-field)] neu-flat p-2 text-left transition hover:border-[var(--accent)] hover:shadow-md disabled:opacity-50"
                >
                  <CardImageThumbnail card={card} isSelecting={isSelecting} />
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

          {results.length > visibleCount && (
            <button
              type="button"
              onClick={() => setVisibleCount((prev) => prev + 12)}
              className="tap self-center rounded-full bg-[var(--surface-sunken)] px-3 py-1 text-xs font-semibold text-[var(--accent)] hover:underline"
            >
              Show more cards ({results.length - visibleCount} remaining)
            </button>
          )}
        </div>
      )}
    </div>
  );
};
