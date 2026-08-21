import { Link } from 'react-router-dom';
import { formatEur, isNegative } from '@/core/money/money';
import type { Position } from '@/core/positions/derivePositions';
import { Surface } from '@/ui/Surface';
import type { InstrumentMeta } from '../api/usePositions';
import { StockAvatar } from './StockAvatar';
import { pct1 as percent, qty4 as quantityFormat } from '@/ui/format';

export const PositionRow = ({
  position,
  instrument,
}: {
  position: Position;
  instrument: InstrumentMeta | undefined;
}) => {
  const gain = position.unrealized;
  const negative = gain ? isNegative(gain) : false;
  const color = gain
    ? negative
      ? 'var(--negative)'
      : 'var(--positive)'
    : 'var(--text-muted)';

  return (
    <Link to={`/positions/${position.instrumentId}`}>
      <Surface
        elevation="flat"
        className="tap flex items-center gap-4 p-4 hover:border-[var(--accent)]"
      >
        <StockAvatar
          ticker={instrument?.ticker ?? position.instrumentId}
          isin={instrument?.isin}
          size={38}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-[var(--text-strong)]">
            {instrument?.name ?? instrument?.ticker ?? 'Instrument'}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {quantityFormat.format(position.quantity.toNumber())} sh ·{' '}
            {formatEur(position.averageCost)} avg
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums text-[var(--text-strong)]">
            {position.marketValue
              ? formatEur(position.marketValue)
              : formatEur(position.costBasis)}
          </p>
          {gain && (
            <p className="text-xs font-semibold tabular-nums" style={{ color }}>
              {formatEur(gain)}
              {position.unrealizedPct !== null &&
                ` · ${percent.format(position.unrealizedPct)}`}
            </p>
          )}
        </div>
      </Surface>
    </Link>
  );
};
