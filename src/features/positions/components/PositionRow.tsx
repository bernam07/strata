import { Link } from 'react-router-dom';
import { isNegative, toNumber } from '@/core/money/money';
import type { Position } from '@/core/positions/derivePositions';
import { AmountInline } from '@/ui/Amount';
import { Surface } from '@/ui/Surface';
import type { InstrumentMeta } from '../api/usePositions';
import { StockAvatar } from './StockAvatar';
import { pct1 as percent, qty4 as quantityFormat } from '@/ui/format';

export const PositionRow = ({
  position,
  instrument,
  weight,
}: {
  position: Position;
  instrument: InstrumentMeta | undefined;
  weight?: number;
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
            <AmountInline value={toNumber(position.averageCost)} /> avg
          </p>
          {weight !== undefined && (
            <p className="text-[11px] font-semibold text-[var(--accent)]">
              {percent.format(weight)} of portfolio
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-[var(--text-strong)]">
            <AmountInline
              value={toNumber(position.marketValue ?? position.costBasis)}
            />
          </p>
          {gain && (
            <p className="text-xs font-semibold" style={{ color }}>
              <AmountInline value={toNumber(gain)} signed />
              {position.unrealizedPct !== null &&
                ` · ${percent.format(position.unrealizedPct)}`}
            </p>
          )}
        </div>
      </Surface>
    </Link>
  );
};
