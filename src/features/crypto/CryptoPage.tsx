import { useMemo } from 'react';
import { formatEur, money } from '@/core/money/money';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { PageHeader } from '@/ui/PageHeader';
import { Stat } from '@/ui/Stat';
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
    for (const holding of holdings) {
      value += holding.valueEur;
      cost += holding.costEur;
      day += holding.dayChangeEur;
    }
    return {
      value,
      cost,
      gain: value - cost,
      gainPct: cost > 0 ? (value - cost) / cost : null,
      day,
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
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Total value" value={formatEur(money(totals.value))} />
          <Stat
            label="Unrealized gain"
            value={`${gainUp ? '+' : '−'}${formatEur(money(Math.abs(totals.gain)))}`}
            hint={
              totals.gainPct !== null
                ? `${gainUp ? '+' : '−'}${(Math.abs(totals.gainPct) * 100).toFixed(1)}%`
                : undefined
            }
            tone={gainUp ? 'positive' : 'negative'}
          />
          <Stat
            label="Today"
            value={`${dayUp ? '+' : '−'}${formatEur(money(Math.abs(totals.day)))}`}
            tone={dayUp ? 'positive' : 'negative'}
          />
        </div>
      )}

      <Card>
        <CryptoManager />
      </Card>
    </div>
  );
};
