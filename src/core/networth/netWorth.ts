import type { BalanceByAccount } from '../balances/deriveBalances';
import { balanceOf } from '../balances/deriveBalances';
import type { Money } from '../money/money';
import { isNegative, sum, zero } from '../money/money';
import type { Account } from '../types';

export interface AccountBalance {
  account: Account;
  balance: Money;
}

export interface NetWorth {
  assets: AccountBalance[];
  liabilities: AccountBalance[];
  totalAssets: Money;
  totalLiabilities: Money;
  net: Money;
}

const isLiabilityBucket = (account: Account, balance: Money): boolean =>
  account.type === 'liability' || isNegative(balance);

export const computeNetWorth = (
  accounts: readonly Account[],
  balances: BalanceByAccount,
): NetWorth => {
  const assets: AccountBalance[] = [];
  const liabilities: AccountBalance[] = [];

  for (const account of accounts) {
    if (account.archivedAt !== null) continue;
    const entry: AccountBalance = {
      account,
      balance: balanceOf(balances, account.id),
    };
    if (isLiabilityBucket(account, entry.balance)) {
      liabilities.push(entry);
    } else {
      assets.push(entry);
    }
  }

  const totalAssets = sum(assets.map((entry) => entry.balance));
  const totalLiabilities = sum(liabilities.map((entry) => entry.balance));

  return {
    assets,
    liabilities,
    totalAssets,
    totalLiabilities,
    net: totalAssets.plus(totalLiabilities),
  };
};

export const emptyNetWorth = (): NetWorth => ({
  assets: [],
  liabilities: [],
  totalAssets: zero(),
  totalLiabilities: zero(),
  net: zero(),
});
