import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Transaction } from '@/core/types';
import { money, toNumber } from '@/core/money/money';
import { usePaydayCycle } from '@/core/payday/paydayCycle';
import { transactionsToCsv } from '@/core/transactions/exportCsv';
import { AmountInline } from '@/ui/Amount';
import { Button } from '@/ui/Button';
import { BottomSheet } from '@/ui/BottomSheet';
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
  useDeleteTransaction,
  useReverseTransaction,
  useTransactions,
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
      onSuccess: () => toast('Reversal entry added'),
      onError: () => toast("Couldn't reverse transaction", 'error'),
    });
  };

  const onDelete = (transaction: Transaction) => {
    del.mutate(transaction.id, {
      onSuccess: () => toast('Transaction deleted'),
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

  const visibleTransactions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return transactions.filter((transaction) => {
      if (quickKind === 'expenses') {
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
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `strata-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const isFiltered =
    quickKind !== 'all' ||
    datePreset !== 'all' ||
    Boolean(filter.accountId) ||
    Boolean(search.trim());

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Activity"
        subtitle="Every movement across your accounts."
        actions={
          <>
            {visibleTransactions.length > 0 && (
              <Button size="sm" variant="ghost" onClick={exportCsv}>
                Export
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setMode('transfer')}
              disabled={accounts.length < 2}
            >
              Transfer
            </Button>
            <Button
              size="sm"
              onClick={() => setMode('transaction')}
              disabled={noAccounts}
            >
              New
            </Button>
          </>
        }
      />

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

      <Card>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_200px]">
            <TextInput
              value={search}
              placeholder="Search notes, categories, accounts or stocks…"
              aria-label="Search transactions"
              onChange={(event) => setSearch(event.target.value)}
            />
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

          {/* Quick Kind / Uncategorized Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { value: 'all', label: 'All' },
                { value: 'expenses', label: 'Expenses' },
                {
                  value: 'uncategorized',
                  label:
                    uncategorizedCount > 0
                      ? `Uncategorized (${uncategorizedCount})`
                      : 'Uncategorized',
                },
                { value: 'income', label: 'Income' },
                { value: 'transfers', label: 'Transfers' },
                { value: 'investments', label: 'Investments' },
              ] as const
            ).map((chip) => {
              const active = quickKind === chip.value;
              return (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => setQuickKind(chip.value)}
                  className={`tap rounded-full px-3 py-1 text-xs font-semibold transition ${
                    active
                      ? 'bg-[var(--accent-soft)] text-[var(--accent)] shadow-[inset_0_0_0_1px_var(--accent)]'
                      : 'neu-flat text-[var(--text-muted)] hover:text-[var(--text-strong)]'
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          {/* Date Presets + Custom Dates Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { value: 'all', label: 'All time' },
                  { value: 'cycle', label: 'This pay cycle' },
                  { value: 'month', label: 'This month' },
                  { value: '30days', label: '30 days' },
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
                        ? 'neu-sunken border border-[var(--accent)]/50 text-[var(--text-strong)]'
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
              className="tap text-[11px] font-semibold text-[var(--accent)]"
            >
              {showCustomDates ? 'Hide dates' : 'Custom dates'}
            </button>
          </div>

          {showCustomDates && (
            <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
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

          {isFiltered && (
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[var(--radius-field)] bg-[var(--surface-sunken)] px-3 py-2 text-xs">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-[var(--text-muted)]">
                  <strong className="font-semibold text-[var(--text-strong)]">
                    {filteredStats.count}
                  </strong>{' '}
                  {filteredStats.count === 1 ? 'movement' : 'movements'}
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
                {filteredStats.count > 1 && filteredStats.avg > 0 && (
                  <span className="tabular-nums text-[var(--text-muted)]">
                    Avg:{' '}
                    <strong className="font-semibold text-[var(--text-strong)]">
                      <AmountInline value={filteredStats.avg} />
                    </strong>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="font-bold tabular-nums"
                  style={{
                    color:
                      filteredStats.net < 0
                        ? 'var(--negative)'
                        : 'var(--positive)',
                  }}
                >
                  Net: <AmountInline value={filteredStats.net} signed />
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setQuickKind('all');
                    setSearch('');
                    setDatePresetState('all');
                    setFilter({});
                  }}
                  className="tap font-semibold text-[var(--accent)]"
                >
                  Reset
                </button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {isLoading ? (
        <SkeletonRows count={5} />
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
          emptyMessage={
            search.trim() || quickKind !== 'all'
              ? 'No transactions match your filter.'
              : transactions.length === 0 && noAccounts
                ? 'No accounts yet. Create an account to start tracking activity.'
                : 'No transactions for this filter.'
          }
        />
      )}
    </div>
  );
};
