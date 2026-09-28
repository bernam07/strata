import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Transaction } from '@/core/types';
import { transactionsToCsv } from '@/core/transactions/exportCsv';
import { Button } from '@/ui/Button';
import { BottomSheet } from '@/ui/BottomSheet';
import { PageHeader } from '@/ui/PageHeader';
import { Card } from '@/ui/Card';
import { Collapsible } from '@/ui/Collapsible';
import { Labelled, Select, TextInput } from '@/ui/Field';
import { SkeletonRows } from '@/ui/Skeleton';
import { useAccounts } from '@/features/accounts/api/useAccounts';
import { useInstruments } from '@/features/positions/api/usePositions';
import {
  useDeleteTransaction,
  useReverseTransaction,
  useTransactions,
  type TransactionFilter,
} from './api/useTransactions';
import { toast } from '@/ui/toast';
import { TransactionForm } from './components/TransactionForm';
import { TransferForm } from './components/TransferForm';
import { TransactionList } from './components/TransactionList';
import { RecurringManager } from './components/RecurringManager';

type AddMode = 'none' | 'transaction' | 'transfer';

export const TransactionsPage = () => {
  const { data: accounts = [] } = useAccounts();
  const [filter, setFilter] = useState<TransactionFilter>({});
  const [mode, setMode] = useState<AddMode>('none');
  const { data: transactions = [], isLoading } = useTransactions(filter);
  const { data: instruments } = useInstruments();
  const reverse = useReverseTransaction();
  const del = useDeleteTransaction();
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [search, setSearch] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const add = searchParams.get('new');
    if (add === 'transaction' || add === 'transfer') {
      setMode(add);
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
    if (
      window.confirm(
        'Reverse this entry? A matching adjustment will be added — the original stays in the ledger.',
      )
    ) {
      reverse.mutate(transaction);
    }
  };

  const onDelete = (transaction: Transaction) => {
    if (
      window.confirm(
        "Delete this transaction for good? This can't be undone — use Reverse instead if you want to keep a record.",
      )
    ) {
      del.mutate(transaction.id, {
        onSuccess: () => toast('Transaction deleted'),
        onError: () => toast("Couldn't delete transaction", 'error'),
      });
    }
  };

  const noAccounts = accounts.length === 0;

  const visibleTransactions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return transactions;
    return transactions.filter((transaction) => {
      const account = accounts.find((item) => item.id === transaction.accountId);
      const instrument = transaction.instrumentId
        ? instruments?.get(transaction.instrumentId)
        : undefined;
      return [
        transaction.note,
        transaction.kind,
        account?.name,
        instrument?.name,
        instrument?.ticker,
      ]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase().includes(query));
    });
  }, [accounts, instruments, search, transactions]);

  const setDatePreset = (preset: 'month' | '30days' | 'all') => {
    if (preset === 'all') {
      patchFilter({ from: undefined, to: undefined });
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

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Transactions"
        subtitle="Every movement across your accounts."
        actions={
          <>
            {visibleTransactions.length > 0 && (
              <Button variant="ghost" onClick={exportCsv}>
                Export
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => setMode('transfer')}
              disabled={accounts.length < 2}
            >
              Transfer
            </Button>
            <Button onClick={() => setMode('transaction')} disabled={noAccounts}>
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
        onClose={() => setMode('none')}
        title="New transaction"
      >
        <TransactionForm accounts={accounts} onDone={() => setMode('none')} />
      </BottomSheet>

      <BottomSheet
        open={mode === 'transfer' && !editing}
        onClose={() => setMode('none')}
        title="Transfer between accounts"
      >
        <TransferForm accounts={accounts} onDone={() => setMode('none')} />
      </BottomSheet>

      {accounts.length > 0 && (
        <Collapsible title="Scheduled · recurring">
          <RecurringManager accounts={accounts} />
        </Collapsible>
      )}

      <Card>
        <div className="flex flex-col gap-4">
          <TextInput
            value={search}
            placeholder="Search notes, accounts or instruments"
            aria-label="Search transactions"
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setDatePreset('month')}>
              This month
            </Button>
            <Button variant="ghost" onClick={() => setDatePreset('30days')}>
              Last 30 days
            </Button>
            <Button variant="ghost" onClick={() => setDatePreset('all')}>
              All time
            </Button>
          </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Labelled label="Account">
            <Select
              value={filter.accountId ?? ''}
              onChange={(event) =>
                patchFilter({ accountId: event.target.value || undefined })
              }
            >
              <option value="">All</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </Labelled>
          <Labelled label="From">
            <TextInput
              type="date"
              value={filter.from?.slice(0, 10) ?? ''}
              onChange={(event) =>
                patchFilter({
                  from: event.target.value
                    ? new Date(`${event.target.value}T00:00:00`).toISOString()
                    : undefined,
                })
              }
            />
          </Labelled>
          <Labelled label="To">
            <TextInput
              type="date"
              value={filter.to?.slice(0, 10) ?? ''}
              onChange={(event) =>
                patchFilter({
                  to: event.target.value
                    ? new Date(`${event.target.value}T23:59:59`).toISOString()
                    : undefined,
                })
              }
            />
          </Labelled>
        </div>
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
          emptyMessage={
            search.trim()
              ? 'No transactions match your search.'
              : transactions.length === 0 && noAccounts
                ? 'No accounts yet. Create an account to start tracking activity.'
                : 'No transactions for this filter.'
          }
        />
      )}
    </div>
  );
};
