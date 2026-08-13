import { useEffect, useMemo, useState } from 'react';
import { useStockSearch } from '@/features/search/api/useMarket';
import { StockAvatar } from '@/features/positions/components/StockAvatar';
import { Button } from '@/ui/Button';
import { MoneyInput, TextInput } from '@/ui/Field';
import { useAddCrypto, useCrypto, useDeleteCrypto } from './api/useCrypto';

const eur = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
});
const pct = new Intl.NumberFormat('en-GB', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const qtyFmt = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 8 });

export const CryptoManager = () => {
  const { data: holdings = [] } = useCrypto();
  const add = useAddCrypto();
  const remove = useDeleteCrypto();

  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<{ symbol: string; name: string } | null>(
    null,
  );
  const [quantity, setQuantity] = useState('');
  const [avgCost, setAvgCost] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setQuery(text), 300);
    return () => clearTimeout(id);
  }, [text]);

  const { data: results = [] } = useStockSearch(query);
  const cryptoResults = useMemo(
    () => results.filter((result) => result.type === 'CRYPTOCURRENCY').slice(0, 6),
    [results],
  );

  const submit = () => {
    if (!selected || !quantity) return;
    add.mutate(
      {
        symbol: selected.symbol,
        name: selected.name,
        quantity: Number(quantity),
        averagePrice: Number(avgCost) || 0,
      },
      {
        onSuccess: () => {
          setSelected(null);
          setText('');
          setQuery('');
          setQuantity('');
          setAvgCost('');
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {holdings.length > 0 && (
        <ul className="flex flex-col gap-2">
          {holdings.map((holding) => (
            <li
              key={holding.symbol}
              className="flex items-center gap-3 rounded-[var(--radius-field)] neu-flat px-4 py-2.5"
            >
              <StockAvatar ticker={holding.symbol.split('-')[0] ?? holding.symbol} size={30} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--text-strong)]">
                  {holding.name}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {qtyFmt.format(holding.quantity)} · {holding.symbol}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums text-[var(--text-strong)]">
                  {eur.format(holding.valueEur)}
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
                onClick={() => remove.mutate(holding.symbol)}
                className="tap text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--negative)]"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-3 border-t border-[var(--line)] pt-4">
        {selected ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <StockAvatar ticker={selected.symbol.split('-')[0] ?? selected.symbol} size={30} />
              <span className="flex-1 truncate text-sm font-semibold text-[var(--text-strong)]">
                {selected.name}
              </span>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="tap text-xs font-semibold text-[var(--text-muted)]"
              >
                Change
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MoneyInput placeholder="Quantity" value={quantity} onChange={setQuantity} />
              <MoneyInput placeholder="Avg cost (opt.)" value={avgCost} onChange={setAvgCost} />
            </div>
            <div>
              <Button onClick={submit} disabled={!quantity || add.isPending}>
                {add.isPending ? 'Adding…' : 'Add holding'}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <TextInput
              value={text}
              placeholder="Search a coin (Bitcoin, ETH…)"
              onChange={(event) => setText(event.target.value)}
            />
            {cryptoResults.map((result) => (
              <button
                key={result.symbol}
                type="button"
                onClick={() =>
                  setSelected({ symbol: result.symbol, name: result.name })
                }
                className="tap flex items-center gap-3 rounded-[var(--radius-field)] neu-flat px-3 py-2 text-left"
              >
                <StockAvatar ticker={result.symbol.split('-')[0] ?? result.symbol} size={26} />
                <span className="flex-1 truncate text-sm font-semibold text-[var(--text-strong)]">
                  {result.name}
                </span>
                <span className="text-xs text-[var(--text-muted)]">{result.symbol}</span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
};
