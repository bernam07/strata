import { useState, type FormEvent } from 'react';
import type { Account } from '@/core/types';
import { InstitutionLogo } from '@/features/accounts/components/InstitutionLogo';
import { Button } from '@/ui/Button';
import { Labelled, MoneyInput, TextInput } from '@/ui/Field';
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
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          onDone();
          requestAnimationFrame(() => {
            document.querySelector('main')?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
            window.scrollTo(0, 0);
          });
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          Amount (EUR)
        </span>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-[var(--text-muted)]">
            €
          </span>
          <MoneyInput
            className="block w-full min-w-0 appearance-none rounded-[var(--radius-field)] neu-sunken py-3 pl-9 pr-4 text-2xl font-bold tabular-nums text-[var(--text-strong)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
            required
            autoFocus
            value={amount}
            placeholder="0,00"
            onChange={setAmount}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          From account
        </span>
        <div className="flex flex-wrap gap-2">
          {accounts.map((account) => {
            const active = account.id === fromAccountId;
            return (
              <button
                key={account.id}
                type="button"
                onClick={() => setFrom(account.id)}
                className={`tap flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)] shadow-[inset_0_0_0_1px_var(--accent)]'
                    : 'neu-flat text-[var(--text-2)]'
                }`}
              >
                <InstitutionLogo institutionId={account.institutionId} size={18} />
                <span>{account.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          To account
        </span>
        <div className="flex flex-wrap gap-2">
          {accounts.map((account) => {
            const active = account.id === toAccountId;
            return (
              <button
                key={account.id}
                type="button"
                onClick={() => setTo(account.id)}
                className={`tap flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)] shadow-[inset_0_0_0_1px_var(--accent)]'
                    : 'neu-flat text-[var(--text-2)]'
                }`}
              >
                <InstitutionLogo institutionId={account.institutionId} size={18} />
                <span>{account.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Labelled label="Date">
          <TextInput
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Labelled>
        <Labelled label="Note (optional)">
          <TextInput
            value={note}
            placeholder="Move savings, top up…"
            onChange={(e) => setNote(e.target.value)}
          />
        </Labelled>
      </div>

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
      <div className="mt-1 flex gap-3">
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
