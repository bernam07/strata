import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
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
import {
  computePaydayCycle,
  usePaydayCycle,
} from '@/core/payday/paydayCycle';
import { useAccounts } from '@/features/accounts/api/useAccounts';
import { useTransactions } from '@/features/transactions/api/useTransactions';
import { RecurringManager } from '@/features/transactions/components/RecurringManager';
import { TransactionForm } from '@/features/transactions/components/TransactionForm';
import { Button } from '@/ui/Button';
import { BottomSheet } from '@/ui/BottomSheet';
import { CashflowNav } from '@/ui/HubNav';
import { PageHeader } from '@/ui/PageHeader';
import { Card } from '@/ui/Card';
import { Collapsible } from '@/ui/Collapsible';
import { Surface } from '@/ui/Surface';
import { AmountInline } from '@/ui/Amount';
import { CardTitle, headingClass } from '@/ui/Heading';
import { TextInput } from '@/ui/Field';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { dayMonth } from '@/ui/format';
import { toast } from '@/ui/toast';
import { monthlyCashflow } from '@/core/analytics/cashflow';
import { BudgetPanel } from './BudgetPanel';
import { CategoryManager } from './CategoryManager';
import { CategoryTiles, type CategoryTile } from './CategoryTiles';
import { SpendOverview } from './SpendOverview';
import { tileStyle } from './categoryColors';
import {
  useAssignCategoriesBulk,
  useAssignCategory,
  useAssignments,
  useCategories,
  useUpdateCategory,
} from './api/useCategories';
import { useBudgets } from './api/useBudgets';
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
  const { data: budgets = [] } = useBudgets();
  const assign = useAssignCategory();
  const assignBulk = useAssignCategoriesBulk();
  const { cycle, config: paydayConfig } = usePaydayCycle();
  const [periodMode, setPeriodMode] = useState<'calendar' | 'cycle'>(() => {
    try {
      return localStorage.getItem('strata-expenses-period-v1') === 'calendar'
        ? 'calendar'
        : 'cycle';
    } catch {
      return 'cycle';
    }
  });
  const [adding, setAdding] = useState(false);
  const [managing, setManaging] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [editingCategory, setEditingCategory] = useState<{
    id: string;
    name: string;
    color: string | null;
  } | null>(null);
  const [categorizeFilter, setCategorizeFilter] = useState<
    'uncategorized' | 'all'
  >('uncategorized');
  const updateCategory = useUpdateCategory();
  const [searchParams, setSearchParams] = useSearchParams();

  const changePeriodMode = (next: 'calendar' | 'cycle') => {
    setPeriodMode(next);
    try {
      localStorage.setItem('strata-expenses-period-v1', next);
    } catch {
      // ignore
    }
  };

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

  const activePeriod = useMemo(() => {
    if (periodMode === 'cycle') {
      const [sy = 0, sm = 1, sd = 1] = cycle.cycleStartIso.split('-').map(Number);
      const prevAnchor = new Date(sy, sm - 1, sd - 1, 12, 0, 0);
      const prevCycle = computePaydayCycle(prevAnchor, paydayConfig);
      const label = `${dayMonth.format(cycle.cycleStart)} – ${dayMonth.format(cycle.cycleEndInclusive)}`;
      const paceRatio = Math.min(
        1,
        Math.max(0, cycle.elapsedCalendarDays / cycle.totalCalendarDays),
      );
      return {
        label: `Pay cycle (${label})`,
        shortLabel: label,
        paceRatio,
        inCurrent: (iso: string) => {
          const d = iso.slice(0, 10);
          return d >= cycle.cycleStartIso && d <= cycle.cycleEndIso;
        },
        inPrevious: (iso: string) => {
          const d = iso.slice(0, 10);
          return d >= prevCycle.cycleStartIso && d <= prevCycle.cycleEndIso;
        },
      };
    }

    const curMonth = monthKey(0);
    const prevMonth = monthKey(1);
    const now = new Date();
    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).getDate();
    const paceRatio = Math.min(1, Math.max(0, now.getDate() / daysInMonth));
    return {
      label: monthLabel(curMonth),
      shortLabel: monthLabel(curMonth),
      paceRatio,
      inCurrent: (iso: string) => iso.startsWith(curMonth),
      inPrevious: (iso: string) => iso.startsWith(prevMonth),
    };
  }, [periodMode, cycle, paydayConfig]);

  const comparison = useMemo(() => {
    const current = transactions.filter((t) =>
      activePeriod.inCurrent(t.occurredAt),
    );
    const previous = transactions.filter((t) =>
      activePeriod.inPrevious(t.occurredAt),
    );
    return comparePeriods(current, previous, categoryName);
  }, [transactions, categoryName, activePeriod]);

  const spentThisMonth = useMemo(() => {
    const totals = new Map<string, Money>();
    for (const transaction of transactions) {
      if (transaction.kind !== 'expense') continue;
      if (!activePeriod.inCurrent(transaction.occurredAt)) continue;
      const categoryId = assignments?.get(transaction.id);
      if (!categoryId) continue;
      totals.set(
        categoryId,
        (totals.get(categoryId) ?? zero()).plus(money(transaction.amount).abs()),
      );
    }
    return totals;
  }, [transactions, assignments, activePeriod]);

  const spentOf = useCallback(
    (categoryId: string) => spentThisMonth.get(categoryId) ?? zero(),
    [spentThisMonth],
  );

  const categoryTiles = useMemo<CategoryTile[]>(() => {
    const byId = new Map(categories.map((c) => [c.id, c]));
    const budgetByCat = new Map(
      budgets.map((b) => [b.categoryId, Number(b.limit)]),
    );
    const agg = new Map<string, { amount: number; count: number }>();
    for (const transaction of transactions) {
      if (transaction.kind !== 'expense') continue;
      if (!activePeriod.inCurrent(transaction.occurredAt)) continue;
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
        budgetLimit: budgetByCat.get(id) ?? null,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [transactions, categories, assignments, budgets, activePeriod]);

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

  const accountNameById = useMemo(
    () => new Map(accounts.map((a) => [a.id, a.name])),
    [accounts],
  );

  const expenses = useMemo(
    () => transactions.filter((t) => t.kind === 'expense'),
    [transactions],
  );

  const uncategorizedExpenses = useMemo(
    () => expenses.filter((t) => !assignments?.get(t.id)),
    [expenses, assignments],
  );

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) ?? null,
    [categories, selectedCategoryId],
  );

  const selectedCategoryExpenses = useMemo(() => {
    if (!selectedCategoryId) return [];
    return expenses.filter(
      (t) =>
        activePeriod.inCurrent(t.occurredAt) &&
        assignments?.get(t.id) === selectedCategoryId,
    );
  }, [expenses, activePeriod, assignments, selectedCategoryId]);

  const handleCategorize = (
    tx: (typeof expenses)[number],
    categoryId: string | null,
  ) => {
    if (categoryId === null) {
      assign.mutate({ transactionId: tx.id, categoryId: null });
      return;
    }
    const normalizedNote = tx.note?.trim().toLowerCase() ?? '';
    if (normalizedNote.length >= 2) {
      const matchingIds = expenses
        .filter(
          (item) =>
            (item.id === tx.id || !assignments?.get(item.id)) &&
            (item.note?.trim().toLowerCase() ?? '') === normalizedNote,
        )
        .map((item) => item.id);

      if (matchingIds.length > 1) {
        const catName =
          categories.find((c) => c.id === categoryId)?.name ?? 'Category';
        assignBulk.mutate(
          { transactionIds: matchingIds, categoryId },
          {
            onSuccess: () =>
              toast(
                `${catName} · categorized ${matchingIds.length} "${tx.note!.trim()}" expenses`,
                'success',
              ),
          },
        );
        return;
      }
    }
    assign.mutate({ transactionId: tx.id, categoryId });
  };

  const categorizeList =
    categorizeFilter === 'uncategorized' && uncategorizedExpenses.length > 0
      ? uncategorizedExpenses
      : expenses;

  return (
    <div className="flex flex-col gap-6">
      <CashflowNav />

      <PageHeader
        title="Spending"
        subtitle="Where your money goes each period."
        actions={
          <>
            <SegmentedControl
              value={periodMode}
              onChange={changePeriodMode}
              label="Expense period mode"
              segments={[
                { value: 'cycle', label: 'Pay cycle' },
                { value: 'calendar', label: 'Calendar' },
              ]}
            />
            <Button
              size="sm"
              onClick={() => setAdding(true)}
              disabled={accounts.length === 0}
            >
              Add expense
            </Button>
          </>
        }
      />

      <BottomSheet
        open={adding}
        onClose={() => setAdding(false)}
        title="New expense"
      >
        <TransactionForm
          accounts={accounts}
          defaultKind="expense"
          onDone={() => setAdding(false)}
        />
      </BottomSheet>

      <SpendOverview
        transactions={transactions}
        preferredRange={periodMode === 'cycle' ? 'cycle' : 'month'}
      />

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3 px-0.5">
          <div className="flex items-baseline gap-2">
            <h2 className={headingClass}>Categories</h2>
            <span className="text-xs text-[var(--text-muted)]">
              · {activePeriod.shortLabel}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setManaging((open) => !open);
              setEditingCategory(null);
              setSelectedCategoryId(null);
            }}
            className="tap text-xs font-semibold text-[var(--accent)]"
          >
            {managing ? 'Done' : 'Manage'}
          </button>
        </div>

        <CategoryTiles
          tiles={categoryTiles}
          totalSpend={comparison.reduce(
            (sum, row) => sum + toNumber(row.current),
            0,
          )}
          selectedId={selectedCategoryId}
          onSelect={(id) => {
            setManaging(false);
            setEditingCategory(null);
            setSelectedCategoryId((current) => (current === id ? null : id));
          }}
        />

        {selectedCategory && !editingCategory && (
          <Card className="page-enter flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ColorDot color={selectedCategory.color} />
                <CardTitle>{selectedCategory.name}</CardTitle>
                <span className="text-xs font-semibold tabular-nums text-[var(--text-muted)]">
                  · {selectedCategoryExpenses.length} movement
                  {selectedCategoryExpenses.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setEditingCategory({
                      id: selectedCategory.id,
                      name: selectedCategory.name,
                      color: selectedCategory.color,
                    })
                  }
                  className="tap rounded-full neu-flat px-2.5 py-1 text-xs font-semibold text-[var(--accent)]"
                >
                  ✎ Edit name &amp; color
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategoryId(null)}
                  className="tap rounded-full px-2 py-1 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                >
                  ✕
                </button>
              </div>
            </div>

            {selectedCategoryExpenses.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">
                No expenses in this category for {activePeriod.shortLabel}.
              </p>
            ) : (
              <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-0.5">
                {selectedCategoryExpenses.map((tx) => {
                  const acctName = accountNameById.get(tx.accountId);
                  return (
                    <li
                      key={tx.id}
                      className="flex items-center justify-between gap-3 rounded-[var(--radius-field)] bg-[var(--surface-sunken)] px-3 py-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-[var(--text-strong)]">
                          {tx.note || 'Expense'}
                        </p>
                        <p className="truncate text-[11px] text-[var(--text-muted)]">
                          {tx.occurredAt.slice(0, 10)}
                          {acctName ? ` · ${acctName}` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 font-bold tabular-nums text-[var(--negative)]">
                        <AmountInline value={Math.abs(Number(tx.amount))} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        )}

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
            Nothing categorised in {activePeriod.shortLabel} yet — assign a few
            expenses below, or use Manage to add categories.
          </p>
        )}
      </section>

      <Card className="flex flex-col gap-4">
        <CardTitle>Budgets</CardTitle>
        <BudgetPanel
          categories={categories}
          spentOf={spentOf}
          paceRatio={activePeriod.paceRatio}
          periodLabel={activePeriod.label}
        />
      </Card>

      {accounts.length > 0 && (
        <Collapsible title="Fixed bills & subscriptions">
          <RecurringManager accounts={accounts} />
        </Collapsible>
      )}

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

      {comparison.length > 0 && (
        <Collapsible
          title={
            periodMode === 'cycle'
              ? 'This pay cycle vs. previous'
              : 'This month vs. last'
          }
        >
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

      <Collapsible
        title="Categorize"
        badge={
          uncategorizedExpenses.length > 0
            ? `${uncategorizedExpenses.length} uncategorized`
            : 'All categorized'
        }
      >
        {expenses.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No expenses.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center rounded-full border border-[var(--line)] bg-[var(--surface-sunken)] p-0.5 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setCategorizeFilter('uncategorized')}
                  className={`tap rounded-full px-3 py-1 transition-colors ${
                    categorizeFilter === 'uncategorized'
                      ? 'bg-[var(--surface-raised)] text-[var(--text-strong)] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'
                  }`}
                >
                  Uncategorized ({uncategorizedExpenses.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCategorizeFilter('all')}
                  className={`tap rounded-full px-3 py-1 transition-colors ${
                    categorizeFilter === 'all'
                      ? 'bg-[var(--surface-raised)] text-[var(--text-strong)] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'
                  }`}
                >
                  All ({expenses.length})
                </button>
              </div>
              <span className="text-[11px] text-[var(--text-muted)]">
                Auto-groups identical merchant notes
              </span>
            </div>

            {categorizeFilter === 'uncategorized' &&
            uncategorizedExpenses.length === 0 ? (
              <p className="py-4 text-center text-xs font-semibold text-[var(--positive)]">
                ✓ Every expense is categorized. Switch to &ldquo;All&rdquo; to
                review or reassign.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {categorizeList.slice(0, 40).map((transaction) => {
                  const currentCatId = assignments?.get(transaction.id) ?? null;
                  const acctName = accountNameById.get(transaction.accountId);
                  return (
                    <Surface
                      key={transaction.id}
                      elevation="flat"
                      className="flex flex-col gap-2 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[var(--text-strong)]">
                            {transaction.note || 'Expense'}
                          </p>
                          <p className="truncate text-[11px] tabular-nums text-[var(--text-muted)]">
                            {transaction.occurredAt.slice(0, 10)}
                            {acctName ? ` · ${acctName}` : ''}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-[var(--negative)]">
                          <AmountInline
                            value={Math.abs(Number(transaction.amount))}
                          />
                        </span>
                      </div>
                      {categories.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {categories.map((cat) => {
                            const style = tileStyle(cat.color);
                            const active = currentCatId === cat.id;
                            return (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() =>
                                  handleCategorize(
                                    transaction,
                                    active ? null : cat.id,
                                  )
                                }
                                className="tap inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition"
                                style={{
                                  background: active
                                    ? style.chipBackground
                                    : 'var(--surface-sunken)',
                                  color: active
                                    ? style.chipColor
                                    : 'var(--text-strong)',
                                  border: active
                                    ? `1.5px solid ${style.dot}`
                                    : '1px solid var(--line)',
                                }}
                              >
                                <span
                                  aria-hidden="true"
                                  className="h-2 w-2 shrink-0 rounded-full"
                                  style={{ background: style.dot }}
                                />
                                {cat.name}
                              </button>
                            );
                          })}
                          {currentCatId && (
                            <button
                              type="button"
                              onClick={() => handleCategorize(transaction, null)}
                              className="tap rounded-full px-2 py-1 text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--negative)]"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      )}
                    </Surface>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </Collapsible>
    </div>
  );
};

