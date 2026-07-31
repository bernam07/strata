import { formatEur } from '@/core/money/money';
import type { NetWorth } from '@/core/networth/netWorth';
import { Card } from '@/ui/Card';

export const NetWorthSummary = ({ netWorth }: { netWorth: NetWorth }) => (
  <Card className="flex flex-col gap-6">
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Património líquido
      </p>
      <p className="mt-1 text-4xl font-bold tabular-nums text-[var(--text-strong)]">
        {formatEur(netWorth.net)}
      </p>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div className="rounded-[var(--radius-neu-sm)] neu-sunken p-4">
        <p className="text-xs text-[var(--text-muted)]">Ativos</p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--positive)]">
          {formatEur(netWorth.totalAssets)}
        </p>
      </div>
      <div className="rounded-[var(--radius-neu-sm)] neu-sunken p-4">
        <p className="text-xs text-[var(--text-muted)]">Passivos</p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--negative)]">
          {formatEur(netWorth.totalLiabilities)}
        </p>
      </div>
    </div>
  </Card>
);
