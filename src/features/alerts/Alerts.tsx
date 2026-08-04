import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { alertMet, type AlertDirection } from '@/core/alerts/evaluate';
import { Button } from '@/ui/Button';
import { MoneyInput } from '@/ui/Field';
import type { MiniQuote } from '@/features/search/api/useMarket';
import {
  useCreateAlert,
  useDeleteAlert,
  useMarkAlertTriggered,
  usePriceAlerts,
  type PriceAlert,
} from './api/useAlerts';

export const AlertBanner = () => {
  const { data: alerts = [] } = usePriceAlerts();
  const triggered = alerts.filter((alert) => alert.triggeredAt);
  if (triggered.length === 0) return null;
  return (
    <Link
      to="/search"
      className="tap flex items-center gap-3 rounded-[var(--radius-card)] p-4"
      style={{ boxShadow: 'inset 0 0 0 1px var(--accent)' }}
    >
      <span className="text-lg">🔔</span>
      <span className="flex-1 text-sm font-semibold text-[var(--text-strong)]">
        {triggered.length === 1
          ? `${triggered[0]!.name} hit your alert`
          : `${triggered.length} price alerts triggered`}
      </span>
      <span className="text-xs font-semibold text-[var(--accent)]">View →</span>
    </Link>
  );
};

const fmt = (value: number, currency: string) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);

export const AlertForm = ({
  symbol,
  name,
  currency,
}: {
  symbol: string;
  name: string;
  currency: string;
}) => {
  const create = useCreateAlert();
  const { data: alerts = [] } = usePriceAlerts();
  const remove = useDeleteAlert();
  const [direction, setDirection] = useState<AlertDirection>('above');
  const [target, setTarget] = useState('');

  const mine = alerts.filter((alert) => alert.symbol === symbol);

  const add = () => {
    const value = Number(target);
    if (!Number.isFinite(value) || value <= 0) return;
    create.mutate(
      { symbol, name, direction, target: value, currency },
      { onSuccess: () => setTarget('') },
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Price alert
      </p>
      <div className="flex items-end gap-2">
        <div className="flex gap-1 rounded-[var(--radius-field)] neu-sunken p-1">
          {(['above', 'below'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDirection(option)}
              className={`tap rounded-[var(--radius-field)] px-3 py-1.5 text-xs font-semibold ${
                direction === option
                  ? 'neu-flat text-[var(--accent)]'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              {option === 'above' ? 'Above' : 'Below'}
            </button>
          ))}
        </div>
        <div className="w-28">
          <MoneyInput placeholder="Target" value={target} onChange={setTarget} />
        </div>
        <Button onClick={add} disabled={!target || create.isPending}>
          Add
        </Button>
      </div>

      {mine.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {mine.map((alert) => (
            <li
              key={alert.id}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-[var(--text-2)]">
                {alert.direction === 'above' ? '≥' : '≤'}{' '}
                {fmt(alert.target, alert.currency)}
                {alert.triggeredAt && ' · 🔔 triggered'}
              </span>
              <button
                type="button"
                onClick={() => remove.mutate(alert.id)}
                className="tap text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--negative)]"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const AlertsList = ({
  alerts,
  quotes,
}: {
  alerts: PriceAlert[];
  quotes: Record<string, MiniQuote>;
}) => {
  const mark = useMarkAlertTriggered();
  const remove = useDeleteAlert();

  useEffect(() => {
    for (const alert of alerts) {
      const quote = quotes[alert.symbol];
      if (!quote) continue;
      const met = alertMet(alert.direction, alert.target, quote.price);
      if (met && !alert.triggeredAt) mark.mutate({ id: alert.id, triggered: true });
      if (!met && alert.triggeredAt) mark.mutate({ id: alert.id, triggered: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts, quotes]);

  if (alerts.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="px-0.5 text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
        Alerts
      </h2>
      {alerts.map((alert) => {
        const quote = quotes[alert.symbol];
        const triggered = Boolean(alert.triggeredAt);
        return (
          <div
            key={alert.id}
            className="flex items-center gap-4 rounded-[var(--radius-card)] neu-flat p-4"
            style={
              triggered
                ? { boxShadow: 'inset 0 0 0 1px var(--accent)' }
                : undefined
            }
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-[var(--text-strong)]">
                {alert.name}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {alert.symbol} · {alert.direction === 'above' ? '≥' : '≤'}{' '}
                {fmt(alert.target, alert.currency)}
              </p>
            </div>
            <div className="text-right">
              {quote && (
                <p className="text-sm font-semibold tabular-nums text-[var(--text-strong)]">
                  {fmt(quote.price, quote.currency)}
                </p>
              )}
              {triggered && (
                <p className="text-xs font-semibold text-[var(--accent)]">
                  🔔 triggered
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => remove.mutate(alert.id)}
              className="tap text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--negative)]"
            >
              Remove
            </button>
          </div>
        );
      })}
    </section>
  );
};
