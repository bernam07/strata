import { useState } from 'react';

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
  size = 40,
}: {
  ticker: string;
  size?: number;
}) => {
  const symbol = (ticker.split('_')[0] ?? ticker).toUpperCase();
  const initials = symbol.slice(0, 3);
  const [failed, setFailed] = useState(false);

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
      {!failed && symbol && (
        <img
          src={`https://financialmodelingprep.com/image-stock/${symbol}.png`}
          alt=""
          className="absolute inset-0 h-full w-full bg-white object-contain"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
};
