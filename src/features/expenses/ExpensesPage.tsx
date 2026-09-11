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
import { AmountInline } from '@/ui/Amount';
import { CardTitle, headingClass } from '@/ui/Heading';
import { Select, TextInput } from '@/ui/Field';
import { toast } from '@/ui/toast';
import { detectRecurring, monthlyEquivalent } from '@/core/expenses/recurring';
import { monthlyCashflow } from '@/core/analytics/cashflow';
import { BudgetPanel } from './BudgetPanel';
import { CategoryManager } from './CategoryManager';
import { CategoryTiles, type CategoryTile } from './CategoryTiles';
import { SpendOverview } from './SpendOverview';
import { tileStyle } from './categoryColors';
import {
  useAssignCategory,
  useAssignments,
  useCategories,
  useUpdateCategory,
} from './api/useCategories';
import { ColorSwatches } from './ColorSwatches';

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

// One row and one heading treatment for every list on the page, so the
// sections below the chart belong to the same design language as the tiles.
const rowClass =
  'flex items-center justify-between gap-3 rounded-[var(--radius-field)] neu-flat px-4 py-3';
const ColorDot = ({ color }: { color: string | null }) => (
  <span
    aria-hidden="true"
    className="h-2.5 w-2.5 shrink-0 rounded-full"
    style={{ background: tileStyle(color).dot }}
  />
);

