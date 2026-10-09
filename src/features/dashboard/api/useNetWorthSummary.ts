import { useMemo } from 'react';
import { deriveBalances } from '@/core/balances/deriveBalances';
import { computeNetWorth, emptyNetWorth, type NetWorth } from '@/core/networth/netWorth';
import { isNegative, money, sum, toNumber, zero, type Money } from '@/core/money/money';
import { useAccounts } from '@/features/accounts/api/useAccounts';
import {
  applyBrokerBalances,
  useBrokerAccounts,
} from '@/features/accounts/api/useBrokerAccounts';
import { useTransactions } from '@/features/transactions/api/useTransactions';
import { usePositions } from '@/features/positions/api/usePositions';
import type { Position } from '@/core/positions/derivePositions';
import { useCrypto } from '@/features/crypto/api/useCrypto';
import { useCollectibles } from '@/features/collectibles/api/useCollectibles';
import { useIncludeCollectiblesInNetWorth } from './usePreferences';
import { monthlyCashflow } from '@/core/analytics/cashflow';
import type { Account, Transaction } from '@/core/types';

export interface NetWorthSummaryResult {
  loading: boolean;
  dataReady: boolean;
  accounts: Account[];
  transactions: Transaction[];
  netWorth: NetWorth;
  netWithAll: Money;
  netNumber: number;
  assets: NetWorth['assets'];
  liabilities: NetWorth['liabilities'];
  cryptoTotal: number;
  cryptoDay: number;
  cryptoCount: number;
  collectiblesTotal: number;
  collectiblesCount: number;
  effectiveCollectibles: number;
  includeCollectibles: boolean;
  investments: Money;
  liquidCash: number;
  mealTotal: number;
  positions: Position[];
  positionsDay: number;
  dayChangeEur: number;
  todayPl: Money | null;
  todayPlNegative: boolean;
  todayPlNumber: number;
  avgMonthlySavings: number;
}

export const useNetWorthSummary = (): NetWorthSummaryResult => {
  const accountsQuery = useAccounts();
  const transactionsQuery = useTransactions();
  const brokersQuery = useBrokerAccounts();
  const positionsQuery = usePositions();
  const { data: crypto = [] } = useCrypto();
  const { data: collectibles = [] } = useCollectibles();
  const { data: includeCollectibles = true } = useIncludeCollectiblesInNetWorth();

  return useMemo(() => {
    const accounts = accountsQuery.data ?? [];
    const transactions = transactionsQuery.data ?? [];
    const brokers = brokersQuery.data ?? new Map();
    const positions = positionsQuery.data?.positions ?? [];

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

    const cryptoTotal = crypto.reduce((total, item) => total + item.valueEur, 0);
    const cryptoDay = crypto.reduce((total, item) => total + item.dayChangeEur, 0);

    const collectiblesTotal = collectibles.reduce(
      (total, item) => total + item.valueEur,
      0,
    );
    const effectiveCollectibles = includeCollectibles ? collectiblesTotal : 0;

    const netWithAll = netWorth.net
      .plus(money(cryptoTotal))
      .plus(money(effectiveCollectibles));
    const netNumber = toNumber(netWithAll);

    const changes = positions
      .map((p) => p.dayChange)
      .filter((c): c is Money => c !== null);
    const hasDayData = changes.length > 0 || cryptoDay !== 0;
    const todayPl: Money | null = hasDayData
      ? (changes.length > 0 ? sum(changes) : zero()).plus(money(cryptoDay))
      : null;
    const todayPlNegative = todayPl !== null && isNegative(todayPl);
    const todayPlNumber = todayPl !== null ? toNumber(todayPl) : 0;
    const positionsDay = changes.length > 0 ? toNumber(sum(changes)) : 0;
    const dayChangeEur = cryptoDay + positionsDay;

    let investments = zero();
    for (const snapshot of brokers.values()) {
      investments = investments.plus(money(snapshot.total));
    }

    let mealTotal = 0;
    for (const entry of netWorth.assets) {
      if (entry.account.institutionId === 'edenred') {
        mealTotal += Math.max(0, toNumber(entry.balance));
      }
    }

    const liquidCash = Math.max(
      0,
      toNumber(netWorth.totalAssets) - toNumber(investments) - mealTotal,
    );

    const rows = monthlyCashflow(transactions).slice(0, 3);
    let avgMonthlySavings = 0;
    if (rows.length > 0) {
      const sumNet = rows.reduce((acc, row) => acc + toNumber(row.net), 0);
      avgMonthlySavings = Math.max(0, sumNet / rows.length);
    }

    const loading = accountsQuery.isLoading || transactionsQuery.isLoading;
    const dataReady =
      !loading &&
      !brokersQuery.isLoading &&
      accounts.length > 0 &&
      !positionsQuery.isLoading;

    return {
      loading,
      dataReady,
      accounts,
      transactions,
      netWorth,
      netWithAll,
      netNumber,
      assets,
      liabilities,
      cryptoTotal,
      cryptoDay,
      cryptoCount: crypto.length,
      collectiblesTotal,
      collectiblesCount: collectibles.length,
      effectiveCollectibles,
      includeCollectibles,
      investments,
      liquidCash,
      mealTotal,
      positions,
      positionsDay,
      dayChangeEur,
      todayPl,
      todayPlNegative,
      todayPlNumber,
      avgMonthlySavings,
    };
  }, [
    accountsQuery.data,
    accountsQuery.isLoading,
    transactionsQuery.data,
    transactionsQuery.isLoading,
    brokersQuery.data,
    brokersQuery.isLoading,
    positionsQuery.data,
    positionsQuery.isLoading,
    crypto,
    collectibles,
    includeCollectibles,
  ]);
};
