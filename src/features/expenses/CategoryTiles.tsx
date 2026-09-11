// Spend-by-category tiles for the current month. Each tile is tinted from a
// fixed hue mixed into the surface colour, so it reads as a deep, dark tint in
// dark mode and a soft pastel in light mode — one definition, both themes.
const grouped = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });

// Distinct, legible hues assigned in spend order. Kept few so colours repeat
// predictably rather than drifting into muddy near-duplicates.
const HUES = ['#52c48c', '#e0a44a', '#c58fd6', '#6aa6e0', '#ef6b78', '#9fce5f'];

export interface CategoryTile {
  id: string;
  name: string;
  amount: number;
  count: number;
}

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('') || '•';

export const CategoryTiles = ({ tiles }: { tiles: CategoryTile[] }) => {
  if (tiles.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      {tiles.map((tile, index) => {
        const hue = HUES[index % HUES.length]!;
        return (
          <div
            key={tile.id}
            className="flex min-h-[104px] flex-col justify-between rounded-[var(--radius-card)] p-4"
            style={{
              background: `color-mix(in srgb, ${hue} 13%, var(--surface-flat))`,
              border: `1px solid color-mix(in srgb, ${hue} 22%, transparent)`,
            }}
          >
            <span
              className="grid h-8 w-8 place-items-center rounded-[10px] text-xs font-extrabold"
              style={{
                background: `color-mix(in srgb, ${hue} 26%, transparent)`,
                color: hue,
              }}
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
          </div>
        );
      })}
    </div>
  );
};
