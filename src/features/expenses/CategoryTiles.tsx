import { tileStyle } from './categoryColors';

// Spend-by-category tiles for the selected month. A category with no colour
// set renders neutral, so the grid stays calm by default and colour only shows
// where the user put it deliberately.
const grouped = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });

export interface CategoryTile {
  id: string;
  name: string;
  color: string | null;
  amount: number;
  count: number;
}

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('') || '•';

export const CategoryTiles = ({
  tiles,
  selectedId = null,
  onSelect,
}: {
  tiles: CategoryTile[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) => {
  if (tiles.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      {tiles.map((tile) => {
        const style = tileStyle(tile.color);
        const selected = selectedId === tile.id;
        return (
          <button
            key={tile.id}
            type="button"
            onClick={() => onSelect?.(tile.id)}
            aria-expanded={onSelect ? selected : undefined}
            className="tap flex min-h-[104px] flex-col justify-between rounded-[var(--radius-card)] p-4 text-left"
            style={{
              background: style.background,
              border: style.border,
              outline: selected ? '1.5px solid var(--accent)' : undefined,
              outlineOffset: '1px',
            }}
          >
            <span
              className="grid h-8 w-8 place-items-center rounded-[10px] text-xs font-extrabold"
              style={{ background: style.chipBackground, color: style.chipColor }}
            >
              {initials(tile.name)}
            </span>
            <div>
              <p className="text-[19px] font-extrabold tracking-[-0.01em] tabular-nums text-[var(--text-strong)]">
                {grouped.format(Math.round(tile.amount))}{' '}
                <span className="text-[var(--accent)]">€</span>
              </p>
              <p className="truncate text-xs font-semibold text-[var(--text-2)]">
                {tile.name}
              </p>
              <p className="text-[10.5px] text-[var(--text-muted)]">
                {tile.count} transaction{tile.count === 1 ? '' : 's'}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
};
