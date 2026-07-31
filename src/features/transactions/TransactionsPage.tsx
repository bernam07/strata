import { useState } from 'react';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Labelled, Select, TextInput } from '@/ui/Field';
import { useAccounts } from '@/features/accounts/api/useAccounts';
import {
  useTransactions,
  type TransactionFilter,
} from './api/useTransactions';
import { TransactionForm } from './components/TransactionForm';
import { TransactionList } from './components/TransactionList';

export const TransactionsPage = () => {
  const { data: accounts = [] } = useAccounts();
  const [filter, setFilter] = useState<TransactionFilter>({});
  const [adding, setAdding] = useState(false);
  const { data: transactions = [], isLoading } = useTransactions(filter);

  const patchFilter = (patch: Partial<TransactionFilter>) =>
    setFilter((current) => {
      const next = { ...current, ...patch };
      for (const key of Object.keys(next) as (keyof TransactionFilter)[]) {
        if (!next[key]) delete next[key];
      }
      return next;
    });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-strong)]">
          Transactions
        </h1>
        {!adding && (
          <Button onClick={() => setAdding(true)} disabled={accounts.length === 0}>
            New transaction
          </Button>
        )}
      </div>

      {adding && (
        <Card>
          <TransactionForm
            accounts={accounts}
            onDone={() => setAdding(false)}
          />
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
        <p className="text-sm text-[var(--text-muted)]">Loading…</p>
      ) : (
        <TransactionList transactions={transactions} accounts={accounts} />
      )}
    </div>
  );
};
