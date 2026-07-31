export const backoffDelayMs = (
  attempt: number,
  baseMs = 1000,
  maxMs = 60000,
): number => Math.min(maxMs, baseMs * 2 ** attempt);

export const retryAfterMs = (
  header: string | null,
  fallbackMs: number,
): number => {
  if (!header) return fallbackMs;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return fallbackMs;
};

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
