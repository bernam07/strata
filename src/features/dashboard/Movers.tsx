import { Link } from 'react-router-dom';
import { formatEur, isNegative, zero } from '@/core/money/money';
import type { Position } from '@/core/positions/derivePositions';
import { StockAvatar } from '@/features/positions/components/StockAvatar';
import type { InstrumentMeta } from '@/features/positions/api/usePositions';

const percent = new Intl.NumberFormat('en-GB', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const MoverRow = ({
  position,
  meta,
}: {
  position: Position;
  meta: InstrumentMeta | undefined;
}) => {
  const unrealized = position.unrealized ?? zero();
  const down = isNegative(unrealized);
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
          {position.unrealizedPct !== null
            ? `${down ? '' : '+'}${percent.format(position.unrealizedPct)}`
            : '—'}
        </p>
        <p className="text-[11px] tabular-nums text-[var(--text-muted)]">
          {formatEur(unrealized)}
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
  const ranked = positions
    .filter((position) => position.unrealizedPct !== null)
    .sort((a, b) => (b.unrealizedPct ?? 0) - (a.unrealizedPct ?? 0));
  if (ranked.length < 2) return null;

  const gainers = ranked.filter((p) => (p.unrealizedPct ?? 0) > 0).slice(0, 3);
  const losers = ranked
    .filter((p) => (p.unrealizedPct ?? 0) < 0)
    .slice(-3)
    .reverse();

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {gainers.length > 0 && (
        <div className="rounded-[var(--radius-card)] neu-flat p-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--positive)]">
            Leaders
          </p>
          <div className="flex flex-col gap-0.5">
            {gainers.map((position) => (
              <MoverRow
                key={position.instrumentId}
                position={position}
                meta={instruments.get(position.instrumentId)}
              />
            ))}
          </div>
        </div>
      )}
      {losers.length > 0 && (
        <div className="rounded-[var(--radius-card)] neu-flat p-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--negative)]">
            Laggards
          </p>
          <div className="flex flex-col gap-0.5">
            {losers.map((position) => (
              <MoverRow
                key={position.instrumentId}
                position={position}
                meta={instruments.get(position.instrumentId)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
