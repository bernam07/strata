import { useMemo, useState } from 'react';

const palette = [
  '#5b6ee1',
  '#2fa27a',
  '#d0567b',
  '#e0a44a',
  '#7c8bff',
  '#4fb286',
  '#c4708f',
  '#5aa9c9',
];

const colorFor = (seed: string): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length]!;
};

export const StockAvatar = ({
  ticker,
  isin,
  size = 40,
}: {
  ticker: string;
  isin?: string | null;
  size?: number;
}) => {
  const symbol = (ticker.split('_')[0] ?? ticker).toUpperCase();
  const initials = symbol.slice(0, 3);

  const candidates = useMemo(() => {
    const list: string[] = [];
    if (isin) list.push(`https://assets.parqet.com/logos/isin/${isin}`);
    if (symbol) list.push(`https://assets.parqet.com/logos/symbol/${symbol}`);
    return list;
  }, [isin, symbol]);

  const [index, setIndex] = useState(0);
  const src = candidates[index];

  return (
    <div
      className="relative flex flex-none items-center justify-center overflow-hidden rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: colorFor(symbol),
        fontSize: size * 0.32,
      }}
      aria-label={symbol}
    >
      <span>{initials}</span>
      {src && (
        <img
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full bg-white object-contain"
          loading="lazy"
          onError={() => setIndex((current) => current + 1)}
        />
      )}
    </div>
  );
};
