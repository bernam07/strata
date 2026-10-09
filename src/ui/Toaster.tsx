import { useEffect, useState } from 'react';
import { dismissToast, subscribeToasts, type Toast } from './toast';

const toneClass: Record<Toast['tone'], string> = {
  info: 'text-[var(--text-strong)]',
  success: 'text-[var(--positive)]',
  error: 'text-[var(--negative)]',
};

const dot: Record<Toast['tone'], string> = {
  info: 'var(--accent)',
  success: 'var(--positive)',
  error: 'var(--negative)',
};

export const Toaster = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => subscribeToasts(setToasts), []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-bar-total-h,4rem)+1.25rem)] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-8">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => dismissToast(toast.id)}
          className="page-enter pointer-events-auto flex items-center gap-2.5 rounded-[var(--radius-pill)] neu-raised px-4 py-2.5 text-sm font-semibold shadow-[var(--shadow)]"
        >
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: dot[toast.tone] }}
          />
          <span className={toneClass[toast.tone]}>{toast.message}</span>
        </button>
      ))}
    </div>
  );
};
