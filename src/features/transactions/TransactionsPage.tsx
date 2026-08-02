import { useState } from 'react';
import type { Transaction } from '@/core/types';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Labelled, Select, TextInput } from '@/ui/Field';
import { SkeletonRows } from '@/ui/Skeleton';
import { useAccounts } from '@/features/accounts/api/useAccounts';
import { useInstruments } from '@/features/positions/api/usePositions';
import {
  useReverseTransaction,
  useTransactions,
  type TransactionFilter,
} from './api/useTransactions';
import { TransactionForm } from './components/TransactionForm';
import { TransferForm } from './components/TransferForm';
import { TransactionList } from './components/TransactionList';

type AddMode = 'none' | 'transaction' | 'transfer';

export const TransactionsPage = () => {
  const { data: accounts = [] } = useAccounts();
  const [filter, setFilter] = useState<TransactionFilter>({});
  const [mode, setMode] = useState<AddMode>('none');
  const { data: transactions = [], isLoading } = useTransactions(filter);
  const { data: instruments } = useInstruments();
  const reverse = useReverseTransaction();

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

  const noAccounts = accounts.length === 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
          Transactions
        </h1>
        {mode === 'none' && (
          <div className="flex gap-2">
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
          </div>
        )}
      </div>

      {mode === 'transaction' && (
        <Card>
          <TransactionForm accounts={accounts} onDone={() => setMode('none')} />
        </Card>
      )}
      {mode === 'transfer' && (
        <Card>
          <TransferForm accounts={accounts} onDone={() => setMode('none')} />
        </Card>
      )}

      <Card>
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
      </Card>

      {isLoading ? (
        <SkeletonRows count={5} />
      ) : (
        <TransactionList
          transactions={transactions}
          accounts={accounts}
          instruments={instruments}
          onReverse={onReverse}
        />
      )}
    </div>
  );
};
