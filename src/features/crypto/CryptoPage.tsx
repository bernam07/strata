import { useMemo } from 'react';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { PageHeader } from '@/ui/PageHeader';
import { Amount, AmountInline } from '@/ui/Amount';
import { useRefreshPrices } from '@/features/search/api/useMarket';
import { CryptoManager } from './CryptoManager';
import { useCrypto } from './api/useCrypto';

export const CryptoPage = () => {
  const { data: holdings = [] } = useCrypto();
  const refresh = useRefreshPrices();

  const totals = useMemo(() => {
    let value = 0;
    let cost = 0;
    let day = 0;
    let hasDay = false;
    for (const holding of holdings) {
      value += holding.valueEur;
      cost += holding.costEur;
      day += holding.dayChangeEur;
      if (holding.dayChangePct !== null) hasDay = true;
    }
    return {
      value,
      cost,
      gain: value - cost,
      gainPct: cost > 0 ? (value - cost) / cost : null,
      day,
      hasDay,
    };
  }, [holdings]);

  const gainUp = totals.gain >= 0;
  const dayUp = totals.day >= 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Crypto"
        subtitle="Coins you hold, tracked alongside the rest of your wealth."
        actions={
          holdings.length > 0 && (
            <Button
              variant="ghost"
              onClick={() => refresh.mutate()}
              disabled={refresh.isPending}
            >
              {refresh.isPending ? 'Refreshing…' : 'Refresh prices'}
            </Button>
          )
        }
      />

      {holdings.length > 0 && (
        <Card className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Total value
            </span>
            <Amount value={totals.value} size="xl" />
          </div>
          <div className="text-right">
            <p className="text-xs text-[var(--text-muted)]">Unrealized gain</p>
            <p
              className="mt-1 text-lg font-semibold"
              style={{ color: gainUp ? 'var(--positive)' : 'var(--negative)' }}
            >
              <AmountInline value={totals.gain} signed />
              {totals.gainPct !== null && (
                <span className="ml-1.5 text-xs">
                  {gainUp ? '+' : '−'}
                  {(Math.abs(totals.gainPct) * 100).toFixed(1)}%
                </span>
              )}
            </p>
            <p className="mt-2 text-xs text-[var(--text-muted)]">Today</p>
            <p
              className="text-sm font-semibold"
              style={{
                color: !totals.hasDay
                  ? 'var(--text-muted)'
                  : dayUp
                    ? 'var(--positive)'
                    : 'var(--negative)',
              }}
            >
              {totals.hasDay ? (
                <AmountInline value={totals.day} signed />
              ) : (
                '— no intraday data yet'
              )}
            </p>
          </div>
        </Card>
      )}

      <Card>
        <CryptoManager />
      </Card>
    </div>
  );
};
