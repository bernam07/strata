import { useState, type FormEvent } from 'react';
import type { Account, Transaction, TransactionKind } from '@/core/types';
import { kindMeta, manualKinds, parseSignedAmount } from '@/core/transactions/kinds';
import { money } from '@/core/money/money';
import { Button } from '@/ui/Button';
import { Labelled, Select, TextInput } from '@/ui/Field';
import {
  useCreateTransaction,
  useUpdateTransaction,
} from '../api/useTransactions';

const today = () => new Date().toISOString().slice(0, 10);

export const TransactionForm = ({
  accounts,
  existing,
  onDone,
}: {
  accounts: Account[];
  existing?: Transaction;
  onDone: () => void;
}) => {
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const editing = existing !== undefined;

  const [accountId, setAccountId] = useState(
    existing?.accountId ?? accounts[0]?.id ?? '',
  );
  const [kind, setKind] = useState<TransactionKind>(existing?.kind ?? 'expense');
  const [magnitude, setMagnitude] = useState(
    existing ? money(existing.amount).abs().toString() : '',
  );
  const [date, setDate] = useState(
    existing ? existing.occurredAt.slice(0, 10) : today(),
  );
  const [note, setNote] = useState(existing?.note ?? '');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!accountId) return;
    const amount = parseSignedAmount(kind, magnitude || '0').toFixed(4);
    const occurredAt = new Date(`${date}T12:00:00`).toISOString();

    if (editing) {
      update.mutate(
        { id: existing.id, kind, amount, occurredAt, note: note.trim() || null },
        { onSuccess: onDone },
      );
      return;
    }

    create.mutate(
      { accountId, kind, amount, occurredAt, note: note.trim() || null },
      {
        onSuccess: () => {
          setMagnitude('');
          setNote('');
          onDone();
        },
      },
    );
  };

  const pending = create.isPending || update.isPending;
  const failed = create.isError || update.isError;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Labelled label="Account">
        <Select
          value={accountId}
          disabled={editing}
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
            onChange={(event) => setKind(event.target.value as TransactionKind)}
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
      {failed && (
        <p className="text-sm text-[var(--negative)]">
          Couldn't save the transaction.
        </p>
      )}
      <div className="mt-2 flex gap-3">
        <Button type="submit" disabled={pending || !accountId}>
          {editing ? 'Save changes' : 'Record'}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
};
