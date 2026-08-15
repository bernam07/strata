import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dismissToast, subscribeToasts, toast } from './toast';

describe('toast store', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('notifies subscribers when a toast is added and auto-dismisses after its ttl', () => {
    const seen: number[] = [];
    const unsubscribe = subscribeToasts((toasts) => seen.push(toasts.length));
    expect(seen).toEqual([0]); // initial snapshot

    toast('Prices updated', 'success', 1000);
    expect(seen.at(-1)).toBe(1);

    vi.advanceTimersByTime(1000);
    expect(seen.at(-1)).toBe(0);
    unsubscribe();
  });

  it('dismisses a specific toast by id', () => {
    let latest = 0;
    const unsubscribe = subscribeToasts((toasts) => (latest = toasts.length));
    const id = toast('Kept', 'info', 0); // ttl 0 → no auto-dismiss
    toast('Other', 'info', 0);
    expect(latest).toBe(2);
    dismissToast(id);
    expect(latest).toBe(1);
    unsubscribe();
  });
});
