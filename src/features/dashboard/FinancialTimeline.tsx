import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { Account, Transaction } from '@/core/types';
import { kindMeta } from '@/core/transactions/kinds';
import { isNegative, money, toNumber } from '@/core/money/money';
import { InstitutionLogo } from '@/features/accounts/components/InstitutionLogo';
import {
  useAssignments,
  useCategories,
} from '@/features/expenses/api/useCategories';
import { tileStyle } from '@/features/expenses/categoryColors';
import type { InstrumentMeta } from '@/features/positions/api/usePositions';
import { AmountInline } from '@/ui/Amount';
import { Card } from '@/ui/Card';
import { SectionTitle } from '@/ui/SectionTitle';
import { KindIcon } from '@/features/transactions/components/TransactionList';

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
});

interface TimelineDisplayItem {
  transaction: Transaction;
  pairedTransfer?: {
    fromAccount: Account | undefined;
    toAccount: Account | undefined;
    magnitude: number;
  };
}

export const FinancialTimeline = ({
  transactions,
  accounts,
  instruments,
}: {
  transactions: Transaction[];
  accounts: Account[];
  instruments?: Map<string, InstrumentMeta>;
}) => {
  const { data: categories = [] } = useCategories();
  const { data: assignments } = useAssignments();

  const accountsById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );
  const categoriesById = useMemo(
    () => new Map(categories.map((cat) => [cat.id, cat])),
    [categories],
  );

  const visible = useMemo<TimelineDisplayItem[]>(() => {
    const transferBuckets = new Map<string, Transaction[]>();
    for (const tx of transactions) {
      if (tx.transferGroupId) {
        const list = transferBuckets.get(tx.transferGroupId) ?? [];
        list.push(tx);
        transferBuckets.set(tx.transferGroupId, list);
      }
    }

    const consumedGroups = new Set<string>();
    const items: TimelineDisplayItem[] = [];

    for (const tx of transactions) {
      if (items.length >= 6) break;
      if (tx.transferGroupId) {
        const legs = transferBuckets.get(tx.transferGroupId);
        if (legs && legs.length >= 2) {
          if (consumedGroups.has(tx.transferGroupId)) continue;
          consumedGroups.add(tx.transferGroupId);

          const negLeg = legs.find((l) => Number(l.amount) < 0) ?? legs[0]!;
          const posLeg =
            legs.find((l) => Number(l.amount) > 0 && l.id !== negLeg.id) ??
            legs[1]!;

          items.push({
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
      items.push({ transaction: tx });
    }

    return items;
  }, [transactions, accountsById]);

  if (visible.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 lg:col-span-2">
      <SectionTitle action={{ to: '/transactions', label: 'All activity' }}>
        Recent activity
      </SectionTitle>
      <Card className="p-3 sm:p-4">
        <ol className="flex flex-col gap-2">
          {visible.map(({ transaction, pairedTransfer }) => {
            const amount = money(transaction.amount);
            const instrument = transaction.instrumentId
              ? instruments?.get(transaction.instrumentId)
              : undefined;
            const account = accountsById.get(transaction.accountId);
            const isMergedTransfer = Boolean(pairedTransfer);
            const fromName =
              pairedTransfer?.fromAccount?.name ?? 'Source account';
            const toName = pairedTransfer?.toAccount?.name ?? 'Target account';

            const title = isMergedTransfer
              ? `${fromName} → ${toName}`
              : instrument?.name ??
                instrument?.ticker ??
                transaction.note ??
                kindMeta[transaction.kind].label;

            const tone = isMergedTransfer
              ? 'var(--text-strong)'
              : isNegative(amount)
                ? 'var(--negative)'
                : 'var(--positive)';

            const catId =
              !isMergedTransfer && transaction.kind === 'expense'
                ? assignments?.get(transaction.id)
                : undefined;
            const cat = catId ? categoriesById.get(catId) : undefined;
            const catStyle = cat ? tileStyle(cat.color) : null;
            const logoAccount = pairedTransfer?.fromAccount ?? account;

            return (
              <li key={transaction.id}>
                <Link
                  to="/transactions"
                  className="tap flex items-center justify-between gap-3 rounded-[var(--radius-field)] neu-flat px-3.5 py-2.5 hover:border-[var(--accent)]/40"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="relative shrink-0">
                      <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--surface-sunken)] border border-[var(--line)]">
                        <KindIcon
                          kind={isMergedTransfer ? 'transfer' : transaction.kind}
                          negative={isNegative(amount)}
                        />
                      </div>
                      {logoAccount && (
                        <div
                          className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-[var(--surface)] ring-1 ring-[var(--line)] shadow-xs overflow-hidden"
                          title={logoAccount.name}
                        >
                          <InstitutionLogo
                            institutionId={logoAccount.institutionId}
                            size={14}
                          />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--text-strong)]">
                        {title}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-muted)]">
                        <span className="truncate">
                          {isMergedTransfer
                            ? transaction.note || 'Internal transfer'
                            : `${kindMeta[transaction.kind].label} · ${account?.name ?? 'Account'}`}{' '}
                          · {dateFormatter.format(new Date(transaction.occurredAt))}
                        </span>
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
                      </div>
                    </div>
                  </div>
                  <span
                    className="shrink-0 text-sm font-semibold tabular-nums"
                    style={{ color: tone }}
                  >
                    {isMergedTransfer ? (
                      <>
                        <span className="mr-1 text-xs font-normal text-[var(--text-muted)]">
                          ⇄
                        </span>
                        <AmountInline value={pairedTransfer!.magnitude} />
                      </>
                    ) : (
                      <AmountInline value={toNumber(amount)} signed />
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </Card>
    </section>
  );
};