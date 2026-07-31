import { Surface } from '@/ui/Surface';
import type { SyncRun } from './api/useT212';

const statusMeta: Record<SyncRun['status'], { label: string; color: string }> = {
  running: { label: 'Running', color: 'var(--text-muted)' },
  success: { label: 'Success', color: 'var(--positive)' },
  error: { label: 'Failed', color: 'var(--negative)' },
};

const formatter = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'short',
  timeStyle: 'short',
});

export const SyncRunList = ({
  runs,
  loading,
}: {
  runs: SyncRun[];
  loading: boolean;
}) => {
  if (loading) {
    return <p className="text-sm text-[var(--text-muted)]">Loading history…</p>;
  }

  if (runs.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)]">No syncs yet.</p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {runs.map((run) => {
        const meta = statusMeta[run.status];
        return (
          <Surface
            key={run.id}
            elevation="flat"
            className="flex items-center gap-4 p-4"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: meta.color }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--text-strong)]">
                {meta.label}
                {run.status === 'success' && ` · ${run.insertedRows} new`}
              </p>
              {run.errorMessage && (
                <p className="truncate text-xs text-[var(--negative)]">
                  {run.errorMessage}
                </p>
              )}
            </div>
            <span className="text-xs text-[var(--text-muted)]">
              {formatter.format(new Date(run.startedAt))}
            </span>
          </Surface>
        );
      })}
    </ul>
  );
};
