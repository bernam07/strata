import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  formatEur,
  isNegative,
  money,
  toNumber,
  zero,
  type Money,
} from '@/core/money/money';
import {
  comparePeriods,
  monthlyExpenses,
  type CategoryLookup,
} from '@/core/expenses/summary';
import { useAccounts } from '@/features/accounts/api/useAccounts';
import { useTransactions } from '@/features/transactions/api/useTransactions';
import { TransactionForm } from '@/features/transactions/components/TransactionForm';
import { Button } from '@/ui/Button';
import { PageHeader } from '@/ui/PageHeader';
import { Card } from '@/ui/Card';
import { Collapsible } from '@/ui/Collapsible';
import { Surface } from '@/ui/Surface';
import { Amount } from '@/ui/Amount';
import { Select } from '@/ui/Field';
import { detectRecurring, monthlyEquivalent } from '@/core/expenses/recurring';
import { monthlyCashflow } from '@/core/analytics/cashflow';
import { BudgetPanel } from './BudgetPanel';
import { CategoryManager } from './CategoryManager';
import { CategoryTiles, type CategoryTile } from './CategoryTiles';
import { WeeklySpend } from './WeeklySpend';
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
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('new')) {
      setAdding(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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

  const categoryTiles = useMemo<CategoryTile[]>(() => {
    const currentMonth = monthKey(0);
    const nameById = new Map(categories.map((c) => [c.id, c.name]));
    const agg = new Map<string, { amount: number; count: number }>();
    for (const transaction of transactions) {
      if (transaction.kind !== 'expense') continue;
      if (!transaction.occurredAt.startsWith(currentMonth)) continue;
      const categoryId = assignments?.get(transaction.id);
      if (!categoryId) continue;
      const entry = agg.get(categoryId) ?? { amount: 0, count: 0 };
      entry.amount += Math.abs(Number(transaction.amount));
      entry.count += 1;
      agg.set(categoryId, entry);
    }
    return [...agg.entries()]
      .map(([id, value]) => ({
        id,
        name: nameById.get(id) ?? 'Uncategorized',
        amount: value.amount,
        count: value.count,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [transactions, categories, assignments]);

  const cashflow = useMemo(
    () => monthlyCashflow(transactions).slice(0, 6),
    [transactions],
  );
  const recurring = useMemo(() => detectRecurring(transactions), [transactions]);
  const recurringMonthly = useMemo(
    () =>
      recurring.reduce((total, item) => total.plus(monthlyEquivalent(item)), money('0')),
    [recurring],
  );

  const expenses = transactions.filter((t) => t.kind === 'expense');

  const spend = useMemo(() => {
    const totalFor = (offset: number): Money =>
      transactions
        .filter(
          (t) =>
            (t.kind === 'expense' || t.kind === 'fee') &&
            t.occurredAt.startsWith(monthKey(offset)),
        )
        .reduce((sum, t) => sum.plus(money(t.amount).abs()), zero());
    const current = totalFor(0);
    const previous = totalFor(1);
    return { current, previous, delta: current.minus(previous) };
  }, [transactions]);

  const spendUp = spend.delta.greaterThan(0);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Expenses"
        subtitle="Where your money goes each month."
        actions={
          !adding && (
            <Button
              onClick={() => setAdding(true)}
              disabled={accounts.length === 0}
            >
              Add expense
            </Button>
          )
        }
      />

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
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              {monthLabel(monthKey(0))} · spent so far
            </span>
            <Amount value={toNumber(spend.current)} size="xl" />
          </div>
          <span
            className="flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 text-xs font-bold"
            style={{
              color: spendUp ? 'var(--negative)' : 'var(--positive)',
              background: `color-mix(in srgb, ${
                spendUp ? 'var(--negative)' : 'var(--positive)'
              } 13%, transparent)`,
            }}
          >
            {spendUp ? '▲' : '▼'} {formatEur(spend.delta.abs())}
          </span>
        </div>
        <WeeklySpend transactions={transactions} />
      </Card>

      {categoryTiles.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between px-0.5">
            <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              Categories
            </h2>
            <span className="text-xs font-semibold tabular-nums text-[var(--text-muted)]">
              {monthLabel(monthKey(0))}
            </span>
          </div>
          <CategoryTiles tiles={categoryTiles} />
        </section>
      )}

      <Card className="flex flex-col gap-4">
        <h2 className="font-semibold text-[var(--text-strong)]">Budgets</h2>
        <BudgetPanel categories={categories} spentOf={spentOf} />
      </Card>

      {cashflow.length > 0 && (
        <Collapsible title="Cash flow">
          <div className="flex flex-col gap-2">
            {cashflow.map((row) => {
              const negative = isNegative(row.net);
              return (
                <div
                  key={row.month}
                  className="flex items-center justify-between gap-3 rounded-[var(--radius-field)] neu-flat px-4 py-3"
                >
                  <span className="text-sm font-semibold capitalize text-[var(--text-strong)]">
                    {monthLabel(row.month)}
                  </span>
                  <div className="flex flex-col items-end gap-0.5 tabular-nums">
                    <span
                      className="whitespace-nowrap text-sm font-semibold"
                      style={{
                        color: negative
                          ? 'var(--negative)'
                          : 'var(--positive)',
                      }}
                    >
                      {formatEur(row.net)}
                    </span>
                    <span className="whitespace-nowrap text-[11px] text-[var(--text-muted)]">
                      <span className="text-[var(--positive)]">
                        +{formatEur(row.inflow)}
                      </span>
                      {' · '}
                      <span className="text-[var(--negative)]">
                        −{formatEur(row.outflow)}
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Collapsible>
      )}

      {recurring.length > 0 && (
        <Collapsible
          title="Recurring"
          badge={`~${formatEur(recurringMonthly)}/mo`}
        >
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
        </Collapsible>
      )}

      <Collapsible title="Categories">
        <CategoryManager />
      </Collapsible>

      {comparison.length > 0 && (
        <Collapsible title="This month vs. last">
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
        </Collapsible>
      )}

      {months.length > 0 && (
        <Collapsible title="Monthly summary">
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
        </Collapsible>
      )}

      <Collapsible title="Categorize" badge={String(expenses.length)}>
        {expenses.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No expenses.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {expenses.slice(0, 40).map((transaction) => (
              <Surface
                key={transaction.id}
                elevation="flat"
                className="flex flex-col gap-2 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-semibold text-[var(--text-strong)]">
                    {transaction.note || 'Expense'}
                  </p>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--negative)]">
                    {formatEur(money(transaction.amount))}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">
                    {transaction.occurredAt.slice(0, 10)}
                  </span>
                  <div className="min-w-0 flex-1">
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
                  </div>
                </div>
              </Surface>
            ))}
          </ul>
        )}
      </Collapsible>
    </div>
  );
};
