import { useEffect, useState } from 'react';
import { Button } from '@/ui/Button';
import { MoneyInput, TextInput } from '@/ui/Field';
import { AmountInline } from '@/ui/Amount';
import { CardTitle } from '@/ui/Heading';
import { toast } from '@/ui/toast';
import { pct1 as pct, qty8 as qtyFmt } from '@/ui/format';
import { CoinIcon } from './CoinIcon';
import {
  useAddCrypto,
  useCoinSearch,
  useCrypto,
  useDeleteCrypto,
  type CoinHit,
} from './api/useCrypto';

export const CryptoManager = () => {
  const { data: holdings = [] } = useCrypto();
  const add = useAddCrypto();
  const remove = useDeleteCrypto();

  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<CoinHit | null>(null);
  const [quantity, setQuantity] = useState('');
  const [avgCost, setAvgCost] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setQuery(text), 300);
    return () => clearTimeout(id);
  }, [text]);

  const { data: coins = [], isFetching } = useCoinSearch(query);

  const reset = () => {
    setSelected(null);
    setText('');
    setQuery('');
    setQuantity('');
    setAvgCost('');
  };

  const submit = () => {
    if (!selected || !quantity) return;
    add.mutate(
      {
        coinId: selected.id,
        symbol: selected.symbol,
        name: selected.name,
        image: selected.image,
        quantity: Number(quantity),
        averagePrice: Number(avgCost) || 0,
      },
      {
        onSuccess: () => {
          reset();
          toast('Holding added', 'success');
        },
        onError: () => toast("Couldn't add holding", 'error'),
      },
    );
  };

  const searching = query.trim().length >= 1;

  return (
    <div className="flex flex-col gap-5">
      {holdings.length > 0 && (
        <ul className="flex flex-col gap-2">
          {holdings.map((holding) => {
            const base = holding.symbol;
            return (
              <li
                key={holding.symbol}
                className="flex items-center gap-3 rounded-[var(--radius-field)] neu-flat px-4 py-2.5"
              >
                <CoinIcon src={holding.imageUrl} ticker={base} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--text-strong)]">
                    {holding.name}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {qtyFmt.format(holding.quantity)} {base}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[var(--text-strong)]">
                    <AmountInline value={holding.valueEur} />
                  </p>
                  {holding.gainPct !== null && (
                    <p
                      className="text-xs font-semibold tabular-nums"
                      style={{
                        color:
                          holding.gainEur >= 0
                            ? 'var(--positive)'
                            : 'var(--negative)',
                      }}
                    >
                      {holding.gainEur >= 0 ? '+' : ''}
                      {pct.format(holding.gainPct)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    remove.mutate(holding.symbol, {
                      onSuccess: () => toast('Holding removed'),
                    })
                  }
                  aria-label={`Remove ${holding.name}`}
                  className="tap text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--negative)]"
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* The rule separates the add form from the holdings above it; with no
          holdings there is nothing to separate, so it would hang on its own. */}
      <div
        className={`flex flex-col gap-3 ${
          holdings.length > 0 ? 'border-t border-[var(--line)] pt-5' : ''
        }`}
      >
        <CardTitle>Add a coin</CardTitle>

        {selected ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 rounded-[var(--radius-field)] neu-flat px-4 py-2.5">
              <CoinIcon src={selected.image} ticker={selected.symbol} size={30} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--text-strong)]">
                  {selected.name}
                </p>
                <p className="text-xs text-[var(--text-muted)]">{selected.symbol}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="tap text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-strong)]"
              >
                Change
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MoneyInput
                placeholder={`Quantity (${selected.symbol})`}
                value={quantity}
                onChange={setQuantity}
              />
              <MoneyInput
                placeholder="Avg cost (optional)"
                value={avgCost}
                onChange={setAvgCost}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={submit} disabled={!quantity || add.isPending}>
                {add.isPending ? 'Adding…' : 'Add holding'}
              </Button>
              <Button variant="ghost" onClick={reset}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <TextInput
              value={text}
              placeholder="Search a coin — BTC, ETH, ADA, SOL…"
              onChange={(event) => setText(event.target.value)}
            />
            {searching && coins.length === 0 && (
              <p className="px-1 text-xs text-[var(--text-muted)]">
                {isFetching ? 'Searching…' : `No coins match “${query}”.`}
              </p>
            )}
            {coins.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {coins.map((coin) => (
                  <li key={coin.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(coin)}
                      className="tap flex w-full items-center gap-3 rounded-[var(--radius-field)] neu-flat px-3 py-2 text-left hover:border-[var(--accent)]"
                    >
                      <CoinIcon src={coin.image} ticker={coin.symbol} size={26} />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text-strong)]">
                        {coin.name}
                      </span>
                      {coin.rank !== null && (
                        <span className="shrink-0 text-[10px] text-[var(--text-muted)]">
                          #{coin.rank}
                        </span>
                      )}
                      <span className="shrink-0 text-xs font-semibold text-[var(--text-muted)]">
                        {coin.symbol}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
};
