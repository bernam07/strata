import { useMemo } from 'react';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { PageHeader } from '@/ui/PageHeader';
import { AmountInline } from '@/ui/Amount';
import { PageHero } from '@/ui/PageHero';
import { DeltaPill } from '@/ui/DeltaPill';
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
        <PageHero
          label="Total value"
          value={totals.value}
          aside={
            totals.hasDay ? (
              <DeltaPill
                value={totals.day}
                tone={dayUp ? 'positive' : 'negative'}
                note="today"
              />
            ) : undefined
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <Stat
              label="Unrealized gain"
              value={<AmountInline value={totals.gain} signed />}
              hint={
                totals.gainPct !== null
                  ? `${gainUp ? '+' : '−'}${(Math.abs(totals.gainPct) * 100).toFixed(1)}%`
                  : undefined
              }
              tone={gainUp ? 'positive' : 'negative'}
            />
            <Stat
              label="Today"
              value={
                totals.hasDay ? (
                  <AmountInline value={totals.day} signed />
                ) : (
                  '—'
                )
              }
              hint={totals.hasDay ? undefined : 'no intraday data yet'}
              tone={totals.hasDay ? (dayUp ? 'positive' : 'negative') : 'default'}
            />
          </div>
        </PageHero>
      )}

      <Card>
        <CryptoManager />
      </Card>
    </div>
  );
};
