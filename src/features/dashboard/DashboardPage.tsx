import { useEffect, useMemo, useState } from 'react';
import { toNumber } from '@/core/money/money';
import { useInstruments, usePositions } from '@/features/positions/api/usePositions';
import { NetWorthChart } from '@/features/analytics/NetWorthChart';
import { Skeleton } from '@/ui/Skeleton';
import { PageHeader } from '@/ui/PageHeader';
import { PageHero } from '@/ui/PageHero';
import { DeltaPill } from '@/ui/DeltaPill';
import { Collapsible } from '@/ui/Collapsible';
import { AlertBanner } from '@/features/alerts/Alerts';
import { Onboarding } from '@/features/onboarding/Onboarding';
import { NetWorthDonut } from './NetWorthDonut';
import { GoalCard } from './GoalCard';
import { InsightsStrip } from './InsightsStrip';
import { MonthlyPulseCard } from './MonthlyPulseCard';
import { Movers } from './Movers';
import { FinancialTimeline } from './FinancialTimeline';
import { WealthLayersBar } from './WealthLayersBar';
import { useNetWorthHistory, useRecordNetWorth } from './api/useNetWorthHistory';
import { useNetWorthSummary } from './api/useNetWorthSummary';

export const DashboardPage = () => {
  const [heroView, setHeroView] = useState<'allocation' | 'trajectory'>('allocation');
  const summary = useNetWorthSummary();
  const { data: instruments } = useInstruments();
  const positionsQuery = usePositions();
  const { data: snapshots = [] } = useNetWorthHistory();
  const recordNetWorth = useRecordNetWorth();

  const loading = summary.loading;
  const accounts = summary.accounts;
  const empty =
    !loading &&
    accounts.length === 0 &&
    summary.cryptoTotal === 0 &&
    summary.collectiblesTotal === 0;
  const positions = summary.positions;
  const positionInstruments = positionsQuery.data?.instruments ?? new Map();
  const rankablePositions = positions.filter(
    (position) => position.unrealizedPct !== null,
  ).length;

  const cryptoTotal = summary.cryptoTotal;
  const collectiblesTotal = summary.collectiblesTotal;
  const effectiveCollectiblesValue = summary.effectiveCollectibles;
  const netWithAll = summary.netWithAll;
  const investments = summary.investments;
  const mealTotal = summary.mealTotal;
  const liquidCash = summary.liquidCash;
  const avgMonthlySavings = summary.avgMonthlySavings;
  const dataReady = summary.dataReady;

  const model = {
    netWorth: summary.netWorth,
    assets: summary.assets,
    liabilities: summary.liabilities,
  };

  const extraSegments = useMemo(() => {
    const list = [];
    if (cryptoTotal > 0) {
      list.push({ id: 'crypto', name: 'Crypto', value: cryptoTotal, to: '/crypto' });
    }
    if (summary.includeCollectibles && collectiblesTotal > 0) {
      list.push({
        id: 'collectibles',
        name: 'Alternative Assets',
        value: collectiblesTotal,
        to: '/collectibles',
      });
    }
    return list;
  }, [cryptoTotal, collectiblesTotal, summary.includeCollectibles]);

  useEffect(() => {
    if (!dataReady) return;
    recordNetWorth.mutate({
      net: toNumber(netWithAll),
      assets:
        toNumber(model.netWorth.totalAssets) +
        cryptoTotal +
        effectiveCollectiblesValue,
      liabilities: toNumber(model.netWorth.totalLiabilities),
      investments:
        toNumber(investments) + cryptoTotal + effectiveCollectiblesValue,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataReady, netWithAll.toString()]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Overview"
        subtitle="Everything you own and owe, in one cross-section."
      />

      {loading ? (
        <div className="flex flex-col gap-8">
          <Skeleton className="h-52 w-full rounded-[var(--radius-card)]" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-20 rounded-[var(--radius-card)]" />
            <Skeleton className="h-20 rounded-[var(--radius-card)]" />
          </div>
        </div>
      ) : empty ? (
        <Onboarding />
      ) : (
        <>
          <Onboarding />
          <AlertBanner />

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
            <div className="min-w-0 lg:col-span-2">
              <PageHero
                label="Net worth"
                value={toNumber(netWithAll)}
                toolbar={
                  snapshots.length >= 2 ? (
                    <div className="ml-auto inline-flex items-center rounded-full border border-[var(--line)] bg-[var(--surface-sunken)] p-0.5 text-[11px] font-semibold">
                      <button
                        type="button"
                        onClick={() => setHeroView('allocation')}
                        className={`tap rounded-full px-2.5 py-1 transition-colors ${
                          heroView === 'allocation'
                            ? 'bg-[var(--surface-raised)] text-[var(--text-strong)] shadow-sm'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'
                        }`}
                      >
                        Allocation
                      </button>
                      <button
                        type="button"
                        onClick={() => setHeroView('trajectory')}
                        className={`tap rounded-full px-2.5 py-1 transition-colors ${
                          heroView === 'trajectory'
                            ? 'bg-[var(--surface-raised)] text-[var(--text-strong)] shadow-sm'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'
                        }`}
                      >
                        Trajectory
                      </button>
                    </div>
                  ) : undefined
                }
                aside={
                  summary.todayPl !== null ? (
                    <DeltaPill
                      value={summary.todayPlNumber}
                      tone={summary.todayPlNegative ? 'negative' : 'positive'}
                      note="today"
                    />
                  ) : undefined
                }
              >
                {heroView === 'trajectory' && snapshots.length >= 2 ? (
                  <NetWorthChart series={snapshots} />
                ) : (
                  <NetWorthDonut
                    netWorth={model.netWorth}
                    extra={extraSegments}
                    net={netWithAll}
                  />
                )}
              </PageHero>
            </div>

            <WealthLayersBar
              investments={toNumber(investments)}
              cash={liquidCash}
              meal={mealTotal}
              crypto={cryptoTotal}
              collectibles={effectiveCollectiblesValue}
            />

            <MonthlyPulseCard
              transactions={summary.transactions}
              liquidCash={liquidCash}
              snapshots={snapshots}
            />

            <GoalCard net={netWithAll} monthlySavings={avgMonthlySavings} />

            <InsightsStrip
              cash={liquidCash + mealTotal}
              investments={
                toNumber(investments) + cryptoTotal + effectiveCollectiblesValue
              }
            />

            {rankablePositions >= 2 && (
              <section className="flex min-w-0 flex-col gap-3">
                <Collapsible title="Movers" badge={`${rankablePositions} positions`}>
                  <Movers positions={positions} instruments={positionInstruments} />
                </Collapsible>
              </section>
            )}

            <FinancialTimeline
              transactions={summary.transactions}
              accounts={accounts}
              instruments={instruments ?? new Map()}
            />
          </div>
        </>
      )}
    </div>
  );
};
