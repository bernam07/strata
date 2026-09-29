import { useMemo, useState } from 'react';
import type { Account, Transaction } from '@/core/types';
import { kindMeta } from '@/core/transactions/kinds';
import { isNegative, money, toNumber } from '@/core/money/money';
import { InstitutionLogo } from '@/features/accounts/components/InstitutionLogo';
import {
  useAssignCategory,
  useAssignments,
  useCategories,
} from '@/features/expenses/api/useCategories';
import { tileStyle } from '@/features/expenses/categoryColors';
import type { InstrumentMeta } from '@/features/positions/api/usePositions';
import { AmountInline } from '@/ui/Amount';
import {
  dayMonthYear as dateFormatter,
  qty4 as quantityFormatter,
} from '@/ui/format';

const formatDayHeading = (dayKey: string): string => {
  const todayKey = new Date().toISOString().slice(0, 10);
  if (dayKey === todayKey) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayKey === yesterday.toISOString().slice(0, 10)) return 'Yesterday';
  const parsed = new Date(`${dayKey}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dayKey;
  return dateFormatter.format(parsed);
};

interface DisplayItem {
  transaction: Transaction;
  pairedTransfer?: {
    fromAccount: Account | undefined;
    toAccount: Account | undefined;
    magnitude: number;
  };
}

export const TransactionList = ({
  transactions,
  accounts,
  instruments,
  showAccount = true,
  instrumentView = false,
  onReverse,
  onDelete,
  onEdit,
  emptyMessage = 'No transactions for this filter.',
}: {
  transactions: Transaction[];
  accounts: Account[];
  instruments?: Map<string, InstrumentMeta>;
  showAccount?: boolean;
  instrumentView?: boolean;
  onReverse?: (transaction: Transaction) => void;
  onDelete?: (transaction: Transaction) => void;
  onEdit?: (transaction: Transaction) => void;
  emptyMessage?: string;
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pickingCategoryTxId, setPickingCategoryTxId] = useState<string | null>(
    null,
  );

  const { data: categories = [] } = useCategories();
  const { data: assignments } = useAssignments();
  const assignCategory = useAssignCategory();

  const categoriesById = useMemo(
    () => new Map(categories.map((cat) => [cat.id, cat])),
    [categories],
  );

  const accountsById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );

  const dayGroups = useMemo(() => {
    const groups: {
      dayKey: string;
      net: number;
      items: DisplayItem[];
    }[] = [];
    const byDay = new Map<
      string,
      { dayKey: string; net: number; rawItems: Transaction[]; items: DisplayItem[] }
    >();

    for (const tx of transactions) {
      const dayKey = tx.occurredAt.slice(0, 10);
      let group = byDay.get(dayKey);
      if (!group) {
        group = { dayKey, net: 0, rawItems: [], items: [] };
        byDay.set(dayKey, group);
        groups.push(group);
      }
      group.rawItems.push(tx);
      group.net += toNumber(money(tx.amount));
    }

    for (const group of byDay.values()) {
      if (!showAccount) {
        group.items = group.rawItems.map((transaction) => ({ transaction }));
        continue;
      }

      // Group transfer legs by transferGroupId when viewing all accounts together
      const transferBuckets = new Map<string, Transaction[]>();
      for (const tx of group.rawItems) {
        if (tx.transferGroupId) {
          const list = transferBuckets.get(tx.transferGroupId) ?? [];
          list.push(tx);
          transferBuckets.set(tx.transferGroupId, list);
        }
      }

      const consumedTransferGroups = new Set<string>();
      const mergedItems: DisplayItem[] = [];

      for (const tx of group.rawItems) {
        if (tx.transferGroupId) {
          const legs = transferBuckets.get(tx.transferGroupId);
          if (legs && legs.length >= 2) {
            if (consumedTransferGroups.has(tx.transferGroupId)) continue;
            consumedTransferGroups.add(tx.transferGroupId);

            const negLeg =
              legs.find((l) => Number(l.amount) < 0) ?? legs[0]!;
            const posLeg =
              legs.find((l) => Number(l.amount) > 0 && l.id !== negLeg.id) ??
              legs[1]!;

            mergedItems.push({
              transaction: negLeg,
              pairedTransfer: {
                fromAccount: accountsById.get(negLeg.accountId),
                toAccount: accountsById.get(posLeg.accountId),
                magnitude: Math.abs(toNumber(money(negLeg.amount))),
              },
            });
            continue;
          }
        }
        mergedItems.push({ transaction: tx });
      }

      group.items = mergedItems;
    }

    return groups;
  }, [transactions, showAccount, accountsById]);

  if (transactions.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-[var(--text-muted)]">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {dayGroups.map((group) => (
        <div key={group.dayKey} className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              {formatDayHeading(group.dayKey)}
            </span>
            {!instrumentView && group.items.length > 1 && Math.abs(group.net) > 0.005 && (
              <span
                className="text-[11px] font-semibold tabular-nums"
                style={{
                  color: group.net < 0 ? 'var(--text-muted)' : 'var(--positive)',
                }}
              >
                <AmountInline value={group.net} signed />
              </span>
            )}
          </div>

          <ul className="flex flex-col gap-2">
            {group.items.map(({ transaction, pairedTransfer }) => {
              const account = accountsById.get(transaction.accountId);
              const amount = money(transaction.amount);
              const negative = isNegative(amount);
              const isManualSingle =
                transaction.source === 'manual' &&
                transaction.transferGroupId === null;
              const isManualTransfer =
                transaction.source === 'manual' &&
                transaction.transferGroupId !== null;
              const canReverse = Boolean(onReverse && isManualSingle);
              const canDelete = Boolean(
                onDelete && (isManualSingle || isManualTransfer),
              );
              const canEdit = Boolean(onEdit && isManualSingle);
              const hasActions = canEdit || canReverse || canDelete;
              const isExpanded = expandedId === transaction.id;

              const instrument = transaction.instrumentId
                ? instruments?.get(transaction.instrumentId)
                : undefined;
              const label = kindMeta[transaction.kind].label;

              const isMergedTransfer = Boolean(pairedTransfer);
              const fromName =
                pairedTransfer?.fromAccount?.name ?? 'Source account';
              const toName =
                pairedTransfer?.toAccount?.name ?? 'Target account';

              const title = isMergedTransfer
                ? `${fromName} → ${toName}`
                : instrument
                  ? instrument.name || instrument.ticker
                  : transaction.note || label;

              const meta: string[] = [];
              if (isMergedTransfer) {
                meta.push('Internal transfer');
                if (transaction.note) meta.push(transaction.note);
              } else {
                if (instrument && transaction.quantity !== null) {
                  meta.push(
                    `${label} ${quantityFormatter.format(Math.abs(Number(transaction.quantity)))} sh`,
                  );
                } else {
                  meta.push(label);
                }
                if (showAccount && account) meta.push(account.name);
              }

              let valueNumber = isMergedTransfer
                ? pairedTransfer!.magnitude
                : toNumber(amount);
              let valueSigned = false;
              let valueColor = isMergedTransfer
                ? 'var(--text-strong)'
                : negative
                  ? 'var(--negative)'
                  : 'var(--positive)';
              if (instrumentView && transaction.kind === 'buy') {
                valueNumber = Math.abs(valueNumber);
                valueColor = 'var(--text-2)';
              } else if (instrumentView && transaction.kind === 'sell') {
                valueNumber = Math.abs(valueNumber);
                valueSigned = true;
                valueColor = 'var(--positive)';
              }

              const isExpense =
                !instrumentView &&
                !isMergedTransfer &&
                transaction.kind === 'expense';
              const assignedCategoryId = isExpense
                ? (assignments?.get(transaction.id) ?? null)
                : null;
              const assignedCategory = assignedCategoryId
                ? categoriesById.get(assignedCategoryId)
                : undefined;
              const catStyle = assignedCategory
                ? tileStyle(assignedCategory.color)
                : null;
              const isPickingCategory = pickingCategoryTxId === transaction.id;

              return (
                <li
                  key={transaction.id}
                  className="group flex min-w-0 flex-col rounded-[var(--radius-field)] px-3.5 py-3 neu-flat transition"
                >
                  <div
                    role={hasActions ? 'button' : undefined}
                    tabIndex={hasActions ? 0 : undefined}
                    onClick={() => {
                      if (!hasActions) return;
                      setExpandedId((current) =>
                        current === transaction.id ? null : transaction.id,
                      );
                    }}
                    onKeyDown={(event) => {
                      if (!hasActions) return;
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setExpandedId((current) =>
                          current === transaction.id ? null : transaction.id,
                        );
                      }
                    }}
                    className={`flex w-full min-w-0 items-center gap-3.5 ${hasActions ? 'cursor-pointer' : ''}`}
                  >
                    {showAccount &&
                      (pairedTransfer?.fromAccount ?? account) && (
                        <div className="relative shrink-0">
                          <InstitutionLogo
                            institutionId={
                              (pairedTransfer?.fromAccount ?? account)!
                                .institutionId
                            }
                            size={36}
                          />
                          {isMergedTransfer && (
                            <span
                              aria-hidden="true"
                              className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-[var(--accent)] text-[9px] font-bold text-white shadow-sm"
                            >
                              ⇄
                            </span>
                          )}
                        </div>
                      )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--text-strong)]">
                        {title}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="truncate text-xs text-[var(--text-muted)]">
                          {meta.join(' · ')}
                        </p>
                        {isExpense && categories.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPickingCategoryTxId((current) =>
                                current === transaction.id
                                  ? null
                                  : transaction.id,
                              );
                            }}
                            title={
                              assignedCategory
                                ? `Category: ${assignedCategory.name} (tap to change)`
                                : 'Assign category'
                            }
                            className="tap inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold transition"
                            style={
                              assignedCategory && catStyle
                                ? {
                                    background: catStyle.chipBackground,
                                    color: catStyle.chipColor,
                                    border: catStyle.border,
                                  }
                                : {
                                    background: 'var(--surface-sunken)',
                                    color: 'var(--text-muted)',
                                    border: '1px dashed var(--line)',
                                  }
                            }
                          >
                            {assignedCategory && catStyle ? (
                              <>
                                <span
                                  aria-hidden="true"
                                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                                  style={{ background: catStyle.dot }}
                                />
                                <span className="max-w-[110px] truncate">
                                  {assignedCategory.name}
                                </span>
                              </>
                            ) : (
                              <span>+ Category</span>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    <span
                      className="shrink-0 text-sm font-semibold tabular-nums"
                      style={{ color: valueColor }}
                    >
                      {isMergedTransfer && (
                        <span className="mr-1 text-xs font-normal text-[var(--text-muted)]">
                          ⇄
                        </span>
                      )}
                      <AmountInline value={valueNumber} signed={valueSigned} />
                    </span>

                    {hasActions && (
                      <div
                        className="hidden items-center gap-1 md:flex"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {canEdit && onEdit && (
                          <button
                            type="button"
                            onClick={() => onEdit(transaction)}
                            title="Edit this entry"
                            aria-label="Edit this entry"
                            className="tap grid h-8 w-8 place-items-center rounded-[var(--radius-field)] text-[var(--text-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--accent)]"
                          >
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4 20h4L18 10l-4-4L4 16v4z" />
                              <path d="M13.5 6.5l4 4" />
                            </svg>
                          </button>
                        )}
                        {canReverse && onReverse && (
                          <button
                            type="button"
                            onClick={() => onReverse(transaction)}
                            title="Reverse this entry"
                            aria-label="Reverse this entry"
                            className="tap grid h-8 w-8 place-items-center rounded-[var(--radius-field)] text-[var(--text-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--negative)]"
                          >
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M9 14L4 9l5-5" />
                              <path d="M4 9h11a5 5 0 015 5v1" />
                            </svg>
                          </button>
                        )}
                        {canDelete && onDelete && (
                          <button
                            type="button"
                            onClick={() => onDelete(transaction)}
                            title="Delete this entry"
                            aria-label="Delete this entry"
                            className="tap grid h-8 w-8 place-items-center rounded-[var(--radius-field)] text-[var(--text-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--negative)]"
                          >
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4 7h16" />
                              <path d="M10 11v6M14 11v6" />
                              <path d="M6 7l1 13h10l1-13" />
                              <path d="M9 7V4h6v3" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {isPickingCategory && (
                    <div
                      className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-[var(--line)] pt-2.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {categories.map((cat) => {
                        const style = tileStyle(cat.color);
                        const active = cat.id === assignedCategoryId;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => {
                              assignCategory.mutate({
                                transactionId: transaction.id,
                                categoryId: active ? null : cat.id,
                              });
                              setPickingCategoryTxId(null);
                            }}
                            className="tap inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition"
                            style={{
                              background: active
                                ? style.chipBackground
                                : 'var(--surface-sunken)',
                              color: active
                                ? style.chipColor
                                : 'var(--text-strong)',
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
                            {cat.name}
                          </button>
                        );
                      })}
                      {assignedCategoryId && (
                        <button
                          type="button"
                          onClick={() => {
                            assignCategory.mutate({
                              transactionId: transaction.id,
                              categoryId: null,
                            });
                            setPickingCategoryTxId(null);
                          }}
                          className="tap rounded-full px-2.5 py-1 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--negative)]"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  )}

                  {hasActions && isExpanded && (
                    <div className="mt-2.5 flex items-center justify-end gap-2 border-t border-[var(--line)] pt-2.5 md:hidden">
                      {canEdit && onEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedId(null);
                            onEdit(transaction);
                          }}
                          className="tap flex items-center gap-1.5 rounded-full neu-sunken px-3 py-1.5 text-xs font-semibold text-[var(--text-strong)] hover:text-[var(--accent)]"
                        >
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 20h4L18 10l-4-4L4 16v4z" />
                            <path d="M13.5 6.5l4 4" />
                          </svg>
                          Edit
                        </button>
                      )}
                      {canReverse && onReverse && (
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedId(null);
                            onReverse(transaction);
                          }}
                          className="tap flex items-center gap-1.5 rounded-full neu-sunken px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--negative)]"
                        >
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 14L4 9l5-5" />
                            <path d="M4 9h11a5 5 0 015 5v1" />
                          </svg>
                          Reverse
                        </button>
                      )}
                      {canDelete && onDelete && (
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedId(null);
                            onDelete(transaction);
                          }}
                          className="tap flex items-center gap-1.5 rounded-full neu-sunken px-3 py-1.5 text-xs font-semibold text-[var(--negative)]"
                        >
                          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 7h16" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M6 7l1 13h10l1-13" />
                            <path d="M9 7V4h6v3" />
                          </svg>
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
};

