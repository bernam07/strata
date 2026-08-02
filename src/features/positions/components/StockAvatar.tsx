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
  const symbol = ticker.split('_')[0] ?? ticker;
  const initials = symbol.slice(0, 3).toUpperCase();
  return (
    <div
      className="flex items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: colorFor(symbol),
        fontSize: size * 0.32,
      }}
      aria-hidden
    >
      {initials}
    </div>
  );
};
