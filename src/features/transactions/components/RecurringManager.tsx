import { useState } from 'react';
import type { Account, TransactionKind } from '@/core/types';
import { kindMeta, manualKinds } from '@/core/transactions/kinds';
import { formatEur, money } from '@/core/money/money';
import type { Cadence } from '@/core/recurring/schedule';
import { Button } from '@/ui/Button';
import { Labelled, MoneyInput, Select, TextInput } from '@/ui/Field';
import {
  useCreateRecurring,
  useDeleteRecurring,
  useRecurring,
} from '../api/useRecurring';

const cadences: Cadence[] = ['weekly', 'monthly', 'quarterly', 'yearly'];
const today = () => new Date().toISOString().slice(0, 10);

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export const RecurringManager = ({ accounts }: { accounts: Account[] }) => {
  const { data: rules = [] } = useRecurring();
  const create = useCreateRecurring();
  const remove = useDeleteRecurring();

  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [kind, setKind] = useState<TransactionKind>('expense');
  const [amount, setAmount] = useState('');
  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [nextRun, setNextRun] = useState(today());
  const [note, setNote] = useState('');

  const accountName = new Map(accounts.map((account) => [account.id, account.name]));

  const submit = () => {
    if (!accountId || !amount) return;
    create.mutate(
      {
        accountId,
        kind,
        amount: money(amount).abs().toFixed(4),
        note: note.trim() || null,
        categoryId: null,
        cadence,
        nextRun,
      },
      {
        onSuccess: () => {
          setAmount('');
          setNote('');
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {rules.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rules.map((rule) => {
            const outflow = kindMeta[rule.kind].direction === 'outflow';
            return (
              <li
                key={rule.id}
                className="flex items-center gap-3 rounded-[var(--radius-field)] neu-flat px-4 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--text-strong)]">
                    {rule.note || kindMeta[rule.kind].label}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {rule.cadence} · next {dateFmt.format(new Date(rule.nextRun))}
                    {' · '}
                    {accountName.get(rule.accountId) ?? 'Account'}
                  </p>
                </div>
                <span
                  className="text-sm font-semibold tabular-nums"
                  style={{
                    color: outflow ? 'var(--negative)' : 'var(--positive)',
                  }}
                >
                  {outflow ? '−' : '+'}
                  {formatEur(money(rule.amount).abs())}
                </span>
                <button
                  type="button"
                  onClick={() => remove.mutate(rule.id)}
                  className="tap text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--negative)]"
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-3 border-t border-[var(--line)] pt-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Labelled label="Account">
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </Labelled>
          <Labelled label="Type">
            <Select
              value={kind}
              onChange={(e) => setKind(e.target.value as TransactionKind)}
            >
              {manualKinds.map((option) => (
                <option key={option} value={option}>
                  {kindMeta[option].label}
                </option>
              ))}
            </Select>
          </Labelled>
          <Labelled label="Amount (EUR)">
            <MoneyInput value={amount} placeholder="0,00" onChange={setAmount} />
          </Labelled>
          <Labelled label="Every">
            <Select
              value={cadence}
              onChange={(e) => setCadence(e.target.value as Cadence)}
            >
              {cadences.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Labelled>
          <Labelled label="Next on">
            <TextInput
              type="date"
              value={nextRun}
              onChange={(e) => setNextRun(e.target.value)}
            />
          </Labelled>
          <Labelled label="Note (optional)">
            <TextInput
              value={note}
              placeholder="Rent, salary, subscription…"
              onChange={(e) => setNote(e.target.value)}
            />
          </Labelled>
        </div>
        <div>
          <Button
            type="button"
            onClick={submit}
            disabled={!accountId || !amount || create.isPending}
          >
            Add scheduled
          </Button>
        </div>
      </div>
    </div>
  );
};
