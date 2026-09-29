import { useMemo, useState } from 'react';
import { pct0 as pct } from '@/ui/format';
import type { Money } from '@/core/money/money';
import { toNumber } from '@/core/money/money';
import { budgetLines, totalBudget } from '@/core/expenses/budget';
import { AmountInline } from '@/ui/Amount';
import { Button } from '@/ui/Button';
import { MoneyInput, Select } from '@/ui/Field';
import type { Category } from './api/useCategories';
import { useBudgets, useSetBudget } from './api/useBudgets';
import { tileStyle } from './categoryColors';

const ProgressBar = ({
  ratio,
  over,
  paceRatio,
}: {
  ratio: number;
  over: boolean;
  paceRatio?: number;
}) => {
  const aheadOfPace =
    !over && paceRatio !== undefined && ratio > paceRatio + 0.12;
  return (
    <div className="relative h-2.5 overflow-hidden rounded-full neu-sunken">
      <div
        className="h-full rounded-full transition-[width]"
        style={{
          width: `${Math.min(ratio, 1) * 100}%`,
          background: over
            ? 'var(--negative)'
            : aheadOfPace
              ? 'var(--accent)'
              : 'var(--positive)',
        }}
      />
      {paceRatio !== undefined && paceRatio > 0.02 && paceRatio < 0.98 && (
        <span
          aria-hidden="true"
          title={`Today's pace (${Math.round(paceRatio * 100)}% of period elapsed)`}
          className="pointer-events-none absolute inset-y-0 w-[2px] bg-[var(--text-strong)]/80 shadow-[0_0_4px_rgba(0,0,0,0.9)]"
          style={{ left: `${Math.min(98, Math.max(2, paceRatio * 100))}%` }}
        />
      )}
    </div>
  );
};

export const BudgetPanel = ({
  categories,
  spentOf,
  paceRatio,
  periodLabel = 'This month',
}: {
  categories: Category[];
  spentOf: (categoryId: string) => Money;
  paceRatio?: number;
  periodLabel?: string;
}) => {
  const { data: budgets = [] } = useBudgets();
  const setBudget = useSetBudget();
  const [newCategory, setNewCategory] = useState('');
  const [newLimit, setNewLimit] = useState('');

  const nameOf = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const colorOf = useMemo(
    () => new Map(categories.map((category) => [category.id, category.color])),
    [categories],
  );

  const lines = useMemo(
    () => budgetLines(budgets, spentOf),
    [budgets, spentOf],
  );
  const totals = useMemo(() => totalBudget(lines), [lines]);

  const budgeted = new Set(budgets.map((budget) => budget.categoryId));
  const available = categories.filter((category) => !budgeted.has(category.id));

  const addBudget = () => {
    if (!newCategory || !newLimit) return;
    setBudget.mutate(
      { categoryId: newCategory, limit: newLimit },
      {
        onSuccess: () => {
          setNewCategory('');
          setNewLimit('');
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {lines.length > 0 && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--text-muted)]">
              {periodLabel}
            </span>
            {paceRatio !== undefined && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
                <span className="inline-block h-2 w-[2px] bg-[var(--text-strong)]/80" />
                {Math.round(paceRatio * 100)}% elapsed
              </span>
            )}
          </div>
          <span className="text-sm font-semibold tabular-nums text-[var(--text-strong)]">
            <AmountInline value={toNumber(totals.spent)} />{' '}
            <span className="text-[var(--text-muted)]">
              / <AmountInline value={toNumber(totals.limit)} />
            </span>
          </span>
        </div>
      )}

      {lines.map((line) => {
        const aheadOfPace =
          !line.over &&
          paceRatio !== undefined &&
          line.ratio > paceRatio + 0.12;
        return (
          <div key={line.categoryId} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    background: tileStyle(colorOf.get(line.categoryId) ?? null)
                      .dot,
                  }}
                />
                <span className="truncate text-sm font-semibold text-[var(--text-strong)]">
                  {nameOf.get(line.categoryId) ?? 'Category'}
                </span>
                {aheadOfPace && (
                  <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--accent)]">
                    Fast pace
                  </span>
                )}
              </span>
              <span className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">
                <AmountInline value={toNumber(line.spent)} /> /{' '}
                <AmountInline value={toNumber(line.limit)} />
              </span>
            </div>
            <ProgressBar
              ratio={line.ratio}
              over={line.over}
              paceRatio={paceRatio}
            />
            <div className="flex items-center justify-between">
              <span
                className="text-xs font-semibold tabular-nums"
                style={{
                  color: line.over
                    ? 'var(--negative)'
                    : aheadOfPace
                      ? 'var(--accent)'
                      : 'var(--text-muted)',
                }}
              >
                {line.over ? (
                  <>
                    <AmountInline value={toNumber(line.remaining.abs())} /> over
                  </>
                ) : (
                  <>
                    <AmountInline value={toNumber(line.remaining)} /> left ·{' '}
                    {pct.format(line.ratio)}
                  </>
                )}
              </span>
              <button
                type="button"
                onClick={() =>
                  setBudget.mutate({ categoryId: line.categoryId, limit: null })
                }
                className="tap text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--negative)]"
              >
                Remove
              </button>
            </div>
          </div>
        );
      })}

      {available.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-[var(--line)] pt-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Select
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value)}
            >
              <option value="">Add a budget…</option>
              {available.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-full sm:w-32">
            <MoneyInput
              placeholder="Limit €"
              value={newLimit}
              onChange={setNewLimit}
            />
          </div>
          <Button
            type="button"
            onClick={addBudget}
            disabled={!newCategory || !newLimit || setBudget.isPending}
          >
            Set
          </Button>
        </div>
      )}

      {lines.length === 0 && available.length === 0 && (
        <p className="text-sm text-[var(--text-muted)]">
          Create a category first, then set a monthly limit for it.
        </p>
      )}
    </div>
  );
};
