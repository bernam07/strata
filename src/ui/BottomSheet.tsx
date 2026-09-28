import { useEffect, type ReactNode } from 'react';

export const BottomSheet = ({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="page-enter relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border-t border-[var(--line)] bg-[var(--surface-raised)] shadow-[0_-16px_48px_rgba(0,0,0,0.65)] sm:rounded-[var(--radius-card)] sm:border">
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-[var(--line)] sm:hidden" />
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--line)]/60 px-5 pb-3.5 pt-3 sm:px-6 sm:pt-5">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[var(--text-strong)]">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="tap grid h-8 w-8 shrink-0 place-items-center rounded-full neu-flat text-sm text-[var(--text-muted)] hover:text-[var(--text-strong)]"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-6">
          {children}
        </div>
      </div>
    </div>
  );
};
