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

const PAGE_SIZE = 36;

const CardImageThumbnail = ({
  card,
  isSelecting,
}: {
  card: PokemonCardSummary;
  isSelecting: boolean;
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [currentSrc, setCurrentSrc] = useState<string | undefined>(card.imageUrl);

  useEffect(() => {
    setLoaded(false);
    setError(false);
    setAttempt(0);
    setCurrentSrc(card.imageUrl);
  }, [card.imageUrl]);

  const handleError = () => {
    // If low.webp failed, attempt high.webp
    if (attempt === 0 && currentSrc && currentSrc.includes('/low.webp')) {
      setAttempt(1);
      setCurrentSrc(currentSrc.replace('/low.webp', '/high.webp'));
      return;
    }
    // Fallback for English cards to pokemontcg.io if TCGdex assets are unreachable
    if (attempt < 2 && card.language === 'en' && card.setId) {
      const pioSetId = card.setId.replace('.', '').toLowerCase();
      const pioUrl = `https://images.pokemontcg.io/${pioSetId}/${card.localId}.png`;
      if (currentSrc !== pioUrl) {
        setAttempt(2);
        setCurrentSrc(pioUrl);
        return;
      }
    }
    setError(true);
  };

  const isJapanese = card.language === 'ja';

  return (
    <div className="relative aspect-[2.5/3.5] w-full overflow-hidden rounded-md bg-[var(--surface-sunken)] p-1">
      {/* Skeleton placeholder while image is downloading */}
      {!loaded && !error && currentSrc && (
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
        /* Stylized Collectible Pokémon Card Frame Placeholder */
        <div className="relative flex h-full w-full flex-col items-center justify-between overflow-hidden rounded border border-[var(--border-subtle)] bg-gradient-to-b from-[var(--surface-raised)] to-[var(--surface-sunken)] p-2 text-center select-none shadow-inner">
          <div className="flex w-full items-center justify-between text-[8px] font-mono text-[var(--text-muted)]">
            <span className="truncate max-w-[50px] font-bold uppercase">{card.setId || 'TCG'}</span>
            <span>#{card.localId}</span>
          </div>

          <div className="relative my-auto flex flex-col items-center justify-center">
            {/* Pokéball watermark */}
            <svg
              className="h-10 w-10 text-[var(--text-muted)] opacity-20"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="6" />
              <line x1="5" y1="50" x2="95" y2="50" stroke="currentColor" strokeWidth="6" />
              <circle cx="50" cy="50" r="16" fill="var(--surface-sunken)" stroke="currentColor" strokeWidth="6" />
              <circle cx="50" cy="50" r="8" fill="currentColor" />
            </svg>
            <span className="mt-1 line-clamp-2 px-0.5 text-[9px] font-bold leading-tight text-[var(--text-strong)]">
              {card.name}
            </span>
          </div>

          <div className="flex w-full items-center justify-center">
            <span className="rounded bg-[var(--surface-flat)] px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              No Official Scan
            </span>
          </div>
        </div>
      )}

      {/* Language badge */}
      <div className="absolute right-1 top-1 z-10">
        <span
          className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider shadow-sm ${
            isJapanese
              ? 'bg-rose-950/90 text-rose-300 border border-rose-500/40'
              : 'bg-sky-950/90 text-sky-300 border border-sky-500/40'
          }`}
        >
          {isJapanese ? 'JA · Japanese' : 'EN · English'}
        </span>
      </div>

      {isSelecting && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-xs">
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
  const [displayLimit, setDisplayLimit] = useState(PAGE_SIZE);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text), 250);
    return () => clearTimeout(timer);
  }, [text]);

  useEffect(() => {
    setDisplayLimit(PAGE_SIZE);
  }, [query, language]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

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

  const visibleResults = results.slice(0, displayLimit);
  const hasMore = results.length > displayLimit;

  const enCount = results.filter((r) => r.language === 'en').length;
  const jaCount = results.filter((r) => r.language === 'ja').length;

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

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
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
                All{results.length > 0 && language === 'all' ? ` (${results.length})` : ''}
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`tap rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
                  language === 'en'
                    ? 'neu-raised border border-sky-500 bg-[var(--surface-raised)] text-sky-400 font-bold'
                    : 'neu-sunken text-[var(--text-muted)] hover:text-[var(--text-strong)]'
                }`}
              >
                English (EN){language === 'all' && enCount > 0 ? ` (${enCount})` : ''}
              </button>
              <button
                type="button"
                onClick={() => setLanguage('ja')}
                className={`tap rounded-md px-2 py-0.5 text-[11px] font-semibold transition ${
                  language === 'ja'
                    ? 'neu-raised border border-rose-500 bg-[var(--surface-raised)] text-rose-400 font-bold'
                    : 'neu-sunken text-[var(--text-muted)] hover:text-[var(--text-strong)]'
                }`}
              >
                Japanese (JA){language === 'all' && jaCount > 0 ? ` (${jaCount})` : ''}
              </button>
            </div>
          </div>

          {results.length > 0 && (
            <span className="text-[11px] text-[var(--text-muted)]">
              Showing {visibleResults.length} of {results.length} cards
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

      {results.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <div className="grid max-h-[460px] sm:max-h-[520px] grid-cols-2 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4">
            {visibleResults.map((card) => {
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
                    <div className="mt-0.5 flex items-center justify-center gap-1.5 text-[10px]">
                      <span className="font-mono text-[10px] text-[var(--text-muted)] truncate max-w-[80px]">
                        {card.setId ? `${card.setId} · ` : ''}#{card.localId}
                      </span>
                      <span
                        className={`rounded px-1 py-0.2 text-[8px] font-bold uppercase tracking-wider shrink-0 ${
                          card.language === 'ja'
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            : 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                        }`}
                      >
                        {card.language === 'ja' ? 'JA' : 'EN'}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => setDisplayLimit((prev) => prev + PAGE_SIZE)}
                className="tap flex items-center gap-1.5 rounded-lg neu-raised px-4 py-2 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--surface-raised)]"
              >
                <span>
                  Show more cards (+{Math.min(PAGE_SIZE, results.length - displayLimit)} remaining)
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

