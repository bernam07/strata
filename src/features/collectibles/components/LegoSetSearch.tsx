import { useEffect, useState } from 'react';
import { TextInput } from '@/ui/Field';
import { searchLegoSets, type LegoSetResult } from '../api/lego';

interface LegoSetSearchProps {
  onSelect: (set: LegoSetResult) => void;
}

export const LegoSetSearch = ({ onSelect }: LegoSetSearchProps) => {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<LegoSetResult[]>([]);
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [rebrickableKey, setRebrickableKey] = useState(
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('strata_rebrickable_key') ?? ''
      : '',
  );

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

    searchLegoSets(query, rebrickableKey)
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

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('strata_rebrickable_key', rebrickableKey.trim());
    }
    setShowKeyConfig(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <TextInput
        value={text}
        placeholder="Pesquisar por número ou nome (ex: 75192, 10316, Rivendell, Titanic)..."
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />

      <div className="flex items-center justify-between px-1 text-[11px] text-[var(--text-muted)]">
        <span>
          💡 Sugestão: Escreve o número do set (ex: <code>10294</code>) para puxar a foto oficial.
        </span>
        <button
          type="button"
          onClick={() => setShowKeyConfig((v) => !v)}
          className="tap text-[var(--accent)] hover:underline"
        >
          {showKeyConfig ? 'Fechar chave Rebrickable' : 'Configurar chave Rebrickable'}
        </button>
      </div>

      {showKeyConfig && (
        <form
          onSubmit={handleSaveKey}
          className="flex flex-col gap-2 rounded-[var(--radius-field)] neu-sunken p-2.5 text-xs"
        >
          <p className="text-[var(--text-muted)] leading-relaxed">
            Se quiseres pesquisar todo o catálogo mundial de mais de 20.000 sets LEGO em tempo real,
            podes criar uma chave gratuita em{' '}
            <a
              href="https://rebrickable.com/api/"
              target="_blank"
              rel="noreferrer"
              className="text-[var(--accent)] underline"
            >
              rebrickable.com/api
            </a>
            .
          </p>
          <div className="flex gap-2">
            <TextInput
              placeholder="Chave de API Rebrickable (opcional)"
              value={rebrickableKey}
              onChange={(e) => setRebrickableKey(e.target.value)}
            />
            <button
              type="submit"
              className="tap shrink-0 rounded-[var(--radius-field)] bg-[var(--accent)] px-3 text-xs font-bold text-[var(--accent-ink)]"
            >
              Guardar
            </button>
          </div>
        </form>
      )}

      {loading && (
        <div className="flex items-center gap-2 px-1 text-xs text-[var(--text-muted)]">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
          <span>A pesquisar sets LEGO...</span>
        </div>
      )}

      {!loading && query.trim().length >= 2 && results.length === 0 && (
        <p className="px-1 text-xs text-[var(--text-muted)]">
          Nenhum set encontrado para “{query}”. Podes introduzir o set manualmente abaixo.
        </p>
      )}

      {results.length > 0 && (
        <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {results.map((set) => (
            <button
              key={set.setNumber}
              type="button"
              onClick={() => onSelect(set)}
              className="tap group flex items-center gap-3 rounded-[var(--radius-field)] neu-flat p-2.5 text-left transition hover:border-[var(--accent)] hover:shadow-md"
            >
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded bg-[var(--surface-sunken)] p-1">
                <img
                  src={set.imageUrl}
                  alt={set.name}
                  loading="lazy"
                  className="h-full w-full object-contain transition duration-200 group-hover:scale-105"
                  onError={(e) => {
                    // Fallback to placeholder emoji if remote image 404s
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] font-bold text-[var(--accent)]">
                    #{set.setNumber}
                  </span>
                  <span className="truncate text-[10px] text-[var(--text-muted)]">
                    {set.theme} {set.year ? `(${set.year})` : ''}
                  </span>
                </div>
                <p className="line-clamp-1 text-xs font-bold text-[var(--text-strong)] group-hover:text-[var(--accent)]">
                  {set.name}
                </p>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                  {set.pieces && <span>{set.pieces.toLocaleString()} peças</span>}
                  {set.rrpEur && (
                    <span className="font-semibold text-[var(--positive)]">
                      RRP: €{set.rrpEur.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
