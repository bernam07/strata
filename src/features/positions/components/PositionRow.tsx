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
  metricMode = 'all',
}: {
  position: Position;
  instrument: InstrumentMeta | undefined;
  weight?: number;
  metricMode?: 'all' | 'today';
}) => {
  const activeGain =
    metricMode === 'today' ? position.dayChange : position.unrealized;
  const activePct =
    metricMode === 'today' ? position.dayChangePct : position.unrealizedPct;
  const negative = activeGain ? isNegative(activeGain) : false;
  const color = activeGain
    ? negative
      ? 'var(--negative)'
      : 'var(--positive)'
    : 'var(--text-muted)';

  return (
    <Link to={`/positions/${position.instrumentId}`}>
      <Surface
        elevation="flat"
        className="tap relative flex flex-col gap-2.5 overflow-hidden p-4 hover:border-[var(--accent)]"
      >
        <div className="flex items-center gap-3.5">
          <StockAvatar
            ticker={instrument?.ticker ?? position.instrumentId}
            isin={instrument?.isin}
            size={38}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <p className="truncate font-semibold text-[var(--text-strong)]">
                {instrument?.name ?? instrument?.ticker ?? 'Instrument'}
              </p>
              {weight !== undefined && weight > 0 && (
                <span className="shrink-0 rounded-full bg-[var(--surface-sunken)] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--text-muted)]">
                  {percent.format(weight)}
                </span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
              {quantityFormat.format(position.quantity.toNumber())} sh ·{' '}
              <AmountInline value={toNumber(position.averageCost)} /> avg
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold tabular-nums text-[var(--text-strong)]">
              <AmountInline
                value={toNumber(position.marketValue ?? position.costBasis)}
              />
            </p>
            {activeGain ? (
              <p className="mt-0.5 text-xs font-semibold tabular-nums" style={{ color }}>
                <AmountInline value={toNumber(activeGain)} signed />
                {activePct !== null && ` · ${percent.format(activePct)}`}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {metricMode === 'today' ? 'No change today' : '—'}
              </p>
            )}
          </div>
        </div>

        {weight !== undefined && weight > 0 && (
          <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.max(2.5, Math.min(100, weight * 100))}%`,
                background: 'var(--accent)',
              }}
            />
          </div>
        )}
      </Surface>
    </Link>
  );
};
