export const extractCursor = (nextPagePath: string | null): string | null => {
  if (!nextPagePath) return null;
  const queryStart = nextPagePath.indexOf('?');
  if (queryStart === -1) return null;
  const params = new URLSearchParams(nextPagePath.slice(queryStart + 1));
  return params.get('cursor');
};
