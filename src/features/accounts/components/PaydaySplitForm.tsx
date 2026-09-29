import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Account } from '@/core/types';
import { supabase } from '@/db/supabase';
import { AmountInline } from '@/ui/Amount';
import { Button } from '@/ui/Button';
import { Labelled, MoneyInput, TextInput } from '@/ui/Field';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { toast } from '@/ui/toast';
import { InstitutionLogo } from './InstitutionLogo';

const todayIso = () => new Date().toISOString().slice(0, 10);

type SplitMode = 'income' | 'reallocate';
type SplitUnit = 'pct' | 'eur';

interface SavedSplitTemplate {
  totalAmount: string;
  mode: SplitMode;
  unit: SplitUnit;
  sourceAccountId?: string;
  note: string;
  sharesByAccountId: Record<string, string>;
}

const storageKey = (institutionId: string) =>
  `strata.paydaySplit.${institutionId}.v1`;

const loadTemplate = (
  institutionId: string,
  accounts: Account[],
): SavedSplitTemplate => {
  try {
    const raw = window.localStorage.getItem(storageKey(institutionId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SavedSplitTemplate>;
      if (parsed && typeof parsed === 'object') {
        return {
          totalAmount:
            typeof parsed.totalAmount === 'string' ? parsed.totalAmount : '',
          mode: parsed.mode === 'reallocate' ? 'reallocate' : 'income',
          unit: parsed.unit === 'eur' ? 'eur' : 'pct',
          sourceAccountId:
            typeof parsed.sourceAccountId === 'string'
              ? parsed.sourceAccountId
              : (accounts[0]?.id ?? ''),
          note: typeof parsed.note === 'string' ? parsed.note : 'Salary',
          sharesByAccountId:
            parsed.sharesByAccountId &&
            typeof parsed.sharesByAccountId === 'object'
              ? parsed.sharesByAccountId
              : {},
        };
      }
    }
  } catch {
    // Ignore storage read errors
  }

  // Default even split in percentage mode
  const defaultShares: Record<string, string> = {};
  if (accounts.length > 0) {
    const base = Math.floor(100 / accounts.length);
    let remainder = 100 - base * accounts.length;
    accounts.forEach((acc) => {
      const add = remainder > 0 ? 1 : 0;
      if (remainder > 0) remainder -= 1;
      defaultShares[acc.id] = String(base + add);
    });
  }

  return {
    totalAmount: '',
    mode: 'income',
    unit: 'pct',
    sourceAccountId: accounts[0]?.id ?? '',
    note: 'Salary',
    sharesByAccountId: defaultShares,
  };
};

export const PaydaySplitForm = ({
  institutionId,
  accounts,
  onDone,
}: {
  institutionId: string;
  accounts: Account[];
  onDone: () => void;
}) => {
  const client = useQueryClient();
  const initial = useMemo(
    () => loadTemplate(institutionId, accounts),
    [institutionId, accounts],
  );

  const [totalAmount, setTotalAmount] = useState(initial.totalAmount);
  const [mode, setMode] = useState<SplitMode>(initial.mode);
  const [unit, setUnit] = useState<SplitUnit>(initial.unit);
  const [sourceAccountId, setSourceAccountId] = useState(
    initial.sourceAccountId ?? accounts[0]?.id ?? '',
  );
  const [shares, setShares] = useState<Record<string, string>>(
    initial.sharesByAccountId,
  );
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState(initial.note);

  useEffect(() => {
    try {
      const payload: SavedSplitTemplate = {
        totalAmount,
        mode,
        unit,
        sourceAccountId,
        note,
        sharesByAccountId: shares,
      };
      window.localStorage.setItem(
        storageKey(institutionId),
        JSON.stringify(payload),
      );
    } catch {
      // Ignore storage write errors
    }
  }, [institutionId, totalAmount, mode, unit, sourceAccountId, note, shares]);

  const totalNum = Math.max(0, Number(totalAmount) || 0);

  const computedRows = useMemo(() => {
    return accounts.map((acc) => {
      const raw = Number(shares[acc.id] ?? 0);
      const val = Number.isFinite(raw) && raw > 0 ? raw : 0;
      const eurAmount =
        unit === 'pct' ? Math.round(totalNum * (val / 100) * 100) / 100 : val;
      const pctAmount =
        unit === 'pct'
          ? val
          : totalNum > 0
            ? Math.round((val / totalNum) * 1000) / 10
            : 0;
      return {
        account: acc,
        rawInput: shares[acc.id] ?? '',
        eurAmount,
        pctAmount,
      };
    });
  }, [accounts, shares, unit, totalNum]);

  const allocatedEur = computedRows.reduce((acc, r) => acc + r.eurAmount, 0);
  const allocatedPct = computedRows.reduce((acc, r) => acc + r.pctAmount, 0);
  const unallocatedEur = Math.round((totalNum - allocatedEur) * 100) / 100;
  const unallocatedPct = Math.round((100 - allocatedPct) * 10) / 10;

  const setShare = (accountId: string, value: string) => {
    setShares((prev) => ({ ...prev, [accountId]: value }));
  };

  const fillRemainder = (targetAccountId: string) => {
    if (unit === 'pct') {
      const othersPct = computedRows
        .filter((r) => r.account.id !== targetAccountId)
        .reduce((acc, r) => acc + r.pctAmount, 0);
      const rem = Math.max(0, Math.round((100 - othersPct) * 100) / 100);
      setShare(targetAccountId, String(rem));
    } else {
      const othersEur = computedRows
        .filter((r) => r.account.id !== targetAccountId)
        .reduce((acc, r) => acc + r.eurAmount, 0);
      const rem = Math.max(0, Math.round((totalNum - othersEur) * 100) / 100);
      setShare(targetAccountId, rem.toFixed(2));
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const occurredAt = new Date(`${date}T12:00:00`).toISOString();
      const cleanNote = note.trim() || 'Payday split';

      const activeRows = computedRows.filter((r) => r.eurAmount >= 0.01);
      if (activeRows.length === 0) {
        throw new Error('Enter at least one bucket allocation.');
      }

      if (mode === 'income') {
        const inserts = activeRows.map((row) => ({
          account_id: row.account.id,
          kind: 'income' as const,
          amount: row.eurAmount.toFixed(4),
          occurred_at: occurredAt,
          note: cleanNote,
        }));
        const { error } = await supabase.from('transactions').insert(inserts);
        if (error) throw error;
        return activeRows.length;
      }

      // mode === 'reallocate': transfer from sourceAccountId into every other active bucket
      const targetRows = activeRows.filter(
        (r) => r.account.id !== sourceAccountId,
      );
      if (targetRows.length === 0) {
        throw new Error('Allocate an amount to at least one target bucket.');
      }
      const inserts: {
        account_id: string;
        kind: 'transfer';
        amount: string;
        occurred_at: string;
        note: string;
        transfer_group_id: string;
      }[] = [];

      for (const row of targetRows) {
        const groupId = crypto.randomUUID();
        const mag = row.eurAmount.toFixed(4);
        inserts.push(
          {
            account_id: sourceAccountId,
            kind: 'transfer',
            amount: `-${mag}`,
            occurred_at: occurredAt,
            note: cleanNote,
            transfer_group_id: groupId,
          },
          {
            account_id: row.account.id,
            kind: 'transfer',
            amount: mag,
            occurred_at: occurredAt,
            note: cleanNote,
            transfer_group_id: groupId,
          },
        );
      }

      const { error } = await supabase.from('transactions').insert(inserts);
      if (error) throw error;
      return targetRows.length;
    },
    onSuccess: (count) => {
      client.invalidateQueries({ queryKey: ['transactions'] });
      toast(`Split applied across ${count} bucket${count === 1 ? '' : 's'}`, 'success');
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      onDone();
      requestAnimationFrame(() => {
        document
          .querySelector('main')
          ?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
        window.scrollTo(0, 0);
      });
    },
  });

  const canSubmit =
    totalNum > 0 &&
    computedRows.some((r) => r.eurAmount >= 0.01) &&
    Math.abs(unallocatedEur) < 0.05;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    mutation.mutate();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedControl
          value={mode}
          onChange={setMode}
          label="Split mode"
          segments={[
            { value: 'income', label: 'New income' },
            { value: 'reallocate', label: 'From bucket' },
          ]}
        />
        <SegmentedControl
          value={unit}
          onChange={setUnit}
          label="Split unit"
          segments={[
            { value: 'pct', label: '% Share' },
            { value: 'eur', label: '€ Fixed' },
          ]}
        />
      </div>

      <p className="text-xs text-[var(--text-muted)]">
        {mode === 'income'
          ? 'Records your paycheck directly across each virtual bucket below. Your split ratios are saved for next month.'
          : 'Splits an amount already sitting in one bucket across your other buckets via internal transfers.'}
      </p>

      {mode === 'reallocate' && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            Source bucket (where salary landed)
          </span>
          <div className="flex flex-wrap gap-2">
            {accounts.map((account) => {
              const active = account.id === sourceAccountId;
              return (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => setSourceAccountId(account.id)}
                  className={`tap flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? 'bg-[var(--accent-soft)] text-[var(--accent)] shadow-[inset_0_0_0_1px_var(--accent)]'
                      : 'neu-flat text-[var(--text-2)]'
                  }`}
                >
                  <InstitutionLogo
                    institutionId={account.institutionId}
                    size={16}
                  />
                  <span>{account.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          Total paycheck / amount to split (EUR)
        </span>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-3.5 text-lg font-semibold text-[var(--text-muted)]">
            €
          </span>
          <MoneyInput
            className="block w-full min-w-0 appearance-none rounded-[var(--radius-field)] neu-sunken py-3 pl-9 pr-4 text-2xl font-bold tabular-nums text-[var(--text-strong)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
            required
            autoFocus
            value={totalAmount}
            placeholder="1500,00"
            onChange={setTotalAmount}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            Bucket allocation
          </span>
          {totalNum > 0 && (
            <span
              className="text-xs font-semibold tabular-nums"
              style={{
                color:
                  Math.abs(unallocatedEur) < 0.05
                    ? 'var(--positive)'
                    : 'var(--accent)',
              }}
            >
              {Math.abs(unallocatedEur) < 0.05 ? (
                '100% allocated ✓'
              ) : unit === 'pct' ? (
                `${unallocatedPct > 0 ? `${unallocatedPct}% left` : `${Math.abs(unallocatedPct)}% over`}`
              ) : (
                <>
                  <AmountInline value={Math.abs(unallocatedEur)} />{' '}
                  {unallocatedEur > 0 ? 'left' : 'over'}
                </>
              )}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {computedRows.map((row) => {
            const isSourceInReallocate =
              mode === 'reallocate' && row.account.id === sourceAccountId;
            return (
              <div
                key={row.account.id}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-field)] neu-flat px-3.5 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-[var(--text-strong)]">
                      {row.account.name}
                    </p>
                    {isSourceInReallocate && (
                      <span className="rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-muted)]">
                        Keeps
                      </span>
                    )}
                  </div>
                  <p className="text-xs tabular-nums text-[var(--text-muted)]">
                    {totalNum > 0 ? (
                      <>
                        <span className="font-semibold text-[var(--positive)]">
                          +<AmountInline value={row.eurAmount} />
                        </span>
                        {unit === 'eur' && ` (${row.pctAmount.toFixed(1)}%)`}
                      </>
                    ) : (
                      'Enter total above'
                    )}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {Math.abs(unallocatedEur) >= 0.05 && totalNum > 0 && (
                    <button
                      type="button"
                      onClick={() => fillRemainder(row.account.id)}
                      title="Assign remaining balance to this bucket"
                      className="tap rounded-full bg-[var(--surface-sunken)] px-2 py-1 text-[10px] font-semibold text-[var(--accent)]"
                    >
                      Rest
                    </button>
                  )}
                  <div className="relative w-24">
                    <MoneyInput
                      value={row.rawInput}
                      placeholder="0"
                      showCalculator={false}
                      onChange={(val) => setShare(row.account.id, val)}
                      className="block w-full rounded-[var(--radius-field)] neu-sunken py-1.5 pl-2.5 pr-6 text-right text-sm font-bold tabular-nums text-[var(--text-strong)] outline-none focus:border-[var(--accent)]"
                    />
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--text-muted)]">
                      {unit === 'pct' ? '%' : '€'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Labelled label="Date">
          <TextInput
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Labelled>
        <Labelled label="Note">
          <TextInput
            value={note}
            placeholder="Salary, bonus…"
            onChange={(e) => setNote(e.target.value)}
          />
        </Labelled>
      </div>

      {mutation.isError && (
        <p className="text-sm text-[var(--negative)]">
          {mutation.error instanceof Error
            ? mutation.error.message
            : "Couldn't apply split."}
        </p>
      )}

      <div className="mt-1 flex gap-3">
        <Button type="submit" disabled={mutation.isPending || !canSubmit}>
          {mutation.isPending ? 'Applying…' : 'Apply payday split'}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
};
