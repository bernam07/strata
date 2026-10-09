import { useEffect, useMemo, useState } from 'react';
import type { Account, Transaction } from '@/core/types';
import { kindMeta } from '@/core/transactions/kinds';
import { isNegative, money, toNumber } from '@/core/money/money';
import { InstitutionLogo } from '@/features/accounts/components/InstitutionLogo';
import {
  useAssignCategoriesBulk,
  useAssignCategory,
  useAssignments,
  useCategories,
} from '@/features/expenses/api/useCategories';
import { tileStyle } from '@/features/expenses/categoryColors';
import type { InstrumentMeta } from '@/features/positions/api/usePositions';
import { AmountInline } from '@/ui/Amount';
import { Button } from '@/ui/Button';
import {
  dayMonthYear as dateFormatter,
  qty4 as quantityFormatter,
} from '@/ui/format';
import { toast } from '@/ui/toast';
import { useConfirmWalletTransaction } from '../api/useTransactions';

const dayDateFormatter = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

interface DayHeadingInfo {
  label: string;
  sub?: string;
  isToday: boolean;
}

const formatDayHeading = (dayKey: string): DayHeadingInfo => {
  const todayKey = new Date().toISOString().slice(0, 10);
  if (dayKey === todayKey) {
    const today = new Date();
    return {
      label: 'Today',
      sub: dateFormatter.format(today),
      isToday: true,
    };
  }
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayKey === yesterday.toISOString().slice(0, 10)) {
    return {
      label: 'Yesterday',
      sub: dateFormatter.format(yesterday),
      isToday: false,
    };
  }
  const parsed = new Date(`${dayKey}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return { label: dayKey, isToday: false };
  }
  return {
    label: dayDateFormatter.format(parsed),
    isToday: false,
  };
};

export const KindIcon = ({
  kind,
  negative = false,
}: {
  kind: Transaction['kind'];
  negative?: boolean;
}) => {
  if (kind === 'adjustment') {
    if (negative) {
      return (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--negative)]">
          <polyline points="17 7 7 7 7 17" />
          <line x1="17" y1="17" x2="7" y2="7" />
        </svg>
      );
    }
    return (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--positive)]">
        <polyline points="7 17 17 17 17 7" />
        <line x1="7" y1="7" x2="17" y2="17" />
      </svg>
    );
  }

  switch (kind) {
    case 'deposit':
    case 'income':
    case 'dividend':
    case 'interest':
      return (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--positive)]">
          <polyline points="7 17 17 17 17 7" />
          <line x1="7" y1="7" x2="17" y2="17" />
        </svg>
      );
    case 'buy':
      return (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent)]">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
      );
    case 'sell':
      return (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--positive)]">
          <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
          <polyline points="16 17 22 17 22 11" />
        </svg>
      );
    case 'transfer':
      return (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent)]">
          <path d="M17 3L21 7L17 11" />
          <path d="M3 7H21" />
          <path d="M7 21L3 17L7 13" />
          <path d="M21 17H3" />
        </svg>
      );
    case 'withdrawal':
    case 'fee':
    case 'expense':
    default:
      return (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--negative)]">
          <polyline points="17 7 7 7 7 17" />
          <line x1="17" y1="17" x2="7" y2="7" />
        </svg>
      );
  }
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
  initialLimit,
  pageSize = 25,
  onReverse,
  onDelete,
  onEdit,
  onRepeat,
  onResetFilters,
  emptyMessage = 'No transactions for this filter.',
}: {
  transactions: Transaction[];
  accounts: Account[];
  instruments?: Map<string, InstrumentMeta>;
  showAccount?: boolean;
  instrumentView?: boolean;
  initialLimit?: number;
  pageSize?: number;
  onReverse?: (transaction: Transaction) => void;
  onDelete?: (transaction: Transaction) => void;
  onEdit?: (transaction: Transaction) => void;
  onRepeat?: (
    transaction: Transaction,
    pairedTransfer?: {
      fromAccount: Account | undefined;
      toAccount: Account | undefined;
      magnitude: number;
    },
  ) => void;
  onResetFilters?: () => void;
  emptyMessage?: string;
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pickingCategoryTxId, setPickingCategoryTxId] = useState<string | null>(
    null,
  );
  const [confirming, setConfirming] = useState<{
    id: string;
    action: 'delete' | 'reverse';
  } | null>(null);

  useEffect(() => {
    if (!confirming) return;
    const timer = window.setTimeout(() => setConfirming(null), 3500);
    return () => window.clearTimeout(timer);
  }, [confirming]);

  const { data: categories = [] } = useCategories();
  const { data: assignments } = useAssignments();
  const assignCategory = useAssignCategory();
  const assignBulk = useAssignCategoriesBulk();
  const confirmWallet = useConfirmWalletTransaction();

  const categoriesById = useMemo(
    () => new Map(categories.map((cat) => [cat.id, cat])),
    [categories],
  );

  const handleAssignCategory = (
    transaction: Transaction,
    categoryId: string | null,
  ) => {
    if (categoryId === null) {
      assignCategory.mutate({ transactionId: transaction.id, categoryId: null });
      return;
    }
    const normalizedNote = transaction.note?.trim().toLowerCase() ?? '';
    if (normalizedNote.length >= 2) {
      const matchingIds = transactions
        .filter(
          (tx) =>
            tx.kind === 'expense' &&
            (tx.id === transaction.id || !assignments?.get(tx.id)) &&
            (tx.note?.trim().toLowerCase() ?? '') === normalizedNote,
        )
        .map((tx) => tx.id);

      if (matchingIds.length > 1) {
        const catName = categoriesById.get(categoryId)?.name ?? 'Category';
        assignBulk.mutate(
          { transactionIds: matchingIds, categoryId },
          {
            onSuccess: () =>
              toast(
                `${catName} · categorized ${matchingIds.length} "${transaction.note!.trim()}" expenses`,
                'success',
              ),
          },
        );
        return;
      }
    }
    assignCategory.mutate({ transactionId: transaction.id, categoryId });
  };

  const accountsById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );

  const [limit, setLimit] = useState<number>(() => initialLimit ?? Number.POSITIVE_INFINITY);

  useEffect(() => {
    if (initialLimit !== undefined) {
      setLimit(initialLimit);
    }
  }, [initialLimit, transactions]);

  const displayedTransactions = useMemo(() => {
    if (!Number.isFinite(limit) || transactions.length <= limit) {
      return transactions;
    }
    let end = limit;
    const boundaryTx = transactions[end - 1];
    if (boundaryTx?.transferGroupId && end < transactions.length) {
      if (transactions[end]?.transferGroupId === boundaryTx.transferGroupId) {
        end += 1;
      }
    }
    return transactions.slice(0, end);
  }, [transactions, limit]);

  const isLimited = Number.isFinite(limit) && transactions.length > displayedTransactions.length;

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

    for (const tx of displayedTransactions) {
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
  }, [displayedTransactions, showAccount, accountsById]);

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[var(--radius-card)] neu-flat p-10 text-center border border-[var(--line)]">
        <div className="mb-3.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-sunken)] text-[var(--text-muted)] border border-[var(--line)] shadow-inner">
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </div>
        <h3 className="text-sm font-bold text-[var(--text-strong)]">
          No transactions found
        </h3>
        <p className="mt-1 max-w-sm text-xs text-[var(--text-muted)]">
          {emptyMessage}
        </p>
        {onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="tap mt-4 inline-flex items-center gap-1.5 rounded-full neu-sunken px-3.5 py-1.5 text-xs font-semibold text-[var(--accent)] hover:underline"
          >
            <svg
              viewBox="0 0 24 24"
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            Reset all filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {dayGroups.map((group, groupIndex) => {
        const heading = formatDayHeading(group.dayKey);
        return (
          <div
            key={group.dayKey}
            className={`flex flex-col gap-2 ${groupIndex >= 2 ? 'defer-day-group' : ''}`}
          >
            <div className="sticky top-0 z-10 -mx-1 flex items-center justify-between rounded-lg bg-[var(--bg)]/90 px-2.5 py-1.5 backdrop-blur-md border-b border-[var(--line)]/50">
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-bold uppercase tracking-[0.12em] ${heading.isToday ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>
                  {heading.label}
                </span>
                {heading.sub && (
                  <span className="text-[11px] text-[var(--text-muted)] font-normal">
                    · {heading.sub}
                  </span>
                )}
              </div>
              {!instrumentView && group.items.length > 1 && Math.abs(group.net) > 0.005 && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums border border-[var(--line)] bg-[var(--surface-sunken)]"
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
                const canRepeat = Boolean(
                  onRepeat && (isManualSingle || isManualTransfer),
                );
                const isPendingWallet = transaction.externalId?.startsWith('wallet:pending');
                const isConfirmedWallet = transaction.externalId?.startsWith('wallet:confirmed');
                const hasActions = canEdit || canRepeat || canReverse || canDelete || isPendingWallet;
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
                    className="group flex min-w-0 flex-col rounded-[var(--radius-field)] px-3.5 py-3 neu-flat transition-all duration-150 hover:border-[var(--line-strong)]"
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
                      {/* Left icon: transaction kind arrow in sunken square, with optional mini institution badge */}
                      <div className="relative shrink-0">
                        <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--surface-sunken)] border border-[var(--line)]">
                          <KindIcon
                            kind={isMergedTransfer ? 'transfer' : transaction.kind}
                            negative={negative}
                          />
                        </div>
                        {showAccount && (account || pairedTransfer?.toAccount) && (
                          <div
                            className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-[var(--surface)] ring-1 ring-[var(--line)] shadow-xs overflow-hidden"
                            title={
                              isMergedTransfer
                                ? `${fromName} → ${toName}`
                                : account?.name
                            }
                          >
                            <InstitutionLogo
                              institutionId={
                                (isMergedTransfer
                                  ? pairedTransfer?.toAccount?.institutionId
                                  : account?.institutionId) ?? ''
                              }
                              size={14}
                            />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          {isMergedTransfer ? (
                            <div className="flex items-center gap-1.5 min-w-0 truncate">
                              <span className="truncate font-semibold text-sm text-[var(--text-strong)]">
                                {fromName}
                              </span>
                              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--text-muted)]">
                                <path d="M5 12h14M12 5l7 7-7 7" />
                              </svg>
                              <span className="truncate font-semibold text-sm text-[var(--text-strong)]">
                                {toName}
                              </span>
                            </div>
                          ) : (
                            <p className="truncate text-sm font-semibold text-[var(--text-strong)]">
                              {title}
                            </p>
                          )}

                          {isPendingWallet && (
                            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent)] border border-[var(--accent)]/30">
                              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                              Apple Pay · Pending
                            </span>
                          )}
                          {isConfirmedWallet && (
                            <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)] border border-[var(--line)]">
                              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="2" y="5" width="20" height="14" rx="2" />
                                <line x1="2" y1="10" x2="22" y2="10" />
                              </svg>
                              Apple Pay
                            </span>
                          )}
                        </div>

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
                                  ? `Category: ${assignedCategory.name} (click to change)`
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

                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className="text-sm font-bold tabular-nums"
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
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            width="14"
                            height="14"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={`text-[var(--text-muted)]/60 transition-transform duration-150 md:hidden ${
                              isExpanded ? 'rotate-180 text-[var(--accent)]' : ''
                            }`}
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        )}
                      </div>

                      {hasActions && (
                        <div
                          className="hidden items-center gap-1 md:flex"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isPendingWallet && (
                            <button
                              type="button"
                              onClick={() =>
                                confirmWallet.mutate(
                                  { id: transaction.id },
                                  {
                                    onSuccess: () =>
                                      toast('Transaction confirmed', 'success'),
                                  },
                                )
                              }
                              disabled={confirmWallet.isPending}
                              title="Confirm Apple Pay transaction"
                              className="tap flex h-8 items-center gap-1.5 rounded-[var(--radius-field)] bg-[var(--accent)] px-2.5 text-xs font-bold text-white hover:opacity-90 transition shadow-sm"
                            >
                              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              <span>Confirm</span>
                            </button>
                          )}
                          {canRepeat && onRepeat && (
                            <button
                              type="button"
                              onClick={() => onRepeat(transaction, pairedTransfer)}
                              title="Repeat transaction"
                              aria-label="Repeat transaction"
                              className="tap grid h-8 w-8 place-items-center rounded-[var(--radius-field)] text-[var(--text-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--accent)] transition"
                            >
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="11" height="11" rx="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                              </svg>
                            </button>
                          )}
                          {canEdit && onEdit && (
                            <button
                              type="button"
                              onClick={() => onEdit(transaction)}
                              title="Edit transaction"
                              aria-label="Edit transaction"
                              className="tap grid h-8 w-8 place-items-center rounded-[var(--radius-field)] text-[var(--text-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--accent)] transition"
                            >
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 20h4L18 10l-4-4L4 16v4z" />
                                <path d="M13.5 6.5l4 4" />
                              </svg>
                            </button>
                          )}
                          {canReverse && onReverse && (
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  confirming?.id === transaction.id &&
                                  confirming.action === 'reverse'
                                ) {
                                  setConfirming(null);
                                  onReverse(transaction);
                                } else {
                                  setConfirming({
                                    id: transaction.id,
                                    action: 'reverse',
                                  });
                                }
                              }}
                              title="Reverse this entry"
                              aria-label="Reverse this entry"
                              className={`tap flex h-8 items-center justify-center rounded-[var(--radius-field)] transition ${
                                confirming?.id === transaction.id &&
                                confirming.action === 'reverse'
                                  ? 'bg-[var(--negative)]/15 px-2.5 text-xs font-bold text-[var(--negative)]'
                                  : 'w-8 text-[var(--text-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--negative)]'
                              }`}
                            >
                              {confirming?.id === transaction.id &&
                              confirming.action === 'reverse' ? (
                                'Confirm?'
                              ) : (
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M9 14L4 9l5-5" />
                                  <path d="M4 9h11a5 5 0 0 1 5 5v1" />
                                </svg>
                              )}
                            </button>
                          )}
                          {canDelete && onDelete && (
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  confirming?.id === transaction.id &&
                                  confirming.action === 'delete'
                                ) {
                                  setConfirming(null);
                                  onDelete(transaction);
                                } else {
                                  setConfirming({
                                    id: transaction.id,
                                    action: 'delete',
                                  });
                                }
                              }}
                              title="Delete this entry"
                              aria-label="Delete this entry"
                              className={`tap flex h-8 items-center justify-center rounded-[var(--radius-field)] transition ${
                                confirming?.id === transaction.id &&
                                confirming.action === 'delete'
                                  ? 'bg-[var(--negative)] px-2.5 text-xs font-bold text-white'
                                  : 'w-8 text-[var(--text-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--negative)]'
                              }`}
                            >
                              {confirming?.id === transaction.id &&
                              confirming.action === 'delete' ? (
                                'Confirm?'
                              ) : (
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  <line x1="10" y1="11" x2="10" y2="17" />
                                  <line x1="14" y1="11" x2="14" y2="17" />
                                </svg>
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {isPickingCategory && (
                      <div
                        className="mt-2.5 flex flex-col gap-2 rounded-[var(--radius-field)] bg-[var(--surface-sunken)] p-3 border border-[var(--line)]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                            Select category
                          </span>
                          <button
                            type="button"
                            onClick={() => setPickingCategoryTxId(null)}
                            className="tap text-xs text-[var(--text-muted)] hover:text-[var(--text-strong)]"
                            aria-label="Close category selector"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {categories.map((cat) => {
                            const style = tileStyle(cat.color);
                            const active = cat.id === assignedCategoryId;
                            return (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => {
                                  handleAssignCategory(
                                    transaction,
                                    active ? null : cat.id,
                                  );
                                  setPickingCategoryTxId(null);
                                }}
                                className="tap inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition"
                                style={{
                                  background: active
                                    ? style.chipBackground
                                    : 'var(--surface)',
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
                                handleAssignCategory(transaction, null);
                                setPickingCategoryTxId(null);
                              }}
                              className="tap rounded-full px-2.5 py-1 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--negative)]"
                            >
                              Clear category
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {hasActions && isExpanded && (
                      <div className="mt-2.5 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--line)] pt-2.5 md:hidden">
                        {isPendingWallet && (
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedId(null);
                              confirmWallet.mutate(
                                { id: transaction.id },
                                {
                                  onSuccess: () =>
                                    toast('Transaction confirmed', 'success'),
                                },
                              );
                            }}
                            disabled={confirmWallet.isPending}
                            className="tap flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm"
                          >
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span>Confirm</span>
                          </button>
                        )}
                        {canRepeat && onRepeat && (
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedId(null);
                              onRepeat(transaction, pairedTransfer);
                            }}
                            className="tap flex items-center gap-1.5 rounded-full neu-sunken px-3 py-1.5 text-xs font-semibold text-[var(--accent)]"
                          >
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="9" y="9" width="11" height="11" rx="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                            </svg>
                            Repeat
                          </button>
                        )}
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
                              if (
                                confirming?.id === transaction.id &&
                                confirming.action === 'reverse'
                              ) {
                                setConfirming(null);
                                setExpandedId(null);
                                onReverse(transaction);
                              } else {
                                setConfirming({
                                  id: transaction.id,
                                  action: 'reverse',
                                });
                              }
                            }}
                            className={`tap flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                              confirming?.id === transaction.id &&
                              confirming.action === 'reverse'
                                ? 'bg-[var(--negative)]/15 font-bold text-[var(--negative)] ring-1 ring-[var(--negative)]/40'
                                : 'neu-sunken text-[var(--text-muted)] hover:text-[var(--negative)]'
                            }`}
                          >
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M9 14L4 9l5-5" />
                              <path d="M4 9h11a5 5 0 0 1 5 5v1" />
                            </svg>
                            {confirming?.id === transaction.id &&
                            confirming.action === 'reverse'
                              ? 'Confirm reverse?'
                              : 'Reverse'}
                          </button>
                        )}
                        {canDelete && onDelete && (
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                confirming?.id === transaction.id &&
                                confirming.action === 'delete'
                              ) {
                                setConfirming(null);
                                setExpandedId(null);
                                onDelete(transaction);
                              } else {
                                setConfirming({
                                  id: transaction.id,
                                  action: 'delete',
                                });
                              }
                            }}
                            className={`tap flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                              confirming?.id === transaction.id &&
                              confirming.action === 'delete'
                                ? 'bg-[var(--negative)] font-bold text-white'
                                : 'neu-sunken text-[var(--negative)]'
                            }`}
                          >
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                            {confirming?.id === transaction.id &&
                            confirming.action === 'delete'
                              ? 'Confirm delete?'
                              : 'Delete'}
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      {isLimited && (
        <div className="mt-3 flex flex-col items-center justify-center gap-2 rounded-2xl bg-[var(--surface-sunken)] p-4 border border-[var(--line)]">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              size="sm"
              onClick={() => setLimit((prev) => prev + (pageSize ?? 25))}
              className="font-semibold shadow-xs"
            >
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-1.5 text-[var(--text-muted)]"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
              Show more ({transactions.length - displayedTransactions.length} remaining)
            </Button>
            {transactions.length - displayedTransactions.length > (pageSize ?? 25) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLimit(transactions.length)}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-strong)]"
              >
                Show all ({transactions.length})
              </Button>
            )}
          </div>
          <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
            Showing {displayedTransactions.length} of {transactions.length} movements
          </span>
        </div>
      )}
      {!isLimited && Number.isFinite(limit) && transactions.length > (initialLimit ?? 0) && (
        <div className="mt-2 text-center text-xs text-[var(--text-muted)] py-2">
          Showing all {transactions.length} movements
        </div>
      )}
    </div>
  );
};
