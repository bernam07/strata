import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatEur, isNegative, money } from '@/core/money/money';
import { useTransactions } from '@/features/transactions/api/useTransactions';
import { TransactionList } from '@/features/transactions/components/TransactionList';
import { Card } from '@/ui/Card';
import { SkeletonRows } from '@/ui/Skeleton';
import { useInstrumentQuote } from '@/features/search/api/useMarket';
import { usePositions, useInstrumentPrices } from './api/usePositions';
import { PriceChart } from './PriceChart';
import { RangeTabs } from './RangeTabs';
import { StockAvatar } from './components/StockAvatar';

const percent = new Intl.NumberFormat('en-GB', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const quantity = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 4 });

const Stat = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <div className="rounded-[var(--radius-field)] neu-sunken p-4">
    <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
      {label}
    </p>
    <p
      className="mt-1 text-lg font-bold tabular-nums"
      style={{ color: color ?? 'var(--text-strong)' }}
    >
      {value}
    </p>
  </div>
);

export const InstrumentDetailPage = () => {
  const { id = '' } = useParams();
  const positionsQuery = usePositions();
  const { data: transactions = [], isLoading } = useTransactions({
    instrumentId: id,
  });
  const { data: prices = [] } = useInstrumentPrices(id);

  const [range, setRange] = useState('1y');
  const instrument = positionsQuery.data?.instruments.get(id);
  const liveQuote = useInstrumentQuote(
    instrument
      ? {
          isin: instrument.isin,
          ticker: instrument.ticker,
          yahoo: instrument.yahoo_symbol,
        }
      : null,
    range,
  );
  const position = useMemo(
    () => positionsQuery.data?.positions.find((entry) => entry.instrumentId === id),
    [positionsQuery.data, id],
  );

  const liveHistory = liveQuote.data?.history ?? [];
  const chartPoints = [...(liveHistory.length >= 2 ? liveHistory : prices)].sort(
    (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0),
  );
  const chartCurrency =
    liveQuote.data?.quote?.currency ?? instrument?.currency ?? 'EUR';
  const usingLive = liveHistory.length >= 2;
  const liveError = usingLive
    ? null
    : liveQuote.data?.error ??
      (liveQuote.isError && liveQuote.error instanceof Error
        ? liveQuote.error.message
        : null);

  const instrumentsMap = positionsQuery.data?.instruments;
  const dividends = transactions.filter((t) => t.kind === 'dividend');
  const dividendTotal = dividends.reduce(
    (sum, t) => sum.plus(money(t.amount)),
    money('0'),
  );

  const gain = position?.unrealized ?? null;
  const gainColor = gain
    ? isNegative(gain)
      ? 'var(--negative)'
      : 'var(--positive)'
    : 'var(--text-muted)';

  return (
    <div className="flex flex-col gap-8">
      <Link
        to="/positions"
        className="tap text-sm font-semibold text-[var(--text-muted)] hover:text-[var(--text-strong)]"
      >
        ← Positions
      </Link>

      <Card className="flex items-center gap-4">
        <StockAvatar
          ticker={instrument?.ticker ?? id}
          isin={instrument?.isin}
          size={52}
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold text-[var(--text-strong)]">
            {instrument?.name ?? instrument?.ticker ?? 'Instrument'}
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            {instrument?.ticker}
            {instrument?.isin ? ` · ${instrument.isin}` : ''}
          </p>
        </div>
        {position?.dayChange && position.dayChangePct !== null && (
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
              Today
            </p>
            <p
              className="text-sm font-bold tabular-nums"
              style={{
                color: isNegative(position.dayChange)
                  ? 'var(--negative)'
                  : 'var(--positive)',
              }}
            >
              {percent.format(position.dayChangePct)}
            </p>
          </div>
        )}
      </Card>

      {position && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Shares" value={quantity.format(position.quantity.toNumber())} />
          <Stat label="Avg cost" value={formatEur(position.averageCost)} />
          <Stat
            label="Market value"
            value={formatEur(position.marketValue ?? position.costBasis)}
          />
          <Stat
            label="Unrealized"
            value={
              gain
                ? `${formatEur(gain)}${position.unrealizedPct !== null ? ` · ${percent.format(position.unrealizedPct)}` : ''}`
                : '—'
            }
            color={gainColor}
          />
        </div>
      )}

      {chartPoints.length >= 2 ? (
        <Card className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Price
            </p>
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
              {usingLive ? 'live' : 'stored'}
            </p>
          </div>
          <PriceChart points={chartPoints} currency={chartCurrency} />
          {usingLive && <RangeTabs value={range} onChange={setRange} />}
          {liveError && (
            <p className="text-[11px] text-[var(--text-muted)]">
              Live chart unavailable · {liveError}
            </p>
          )}
        </Card>
      ) : liveError ? (
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Price
          </p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Chart unavailable · {liveError}
          </p>
        </Card>
      ) : null}

      {dividends.length > 0 && (
        <Card className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Dividends received
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--positive)]">
              {formatEur(dividendTotal)}
            </p>
          </div>
          <p className="text-xs text-[var(--text-muted)]">{dividends.length} payments</p>
        </Card>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="px-0.5 text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          History
        </h2>
        {isLoading ? (
          <SkeletonRows count={4} />
        ) : (
          <TransactionList
            transactions={transactions}
            accounts={[]}
            instruments={instrumentsMap}
            showAccount={false}
            instrumentView
          />
        )}
      </div>
    </div>
  );
};
