import { useState, type FormEvent } from 'react';
import type { Account, TransactionKind } from '@/core/types';
import { kindMeta, manualKinds, parseSignedAmount } from '@/core/transactions/kinds';
import { Button } from '@/ui/Button';
import { Labelled, Select, TextInput } from '@/ui/Field';
import { useCreateTransaction } from '../api/useTransactions';

const today = () => new Date().toISOString().slice(0, 10);

export const TransactionForm = ({
  accounts,
  onDone,
}: {
  accounts: Account[];
  onDone: () => void;
}) => {
  const create = useCreateTransaction();
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [kind, setKind] = useState<TransactionKind>('expense');
  const [magnitude, setMagnitude] = useState('');
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!accountId) return;
    const amount = parseSignedAmount(kind, magnitude || '0').toFixed(4);
    create.mutate(
      {
        accountId,
        kind,
        amount,
        occurredAt: new Date(`${date}T12:00:00`).toISOString(),
        note: note.trim() || null,
      },
      {
        onSuccess: () => {
          setMagnitude('');
          setNote('');
          onDone();
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Labelled label="Account">
        <Select
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </Select>
      </Labelled>
      <div className="grid grid-cols-2 gap-4">
        <Labelled label="Type">
          <Select
            value={kind}
            onChange={(event) =>
              setKind(event.target.value as TransactionKind)
            }
          >
            {manualKinds.map((option) => (
              <option key={option} value={option}>
                {kindMeta[option].label}
              </option>
            ))}
          </Select>
        </Labelled>
        <Labelled label="Amount (EUR)">
          <TextInput
            type="number"
            step="0.01"
            min="0"
            required
            inputMode="decimal"
            value={magnitude}
            placeholder="0.00"
            onChange={(event) => setMagnitude(event.target.value)}
          />
        </Labelled>
      </div>
      <Labelled label="Date">
        <TextInput
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </Labelled>
      <Labelled label="Note (optional)">
        <TextInput
          value={note}
          placeholder="Coffee, salary, transfer…"
          onChange={(event) => setNote(event.target.value)}
        />
      </Labelled>
      <p className="text-xs text-[var(--text-muted)]">
        {kindMeta[kind].direction === 'outflow'
          ? 'Leaves the account — recorded as negative.'
          : 'Enters the account — recorded as positive.'}
      </p>
      {create.isError && (
        <p className="text-sm text-[var(--negative)]">
          Couldn't record the transaction.
        </p>
      )}
      <div className="mt-2 flex gap-3">
        <Button type="submit" disabled={create.isPending || !accountId}>
          Record
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
};
