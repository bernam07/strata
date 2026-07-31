import { formatEur, isNegative, money, sum, zero } from '@/core/money/money';
import { Card } from '@/ui/Card';
import { Surface } from '@/ui/Surface';
import { usePositions, type InstrumentMeta } from './api/usePositions';
import type { Position } from '@/core/positions/derivePositions';

const percent = new Intl.NumberFormat('en-GB', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const quantityFormat = new Intl.NumberFormat('en-GB', {
  maximumFractionDigits: 4,
});

const PositionRow = ({
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
    <Surface elevation="flat" className="flex items-center gap-4 p-4">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-[var(--text-strong)]">
          {instrument?.name ?? instrument?.ticker ?? 'Instrumento'}
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
  );
};

export const PositionsPage = () => {
  const { data, isLoading } = usePositions();

  const positions = data?.positions ?? [];
  const totalMarket = sum(
    positions.map((position) => position.marketValue ?? position.costBasis),
  );
  const totalCost = sum(positions.map((position) => position.costBasis));
  const totalGain = totalMarket.minus(totalCost);
  const gainNegative = isNegative(totalGain);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
        Positions
      </h1>

      {isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">Loading…</p>
      ) : positions.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">
          No open positions. Sync Trading 212 under Integrations.
        </p>
      ) : (
        <>
          <Card className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Market value
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-[var(--text-strong)]">
                {formatEur(totalMarket)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[var(--text-muted)]">Unrealized gain</p>
              <p
                className="mt-1 text-lg font-semibold tabular-nums"
                style={{
                  color: totalGain.equals(zero())
                    ? 'var(--text-muted)'
                    : gainNegative
                      ? 'var(--negative)'
                      : 'var(--positive)',
                }}
              >
                {formatEur(totalGain)}
              </p>
            </div>
          </Card>

          <div className="flex flex-col gap-2">
            {positions
              .slice()
              .sort((a, b) =>
                money(b.marketValue ?? b.costBasis)
                  .minus(a.marketValue ?? a.costBasis)
                  .toNumber(),
              )
              .map((position) => (
                <PositionRow
                  key={position.instrumentId}
                  position={position}
                  instrument={data?.instruments.get(position.instrumentId)}
                />
              ))}
          </div>
        </>
      )}
    </div>
  );
};
