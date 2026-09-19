import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Action {
  label: string;
  hint: string;
  to: string;
}

const actions: Action[] = [
  { label: 'New transaction', hint: 'Income, buy, sell…', to: '/transactions?new=transaction' },
  { label: 'New expense', hint: 'A spend to categorize', to: '/expenses?new=1' },
  { label: 'Transfer', hint: 'Move between accounts', to: '/transactions?new=transfer' },
];

export const QuickAdd = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Clears the bottom bar and the home indicator beneath it, so the
          button never sits in front of the tab strip. */}
      <div className="fixed bottom-[calc(6.5rem+env(safe-area-inset-bottom))] right-4 z-40 lg:bottom-8 lg:right-8">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? 'Close quick add' : 'Quick add'}
          aria-expanded={open}
          className="tap relative z-10 grid h-14 w-14 place-items-center rounded-full shadow-[0_12px_28px_-10px_var(--accent)]"
          style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
        >
          <svg
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            className="transition-transform"
            style={{ transform: open ? 'rotate(45deg)' : 'none' }}
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        {open && (
          <div className="page-enter absolute bottom-[calc(100%+0.75rem)] right-0 w-56 rounded-[var(--radius-card)] neu-raised p-2">
            {actions.map((action) => (
              <button
                key={action.to}
                type="button"
                onClick={() => go(action.to)}
                className="tap flex w-full flex-col items-start rounded-[var(--radius-field)] px-3 py-2.5 text-left hover:bg-[var(--accent-soft)]"
              >
                <span className="text-sm font-semibold text-[var(--text-strong)]">
                  {action.label}
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  {action.hint}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
};
