import type { Money } from '../money/money';
import { money, sum, zero } from '../money/money';
import type { Transaction } from '../types';

export type BalanceByAccount = ReadonlyMap<string, Money>;

export const deriveBalances = (
  transactions: readonly Transaction[],
): BalanceByAccount => {
  const grouped = new Map<string, Money[]>();

  for (const transaction of transactions) {
    const bucket = grouped.get(transaction.accountId) ?? [];
    bucket.push(money(transaction.amount));
    grouped.set(transaction.accountId, bucket);
  }

  const balances = new Map<string, Money>();
  for (const [accountId, amounts] of grouped) {
    balances.set(accountId, sum(amounts));
  }
  return balances;
};

export const balanceOf = (
  balances: BalanceByAccount,
  accountId: string,
): Money => balances.get(accountId) ?? zero();
