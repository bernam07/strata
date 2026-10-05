import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { Account, Transaction, TransactionKind } from '@/core/types';
import { kindMeta, manualKinds, parseSignedAmount } from '@/core/transactions/kinds';
import { money } from '@/core/money/money';
import { Button } from '@/ui/Button';
import { Labelled, MoneyInput, Select, TextInput } from '@/ui/Field';
import { InstitutionLogo } from '@/features/accounts/components/InstitutionLogo';
import {
  useAssignCategory,
  useAssignments,
  useCategories,
  useCreateCategory,
} from '@/features/expenses/api/useCategories';
import { tileStyle } from '@/features/expenses/categoryColors';
import {
  useCreateTransaction,
  useTransactions,
  useUpdateTransaction,
} from '../api/useTransactions';

const today = () => new Date().toISOString().slice(0, 10);

interface QuickTemplate {
  key: string;
  label: string;
  accountId: string;
  categoryId: string;
  lastAmount: string;
  count: number;
}

export interface TransactionPrefill {
  amount?: string;
  note?: string;
  account?: string;
  kind?: TransactionKind;
  categoryId?: string;
}

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
  prefill,
  onDone,
}: {
  accounts: Account[];
  existing?: Transaction;
  defaultKind?: TransactionKind;
  prefill?: TransactionPrefill;
  onDone: () => void;
}) => {
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const assignCategory = useAssignCategory();
  const createCategory = useCreateCategory();
  const { data: categories = [] } = useCategories();
  const { data: assignments } = useAssignments();
  const { data: history = [] } = useTransactions();
  const editing = existing !== undefined;

  const NEW_CATEGORY = '__new__';

  const [accountId, setAccountId] = useState(
    existing?.accountId ?? accounts[0]?.id ?? '',
  );
  const [accountTouched, setAccountTouched] = useState(false);
  const [kind, setKind] = useState<TransactionKind>(
    existing?.kind ?? prefill?.kind ?? defaultKind ?? 'expense',
  );
  const [magnitude, setMagnitude] = useState(
    existing ? money(existing.amount).abs().toString() : prefill?.amount ?? '',
  );
  const [date, setDate] = useState(
    existing ? existing.occurredAt.slice(0, 10) : today(),
  );
  const [note, setNote] = useState(existing?.note ?? prefill?.note ?? '');
  const [categoryId, setCategoryId] = useState('');
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Split / MB WAY state for shared expenses
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitDivisor, setSplitDivisor] = useState<2 | 3 | 4 | 'custom'>(2);
  const [customMyShare, setCustomMyShare] = useState('');
  const [splitRecordMode, setSplitRecordMode] = useState<'net' | 'ledger'>('net');
  const [reimburseAccountId, setReimburseAccountId] = useState(
    existing?.accountId ?? accounts[0]?.id ?? '',
  );

  useEffect(() => {
    if (editing && !categoryTouched && assignments) {
      setCategoryId(assignments.get(existing.id) ?? '');
    }
  }, [editing, categoryTouched, assignments, existing?.id]);

  useEffect(() => {
    if (!prefill || editing) return;
    if (prefill.amount) setMagnitude(prefill.amount);
    if (prefill.kind) setKind(prefill.kind);
    if (prefill.categoryId) {
      setCategoryId(prefill.categoryId);
      setCategoryTouched(true);
    }
    if (prefill.account) {
      const q = prefill.account.trim().toLowerCase();
      const matchedAcc = accounts.find(
        (a) =>
          a.id.toLowerCase() === q ||
          a.institutionId.toLowerCase() === q ||
          a.name.toLowerCase().includes(q),
      );
      if (matchedAcc) {
        setAccountId(matchedAcc.id);
        setReimburseAccountId(matchedAcc.id);
        setAccountTouched(true);
      }
    }
    if (prefill.note) {
      setNote(prefill.note);
    }
  }, [prefill, editing, accounts]);

  const validAccountIds = useMemo(
    () => new Set(accounts.map((a) => a.id)),
    [accounts],
  );
  const accountById = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  );
  const categoryNameById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  // Full index of past distinct notes for the selected kind (powers both top chips and live Note autocomplete)
  const allNoteTemplates = useMemo<QuickTemplate[]>(() => {
    if (editing) return [];
    const byKey = new Map<string, QuickTemplate>();

    for (const tx of history) {
      if (tx.kind !== kind) continue;
      if (!tx.note || tx.note.trim().length === 0) continue;
      const clean = tx.note.trim();
      const key = clean.toLowerCase().replace(/\s+/g, ' ');
      const assignedCat = assignments?.get(tx.id) ?? '';
      const existingEntry = byKey.get(key);

      if (!existingEntry) {
        byKey.set(key, {
          key,
          label: clean,
          accountId: validAccountIds.has(tx.accountId)
            ? tx.accountId
            : accounts[0]?.id ?? '',
          categoryId: assignedCat,
          lastAmount: money(tx.amount).abs().toString(),
          count: 1,
        });
      } else {
        existingEntry.count += 1;
        if (!existingEntry.categoryId && assignedCat) {
          existingEntry.categoryId = assignedCat;
        }
      }
    }

    // If user has very few expense templates yet, provide smart starter presets mapped to their accounts/categories
    if (kind === 'expense' && byKey.size < 4 && accounts.length > 0) {
      const edenredAcc = accounts.find((a) => a.institutionId === 'edenred');
      const carAcc = accounts.find((a) =>
        /carro|auto|fuel|via/i.test(a.name),
      );
      const spendAcc =
        accounts.find((a) => /gasto|spend|pessoal|ordem|cgd/i.test(a.name)) ??
        accounts[0]!;
      const findCat = (re: RegExp) =>
        categories.find((c) => re.test(c.name))?.id ?? '';

      const starters: Array<{
        label: string;
        accountId: string;
        categoryId: string;
      }> = [
        {
          label: 'Continente',
          accountId: (edenredAcc ?? spendAcc).id,
          categoryId: findCat(/grocer|super|alimenta|comida/i),
        },
        {
          label: 'Almoço',
          accountId: (edenredAcc ?? spendAcc).id,
          categoryId: findCat(/dining|restaur|almo|food|eat/i),
        },
        {
          label: 'Combustível',
          accountId: (carAcc ?? spendAcc).id,
          categoryId: findCat(/transp|car|auto|fuel|combust/i),
        },
        {
          label: 'Café',
          accountId: spendAcc.id,
          categoryId: findCat(/coffee|caf|dining|restaur/i),
        },
      ];

      for (const s of starters) {
        const k = s.label.toLowerCase();
        if (!byKey.has(k)) {
          byKey.set(k, {
            key: k,
            label: s.label,
            accountId: s.accountId,
            categoryId: s.categoryId,
            lastAmount: '',
            count: 0,
          });
        }
      }
    }

    return [...byKey.values()].sort((a, b) => b.count - a.count);
  }, [editing, history, kind, assignments, validAccountIds, accounts, categories]);

  const quickTemplates = useMemo(
    () => allNoteTemplates.slice(0, 6),
    [allNoteTemplates],
  );

  const noteSuggestions = useMemo(() => {
    if (editing) return [];
    const q = note.trim().toLowerCase().replace(/\s+/g, ' ');
    if (q.length < 1) return [];
    return allNoteTemplates
      .filter((t) => t.key !== q && t.key.includes(q))
      .slice(0, 4);
  }, [editing, note, allNoteTemplates]);

  const applyTemplate = (tpl: QuickTemplate) => {
    setNote(tpl.label);
    if (tpl.accountId && validAccountIds.has(tpl.accountId)) {
      setAccountId(tpl.accountId);
      setReimburseAccountId(tpl.accountId);
      setAccountTouched(true);
    }
    if (kind === 'expense' && tpl.categoryId) {
      setCategoryId(tpl.categoryId);
      setCategoryTouched(true);
    }
    if (!magnitude.trim() && tpl.lastAmount) {
      setMagnitude(tpl.lastAmount);
    }
  };

  const handleNoteChange = (nextNote: string) => {
    setNote(nextNote);
    if (editing) return;
    const key = nextNote.trim().toLowerCase().replace(/\s+/g, ' ');
    if (key.length < 2) return;
    const match =
      allNoteTemplates.find((t) => t.key === key) ??
      allNoteTemplates.find((t) => t.key.startsWith(key));
    if (!match) return;

    if (!accountTouched && match.accountId && validAccountIds.has(match.accountId)) {
      setAccountId(match.accountId);
      setReimburseAccountId(match.accountId);
    }
    if (kind === 'expense' && !categoryTouched && match.categoryId) {
      setCategoryId(match.categoryId);
    }
  };

  const showCategory = kind === 'expense';
  const pickCategory = (value: string) => {
    setCategoryTouched(true);
    setCategoryId(value);
  };

  const resolveCategory = async (): Promise<string | null> => {
    if (!showCategory) return null;
    if (categoryId === NEW_CATEGORY) {
      const name = newCategoryName.trim();
      if (!name) return null;
      return createCategory.mutateAsync({ name, parentId: null });
    }
    return categoryId || null;
  };

  const totalBillNum = Math.max(0, Number(magnitude) || 0);
  const myShareNum = useMemo(() => {
    if (!splitOpen || kind !== 'expense' || editing) return totalBillNum;
    if (splitDivisor === 'custom') {
      const parsed = Number(customMyShare);
      if (Number.isFinite(parsed) && parsed > 0) {
        return Math.min(totalBillNum, Math.round(parsed * 100) / 100);
      }
      return totalBillNum;
    }
    return Math.round((totalBillNum / splitDivisor) * 100) / 100;
  }, [splitOpen, kind, editing, totalBillNum, splitDivisor, customMyShare]);

  const reimbursedNum = Math.max(
    0,
    Math.round((totalBillNum - myShareNum) * 100) / 100,
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!accountId) return;
    const effectiveMagnitude =
      splitOpen && kind === 'expense' && !editing && myShareNum > 0
        ? String(myShareNum)
        : magnitude || '0';
    const amount = parseSignedAmount(kind, effectiveMagnitude).toFixed(4);
    const occurredAt = new Date(`${date}T12:00:00`).toISOString();

    const baseNote = note.trim();
    const finalNote =
      splitOpen &&
      kind === 'expense' &&
      !editing &&
      reimbursedNum > 0 &&
      splitRecordMode === 'net'
        ? `${baseNote || 'Expense'} (my share of €${totalBillNum.toFixed(2)})`
        : baseNote || null;

    try {
      if (editing) {
        await update.mutateAsync({
          id: existing.id,
          accountId,
          kind,
          amount,
          occurredAt,
          note: baseNote || null,
          externalId: existing.externalId?.startsWith('wallet:pending')
            ? existing.externalId.replace('wallet:pending', 'wallet:confirmed')
            : existing.externalId,
        });
        if (categoryTouched) {
          const category = await resolveCategory();
          await assignCategory.mutateAsync({
            transactionId: existing.id,
            categoryId: category,
          });
        }
        onDone();
        return;
      }

      const created = await create.mutateAsync({
        accountId,
        kind,
        amount,
        occurredAt,
        note: finalNote,
      });
      const category = await resolveCategory();
      if (category) {
        await assignCategory.mutateAsync({
          transactionId: created.id,
          categoryId: category,
        });
      }

      // If the user chose to also record the fronted bill + MB WAY reimbursement in the ledger
      // (using 'adjustment' legs so Expenses/Budgets only count `myShareNum`):
      if (
        splitOpen &&
        kind === 'expense' &&
        reimbursedNum > 0 &&
        splitRecordMode === 'ledger'
      ) {
        const targetAccId = reimburseAccountId || accountId;
        await create.mutateAsync({
          accountId,
          kind: 'adjustment',
          amount: (-reimbursedNum).toFixed(4),
          occurredAt,
          note: `${baseNote || 'Split'} (fronted for others)`,
        });
        await create.mutateAsync({
          accountId: targetAccId,
          kind: 'adjustment',
          amount: reimbursedNum.toFixed(4),
          occurredAt,
          note: `MB WAY · ${baseNote || 'Split reimbursement'}`,
        });
      }

      setMagnitude('');
      setNote('');
      setNewCategoryName('');
      setSplitOpen(false);
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      onDone();
      requestAnimationFrame(() => {
        document.querySelector('main')?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
        window.scrollTo(0, 0);
      });
    } catch {
      // surfaced via the failed flag below
    }
  };

  const pending =
    create.isPending ||
    update.isPending ||
    assignCategory.isPending ||
    createCategory.isPending;
  const failed =
    create.isError ||
    update.isError ||
    createCategory.isError ||
    assignCategory.isError;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Labelled label="Type">
        <div className="pt-0.5">
          <KindPicker value={kind} onChange={setKind} />
        </div>
      </Labelled>

      {!editing && quickTemplates.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            Quick fill (1-tap merchant, account & category)
          </span>
          <div className="flex flex-wrap gap-1.5">
            {quickTemplates.map((tpl) => {
              const acc = accountById.get(tpl.accountId);
              const catName = tpl.categoryId
                ? categoryNameById.get(tpl.categoryId)
                : undefined;
              const isSelected =
                note.trim().toLowerCase() === tpl.key &&
                accountId === tpl.accountId;
              return (
                <button
                  key={tpl.key}
                  type="button"
                  onClick={() => applyTemplate(tpl)}
                  className={`tap flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                    isSelected
                      ? 'border border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                      : 'neu-flat text-[var(--text-2)] hover:text-[var(--text-strong)]'
                  }`}
                >
                  {acc && (
                    <InstitutionLogo
                      institutionId={acc.institutionId}
                      size={15}
                    />
                  )}
                  <span className="truncate">{tpl.label}</span>
                  {catName && (
                    <span className="truncate text-[10px] font-normal text-[var(--text-muted)]">
                      · {catName}
                    </span>
                  )}
                  {tpl.lastAmount && (
                    <span className="shrink-0 text-[10px] font-bold tabular-nums text-[var(--text-muted)]">
                      €{Number(tpl.lastAmount).toFixed(2)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            {splitOpen && kind === 'expense' && !editing
              ? 'Total bill paid (EUR)'
              : 'Amount (EUR)'}
          </span>
          {!editing && kind === 'expense' && (
            <button
              type="button"
              onClick={() => setSplitOpen((prev) => !prev)}
              className={`tap inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold transition ${
                splitOpen
                  ? 'bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/40'
                  : 'neu-flat text-[var(--text-muted)] hover:text-[var(--text-strong)]'
              }`}
            >
              <span>÷ Split / MB WAY</span>
            </button>
          )}
        </div>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-3.5 text-lg font-semibold text-[var(--text-muted)]">
            €
          </span>
          <MoneyInput
            className="block w-full min-w-0 appearance-none rounded-[var(--radius-field)] neu-sunken py-3 pl-9 pr-4 text-2xl font-bold tabular-nums text-[var(--text-strong)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
            required
            autoFocus
            value={magnitude}
            placeholder="0,00"
            onChange={setMagnitude}
          />
        </div>
      </div>

      {!editing && kind === 'expense' && splitOpen && (
        <div className="flex flex-col gap-2.5 rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface-sunken)] p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">
              Your share
            </span>
            <div className="flex flex-wrap gap-1.5">
              {([2, 3, 4] as const).map((div) => (
                <button
                  key={div}
                  type="button"
                  onClick={() => setSplitDivisor(div)}
                  className={`tap rounded-full px-2.5 py-0.5 text-xs font-bold transition ${
                    splitDivisor === div
                      ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                      : 'neu-flat text-[var(--text-2)]'
                  }`}
                >
                  ÷{div}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSplitDivisor('custom')}
                className={`tap rounded-full px-2.5 py-0.5 text-xs font-bold transition ${
                  splitDivisor === 'custom'
                    ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                    : 'neu-flat text-[var(--text-2)]'
                }`}
              >
                Custom €
              </button>
            </div>
          </div>

          {splitDivisor === 'custom' && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-[var(--text-2)]">
                Your real expense (€):
              </span>
              <div className="w-28">
                <MoneyInput
                  value={customMyShare}
                  placeholder="0.00"
                  showCalculator={false}
                  onChange={setCustomMyShare}
                  className="block w-full rounded-[var(--radius-field)] neu-flat px-2.5 py-1.5 text-right text-sm font-bold tabular-nums text-[var(--text-strong)] outline-none"
                />
              </div>
            </div>
          )}

          {totalBillNum > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-field)] neu-flat px-3 py-2 text-xs">
              <span>
                Counts in Expenses:{' '}
                <strong className="font-bold tabular-nums text-[var(--negative)]">
                  −€{myShareNum.toFixed(2)}
                </strong>
              </span>
              <span className="text-[var(--text-muted)]">
                MB WAY back:{' '}
                <strong className="font-bold tabular-nums text-[var(--positive)]">
                  +€{reimbursedNum.toFixed(2)}
                </strong>
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => setSplitRecordMode('net')}
              className={`tap flex-1 rounded-[var(--radius-field)] px-2.5 py-1.5 text-[11px] font-semibold transition ${
                splitRecordMode === 'net'
                  ? 'border border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'neu-flat text-[var(--text-muted)]'
              }`}
            >
              Only record my share (−€{myShareNum.toFixed(2)})
            </button>
            <button
              type="button"
              onClick={() => setSplitRecordMode('ledger')}
              className={`tap flex-1 rounded-[var(--radius-field)] px-2.5 py-1.5 text-[11px] font-semibold transition ${
                splitRecordMode === 'ledger'
                  ? 'border border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'neu-flat text-[var(--text-muted)]'
              }`}
            >
              Full bill (−€{totalBillNum.toFixed(2)}) + MB WAY (+€{reimbursedNum.toFixed(2)})
            </button>
          </div>

          {splitRecordMode === 'ledger' && accounts.length > 1 && (
            <div className="flex flex-col gap-1 pt-1">
              <span className="text-[10.5px] font-semibold text-[var(--text-muted)]">
                Account that received the MB WAY (+€{reimbursedNum.toFixed(2)}):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {accounts.map((acc) => {
                  const active = acc.id === reimburseAccountId;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => setReimburseAccountId(acc.id)}
                      className={`tap flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        active
                          ? 'border border-[var(--positive)] bg-[var(--positive)]/15 text-[var(--positive)]'
                          : 'neu-flat text-[var(--text-muted)]'
                      }`}
                    >
                      <InstitutionLogo
                        institutionId={acc.institutionId}
                        size={14}
                      />
                      <span>{acc.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <Labelled label="Account">
        <div className="flex flex-wrap gap-2 pt-0.5">
          {accounts.map((account) => {
            const active = account.id === accountId;
            return (
              <button
                key={account.id}
                type="button"
                onClick={() => {
                  setAccountId(account.id);
                  setReimburseAccountId(account.id);
                  setAccountTouched(true);
                }}
                className={`tap flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'neu-sunken border border-[var(--accent)] text-[var(--text-strong)] shadow-[0_0_12px_-4px_var(--accent)]'
                    : 'neu-flat text-[var(--text-muted)] hover:text-[var(--text-strong)]'
                }`}
              >
                <InstitutionLogo institutionId={account.institutionId} size={18} />
                <span className="max-w-[140px] truncate">{account.name}</span>
              </button>
            );
          })}
        </div>
      </Labelled>

      <Labelled label="Date">
        <TextInput
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </Labelled>

      {showCategory && (
        <Labelled label="Category">
          <div className="flex flex-col gap-2">
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pb-0.5">
                {categories.map((cat) => {
                  const style = tileStyle(cat.color);
                  const active = categoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => pickCategory(active ? '' : cat.id)}
                      className="tap inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition"
                      style={{
                        background: active
                          ? style.chipBackground
                          : 'var(--surface-sunken)',
                        color: active ? style.chipColor : 'var(--text-2)',
                        border: active
                          ? `1.5px solid ${style.dot}`
                          : '1px solid var(--line)',
                      }}
                    >
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: style.dot }}
                      />
                      <span>{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
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
              <option value={NEW_CATEGORY}>+ New category…</option>
            </Select>
            {categoryId === NEW_CATEGORY && (
              <TextInput
                value={newCategoryName}
                autoFocus
                placeholder="Category name (e.g. Groceries)"
                onChange={(event) => setNewCategoryName(event.target.value)}
              />
            )}
          </div>
        </Labelled>
      )}

      <Labelled label="Note (optional)">
        <div className="flex flex-col gap-2">
          <TextInput
            value={note}
            placeholder={
              kind === 'expense' ? 'Coffee, groceries, rent…' : 'Salary, refund…'
            }
            onChange={(event) => handleNoteChange(event.target.value)}
          />
          {!editing && noteSuggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Matches:
              </span>
              {noteSuggestions.map((tpl) => {
                const acc = accountById.get(tpl.accountId);
                const catName = tpl.categoryId
                  ? categoryNameById.get(tpl.categoryId)
                  : undefined;
                return (
                  <button
                    key={tpl.key}
                    type="button"
                    onClick={() => applyTemplate(tpl)}
                    className="tap inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface-sunken)] px-2.5 py-1 text-xs font-semibold text-[var(--text-strong)] hover:border-[var(--accent)]"
                  >
                    {acc && (
                      <InstitutionLogo
                        institutionId={acc.institutionId}
                        size={14}
                      />
                    )}
                    <span>{tpl.label}</span>
                    {catName && (
                      <span className="text-[10px] font-normal text-[var(--text-muted)]">
                        · {catName}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
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
