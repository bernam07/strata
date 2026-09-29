import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { Account, Transaction, TransactionKind } from '@/core/types';
import { kindMeta, manualKinds, parseSignedAmount } from '@/core/transactions/kinds';
import { money } from '@/core/money/money';
import { Button } from '@/ui/Button';
import { Labelled, MoneyInput, Select, TextInput } from '@/ui/Field';
import { toast } from '@/ui/toast';
import { InstitutionLogo } from '@/features/accounts/components/InstitutionLogo';
import {
  useAssignCategory,
  useAssignments,
  useCategories,
  useCreateCategory,
} from '@/features/expenses/api/useCategories';
import {
  useCreateTransaction,
  useTransactions,
  useUpdateTransaction,
} from '../api/useTransactions';
import { scanReceiptImage } from '../receiptScanner';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);

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

  useEffect(() => {
    if (editing && !categoryTouched && assignments) {
      setCategoryId(assignments.get(existing.id) ?? '');
    }
  }, [editing, categoryTouched, assignments, existing?.id]);

  useEffect(() => {
    if (!prefill || editing) return;
    if (prefill.amount) setMagnitude(prefill.amount);
    if (prefill.kind) setKind(prefill.kind);
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

  // Build 1-tap frequent templates for the selected kind from past transactions
  const quickTemplates = useMemo<QuickTemplate[]>(() => {
    if (editing || history.length === 0) return [];
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

    return [...byKey.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [editing, history, kind, assignments, validAccountIds, accounts]);

  const applyTemplate = (tpl: QuickTemplate) => {
    setNote(tpl.label);
    if (tpl.accountId && validAccountIds.has(tpl.accountId)) {
      setAccountId(tpl.accountId);
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
      quickTemplates.find((t) => t.key === key) ??
      quickTemplates.find((t) => t.key.startsWith(key));
    if (!match) return;

    if (!accountTouched && match.accountId && validAccountIds.has(match.accountId)) {
      setAccountId(match.accountId);
    }
    if (kind === 'expense' && !categoryTouched && match.categoryId) {
      setCategoryId(match.categoryId);
    }
  };

  const handleFileScan = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setScanning(true);
    try {
      const scanned = await scanReceiptImage(
        file,
        categories.map((c) => c.name),
      );
      if (scanned.kind === 'income' || scanned.kind === 'expense') {
        setKind(scanned.kind);
      }
      if (scanned.amount !== null && scanned.amount > 0) {
        setMagnitude(scanned.amount.toFixed(2));
      }
      if (scanned.date) {
        setDate(scanned.date);
      }
      if (scanned.merchant) {
        handleNoteChange(scanned.merchant);
      }
      if (scanned.institutionId) {
        const matchedAcc = accounts.find(
          (a) => a.institutionId === scanned.institutionId,
        );
        if (matchedAcc) {
          setAccountId(matchedAcc.id);
          setAccountTouched(true);
        }
      }
      if (scanned.category) {
        const matchedCat = categories.find(
          (c) => c.name.toLowerCase() === scanned.category!.toLowerCase(),
        );
        if (matchedCat) {
          setCategoryId(matchedCat.id);
          setCategoryTouched(true);
        }
      }
      toast(
        `Talão lido${scanned.merchant ? `: ${scanned.merchant}` : ''}${
          scanned.amount ? ` · €${scanned.amount.toFixed(2)}` : ''
        }`,
        'success',
      );
    } catch (err) {
      toast(
        err instanceof Error ? err.message : 'Não foi possível ler a imagem',
        'error',
      );
    } finally {
      setScanning(false);
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

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!accountId) return;
    const amount = parseSignedAmount(kind, magnitude || '0').toFixed(4);
    const occurredAt = new Date(`${date}T12:00:00`).toISOString();

    try {
      if (editing) {
        await update.mutateAsync({
          id: existing.id,
          kind,
          amount,
          occurredAt,
          note: note.trim() || null,
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
        note: note.trim() || null,
      });
      const category = await resolveCategory();
      if (category) {
        await assignCategory.mutateAsync({
          transactionId: created.id,
          categoryId: category,
        });
      }
      setMagnitude('');
      setNote('');
      setNewCategoryName('');
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
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-2">
        <Labelled label="Type">
          <div className="pt-0.5">
            <KindPicker value={kind} onChange={setKind} />
          </div>
        </Labelled>

        {!editing && (
          <div className="pt-5 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileScan}
            />
            <button
              type="button"
              disabled={scanning}
              onClick={() => fileInputRef.current?.click()}
              className="tap inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/45 bg-[var(--accent-soft)] px-3 py-2 text-xs font-bold text-[var(--accent)] disabled:opacity-50"
            >
              <span>📷</span>
              <span>{scanning ? 'Scanning…' : 'Scan receipt'}</span>
            </button>
          </div>
        )}
      </div>

      {!editing && quickTemplates.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            Quick fill (auto-selects account & category)
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
                </button>
              );
            })}
          </div>
        </div>
      )}

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
            value={magnitude}
            placeholder="0,00"
            onChange={setMagnitude}
          />
        </div>
      </div>

      <Labelled label="Account">
        <div className="flex flex-wrap gap-2 pt-0.5">
          {accounts.map((account) => {
            const active = account.id === accountId;
            return (
              <button
                key={account.id}
                type="button"
                disabled={editing}
                onClick={() => {
                  setAccountId(account.id);
                  setAccountTouched(true);
                }}
                className={`tap flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
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
        <TextInput
          value={note}
          placeholder={
            kind === 'expense' ? 'Coffee, groceries, rent…' : 'Salary, refund…'
          }
          onChange={(event) => handleNoteChange(event.target.value)}
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
