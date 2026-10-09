import { useEffect, useMemo, useState } from 'react';
import { deriveBalances } from '@/core/balances/deriveBalances';
import { monthlyCashflow } from '@/core/analytics/cashflow';
import { computeNetWorth, emptyNetWorth } from '@/core/networth/netWorth';
import { isNegative, money, sum, toNumber, zero, type Money } from '@/core/money/money';
import { useAccounts } from '@/features/accounts/api/useAccounts';
import {
  applyBrokerBalances,
  useBrokerAccounts,
} from '@/features/accounts/api/useBrokerAccounts';
import { useTransactions } from '@/features/transactions/api/useTransactions';
import { useInstruments, usePositions } from '@/features/positions/api/usePositions';
import { useCrypto } from '@/features/crypto/api/useCrypto';
import { useCollectibles } from '@/features/collectibles/api/useCollectibles';
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
import { useIncludeCollectiblesInNetWorth } from './api/usePreferences';

export const DashboardPage = () => {
  const [heroView, setHeroView] = useState<'allocation' | 'trajectory'>('allocation');
  const accountsQuery = useAccounts();
  const transactionsQuery = useTransactions();
  const brokersQuery = useBrokerAccounts();
  const { data: instruments } = useInstruments();
  const positionsQuery = usePositions();
  const { data: crypto = [] } = useCrypto();
  const { data: collectibles = [] } = useCollectibles();
  const { data: includeCollectibles = true } = useIncludeCollectiblesInNetWorth();
  const { data: snapshots = [] } = useNetWorthHistory();
  const recordNetWorth = useRecordNetWorth();

  const model = useMemo(() => {
    const accounts = accountsQuery.data ?? [];
    const transactions = transactionsQuery.data ?? [];
    const brokers = brokersQuery.data ?? new Map();
    const balances = applyBrokerBalances(
      deriveBalances(transactions),
      accounts,
      brokers,
    );
    const netWorth =
      accounts.length === 0
        ? emptyNetWorth()
        : computeNetWorth(accounts, balances);
    const assets = [...netWorth.assets].sort((a, b) =>
      b.balance.comparedTo(a.balance),
    );
    const liabilities = [...netWorth.liabilities].sort((a, b) =>
      a.balance.comparedTo(b.balance),
    );
    return {
      netWorth,
      assets,
      liabilities,
    };
  }, [accountsQuery.data, transactionsQuery.data, brokersQuery.data]);

  const loading = accountsQuery.isLoading || transactionsQuery.isLoading;
  const accounts = accountsQuery.data ?? [];
  const empty =
    !loading &&
    accounts.length === 0 &&
    crypto.length === 0 &&
    collectibles.length === 0;
  const positions = positionsQuery.data?.positions ?? [];
  const positionInstruments = positionsQuery.data?.instruments ?? new Map();
  const rankablePositions = positions.filter(
    (position) => position.unrealizedPct !== null,
  ).length;

  const cryptoTotal = crypto.reduce((total, item) => total + item.valueEur, 0);
  const cryptoDay = crypto.reduce((total, item) => total + item.dayChangeEur, 0);
  const collectiblesTotal = collectibles.reduce(
    (total, item) => total + item.valueEur,
    0,
  );
  const effectiveCollectiblesValue = includeCollectibles ? collectiblesTotal : 0;
  const netWithAll = model.netWorth.net
    .plus(money(cryptoTotal))
    .plus(money(effectiveCollectiblesValue));

  const extraSegments = useMemo(() => {
    const list = [];
    if (cryptoTotal > 0) {
      list.push({ id: 'crypto', name: 'Crypto', value: cryptoTotal, to: '/crypto' });
    }
    if (includeCollectibles && collectiblesTotal > 0) {
      list.push({
        id: 'collectibles',
        name: 'Alternative Assets',
        value: collectiblesTotal,
        to: '/collectibles',
      });
    }
    return list;
  }, [cryptoTotal, collectiblesTotal, includeCollectibles]);

  const investments = useMemo(() => {
    const brokers = brokersQuery.data ?? new Map();
    let total = zero();
    for (const snapshot of brokers.values()) total = total.plus(money(snapshot.total));
    return total;
  }, [brokersQuery.data]);

  const mealTotal = useMemo(() => {
    let total = 0;
    for (const entry of model.netWorth.assets) {
      if (entry.account.institutionId === 'edenred') {
        total += Math.max(0, toNumber(entry.balance));
      }
    }
    return total;
  }, [model.netWorth.assets]);

  const liquidCash = Math.max(
    0,
    toNumber(model.netWorth.totalAssets) - toNumber(investments) - mealTotal,
  );

  const avgMonthlySavings = useMemo(() => {
    const rows = monthlyCashflow(transactionsQuery.data ?? []).slice(0, 3);
    if (rows.length === 0) return 0;
    const sumNet = rows.reduce((acc, row) => acc + toNumber(row.net), 0);
    return Math.max(0, sumNet / rows.length);
  }, [transactionsQuery.data]);

  const dataReady =
    !loading &&
    !brokersQuery.isLoading &&
    accounts.length > 0 &&
    !positionsQuery.isLoading;

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

  const todayPl = useMemo<Money | null>(() => {
    const changes = positions
      .map((position) => position.dayChange)
      .filter((change): change is Money => change !== null);
    if (changes.length === 0 && cryptoDay === 0) return null;
    return sum(changes).plus(money(cryptoDay));
  }, [positions, cryptoDay]);

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
                  todayPl !== null ? (
                    <DeltaPill
                      value={toNumber(todayPl)}
                      tone={isNegative(todayPl) ? 'negative' : 'positive'}
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
              transactions={transactionsQuery.data ?? []}
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
              transactions={transactionsQuery.data ?? []}
              accounts={accounts}
              instruments={instruments}
            />
          </div>
        </>
      )}
    </div>
  );
};
