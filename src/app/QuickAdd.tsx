import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAccounts } from '@/features/accounts/api/useAccounts';
import { TransactionForm } from '@/features/transactions/components/TransactionForm';
import { TransferForm } from '@/features/transactions/components/TransferForm';
import { BottomSheet } from '@/ui/BottomSheet';
import { Button } from '@/ui/Button';
import { SegmentedControl } from '@/ui/SegmentedControl';

export const QuickAdd = ({ hidden = false }: { hidden?: boolean }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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

  const urlPrefill = useMemo(() => {
    const shouldOpen =
      searchParams.get('quickAdd') === 'true' ||
      searchParams.get('add') === 'true' ||
      searchParams.has('amount');
    if (!shouldOpen) return undefined;
    return {
      amount: searchParams.get('amount') ?? undefined,
      note: searchParams.get('note') ?? searchParams.get('merchant') ?? undefined,
      kind: 'expense' as const,
      account: activeAccountId ?? searchParams.get('account') ?? undefined,
    };
  }, [searchParams, activeAccountId]);

  useEffect(() => {
    if (urlPrefill) {
      setTab('transaction');
      setOpen(true);
    }
  }, [urlPrefill]);

  const handleClose = () => {
    setOpen(false);
    if (
      searchParams.has('add') ||
      searchParams.has('quickAdd') ||
      searchParams.has('amount')
    ) {
      const next = new URLSearchParams(searchParams);
      next.delete('add');
      next.delete('quickAdd');
      next.delete('amount');
      next.delete('note');
      next.delete('merchant');
      next.delete('account');
      setSearchParams(next, { replace: true });
    }
  };

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
        onClose={handleClose}
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
                handleClose();
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
                onDone={handleClose}
              />
            ) : (
              <TransactionForm
                accounts={accounts}
                prefill={
                  urlPrefill ??
                  (activeAccountId ? { account: activeAccountId } : undefined)
                }
                onDone={handleClose}
              />
            )}
          </div>
        )}
      </BottomSheet>
    </>
  );
};
