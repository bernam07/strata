import { useCallback, useMemo, useState } from 'react';
import { formatEur, money, zero, type Money } from '@/core/money/money';
import {
  comparePeriods,
  monthlyExpenses,
  type CategoryLookup,
} from '@/core/expenses/summary';
import { useAccounts } from '@/features/accounts/api/useAccounts';
import { useTransactions } from '@/features/transactions/api/useTransactions';
import { TransactionForm } from '@/features/transactions/components/TransactionForm';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Surface } from '@/ui/Surface';
import { Select } from '@/ui/Field';
import { detectRecurring, monthlyEquivalent } from '@/core/expenses/recurring';
import { BudgetPanel } from './BudgetPanel';
import { CategoryManager } from './CategoryManager';
import {
  useAssignCategory,
  useAssignments,
  useCategories,
} from './api/useCategories';

const monthLabel = (month: string): string => {
  const [year, m] = month.split('-');
  return new Date(Number(year), Number(m) - 1, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
};

const monthKey = (offset: number): string => {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export const ExpensesPage = () => {
  const { data: transactions = [] } = useTransactions();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: assignments } = useAssignments();
  const assign = useAssignCategory();
  const [adding, setAdding] = useState(false);

  const categoryName = useMemo(() => {
    const byId = new Map(categories.map((category) => [category.id, category.name]));
    const categoryOf: CategoryLookup = (transactionId) => {
      const categoryId = assignments?.get(transactionId);
      return (categoryId && byId.get(categoryId)) || 'Uncategorized';
    };
    return categoryOf;
  }, [categories, assignments]);

  const months = useMemo(
    () => monthlyExpenses(transactions, categoryName),
    [transactions, categoryName],
  );

  const comparison = useMemo(() => {
    const current = transactions.filter((t) =>
      t.occurredAt.startsWith(monthKey(0)),
    );
    const previous = transactions.filter((t) =>
      t.occurredAt.startsWith(monthKey(1)),
    );
    return comparePeriods(current, previous, categoryName);
  }, [transactions, categoryName]);

  const spentThisMonth = useMemo(() => {
    const currentMonth = monthKey(0);
    const totals = new Map<string, Money>();
    for (const transaction of transactions) {
      if (transaction.kind !== 'expense') continue;
      if (!transaction.occurredAt.startsWith(currentMonth)) continue;
      const categoryId = assignments?.get(transaction.id);
      if (!categoryId) continue;
      totals.set(
        categoryId,
        (totals.get(categoryId) ?? zero()).plus(money(transaction.amount).abs()),
      );
    }
    return totals;
  }, [transactions, assignments]);

  const spentOf = useCallback(
    (categoryId: string) => spentThisMonth.get(categoryId) ?? zero(),
    [spentThisMonth],
  );

  const recurring = useMemo(() => detectRecurring(transactions), [transactions]);
  const recurringMonthly = useMemo(
    () =>
      recurring.reduce((total, item) => total.plus(monthlyEquivalent(item)), money('0')),
    [recurring],
  );

  const expenses = transactions.filter((t) => t.kind === 'expense');

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
          Expenses
        </h1>
        {!adding && (
          <Button onClick={() => setAdding(true)} disabled={accounts.length === 0}>
            Add expense
          </Button>
        )}
      </div>

      {adding && (
        <Card>
          <TransactionForm
            accounts={accounts}
            defaultKind="expense"
            onDone={() => setAdding(false)}
          />
        </Card>
      )}

      <Card className="flex flex-col gap-4">
        <h2 className="font-semibold text-[var(--text-strong)]">Budgets</h2>
        <BudgetPanel categories={categories} spentOf={spentOf} />
      </Card>

      {recurring.length > 0 && (
        <Card className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold text-[var(--text-strong)]">
              Recurring
            </h2>
            <span className="text-sm text-[var(--text-muted)]">
              ~{formatEur(recurringMonthly)}/mo
            </span>
          </div>
          <ul className="flex flex-col gap-2">
            {recurring.map((item) => (
              <li
                key={item.label}
                className="flex items-center justify-between rounded-[var(--radius-field)] neu-flat px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--text-strong)]">
                    {item.label}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {item.cadence} · next{' '}
                    {new Date(item.nextExpected).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-[var(--text-strong)]">
                  {formatEur(item.amount)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <h2 className="mb-4 font-semibold text-[var(--text-strong)]">
          Categories
        </h2>
        <CategoryManager />
      </Card>

      {comparison.length > 0 && (
        <Card className="flex flex-col gap-4">
          <h2 className="font-semibold text-[var(--text-strong)]">
            This month vs. last
          </h2>
          <ul className="flex flex-col gap-2">
            {comparison.map((row) => {
              const up = row.delta.greaterThan(0);
              return (
                <li
                  key={row.category}
                  className="flex items-center justify-between rounded-[var(--radius-field)] neu-flat px-4 py-2.5"
                >
                  <span className="text-sm font-semibold text-[var(--text-strong)]">
                    {row.category}
                  </span>
                  <div className="flex items-center gap-4 text-sm tabular-nums">
                    <span className="text-[var(--text-strong)]">
                      {formatEur(row.current)}
                    </span>
                    <span
                      className="text-xs"
                      style={{
                        color: up ? 'var(--negative)' : 'var(--positive)',
                      }}
                    >
                      {up ? '▲' : '▼'} {formatEur(row.delta.abs())}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {months.length > 0 && (
        <Card className="flex flex-col gap-4">
          <h2 className="font-semibold text-[var(--text-strong)]">
            Monthly summary
          </h2>
          <div className="flex flex-col gap-4">
            {months.slice(0, 6).map((month) => (
              <div key={month.month} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold capitalize text-[var(--text-strong)]">
                    {monthLabel(month.month)}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-[var(--negative)]">
                    {formatEur(month.total)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {month.byCategory.map((entry) => (
                    <span
                      key={entry.category}
                      className="rounded-full neu-sunken px-3 py-1 text-xs text-[var(--text-muted)]"
                    >
                      {entry.category} · {formatEur(entry.total)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="flex flex-col gap-4">
        <h2 className="font-semibold text-[var(--text-strong)]">Categorize</h2>
        {expenses.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No expenses.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {expenses.slice(0, 40).map((transaction) => (
              <Surface
                key={transaction.id}
                elevation="flat"
                className="flex items-center gap-4 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--text-strong)]">
                    {transaction.note || 'Expense'}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {transaction.occurredAt.slice(0, 10)}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-[var(--negative)]">
                  {formatEur(money(transaction.amount))}
                </span>
                <Select
                  value={assignments?.get(transaction.id) ?? ''}
                  onChange={(event) =>
                    assign.mutate({
                      transactionId: transaction.id,
                      categoryId: event.target.value || null,
                    })
                  }
                >
                  <option value="">Uncategorized</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </Surface>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};
