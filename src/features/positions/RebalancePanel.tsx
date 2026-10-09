import { useState } from 'react';
import { pct0 as percent } from '@/ui/format';
import { AmountInline } from '@/ui/Amount';
import { rebalanceRows } from '@/core/positions/rebalance';
import type { InstrumentMeta } from './api/usePositions';
import { useAllocationTargets, useSetTarget } from './api/useTargets';

interface Entry {
  instrumentId: string;
  value: number;
}

const Row = ({
  entry,
  meta,
  total,
  target,
  onSave,
}: {
  entry: Entry;
  meta: InstrumentMeta | undefined;
  total: number;
  target: number | undefined;
  onSave: (weight: number | null) => void;
}) => {
  const [text, setText] = useState(
    target !== undefined ? String(Math.round(target * 100)) : '',
  );
  const current = total > 0 ? entry.value / total : 0;

  const commit = () => {
    const trimmed = text.trim();
    if (trimmed === '') {
      onSave(null);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return;
    onSave(Math.max(0, Math.min(100, parsed)) / 100);
  };

  const drift =
    target !== undefined ? (target - current) * total : null;

  return (
    <div className="flex items-center gap-3">
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text-strong)]">
        {meta?.name ?? meta?.ticker ?? 'Instrument'}
      </span>
      <span className="w-12 text-right text-xs tabular-nums text-[var(--text-muted)]">
        {percent.format(current)}
      </span>
      <div className="flex items-center gap-1">
        <input
          className="w-12 appearance-none rounded-[var(--radius-field)] neu-sunken px-2 py-1 text-right text-sm tabular-nums text-[var(--text-strong)] outline-none focus:border-[var(--accent)]"
          type="number"
          inputMode="numeric"
          min="0"
          max="100"
          placeholder="—"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur();
            }
          }}
          onBlur={commit}
        />
        <span className="text-xs text-[var(--text-muted)]">%</span>
      </div>
      <span
        className="w-24 text-right text-xs font-semibold tabular-nums"
        style={{
          color:
            drift === null
              ? 'var(--text-muted)'
              : drift >= 0
                ? 'var(--positive)'
                : 'var(--negative)',
        }}
      >
        {drift === null
          ? '—'
          : <>{drift >= 0 ? 'Buy ' : 'Sell '}<AmountInline value={Math.abs(drift)} /></>}
      </span>
    </div>
  );
};

export const RebalancePanel = ({
  positions,
  instruments,
  total,
}: {
  positions: Entry[];
  instruments: Map<string, InstrumentMeta>;
  total: number;
}) => {
  const { data: targets = new Map<string, number>() } = useAllocationTargets();
  const setTarget = useSetTarget();

  const rows = rebalanceRows(positions, (id) => targets.get(id), total);
  const targetSum = [...targets.values()].reduce((sum, weight) => sum + weight, 0);
  const sorted = [...positions].sort((a, b) => b.value - a.value);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          Set target weights to see what to buy or sell
        </span>
        {rows.length > 0 && (
          <span
            className="text-xs font-semibold tabular-nums"
            style={{
              color:
                Math.abs(targetSum - 1) < 0.005
                  ? 'var(--text-muted)'
                  : 'var(--negative)',
            }}
          >
            targets {percent.format(targetSum)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 px-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
        <span className="flex-1">Holding</span>
        <span className="w-12 text-right">Now</span>
        <span className="w-14 text-right">Target</span>
        <span className="w-24 text-right">Action</span>
      </div>
      {sorted.map((entry) => (
        <Row
          key={entry.instrumentId}
          entry={entry}
          meta={instruments.get(entry.instrumentId)}
          total={total}
          target={targets.get(entry.instrumentId)}
          onSave={(weight) =>
            setTarget.mutate({ instrumentId: entry.instrumentId, weight })
          }
        />
      ))}
    </div>
  );
};
