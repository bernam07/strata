import { Link } from 'react-router-dom';
import { pct1 as percent } from '@/ui/format';
import { formatEur, isNegative, zero } from '@/core/money/money';
import type { Position } from '@/core/positions/derivePositions';
import { StockAvatar } from '@/features/positions/components/StockAvatar';
import type { InstrumentMeta } from '@/features/positions/api/usePositions';

const MoverRow = ({
  position,
  meta,
  useDay,
}: {
  position: Position;
  meta: InstrumentMeta | undefined;
  useDay: boolean;
}) => {
  const value = (useDay ? position.dayChange : position.unrealized) ?? zero();
  const pct = useDay ? position.dayChangePct : position.unrealizedPct;
  const down = isNegative(value);
  const color = down ? 'var(--negative)' : 'var(--positive)';
  return (
    <Link
      to={`/positions/${position.instrumentId}`}
      className="tap flex items-center gap-3 rounded-[var(--radius-field)] px-1 py-1.5 hover:bg-[var(--surface-flat)]"
    >
      <StockAvatar
        ticker={meta?.ticker ?? position.instrumentId}
        isin={meta?.isin}
        size={30}
      />
      <span className="flex-1 truncate text-sm font-semibold text-[var(--text-strong)]">
        {meta?.name ?? meta?.ticker ?? 'Instrument'}
      </span>
      <div className="text-right">
        <p className="text-sm font-semibold tabular-nums" style={{ color }}>
          {pct !== null ? `${down ? '' : '+'}${percent.format(pct)}` : '—'}
        </p>
        <p className="text-[11px] tabular-nums text-[var(--text-muted)]">
          {formatEur(value)}
        </p>
      </div>
    </Link>
  );
};

export const Movers = ({
  positions,
  instruments,
}: {
  positions: Position[];
  instruments: Map<string, InstrumentMeta>;
}) => {
  const useDay = positions.some((position) => position.dayChangePct !== null);
  const metric = (position: Position) =>
    useDay ? position.dayChangePct : position.unrealizedPct;

  const ranked = positions
    .filter((position) => metric(position) !== null)
    .sort((a, b) => (metric(b) ?? 0) - (metric(a) ?? 0));
  if (ranked.length < 2) return null;

  const gainers = ranked.filter((p) => (metric(p) ?? 0) > 0).slice(0, 3);
  const losers = ranked
    .filter((p) => (metric(p) ?? 0) < 0)
    .slice(-3)
    .reverse();

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {gainers.length > 0 && (
        <div className="rounded-[var(--radius-card)] neu-flat p-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--positive)]">
            {useDay ? 'Up today' : 'Leaders'}
          </p>
          <div className="flex flex-col gap-0.5">
            {gainers.map((position) => (
              <MoverRow
                key={position.instrumentId}
                position={position}
                meta={instruments.get(position.instrumentId)}
                useDay={useDay}
              />
            ))}
          </div>
        </div>
      )}
      {losers.length > 0 && (
        <div className="rounded-[var(--radius-card)] neu-flat p-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--negative)]">
            {useDay ? 'Down today' : 'Laggards'}
          </p>
          <div className="flex flex-col gap-0.5">
            {losers.map((position) => (
              <MoverRow
                key={position.instrumentId}
                position={position}
                meta={instruments.get(position.instrumentId)}
                useDay={useDay}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
