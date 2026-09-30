import { useMemo, useState } from 'react';
import type { Account, TransactionKind } from '@/core/types';
import { kindMeta, manualKinds } from '@/core/transactions/kinds';
import { money } from '@/core/money/money';
import { usePaydayCycle } from '@/core/payday/paydayCycle';
import type { Cadence } from '@/core/recurring/schedule';
import { InstitutionLogo } from '@/features/accounts/components/InstitutionLogo';
import { useCategories } from '@/features/expenses/api/useCategories';
import { tileStyle } from '@/features/expenses/categoryColors';
import { AmountInline } from '@/ui/Amount';
import { Button } from '@/ui/Button';
import { Labelled, MoneyInput, Select, TextInput } from '@/ui/Field';
import { dayMonth } from '@/ui/format';
import { toast } from '@/ui/toast';
import {
  computeRecurringMetrics,
  useCreateRecurring,
  useDeleteRecurring,
  useRecurring,
  useToggleRecurring,
  useUpdateRecurring,
  type RecurringRule,
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
  const { data: categories = [] } = useCategories();
  const { cycle } = usePaydayCycle();
  const create = useCreateRecurring();
  const update = useUpdateRecurring();
  const toggle = useToggleRecurring();
  const remove = useDeleteRecurring();

  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [kind, setKind] = useState<TransactionKind>('expense');
  const [amount, setAmount] = useState('');
  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [nextRun, setNextRun] = useState(today());
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const accountById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );
  const categoryById = useMemo(
    () => new Map(categories.map((cat) => [cat.id, cat])),
    [categories],
  );

  const metrics = useMemo(
    () => computeRecurringMetrics(rules, cycle.cycleEndIso),
    [rules, cycle.cycleEndIso],
  );

  const resetForm = () => {
    setEditingRuleId(null);
    setAmount('');
    setNote('');
    setCategoryId('');
    setNextRun(today());
    setCadence('monthly');
    setKind('expense');
  };

  const startEdit = (rule: RecurringRule) => {
    setEditingRuleId(rule.id);
    setAccountId(rule.accountId);
    setKind(rule.kind);
    setAmount(money(rule.amount).abs().toString());
    setCadence(rule.cadence);
    setNextRun(rule.nextRun.slice(0, 10));
    setNote(rule.note ?? '');
    setCategoryId(rule.categoryId ?? '');
  };

  const submit = () => {
    if (!accountId || !amount) return;
    const payload = {
      accountId,
      kind,
      amount: money(amount).abs().toFixed(4),
      note: note.trim() || null,
      categoryId: kind === 'expense' && categoryId ? categoryId : null,
      cadence,
      nextRun,
    };

    if (editingRuleId) {
      update.mutate(
        { id: editingRuleId, ...payload },
        {
          onSuccess: () => {
            resetForm();
            toast('Recurring rule updated', 'success');
          },
          onError: () => toast("Couldn't update recurring rule", 'error'),
        },
      );
      return;
    }

    create.mutate(payload, {
      onSuccess: () => {
        resetForm();
        toast('Scheduled rule added', 'success');
      },
      onError: () => toast("Couldn't add scheduled rule", 'error'),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {rules.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="flex flex-col gap-0.5 rounded-[var(--radius-field)] border border-[var(--line)] bg-[var(--surface-sunken)] px-3.5 py-2.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              Fixed monthly commitments
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold tabular-nums text-[var(--text-strong)]">
                <AmountInline value={metrics.monthlyFixedOutflow} />
                <span className="text-xs font-normal text-[var(--text-muted)]">
                  /mo
                </span>
              </span>
              <span className="text-xs tabular-nums text-[var(--text-muted)]">
                · <AmountInline value={metrics.yearlyFixedOutflow} />
                /yr
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-0.5 rounded-[var(--radius-field)] border border-[var(--line)] bg-[var(--surface-sunken)] px-3.5 py-2.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              Still due before payday ({dayMonth.format(cycle.cycleEndInclusive)})
            </span>
            <div className="flex items-baseline gap-2">
              <span
                className="text-base font-bold tabular-nums"
                style={{
                  color:
                    metrics.dueBeforePayday > 0
                      ? 'var(--negative)'
                      : 'var(--positive)',
                }}
              >
                {metrics.dueBeforePayday > 0 ? (
                  <>
                    −<AmountInline value={metrics.dueBeforePayday} />
                  </>
                ) : (
                  'All paid ✓'
                )}
              </span>
              {metrics.dueBeforePaydayCount > 0 && (
                <span className="text-xs text-[var(--text-muted)]">
                  · {metrics.dueBeforePaydayCount}{' '}
                  {metrics.dueBeforePaydayCount === 1 ? 'bill' : 'bills'} left
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {rules.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rules.map((rule) => {
            const outflow = kindMeta[rule.kind].direction === 'outflow';
            const acc = accountById.get(rule.accountId);
            const cat = rule.categoryId
              ? categoryById.get(rule.categoryId)
              : undefined;
            const catStyle = cat ? tileStyle(cat.color) : null;
            const isDueBeforePayday =
              rule.active && outflow && rule.nextRun <= cycle.cycleEndIso;

            return (
              <li
                key={rule.id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-field)] neu-flat px-3.5 py-2.5 transition ${
                  !rule.active ? 'opacity-55' : ''
                }`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {acc && (
                    <InstitutionLogo
                      institutionId={acc.institutionId}
                      size={30}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-sm font-semibold text-[var(--text-strong)]">
                        {rule.note || kindMeta[rule.kind].label}
                      </p>
                      {cat && catStyle && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{
                            background: catStyle.chipBackground,
                            color: catStyle.chipColor,
                            border: catStyle.border,
                          }}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: catStyle.dot }}
                          />
                          {cat.name}
                        </span>
                      )}
                      {!rule.active && (
                        <span className="rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                          Paused
                        </span>
                      )}
                      {isDueBeforePayday && (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                          Due before payday
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {rule.cadence} · next{' '}
                      {dateFmt.format(new Date(`${rule.nextRun.slice(0, 10)}T12:00:00`))}
                      {' · '}
                      {acc?.name ?? 'Account'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <span
                    className="text-sm font-semibold tabular-nums"
                    style={{
                      color: outflow ? 'var(--negative)' : 'var(--positive)',
                    }}
                  >
                    {outflow ? '−' : '+'}
                    <AmountInline value={Math.abs(Number(rule.amount))} />
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(rule)}
                      className="tap rounded-full px-2 py-1 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--accent)]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        toggle.mutate({ id: rule.id, active: !rule.active })
                      }
                      className="tap rounded-full px-2 py-1 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-strong)]"
                    >
                      {rule.active ? 'Pause' : 'Resume'}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove.mutate(rule.id)}
                      className="tap rounded-full px-2 py-1 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--negative)]"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-3 border-t border-[var(--line)] pt-4">
        {editingRuleId && (
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--accent)]">
              Editing scheduled rule
            </span>
            <button
              type="button"
              onClick={resetForm}
              className="tap text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-strong)]"
            >
              Cancel edit
            </button>
          </div>
        )}
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
              placeholder="Rent, gym, Spotify, salary…"
              onChange={(e) => setNote(e.target.value)}
            />
          </Labelled>
          {kind === 'expense' && (
            <div className="sm:col-span-2">
              <Labelled label="Category">
                <Select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">Uncategorized</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </Select>
              </Labelled>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={submit}
            disabled={
              !accountId || !amount || create.isPending || update.isPending
            }
          >
            {editingRuleId ? 'Save changes' : 'Add scheduled'}
          </Button>
          {editingRuleId && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={resetForm}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
