import type { Money } from '../money/money';
import { money, zero } from '../money/money';

export interface BudgetInput {
  categoryId: string;
  limit: string;
}

export interface BudgetLine {
  categoryId: string;
  limit: Money;
  spent: Money;
  remaining: Money;
  ratio: number;
  over: boolean;
}

export const budgetLines = (
  budgets: readonly BudgetInput[],
  spentOf: (categoryId: string) => Money,
): BudgetLine[] =>
  budgets
    .map((budget) => {
      const limit = money(budget.limit);
      const spent = spentOf(budget.categoryId);
      const remaining = limit.minus(spent);
      const ratio = limit.greaterThan(0)
        ? spent.dividedBy(limit).toNumber()
        : 0;
      return {
        categoryId: budget.categoryId,
        limit,
        spent,
        remaining,
        ratio,
        over: spent.greaterThan(limit),
      };
    })
    .sort((a, b) => b.ratio - a.ratio);

export const totalBudget = (lines: readonly BudgetLine[]): {
  limit: Money;
  spent: Money;
} =>
  lines.reduce(
    (totals, line) => ({
      limit: totals.limit.plus(line.limit),
      spent: totals.spent.plus(line.spent),
    }),
    { limit: zero(), spent: zero() },
  );
