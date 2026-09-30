import { AmountInline } from '@/ui/Amount';
import { tileStyle } from './categoryColors';

// Spend-by-category tiles for the selected period. A category with no colour
// set renders neutral, so the grid stays calm by default and colour only shows
// where the user put it deliberately.

export interface CategoryTile {
  id: string;
  name: string;
  color: string | null;
  amount: number;
  count: number;
  budgetLimit?: number | null;
}

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('') || '•';

export const CategoryTiles = ({
  tiles,
  totalSpend,
  selectedId = null,
  onSelect,
}: {
  tiles: CategoryTile[];
  totalSpend?: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) => {
  if (tiles.length === 0) return null;

  const computedTotal =
    totalSpend && totalSpend > 0
      ? totalSpend
      : tiles.reduce((sum, tile) => sum + tile.amount, 0);

  return (
    <div className="grid grid-cols-2 gap-3">
      {tiles.map((tile) => {
        const style = tileStyle(tile.color);
        const selected = selectedId === tile.id;
        const share = computedTotal > 0 ? tile.amount / computedTotal : 0;
        const sharePct = Math.round(share * 100);
        const hasBudget =
          tile.budgetLimit !== undefined &&
          tile.budgetLimit !== null &&
          tile.budgetLimit > 0;
        const budgetRatio = hasBudget ? tile.amount / tile.budgetLimit! : 0;
        const overBudget = hasBudget && tile.amount > tile.budgetLimit!;
        const barWidthPct = hasBudget
          ? Math.min(100, Math.max(4, budgetRatio * 100))
          : Math.min(100, Math.max(4, share * 100));

        return (
          <button
            key={tile.id}
            type="button"
            onClick={() => onSelect?.(tile.id)}
            aria-expanded={onSelect ? selected : undefined}
            className="tap flex min-h-[116px] flex-col justify-between rounded-[var(--radius-card)] p-4 text-left"
            style={{
              background: style.background,
              border: style.border,
              outline: selected ? '1.5px solid var(--accent)' : undefined,
              outlineOffset: '1px',
            }}
          >
            <div className="flex w-full items-start justify-between gap-2">
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-xs font-extrabold"
                style={{ background: style.chipBackground, color: style.chipColor }}
              >
                {initials(tile.name)}
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums"
                style={{
                  background: style.chipBackground,
                  color: style.chipColor,
                }}
              >
                {sharePct}%
              </span>
            </div>

            <div className="mt-2.5 w-full">
              <p className="text-[18px] font-extrabold tracking-[-0.01em] tabular-nums text-[var(--text-strong)]">
                <AmountInline value={tile.amount} />
              </p>
              <p className="mt-0.5 truncate text-xs font-semibold text-[var(--text-2)]">
                {tile.name}
              </p>
              <div className="mt-0.5 flex items-center justify-between gap-1.5 text-[10.5px] text-[var(--text-muted)]">
                <span>
                  {tile.count} transaction{tile.count === 1 ? '' : 's'}
                </span>
                {hasBudget && (
                  <span
                    className="font-semibold tabular-nums"
                    style={{
                      color: overBudget ? 'var(--negative)' : 'var(--text-2)',
                    }}
                  >
                    {Math.round(budgetRatio * 100)}% cap
                  </span>
                )}
              </div>
              <div
                aria-hidden="true"
                className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/25"
              >
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{
                    width: `${barWidthPct}%`,
                    background: overBudget ? 'var(--negative)' : style.dot,
                  }}
                />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