export const ExpensesPage = () => {
  const { data: transactions = [] } = useTransactions();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: assignments } = useAssignments();
  const assign = useAssignCategory();
  const [adding, setAdding] = useState(false);
  const [managing, setManaging] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{
    id: string;
    name: string;
    color: string | null;
  } | null>(null);
  const updateCategory = useUpdateCategory();
  const [searchParams, setSearchParams] = useSearchParams();

  const saveCategory = () => {
    if (!editingCategory) return;
    const name = editingCategory.name.trim();
    if (!name) return;
    updateCategory.mutate(
      { id: editingCategory.id, name, color: editingCategory.color },
      {
        onSuccess: () => {
          setEditingCategory(null);
          toast('Category updated', 'success');
        },
        onError: () => toast("Couldn't update category", 'error'),
      },
    );
  };

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
    const byId = new Map(categories.map((c) => [c.id, c]));
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
        name: byId.get(id)?.name ?? 'Uncategorized',
        color: byId.get(id)?.color ?? null,
        amount: value.amount,
        count: value.count,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [transactions, categories, assignments]);

  // The comparison and summary rows key by category name, so colour has to be
  // looked up that way to carry through from the tiles.
  const colorByName = useMemo(
    () => new Map(categories.map((category) => [category.name, category.color])),
    [categories],
  );

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

      <SpendOverview transactions={transactions} />

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3 px-0.5">
          <h2 className={headingClass}>Categories</h2>
          <button
            type="button"
            onClick={() => {
              setManaging((open) => !open);
              setEditingCategory(null);
            }}
            className="tap text-xs font-semibold text-[var(--accent)]"
          >
            {managing ? 'Done' : 'Manage'}
          </button>
        </div>

        <CategoryTiles
          tiles={categoryTiles}
          selectedId={editingCategory?.id ?? null}
          onSelect={(id) => {
            setManaging(false);
            setEditingCategory((current) =>
              current?.id === id
                ? null
                : {
                    id,
                    name: categories.find((c) => c.id === id)?.name ?? '',
                    color: categories.find((c) => c.id === id)?.color ?? null,
                  },
            );
          }}
        />

        {editingCategory && (
          <Card className="page-enter flex flex-col gap-3">
            <CardTitle>Edit category</CardTitle>
            <TextInput
              value={editingCategory.name}
              autoFocus
              onChange={(event) =>
                setEditingCategory((current) =>
                  current ? { ...current, name: event.target.value } : current,
                )
              }
              onKeyDown={(event) => {
                if (event.key === 'Enter') saveCategory();
                if (event.key === 'Escape') setEditingCategory(null);
              }}
            />
            <ColorSwatches
              value={editingCategory.color}
              onChange={(color) =>
                setEditingCategory((current) =>
                  current ? { ...current, color } : current,
                )
              }
            />
            <div className="flex gap-2">
              <Button
                onClick={saveCategory}
                disabled={updateCategory.isPending || !editingCategory.name.trim()}
              >
                {updateCategory.isPending ? 'Saving…' : 'Save'}
              </Button>
              <Button variant="ghost" onClick={() => setEditingCategory(null)}>
                Cancel
              </Button>
            </div>
          </Card>
        )}

        {managing && (
          <Card className="page-enter">
            <CategoryManager />
          </Card>
        )}

        {categoryTiles.length === 0 && !managing && (
          <p className="px-0.5 text-sm text-[var(--text-muted)]">
            Nothing categorised in {monthLabel(monthKey(0))} yet — assign a few
            expenses below, or use Manage to add categories.
          </p>
        )}
      </section>

      <Card className="flex flex-col gap-4">
        <CardTitle>Budgets</CardTitle>
        <BudgetPanel categories={categories} spentOf={spentOf} />
      </Card>

      {cashflow.length > 0 && (
        <Collapsible title="Cash flow">
          <div className="flex flex-col gap-2">
            {cashflow.map((row) => {
              const negative = isNegative(row.net);
              return (
                <div key={row.month} className={rowClass}>
                  <span className="text-sm font-semibold capitalize text-[var(--text-strong)]">
                    {monthLabel(row.month)}
                  </span>
                  <div className="flex flex-col items-end gap-0.5">
                    <span
                      className="text-sm font-semibold"
                      style={{
                        color: negative
                          ? 'var(--negative)'
                          : 'var(--positive)',
                      }}
                    >
                      <AmountInline value={toNumber(row.net)} />
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      <span className="text-[var(--positive)]">
                        <AmountInline value={toNumber(row.inflow)} signed />
                      </span>
                      {' · '}
                      <span className="text-[var(--negative)]">
                        <AmountInline value={-toNumber(row.outflow)} signed />
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
              <li key={item.label} className={rowClass}>
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
                <span className="text-sm font-semibold text-[var(--text-strong)]">
                  <AmountInline value={toNumber(item.amount)} />
                </span>
              </li>
            ))}
          </ul>
        </Collapsible>
      )}

      {comparison.length > 0 && (
        <Collapsible title="This month vs. last">
          <ul className="flex flex-col gap-2">
            {comparison.map((row) => {
              const up = row.delta.greaterThan(0);
              return (
                <li key={row.category} className={rowClass}>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <ColorDot color={colorByName.get(row.category) ?? null} />
                    <span className="truncate text-sm font-semibold text-[var(--text-strong)]">
                      {row.category}
                    </span>
                  </span>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-[var(--text-strong)]">
                      <AmountInline value={toNumber(row.current)} />
                    </span>
                    <span
                      className="text-xs"
                      style={{
                        color: up ? 'var(--negative)' : 'var(--positive)',
                      }}
                    >
                      {up ? '▲' : '▼'}{' '}
                      <AmountInline value={toNumber(row.delta.abs())} />
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
                  <span className="text-sm font-semibold text-[var(--negative)]">
                    <AmountInline value={toNumber(month.total)} />
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {month.byCategory.map((entry) => (
                    <span
                      key={entry.category}
                      className="flex items-center gap-2 rounded-full neu-sunken px-3 py-1 text-xs text-[var(--text-muted)]"
                    >
                      <ColorDot color={colorByName.get(entry.category) ?? null} />
                      {entry.category} · <AmountInline value={toNumber(entry.total)} />
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
                  <span className="shrink-0 text-sm font-semibold text-[var(--negative)]">
                    <AmountInline value={Math.abs(Number(transaction.amount))} />
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
