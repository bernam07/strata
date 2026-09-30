import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAccounts } from '@/features/accounts/api/useAccounts';
import { TransactionForm } from '@/features/transactions/components/TransactionForm';
import { TransferForm } from '@/features/transactions/components/TransferForm';
import { BottomSheet } from '@/ui/BottomSheet';
import { Button } from '@/ui/Button';
import { SegmentedControl } from '@/ui/SegmentedControl';

export const QuickAdd = ({ hidden = false }: { hidden?: boolean }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: accounts = [] } = useAccounts();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'transaction' | 'transfer'>('transaction');

  // If the user is inside /accounts/:id, pre-select that account automatically
  const activeAccountId = useMemo(() => {
    const match = location.pathname.match(/^\/accounts\/([^/]+)$/);
    return match?.[1] ?? undefined;
  }, [location.pathname]);

  const activeAccount = useMemo(
    () =>
      activeAccountId
        ? accounts.find((a) => a.id === activeAccountId)
        : undefined,
    [accounts, activeAccountId],
  );

  return (
    <>
      {/* Sits comfortably above the bottom navigation bar and home indicator */}
      <div
        className={`fixed bottom-[calc(var(--bottom-bar-total-h,4rem)+0.85rem)] right-4 z-40 transition-all duration-200 ease-out lg:bottom-8 lg:right-8 ${
          hidden && !open
            ? 'translate-y-20 opacity-0 pointer-events-none'
            : 'translate-y-0 opacity-100'
        }`}
      >
        <button
          type="button"
          onClick={() => {
            setTab('transaction');
            setOpen(true);
          }}
          aria-label="Quick add movement"
          aria-expanded={open}
          className="tap relative z-10 grid h-12 w-12 sm:h-14 sm:w-14 place-items-center rounded-full shadow-[0_12px_28px_-10px_var(--accent)]"
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
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={
          activeAccount
            ? `New movement · ${activeAccount.name}`
            : 'Quick add movement'
        }
      >
        {accounts.length === 0 ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-[var(--text-muted)]">
              Create your first account before recording movements.
            </p>
            <Button
              size="sm"
              onClick={() => {
                setOpen(false);
                navigate('/accounts');
              }}
            >
              Go to Accounts
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {accounts.length >= 2 && (
              <SegmentedControl
                value={tab}
                onChange={setTab}
                segments={[
                  { value: 'transaction', label: 'Expense / Income' },
                  { value: 'transfer', label: 'Transfer ⇄' },
                ]}
              />
            )}

            {tab === 'transfer' && accounts.length >= 2 ? (
              <TransferForm
                accounts={accounts}
                defaultFromAccountId={activeAccountId}
                onDone={() => setOpen(false)}
              />
            ) : (
              <TransactionForm
                accounts={accounts}
                prefill={
                  activeAccountId ? { account: activeAccountId } : undefined
                }
                onDone={() => setOpen(false)}
              />
            )}
          </div>
        )}
      </BottomSheet>
    </>
  );
};
