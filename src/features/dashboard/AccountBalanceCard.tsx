import { formatEur, isNegative } from '@/core/money/money';
import type { AccountBalance } from '@/core/networth/netWorth';
import { Surface } from '@/ui/Surface';
import { InstitutionLogo } from '@/features/accounts/components/InstitutionLogo';

export const AccountBalanceCard = ({ entry }: { entry: AccountBalance }) => {
  const negative = isNegative(entry.balance);
  return (
    <Surface elevation="raised" className="flex items-center gap-4 p-5">
      <InstitutionLogo institutionId={entry.account.institutionId} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-[var(--text-strong)]">
          {entry.account.name}
        </p>
        <p className="text-xs text-[var(--text-muted)]">
          {negative ? 'Passivo' : 'Ativo'}
        </p>
      </div>
      <span
        className="text-lg font-semibold tabular-nums"
        style={{ color: negative ? 'var(--negative)' : 'var(--text-strong)' }}
      >
        {formatEur(entry.balance)}
      </span>
    </Surface>
  );
};
