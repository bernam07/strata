import { useEffect, useState } from 'react';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import {
  useInstrumentNote,
  useSaveInstrumentNote,
} from '../api/useInstrumentNote';

export const InstrumentNote = ({ instrumentId }: { instrumentId: string }) => {
  const { data: saved = '' } = useInstrumentNote(instrumentId);
  const save = useSaveInstrumentNote(instrumentId);
  const [draft, setDraft] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loaded) {
      setDraft(saved);
      if (saved.length > 0) setLoaded(true);
    }
  }, [saved, loaded]);

  const dirty = draft.trim() !== saved.trim();

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          Notes
        </h2>
        {dirty && (
          <Button
            variant="ghost"
            onClick={() => save.mutate(draft)}
            disabled={save.isPending}
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        )}
      </div>
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={() => setLoaded(true)}
        placeholder="Your thesis, targets, reminders…"
        rows={4}
        className="block w-full resize-y rounded-[var(--radius-field)] neu-sunken px-3.5 py-2.5 text-sm text-[var(--text-strong)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
      />
    </Card>
  );
};
