import { useMemo } from 'react';
import { pct1 as percent, qty4 as quantity } from '@/ui/format';
import { Link, useParams } from 'react-router-dom';
import { usePersistentState } from '@/app/usePersistentState';
import { isNegative, money, toNumber } from '@/core/money/money';
import { AmountInline } from '@/ui/Amount';
import { Stat } from '@/ui/Stat';
import { useTransactions } from '@/features/transactions/api/useTransactions';
import { TransactionList } from '@/features/transactions/components/TransactionList';
import { Card } from '@/ui/Card';
import { SkeletonRows } from '@/ui/Skeleton';
import {
  useInstrumentProfile,
  useInstrumentQuote,
} from '@/features/search/api/useMarket';
import {
  isSanePrice,
  usePositions,
  useInstrumentPrices,
  useHolding,
} from './api/usePositions';
import { PriceChart, type ChartTradeMarker } from './PriceChart';
import { RangeTabs } from './RangeTabs';
import { StockAvatar } from './components/StockAvatar';
import { InstrumentFacts } from './components/InstrumentFacts';

const nativeMoney = (value: number, currency: string): string =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export const InstrumentDetailPage = () => {
  const { id = '' } = useParams();
  const positionsQuery = usePositions();
  const { data: transactions = [], isLoading } = useTransactions({
    instrumentId: id,
  });
  const { data: prices = [] } = useInstrumentPrices(id);
  const { data: holding } = useHolding(id);

  const [range, setRange] = usePersistentState('chart-range', '1y');
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
  const profile = useInstrumentProfile(
    instrument
      ? {
          isin: instrument.isin,
          ticker: instrument.ticker,
          yahoo: instrument.yahoo_symbol,
        }
      : null,
  );
  const position = useMemo(
    () => positionsQuery.data?.positions.find((entry) => entry.instrumentId === id),
    [positionsQuery.data, id],
  );

  const refAvgPrice =
    holding?.averagePrice ?? (position ? toNumber(position.averageCost) : 0);
  const rawLivePrice = liveQuote.data?.quote?.price;
  const liveQuoteIsSane =
    rawLivePrice !== undefined ? isSanePrice(rawLivePrice, refAvgPrice) : true;
  const liveHistory = liveQuoteIsSane ? (liveQuote.data?.history ?? []) : [];
  const chartPoints = [...(liveHistory.length >= 2 ? liveHistory : prices)].sort(
    (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0),
  );
  const chartCurrency =
    (liveQuoteIsSane ? liveQuote.data?.quote?.currency : undefined) ??
    instrument?.currency ??
    'EUR';
  const usingLive = liveHistory.length >= 2;
  const liveError = usingLive
    ? null
    : liveQuote.data?.error ??
      (liveQuote.isError && liveQuote.error instanceof Error
        ? liveQuote.error.message
        : null);

  const chartAveragePrice = useMemo(() => {
    const candidate =
      holding && holding.currency === chartCurrency && holding.averagePrice > 0
        ? holding.averagePrice
        : position && chartCurrency === 'EUR'
          ? toNumber(position.averageCost)
          : refAvgPrice;
    if (!candidate || candidate <= 0 || chartPoints.length === 0) return null;
    const latestChartVal = chartPoints[chartPoints.length - 1]!.value;
    return isSanePrice(candidate, latestChartVal) ? candidate : null;
  }, [holding, position, chartCurrency, refAvgPrice, chartPoints]);

  const tradeMarkers = useMemo<ChartTradeMarker[]>(() => {
    return transactions
      .filter((t) => t.kind === 'buy' || t.kind === 'sell')
      .map((t) => {
        const qty = Math.abs(Number(t.quantity ?? 0));
        const amt = Math.abs(Number(t.amount ?? 0));
        const unitPrice = qty > 0 ? amt / qty : 0;
        return {
          id: t.id,
          date: t.occurredAt,
          kind: t.kind as 'buy' | 'sell',
          quantity: qty,
          price: unitPrice,
          amount: amt,
        };
      });
  }, [transactions]);

  const instrumentsMap = positionsQuery.data?.instruments;
  const dividends = transactions.filter((t) => t.kind === 'dividend');
  const dividendTotal = dividends.reduce(
    (sum, t) => sum.plus(money(t.amount)),
    money('0'),
  );

  const gain = position?.unrealized ?? null;
  const gainTone = gain
    ? isNegative(gain)
      ? ('negative' as const)
      : ('positive' as const)
    : ('default' as const);

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
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
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
          <Stat
            label="Avg cost"
            value={<AmountInline value={toNumber(position.averageCost)} />}
          />
          <Stat
            label="Market value"
            value={
              <AmountInline
                value={toNumber(position.marketValue ?? position.costBasis)}
              />
            }
          />
          <Stat
            label="Unrealized"
            value={
              gain ? (
                <>
                  <AmountInline value={toNumber(gain)} signed />
                  {position.unrealizedPct !== null &&
                    ` · ${percent.format(position.unrealizedPct)}`}
                </>
              ) : (
                '—'
              )
            }
            tone={gainTone}
          />
        </div>
      )}

      {holding && holding.currency !== 'EUR' && (
        <Card className="flex flex-wrap items-center gap-x-8 gap-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            Native · {holding.currency}
          </p>
          <div>
            <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
              Price{' '}
            </span>
            <span className="text-sm font-semibold tabular-nums text-[var(--text-strong)]">
              {nativeMoney(holding.currentPrice, holding.currency)}
            </span>
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
              Avg cost{' '}
            </span>
            <span className="text-sm font-semibold tabular-nums text-[var(--text-strong)]">
              {nativeMoney(holding.averagePrice, holding.currency)}
            </span>
          </div>
          <div>
            <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
              Market value{' '}
            </span>
            <span className="text-sm font-semibold tabular-nums text-[var(--text-strong)]">
              {nativeMoney(holding.quantity * holding.currentPrice, holding.currency)}
            </span>
          </div>
        </Card>
      )}

      {chartPoints.length >= 2 ? (
        <Card className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              Price
            </p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
              {usingLive ? 'live' : 'stored'}
            </p>
          </div>
          <PriceChart
            points={chartPoints}
            currency={chartCurrency}
            averagePrice={chartAveragePrice}
            markers={tradeMarkers}
          />
          {usingLive && <RangeTabs value={range} onChange={setRange} />}
          {liveError && (
            <p className="text-[11px] text-[var(--text-muted)]">
              Live chart unavailable · {liveError}
            </p>
          )}
        </Card>
      ) : liveError ? (
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            Price
          </p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Chart unavailable · {liveError}
          </p>
        </Card>
      ) : null}

      {profile.data?.profile && liveQuoteIsSane && (
        <InstrumentFacts
          profile={profile.data.profile}
          price={liveQuote.data?.quote?.price ?? holding?.currentPrice ?? null}
        />
      )}

      {(() => {
        const prof = profile.data?.profile;
        const hasHistory = dividends.length > 0;
        const hasMarketYield =
          (prof?.dividendYield ?? 0) > 0 || (prof?.dividendRate ?? 0) > 0;
        const hasMarketDates =
          Boolean(prof?.dividendDate) || Boolean(prof?.exDividendDate);

        if (!hasHistory && !hasMarketYield && !hasMarketDates) return null;

        const posMarketVal = position
          ? toNumber(position.marketValue ?? position.costBasis)
          : 0;
        const annualEstEur =
          (prof?.dividendYield ?? 0) > 0 && posMarketVal > 0
            ? posMarketVal * prof!.dividendYield!
            : 0;

        const nextPayDate = prof?.dividendDate
          ? new Date(`${prof.dividendDate}T00:00:00Z`)
          : null;
        const isFuturePayout =
          nextPayDate && nextPayDate.getTime() >= Date.now() - 86_400_000;

        return (
          <Card className="flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                  Dividends & Income
                </p>
                {annualEstEur > 0 && (
                  <p className="text-xs text-[var(--text-muted)]">
                    Est. ~<AmountInline value={annualEstEur} /> / yr (
                    {percent.format(prof!.dividendYield!)} yield)
                  </p>
                )}
              </div>
              <Link
                to="/dividends"
                className="tap text-xs font-semibold text-[var(--accent)] hover:underline"
              >
                Dividend calendar →
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {hasHistory && (
                <div className="flex flex-col gap-0.5 rounded-[var(--radius-field)] neu-flat p-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Total Received
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-bold tabular-nums text-[var(--positive)]">
                      <AmountInline value={toNumber(dividendTotal)} />
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {dividends.length}{' '}
                      {dividends.length === 1 ? 'payment' : 'payments'}
                    </span>
                  </div>
                </div>
              )}

              {isFuturePayout && (
                <div className="flex flex-col gap-0.5 rounded-[var(--radius-field)] neu-flat p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Next Scheduled Payout
                    </span>
                    <span className="rounded bg-[color-mix(in_srgb,var(--positive)_18%,transparent)] px-1.5 py-0.2 text-[9px] font-bold uppercase text-[var(--positive)]">
                      Confirmed
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-bold text-[var(--text-strong)]">
                      {dateFormat.format(nextPayDate)}
                    </span>
                    {annualEstEur > 0 && (
                      <span className="text-sm font-bold tabular-nums text-[var(--positive)]">
                        ~<AmountInline value={annualEstEur / 4} />
                      </span>
                    )}
                  </div>
                  {prof?.exDividendDate && (
                    <span className="text-[11px] text-[var(--accent)]">
                      Ex-div{' '}
                      {dateFormat.format(
                        new Date(`${prof.exDividendDate}T00:00:00Z`),
                      )}
                    </span>
                  )}
                </div>
              )}
            </div>
          </Card>
        );
      })()}

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
