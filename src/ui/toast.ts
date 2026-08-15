export type ToastTone = 'info' | 'success' | 'error';

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

// A tiny module-level store so anything — hooks, event handlers, plain
// functions — can raise a toast without threading a context through the tree.
let toasts: Toast[] = [];
const listeners = new Set<(toasts: Toast[]) => void>();
let nextId = 1;

const emit = () => {
  for (const listener of listeners) listener(toasts);
};

export const dismissToast = (id: number): void => {
  toasts = toasts.filter((toast) => toast.id !== id);
  emit();
};

export const toast = (
  message: string,
  tone: ToastTone = 'info',
  ttl = 3200,
): number => {
  const id = nextId++;
  toasts = [...toasts, { id, message, tone }];
  emit();
  if (ttl > 0) setTimeout(() => dismissToast(id), ttl);
  return id;
};

export const subscribeToasts = (
  listener: (toasts: Toast[]) => void,
): (() => void) => {
  listeners.add(listener);
  listener(toasts);
  return () => {
    listeners.delete(listener);
  };
};
