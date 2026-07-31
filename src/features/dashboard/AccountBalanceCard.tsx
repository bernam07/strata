import { formatEur, isNegative } from '@/core/money/money';
import type { AccountBalance } from '@/core/networth/netWorth';
import { InstitutionLogo } from '@/features/accounts/components/InstitutionLogo';

export const AccountBalanceCard = ({ entry }: { entry: AccountBalance }) => {
  const negative = isNegative(entry.balance);
  return (
    <div className="flex items-center gap-4 rounded-[var(--radius-card)] neu-flat p-4">
      <InstitutionLogo institutionId={entry.account.institutionId} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-[var(--text-strong)]">
          {entry.account.name}
        </p>
        <p className="text-xs text-[var(--text-muted)]">
          {negative ? 'Liability' : 'Asset'}
        </p>
      </div>
      <span
        className="text-lg font-bold tabular-nums"
        style={{ color: negative ? 'var(--negative)' : 'var(--text-strong)' }}
      >
        {formatEur(entry.balance)}
      </span>
    </div>
  );
};
