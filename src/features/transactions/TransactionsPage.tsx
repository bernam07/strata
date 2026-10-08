import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Transaction } from '@/core/types';
import { money, toNumber } from '@/core/money/money';
import { usePaydayCycle } from '@/core/payday/paydayCycle';
import { transactionsToCsv } from '@/core/transactions/exportCsv';
import { AmountInline } from '@/ui/Amount';
import { Button } from '@/ui/Button';
import { BottomSheet } from '@/ui/BottomSheet';
import { CashflowNav } from '@/ui/HubNav';
import { PageHeader } from '@/ui/PageHeader';
import { Card } from '@/ui/Card';
import { Collapsible } from '@/ui/Collapsible';
import { Labelled, Select, TextInput } from '@/ui/Field';
import { SkeletonRows } from '@/ui/Skeleton';
import { useAccounts } from '@/features/accounts/api/useAccounts';
import {
  useAssignments,
  useCategories,
} from '@/features/expenses/api/useCategories';
import { useInstruments } from '@/features/positions/api/usePositions';
import {
  useConfirmWalletTransaction,
  useDeleteTransaction,
  useReverseTransaction,
  useTransactions,
  useUpdateTransaction,
  type TransactionFilter,
} from './api/useTransactions';
import { toast } from '@/ui/toast';
import {
  TransactionForm,
  type TransactionPrefill,
} from './components/TransactionForm';
import { TransferForm, type TransferPrefill } from './components/TransferForm';
import { TransactionList } from './components/TransactionList';
import { RecurringManager } from './components/RecurringManager';

type AddMode = 'none' | 'transaction' | 'transfer';
type QuickKindFilter =
  | 'all'
  | 'pending'
  | 'expenses'
  | 'uncategorized'
  | 'income'
  | 'transfers'
  | 'investments';
type DatePreset = 'all' | 'cycle' | 'month' | '30days' | 'custom';

