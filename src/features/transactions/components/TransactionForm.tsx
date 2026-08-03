import { useEffect, useState, type FormEvent } from 'react';
import type { Account, Transaction, TransactionKind } from '@/core/types';
import { kindMeta, manualKinds, parseSignedAmount } from '@/core/transactions/kinds';
import { money } from '@/core/money/money';
import { Button } from '@/ui/Button';
import { Labelled, Select, TextInput } from '@/ui/Field';
import {
  useAssignCategory,
  useAssignments,
  useCategories,
} from '@/features/expenses/api/useCategories';
import {
  useCreateTransaction,
  useUpdateTransaction,
} from '../api/useTransactions';

const today = () => new Date().toISOString().slice(0, 10);

const KindPicker = ({
  value,
  onChange,
}: {
  value: TransactionKind;
  onChange: (kind: TransactionKind) => void;
}) => (
  <div className="flex flex-wrap gap-2">
    {manualKinds.map((option) => {
      const active = option === value;
      const outflow = kindMeta[option].direction === 'outflow';
      return (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`tap rounded-full px-3.5 py-2 text-sm font-semibold transition ${
            active
              ? 'bg-[var(--accent-soft)] text-[var(--accent)] shadow-[inset_0_0_0_1px_var(--accent)]'
              : 'neu-flat text-[var(--text-2)]'
          }`}
        >
          <span
            aria-hidden
            className="mr-1.5 text-xs"
            style={{
              color: active
                ? undefined
                : outflow
                  ? 'var(--negative)'
                  : 'var(--positive)',
            }}
          >
            {outflow ? '−' : '+'}
          </span>
          {kindMeta[option].label}
        </button>
      );
    })}
  </div>
);

export const TransactionForm = ({
  accounts,
  existing,
  defaultKind,
  onDone,
}: {
  accounts: Account[];
  existing?: Transaction;
  defaultKind?: TransactionKind;
  onDone: () => void;
}) => {
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const assignCategory = useAssignCategory();
  const { data: categories = [] } = useCategories();
  const { data: assignments } = useAssignments();
  const editing = existing !== undefined;

  const [accountId, setAccountId] = useState(
    existing?.accountId ?? accounts[0]?.id ?? '',
  );
  const [kind, setKind] = useState<TransactionKind>(
    existing?.kind ?? defaultKind ?? 'expense',
  );
  const [magnitude, setMagnitude] = useState(
    existing ? money(existing.amount).abs().toString() : '',
  );
  const [date, setDate] = useState(
    existing ? existing.occurredAt.slice(0, 10) : today(),
  );
  const [note, setNote] = useState(existing?.note ?? '');
  const [categoryId, setCategoryId] = useState('');
  const [categoryTouched, setCategoryTouched] = useState(false);

  useEffect(() => {
    if (editing && !categoryTouched && assignments) {
      setCategoryId(assignments.get(existing.id) ?? '');
    }
  }, [editing, categoryTouched, assignments, existing?.id]);

  const showCategory = kind === 'expense';
  const pickCategory = (value: string) => {
    setCategoryTouched(true);
    setCategoryId(value);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!accountId) return;
    const amount = parseSignedAmount(kind, magnitude || '0').toFixed(4);
    const occurredAt = new Date(`${date}T12:00:00`).toISOString();
    const category = showCategory ? categoryId || null : null;

    if (editing) {
      update.mutate(
        { id: existing.id, kind, amount, occurredAt, note: note.trim() || null },
        {
          onSuccess: () => {
            if (!categoryTouched) {
              onDone();
              return;
            }
            assignCategory.mutate(
              { transactionId: existing.id, categoryId: category },
              { onSettled: onDone },
            );
          },
        },
      );
      return;
    }

    create.mutate(
      { accountId, kind, amount, occurredAt, note: note.trim() || null },
      {
        onSuccess: (created) => {
          const finish = () => {
            setMagnitude('');
            setNote('');
            onDone();
          };
          if (category) {
            assignCategory.mutate(
              { transactionId: created.id, categoryId: category },
              { onSettled: finish },
            );
          } else {
            finish();
          }
        },
      },
    );
  };

  const pending =
    create.isPending || update.isPending || assignCategory.isPending;
  const failed = create.isError || update.isError;

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Labelled label="Type">
        <div className="pt-0.5">
          <KindPicker value={kind} onChange={setKind} />
        </div>
      </Labelled>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Amount (EUR)
        </span>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-[var(--text-muted)]">
            €
          </span>
          <input
            className="block w-full min-w-0 appearance-none rounded-[var(--radius-field)] neu-sunken py-3 pl-9 pr-4 text-2xl font-bold tabular-nums text-[var(--text-strong)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
            type="number"
            step="0.01"
            min="0"
            required
            autoFocus
            inputMode="decimal"
            value={magnitude}
            placeholder="0.00"
            onChange={(event) => setMagnitude(event.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
        <Labelled label="Date">
          <TextInput
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </Labelled>
      </div>

      {showCategory && (
        <Labelled label="Category">
          <Select
            value={categoryId}
            onChange={(event) => pickCategory(event.target.value)}
          >
            <option value="">Uncategorized</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Labelled>
      )}

      <Labelled label="Note (optional)">
        <TextInput
          value={note}
          placeholder={
            kind === 'expense' ? 'Coffee, groceries, rent…' : 'Salary, refund…'
          }
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
      <div className="mt-1 flex gap-3">
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
