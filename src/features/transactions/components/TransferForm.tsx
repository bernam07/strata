import { useState, type FormEvent } from 'react';
import type { Account } from '@/core/types';
import { Button } from '@/ui/Button';
import { Labelled, Select, TextInput } from '@/ui/Field';
import { useCreateTransfer } from '../api/useTransactions';

const today = () => new Date().toISOString().slice(0, 10);

export const TransferForm = ({
  accounts,
  onDone,
}: {
  accounts: Account[];
  onDone: () => void;
}) => {
  const create = useCreateTransfer();
  const [fromAccountId, setFrom] = useState(accounts[0]?.id ?? '');
  const [toAccountId, setTo] = useState(accounts[1]?.id ?? accounts[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');

  const sameAccount = fromAccountId === toAccountId;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (sameAccount || !amount) return;
    create.mutate(
      {
        fromAccountId,
        toAccountId,
        amount,
        occurredAt: new Date(`${date}T12:00:00`).toISOString(),
        note: note.trim() || null,
      },
      {
        onSuccess: () => {
          setAmount('');
          setNote('');
          onDone();
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Labelled label="From">
          <Select value={fromAccountId} onChange={(e) => setFrom(e.target.value)}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
        </Labelled>
        <Labelled label="To">
          <Select value={toAccountId} onChange={(e) => setTo(e.target.value)}>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
        </Labelled>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Labelled label="Amount (EUR)">
          <TextInput
            type="number"
            step="0.01"
            min="0"
            required
            inputMode="decimal"
            value={amount}
            placeholder="0.00"
            onChange={(e) => setAmount(e.target.value)}
          />
        </Labelled>
        <Labelled label="Date">
          <TextInput
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Labelled>
      </div>
      <Labelled label="Note (optional)">
        <TextInput
          value={note}
          placeholder="Move savings, top up…"
          onChange={(e) => setNote(e.target.value)}
        />
      </Labelled>
      {sameAccount && (
        <p className="text-xs text-[var(--negative)]">
          Pick two different accounts.
        </p>
      )}
      {create.isError && (
        <p className="text-sm text-[var(--negative)]">
          Couldn't record the transfer.
        </p>
      )}
      <div className="mt-2 flex gap-3">
        <Button
          type="submit"
          disabled={create.isPending || sameAccount || !amount}
        >
          Transfer
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
};