export const TransactionsPage = () => {
  const { data: accounts = [] } = useAccounts();
  const [filter, setFilter] = useState<TransactionFilter>({});
  const [datePreset, setDatePresetState] = useState<DatePreset>('all');
  const [quickKind, setQuickKind] = useState<QuickKindFilter>('all');
  const [showCustomDates, setShowCustomDates] = useState(false);
  const [mode, setMode] = useState<AddMode>('none');
  const { data: transactions = [], isLoading } = useTransactions(filter);
  const { data: instruments } = useInstruments();
  const { data: assignments } = useAssignments();
  const { data: categories = [] } = useCategories();
  const { cycle } = usePaydayCycle();
  const reverse = useReverseTransaction();
  const del = useDeleteTransaction();
  const updateTx = useUpdateTransaction();
  const confirmWallet = useConfirmWalletTransaction();
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [search, setSearch] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const [prefill, setPrefill] = useState<TransactionPrefill | null>(null);
  const [transferPrefill, setTransferPrefill] =
    useState<TransferPrefill | null>(null);

  useEffect(() => {
    const add = searchParams.get('new');
    if (add === 'transaction' || add === 'transfer' || add === 'expense') {
      const rawAmount = searchParams.get('amount') ?? undefined;
      const cleanAmount = rawAmount
        ? rawAmount.replace(/[^0-9.,]/g, '').replace(',', '.')
        : undefined;
      setPrefill({
        amount: cleanAmount,
        note: searchParams.get('note') ?? searchParams.get('merchant') ?? undefined,
        account: searchParams.get('account') ?? searchParams.get('institution') ?? undefined,
        kind:
          searchParams.get('kind') === 'income'
            ? 'income'
            : add === 'expense'
              ? 'expense'
              : undefined,
      });
      setMode(add === 'transfer' ? 'transfer' : 'transaction');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const patchFilter = (patch: Partial<TransactionFilter>) =>
    setFilter((current) => {
      const next = { ...current, ...patch };
      for (const key of Object.keys(next) as (keyof TransactionFilter)[]) {
        if (!next[key]) delete next[key];
      }
      return next;
    });

  const onReverse = (transaction: Transaction) => {
    reverse.mutate(transaction, {
      onSuccess: () => toast('Reversal entry added', 'success'),
      onError: () => toast("Couldn't reverse transaction", 'error'),
    });
  };

  const onDelete = (transaction: Transaction) => {
    del.mutate(transaction.id, {
      onSuccess: () => toast('Transaction deleted', 'info'),
      onError: () => toast("Couldn't delete transaction", 'error'),
    });
  };

  const noAccounts = accounts.length === 0;

  const categoryNameById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const uncategorizedCount = useMemo(
    () =>
      transactions.filter(
        (tx) => tx.kind === 'expense' && !assignments?.get(tx.id),
      ).length,
    [transactions, assignments],
  );

  const pendingWalletTransactions = useMemo(
    () =>
      transactions.filter((tx) =>
        tx.externalId?.startsWith('wallet:pending'),
      ),
    [transactions],
  );

  const visibleTransactions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return transactions.filter((transaction) => {
      if (quickKind === 'pending') {
        if (!transaction.externalId?.startsWith('wallet:pending')) {
          return false;
        }
      } else if (quickKind === 'expenses') {
        if (transaction.kind !== 'expense' && transaction.kind !== 'fee') {
          return false;
        }
      } else if (quickKind === 'uncategorized') {
        if (
          transaction.kind !== 'expense' ||
          Boolean(assignments?.get(transaction.id))
        ) {
          return false;
        }
      } else if (quickKind === 'income') {
        if (
          transaction.kind !== 'income' &&
          transaction.kind !== 'dividend' &&
          transaction.kind !== 'interest'
        ) {
          return false;
        }
      } else if (quickKind === 'transfers') {
        if (
          transaction.kind !== 'transfer' &&
          transaction.transferGroupId === null
        ) {
          return false;
        }
      } else if (quickKind === 'investments') {
        if (
          transaction.kind !== 'buy' &&
          transaction.kind !== 'sell' &&
          transaction.instrumentId === null
        ) {
          return false;
        }
      }

      if (!query) return true;
      const account = accounts.find((item) => item.id === transaction.accountId);
      const instrument = transaction.instrumentId
        ? instruments?.get(transaction.instrumentId)
        : undefined;
      const catId = assignments?.get(transaction.id);
      const catName = catId ? categoryNameById.get(catId) : undefined;
      return [
        transaction.note,
        transaction.kind,
        account?.name,
        instrument?.name,
        instrument?.ticker,
        catName,
      ]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase().includes(query));
    });
  }, [
    accounts,
    assignments,
    categoryNameById,
    instruments,
    quickKind,
    search,
    transactions,
  ]);

  const filteredStats = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    let net = 0;
    let totalMagnitude = 0;
    let count = 0;
    const singleAccountView = Boolean(filter.accountId);

    for (const tx of visibleTransactions) {
      const val = toNumber(money(tx.amount));
      net += val;
      // Avoid counting internal transfer legs as income/expense when viewing all accounts
      if (!singleAccountView && tx.transferGroupId !== null) {
        if (val < 0) {
          totalMagnitude += Math.abs(val);
          count += 1;
        }
        continue;
      }
      if (val > 0) inflow += val;
      else if (val < 0) outflow += Math.abs(val);
      totalMagnitude += Math.abs(val);
      count += 1;
    }

    return {
      inflow,
      outflow,
      net,
      avg: count > 0 ? totalMagnitude / count : 0,
      count,
    };
  }, [visibleTransactions, filter.accountId]);

  const applyDatePreset = (preset: 'all' | 'cycle' | 'month' | '30days') => {
    setDatePresetState(preset);
    if (preset === 'all') {
      patchFilter({ from: undefined, to: undefined });
      return;
    }
    if (preset === 'cycle') {
      patchFilter({
        from: new Date(`${cycle.cycleStartIso}T00:00:00`).toISOString(),
        to: new Date(`${cycle.cycleEndIso}T23:59:59`).toISOString(),
      });
      return;
    }
    const now = new Date();
    const from = new Date(now);
    if (preset === 'month') from.setDate(1);
    else from.setDate(now.getDate() - 29);
    patchFilter({
      from: new Date(from.getFullYear(), from.getMonth(), from.getDate()).toISOString(),
      to: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString(),
    });
  };

  const exportCsv = () => {
    const accountName = new Map(accounts.map((account) => [account.id, account.name]));
    const csv = transactionsToCsv(
      visibleTransactions,
      (id) => (id ? accountName.get(id) ?? '' : ''),
      (id) => (id ? instruments?.get(id)?.name ?? instruments?.get(id)?.ticker ?? '' : ''),
      (txId) => {
        const catId = txId ? assignments?.get(txId) : undefined;
        return catId ? categoryNameById.get(catId) ?? '' : '';
      },
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `strata-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const isFiltered =
    quickKind !== 'all' ||
    datePreset !== 'all' ||
    Boolean(filter.accountId) ||
    Boolean(search.trim());

  const resetAllFilters = () => {
    setQuickKind('all');
    setSearch('');
    setDatePresetState('all');
    setShowCustomDates(false);
    setFilter({});
  };

  return (
    <div className="flex flex-col gap-6">
      <CashflowNav />

      <PageHeader
        title="Activity"
        subtitle="Complete ledger of all account movements and transactions."
        actions={
          <div className="flex items-center gap-2">
            {visibleTransactions.length > 0 && (
              <Button size="sm" variant="ghost" onClick={exportCsv} title="Export current view to CSV">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setMode('transfer')}
              disabled={accounts.length < 2}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                <path d="M17 3L21 7L17 11" />
                <path d="M3 7H21" />
                <path d="M7 21L3 17L7 13" />
                <path d="M21 17H3" />
              </svg>
              Transfer
            </Button>
            <Button
              size="sm"
              onClick={() => setMode('transaction')}
              disabled={noAccounts}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Transaction
            </Button>
          </div>
        }
      />

      {/* Financial Overview Metrics Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="flex flex-col gap-1 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Total Inflow
            </span>
            <div className="grid h-5 w-5 place-items-center rounded-md bg-[var(--positive)]/10 text-[var(--positive)]">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="7 17 17 17 17 7" />
                <line x1="7" y1="7" x2="17" y2="17" />
              </svg>
            </div>
          </div>
          <span className="text-base font-bold tabular-nums text-[var(--positive)]">
            <AmountInline value={filteredStats.inflow} signed />
          </span>
        </Card>
        <Card className="flex flex-col gap-1 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Total Outflow
            </span>
            <div className="grid h-5 w-5 place-items-center rounded-md bg-[var(--negative)]/10 text-[var(--negative)]">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 7 7 7 7 17" />
                <line x1="17" y1="17" x2="7" y2="7" />
              </svg>
            </div>
          </div>
          <span className="text-base font-bold tabular-nums text-[var(--negative)]">
            <AmountInline value={-filteredStats.outflow} signed />
          </span>
        </Card>
        <Card className="flex flex-col gap-1 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Net Cashflow
            </span>
            <div
              className="grid h-5 w-5 place-items-center rounded-md"
              style={{
                background: filteredStats.net < 0 ? 'var(--negative)/10' : 'var(--positive)/10',
                color: filteredStats.net < 0 ? 'var(--negative)' : 'var(--positive)',
              }}
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
          </div>
          <span
            className="text-base font-bold tabular-nums"
            style={{
              color: filteredStats.net < 0 ? 'var(--negative)' : 'var(--positive)',
            }}
          >
            <AmountInline value={filteredStats.net} signed />
          </span>
        </Card>
        <Card className="flex flex-col gap-1 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Movements
            </span>
            <div className="grid h-5 w-5 place-items-center rounded-md bg-[var(--surface-sunken)] text-[var(--text-muted)]">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </div>
          </div>
          <span className="text-base font-bold tabular-nums text-[var(--text-strong)]">
            {filteredStats.count}
          </span>
        </Card>
      </div>

      <BottomSheet
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit transaction"
      >
        {editing && (
          <TransactionForm
            accounts={accounts}
            existing={editing}
            onDone={() => setEditing(null)}
          />
        )}
      </BottomSheet>

      <BottomSheet
        open={mode === 'transaction' && !editing}
        onClose={() => {
          setMode('none');
          setPrefill(null);
        }}
        title="New transaction"
      >
        <TransactionForm
          accounts={accounts}
          prefill={prefill ?? undefined}
          onDone={() => {
            setMode('none');
            setPrefill(null);
          }}
        />
      </BottomSheet>

      <BottomSheet
        open={mode === 'transfer' && !editing}
        onClose={() => {
          setMode('none');
          setTransferPrefill(null);
        }}
        title="Transfer between accounts"
      >
        <TransferForm
          accounts={accounts}
          prefill={transferPrefill ?? undefined}
          onDone={() => {
            setMode('none');
            setTransferPrefill(null);
          }}
        />
      </BottomSheet>

      {accounts.length > 0 && (
        <Collapsible title="Scheduled · recurring">
          <RecurringManager accounts={accounts} />
        </Collapsible>
      )}

      {/* Apple Pay Pending Review Banner */}
      {pendingWalletTransactions.length > 0 && (
        <Card className="flex flex-col gap-3 border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--accent)_4%,var(--surface-sunken))] p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] shadow-sm">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[var(--text-strong)]">
                    Apple Pay · {pendingWalletTransactions.length}{' '}
                    {pendingWalletTransactions.length === 1
                      ? 'pending review'
                      : 'pending review'}
                  </h3>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                    Review needed
                  </span>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  Verify destination account and expense category before confirming.
                </p>
              </div>
            </div>

            {pendingWalletTransactions.length > 1 && (
              <Button
                size="sm"
                onClick={() => {
                  for (const tx of pendingWalletTransactions) {
                    confirmWallet.mutate({ id: tx.id });
                  }
                  toast(`Confirmed ${pendingWalletTransactions.length} Apple Pay transactions`, 'success');
                }}
                disabled={confirmWallet.isPending}
              >
                Confirm all ({pendingWalletTransactions.length})
              </Button>
            )}
          </div>

          <div className="flex flex-col divide-y divide-[var(--line)] rounded-[var(--radius-field)] neu-flat overflow-hidden">
            {pendingWalletTransactions.map((tx) => {
              const assignedCatId = assignments?.get(tx.id);
              const assignedCat = assignedCatId
                ? categoryNameById.get(assignedCatId)
                : undefined;
              return (
                <div
                  key={tx.id}
                  className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-[var(--text-strong)] truncate">
                        {tx.note || 'Apple Pay'}
                      </span>
                      <span className="font-bold text-sm tabular-nums text-[var(--negative)]">
                        −€{Math.abs(Number(tx.amount)).toFixed(2)}
                      </span>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs">
                      {/* Destination Account Pill */}
                      <div className="inline-flex items-center gap-1.5">
                        <span className="text-[11px] text-[var(--text-muted)] font-medium">
                          Account:
                        </span>
                        <div className="relative inline-flex items-center">
                          <select
                            aria-label="Assigned account"
                            value={tx.accountId}
                            onChange={(e) => {
                              const newAccId = e.target.value;
                              updateTx.mutate({
                                id: tx.id,
                                accountId: newAccId,
                                kind: tx.kind,
                                amount: tx.amount,
                                occurredAt: tx.occurredAt,
                                note: tx.note,
                              });
                            }}
                            className="tap appearance-none rounded-full neu-sunken py-0.5 pl-2.5 pr-6 text-[11px] font-semibold text-[var(--accent)] border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] focus:border-[var(--accent)] outline-none cursor-pointer"
                          >
                            {accounts.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                            ))}
                          </select>
                          <svg
                            viewBox="0 0 24 24"
                            width="10"
                            height="10"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="pointer-events-none absolute right-2 text-[var(--accent)]"
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </div>
                      </div>

                      {/* Category Pill */}
                      <div className="inline-flex items-center gap-1.5">
                        <span className="text-[11px] text-[var(--text-muted)] font-medium">
                          Category:
                        </span>
                        {assignedCat ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-sunken)] border border-[var(--line)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--text-2)]">
                            {assignedCat}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditing(tx)}
                            className="tap rounded-full border border-dashed border-[var(--line)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                          >
                            + Assign
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() =>
                        confirmWallet.mutate(
                          { id: tx.id },
                          {
                            onSuccess: () =>
                              toast('Wallet transaction confirmed', 'success'),
                          },
                        )
                      }
                      disabled={confirmWallet.isPending}
                    >
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditing(tx)}
                    >
                      Edit
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Filter, Search & Group Controls */}
      <Card className="flex flex-col gap-3.5 p-4">
        {/* Search & Account select */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_220px]">
          <div className="relative flex items-center">
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none absolute left-3 text-[var(--text-muted)]"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              placeholder="Search notes, categories, accounts or stocks…"
              aria-label="Search transactions"
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-[var(--radius-field)] neu-sunken py-2 pl-9 pr-8 text-xs text-[var(--text-strong)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="tap absolute right-2.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <Select
            aria-label="Filter by account"
            value={filter.accountId ?? ''}
            onChange={(event) =>
              patchFilter({ accountId: event.target.value || undefined })
            }
          >
            <option value="">All accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
        </div>

        {/* Quick Type Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { value: 'all' as const, label: 'All' },
              ...(pendingWalletTransactions.length > 0
                ? [
                    {
                      value: 'pending' as const,
                      label: `Apple Pay (${pendingWalletTransactions.length})`,
                    },
                  ]
                : []),
              { value: 'expenses' as const, label: 'Expenses' },
              {
                value: 'uncategorized' as const,
                label:
                  uncategorizedCount > 0
                    ? `Uncategorized (${uncategorizedCount})`
                    : 'Uncategorized',
              },
              { value: 'income' as const, label: 'Income' },
              { value: 'transfers' as const, label: 'Transfers' },
              { value: 'investments' as const, label: 'Investments' },
            ]
          ).map((chip) => {
            const active = quickKind === chip.value;
            return (
              <button
                key={chip.value}
                type="button"
                onClick={() => setQuickKind(chip.value)}
                className={`tap rounded-full px-3 py-1 text-xs font-semibold transition ${
                  active
                    ? 'bg-[var(--accent)] text-white shadow-sm'
                    : 'neu-flat text-[var(--text-muted)] hover:text-[var(--text-strong)]'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {/* Date Presets + Custom Dates */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { value: 'all', label: 'All time' },
                { value: 'cycle', label: 'This pay cycle' },
                { value: 'month', label: 'This month' },
                { value: '30days', label: 'Last 30 days' },
              ] as const
            ).map((preset) => {
              const active = datePreset === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => applyDatePreset(preset.value)}
                  className={`tap rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    active
                      ? 'neu-sunken border border-[var(--accent)]/50 text-[var(--text-strong)] font-bold'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setShowCustomDates((v) => !v)}
            className="tap flex items-center gap-1 text-[11px] font-semibold text-[var(--accent)] hover:underline"
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {showCustomDates ? 'Hide dates' : 'Custom dates'}
          </button>
        </div>

        {showCustomDates && (
          <div className="grid grid-cols-1 gap-3 border-t border-[var(--line)] pt-3 sm:grid-cols-2">
            <Labelled label="From">
              <TextInput
                type="date"
                value={filter.from?.slice(0, 10) ?? ''}
                onChange={(event) => {
                  setDatePresetState('custom');
                  patchFilter({
                    from: event.target.value
                      ? new Date(`${event.target.value}T00:00:00`).toISOString()
                      : undefined,
                  });
                }}
              />
            </Labelled>
            <Labelled label="To">
              <TextInput
                type="date"
                value={filter.to?.slice(0, 10) ?? ''}
                onChange={(event) => {
                  setDatePresetState('custom');
                  patchFilter({
                    to: event.target.value
                      ? new Date(`${event.target.value}T23:59:59`).toISOString()
                      : undefined,
                  });
                }}
              />
            </Labelled>
          </div>
        )}

        {/* Active Filter Strip */}
        {isFiltered && (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl bg-[var(--surface-sunken)] px-3.5 py-2 text-xs border border-[var(--line)]">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-[var(--text-muted)]">
                Showing{' '}
                <strong className="font-semibold text-[var(--text-strong)]">
                  {filteredStats.count}
                </strong>{' '}
                filtered movements
              </span>
              {filteredStats.inflow > 0 && (
                <span className="tabular-nums text-[var(--text-muted)]">
                  In:{' '}
                  <strong className="font-semibold text-[var(--positive)]">
                    <AmountInline value={filteredStats.inflow} signed />
                  </strong>
                </span>
              )}
              {filteredStats.outflow > 0 && (
                <span className="tabular-nums text-[var(--text-muted)]">
                  Out:{' '}
                  <strong className="font-semibold text-[var(--negative)]">
                    <AmountInline value={-filteredStats.outflow} signed />
                  </strong>
                </span>
              )}
              <span
                className="font-bold tabular-nums"
                style={{
                  color: filteredStats.net < 0 ? 'var(--negative)' : 'var(--positive)',
                }}
              >
                Net: <AmountInline value={filteredStats.net} signed />
              </span>
            </div>
            <button
              type="button"
              onClick={resetAllFilters}
              className="tap flex items-center gap-1 font-semibold text-[var(--accent)] hover:underline"
            >
              Reset filters
            </button>
          </div>
        )}
      </Card>

      {/* Transaction List Feed */}
      {isLoading ? (
        <SkeletonRows count={6} />
      ) : (
        <TransactionList
          transactions={visibleTransactions}
          accounts={accounts}
          instruments={instruments}
          onReverse={onReverse}
          onDelete={onDelete}
          onEdit={(transaction) => {
            setMode('none');
            setEditing(transaction);
          }}
          onRepeat={(transaction, pairedTransfer) => {
            setEditing(null);
            if (pairedTransfer?.fromAccount && pairedTransfer?.toAccount) {
              setTransferPrefill({
                fromAccountId: pairedTransfer.fromAccount.id,
                toAccountId: pairedTransfer.toAccount.id,
                amount: String(pairedTransfer.magnitude),
                note: transaction.note ?? undefined,
              });
              setMode('transfer');
              return;
            }
            setPrefill({
              account: transaction.accountId,
              kind: transaction.kind,
              amount: money(transaction.amount).abs().toString(),
              note: transaction.note ?? undefined,
              categoryId: assignments?.get(transaction.id) ?? undefined,
            });
            setMode('transaction');
          }}
          onResetFilters={isFiltered ? resetAllFilters : undefined}
          emptyMessage={
            search.trim() || quickKind !== 'all' || datePreset !== 'all'
              ? 'No transactions match your current search, date range, or filters.'
              : transactions.length === 0 && noAccounts
                ? 'No accounts yet. Create an account to start tracking financial activity.'
                : 'No recorded activity for this view.'
          }
        />
      )}
    </div>
  );
};
