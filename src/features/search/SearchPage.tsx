import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { TextInput } from '@/ui/Field';
import { SkeletonRows } from '@/ui/Skeleton';
import { StockAvatar } from '@/features/positions/components/StockAvatar';
import { PriceChart } from '@/features/positions/PriceChart';
import { RangeTabs } from '@/features/positions/RangeTabs';
import { usePersistentState } from '@/app/usePersistentState';
import {
  useQuote,
  useStockSearch,
  useToggleWatch,
  useWatchlist,
} from './api/useMarket';

const QuotePanel = ({
  symbol,
  name,
  onBack,
}: {
  symbol: string;
  name: string;
  onBack: () => void;
}) => {
  const [range, setRange] = usePersistentState('chart-range', '1y');
  const { data, isLoading } = useQuote(symbol, range);
  const { data: watchlist = [] } = useWatchlist();
  const toggle = useToggleWatch();

  const watched = watchlist.some((w) => w.symbol === symbol);
  const q = data?.quote;
  const dayPct =
    q && q.previousClose > 0 ? (q.price - q.previousClose) / q.previousClose : 0;

  const money = (n: number) =>
    new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: q?.currency ?? 'USD',
      maximumFractionDigits: 2,
    }).format(n);

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={onBack}
        className="tap self-start text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-strong)]"
      >
        ← Back
      </button>
      <Card className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <StockAvatar ticker={symbol} size={48} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-[var(--text-strong)]">
              {name}
            </h1>
            <p className="text-xs text-[var(--text-muted)]">{symbol}</p>
          </div>
          <Button
            variant="ghost"
            disabled={toggle.isPending}
            onClick={() =>
              toggle.mutate({
                item: { symbol, name, currency: q?.currency ?? 'USD' },
                watched,
              })
            }
          >
            {watched ? 'Watching ✓' : 'Watch'}
          </Button>
        </div>

        {isLoading ? (
          <SkeletonRows count={2} />
        ) : q ? (
          <>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold tabular-nums text-[var(--text-strong)]">
                {money(q.price)}
              </span>
              <span
                className="text-sm font-semibold tabular-nums"
                style={{ color: dayPct >= 0 ? 'var(--positive)' : 'var(--negative)' }}
              >
                {dayPct >= 0 ? '▲ ' : '▼ '}
                {(dayPct * 100).toFixed(2)}% today
              </span>
            </div>
            {data?.history && data.history.length >= 2 && (
              <div className="flex flex-col gap-3">
                <PriceChart points={data.history} currency={q.currency} />
                <RangeTabs value={range} onChange={setRange} />
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            {data?.error ?? 'No data for this symbol.'}
          </p>
        )}
      </Card>
    </div>
  );
};

export const SearchPage = () => {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<{ symbol: string; name: string } | null>(
    null,
  );

  useEffect(() => {
    const id = setTimeout(() => setQuery(text), 300);
    return () => clearTimeout(id);
  }, [text]);

  const { data: results = [], isLoading, isError, error } = useStockSearch(query);
  const { data: watchlist = [] } = useWatchlist();

  const showWatchlist = useMemo(
    () => query.trim().length < 2,
    [query],
  );

  if (selected) {
    return (
      <QuotePanel
        symbol={selected.symbol}
        name={selected.name}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
          Search
        </h1>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">
          Look up any stock or ETF — even ones you don't own.
        </p>
      </div>

      <TextInput
        value={text}
        placeholder="Search by name or ticker (e.g. Apple, NVDA)"
        onChange={(event) => setText(event.target.value)}
      />

      {showWatchlist ? (
        watchlist.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h2 className="px-0.5 text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              Watchlist
            </h2>
            {watchlist.map((item) => (
              <button
                key={item.symbol}
                type="button"
                className="tap flex w-full items-center gap-4 rounded-[var(--radius-card)] neu-flat p-4 text-left hover:border-[var(--accent)]"
                onClick={() =>
                  setSelected({ symbol: item.symbol, name: item.name })
                }
              >
                <StockAvatar ticker={item.symbol} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-[var(--text-strong)]">
                    {item.name}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">{item.symbol}</p>
                </div>
                <span className="text-[var(--text-muted)]">›</span>
              </button>
            ))}
          </section>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            Search for a stock to see its price and chart, or add it to your
            watchlist.
          </p>
        )
      ) : isLoading ? (
        <SkeletonRows count={4} />
      ) : isError ? (
        <p className="text-sm text-[var(--negative)]">
          {error instanceof Error ? error.message : 'Search failed. Try again.'}
        </p>
      ) : results.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No matches.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {results.map((result) => (
            <button
              key={result.symbol}
              type="button"
              className="tap flex w-full items-center gap-4 rounded-[var(--radius-card)] neu-flat p-4 text-left hover:border-[var(--accent)]"
              onClick={() =>
                setSelected({ symbol: result.symbol, name: result.name })
              }
            >
              <StockAvatar ticker={result.symbol} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-[var(--text-strong)]">
                  {result.name}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {result.symbol} · {result.exchange}
                </p>
              </div>
              <span className="text-[var(--text-muted)]">›</span>
            </button>
          ))}
        </ul>
      )}
    </div>
  );
};
