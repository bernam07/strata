export interface Searchable {
  label: string;
  keywords?: readonly string[];
}

// Case-insensitive, multi-term AND matching over the label and keywords. An
// empty query returns everything (in the original order). Kept pure so the
// palette's filtering can be unit-tested without rendering anything.
export const filterCommands = <T extends Searchable>(
  items: readonly T[],
  query: string,
): T[] => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [...items];
  const terms = normalized.split(/\s+/);
  return items.filter((item) => {
    const haystack = `${item.label} ${item.keywords?.join(' ') ?? ''}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
};
