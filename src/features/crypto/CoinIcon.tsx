import { useState } from 'react';
import { StockAvatar } from '@/features/positions/components/StockAvatar';

// CoinGecko gives a logo for every coin, but a holding added before the switch
// has none stored yet and a URL can always fail to load — fall back to the
// lettered avatar the rest of the app uses rather than leaving a gap.
export const CoinIcon = ({
  src,
  ticker,
  size = 30,
}: {
  src: string | null;
  ticker: string;
  size?: number;
}) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) return <StockAvatar ticker={ticker} size={size} />;

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className="shrink-0 rounded-full bg-[var(--surface-sunken)] object-cover"
      style={{ width: size, height: size }}
    />
  );
};
