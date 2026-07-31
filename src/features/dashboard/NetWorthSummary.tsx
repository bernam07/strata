import { formatEur } from '@/core/money/money';
import type { NetWorth } from '@/core/networth/netWorth';

export const NetWorthSummary = ({ netWorth }: { netWorth: NetWorth }) => (
  <section className="relative overflow-hidden rounded-[var(--radius-card)] neu-raised p-6">
    <div className="pointer-events-none absolute inset-0 opacity-50">
      {[32, 52, 70, 85].map((top) => (
        <span
          key={top}
          className="absolute inset-x-0 h-px bg-[var(--line)]"
          style={{ top: `${top}%` }}
        />
      ))}
    </div>
    <div className="relative flex flex-col gap-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          Net worth
        </p>
        <p className="mt-1.5 text-[42px] font-extrabold leading-none tracking-tight text-[var(--text-strong)]">
          {formatEur(netWorth.net)}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[var(--radius-field)] neu-sunken p-4">
          <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
            Assets
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums text-[var(--positive)]">
            {formatEur(netWorth.totalAssets)}
          </p>
        </div>
        <div className="rounded-[var(--radius-field)] neu-sunken p-4">
          <p className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
            Liabilities
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums text-[var(--negative)]">
            {formatEur(netWorth.totalLiabilities)}
          </p>
        </div>
      </div>
    </div>
  </section>
);
