import { Link } from 'react-router-dom';
import { formatEur, isNegative, money, sum, zero } from '@/core/money/money';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Surface } from '@/ui/Surface';
import { SkeletonRows } from '@/ui/Skeleton';
import { usePositions, type InstrumentMeta } from './api/usePositions';
import { useRefreshPrices } from '@/features/search/api/useMarket';
import { StockAvatar } from './components/StockAvatar';
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

export const PositionsPage = () => {
  const { data, isLoading } = usePositions();
  const refresh = useRefreshPrices();

  const positions = data?.positions ?? [];
  const totalMarket = sum(
    positions.map((position) => position.marketValue ?? position.costBasis),
  );
  const totalCost = sum(positions.map((position) => position.costBasis));
  const totalGain = totalMarket.minus(totalCost);
  const gainNegative = isNegative(totalGain);

  const totalMarketNumber = totalMarket.toNumber();
  const allocation = positions
    .map((position) => ({
      instrumentId: position.instrumentId,
      value: (position.marketValue ?? position.costBasis).toNumber(),
    }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
    .map((entry) => ({
      ...entry,
      weight: totalMarketNumber > 0 ? entry.value / totalMarketNumber : 0,
    }));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
          Positions
        </h1>
        {positions.length > 0 && (
          <Button
            variant="ghost"
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
          >
            {refresh.isPending ? 'Refreshing…' : 'Refresh prices'}
          </Button>
        )}
      </div>

      {refresh.isError && (
        <p className="text-sm text-[var(--negative)]">
          Couldn't refresh prices. Try again in a moment.
        </p>
      )}

      {isLoading ? (
        <SkeletonRows count={4} />
      ) : positions.length === 0 ? (
        <Card className="flex flex-col items-start gap-4">
          <p className="text-sm text-[var(--text-muted)]">
            No open positions yet. Connect Trading 212 to import your holdings.
          </p>
          <Link to="/integrations">
            <Button>Go to Integrations</Button>
          </Link>
        </Card>
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

          {allocation.length > 1 && (
            <Card className="flex flex-col gap-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Allocation
              </h2>
              {allocation.map((entry) => {
                const meta = data?.instruments.get(entry.instrumentId);
                return (
                  <div key={entry.instrumentId} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-semibold text-[var(--text-strong)]">
                        {meta?.name ?? meta?.ticker ?? 'Instrument'}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">
                        {percent.format(entry.weight)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full neu-sunken">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${entry.weight * 100}%`,
                          background: 'var(--accent)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </Card>
          )}

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
