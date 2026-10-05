import { useId } from 'react';
import { icons } from '@/app/icons';
import { TextInput } from '@/ui/Field';
import { toast } from '@/ui/toast';

export interface SecretFieldProps {
  label: string;
  hint?: string;
  placeholder: string;
  value: string;
  visible: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
  onToggleVisible: () => void;
}

export const SecretField = ({
  label,
  hint,
  placeholder,
  value,
  visible,
  disabled,
  onChange,
  onToggleVisible,
}: SecretFieldProps) => {
  const id = useId();

  const handlePaste = async () => {
    if (!navigator.clipboard?.readText) {
      toast('Clipboard access is not supported in this browser', 'error');
      return;
    }
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) {
        toast('Clipboard is empty', 'info');
        return;
      }
      onChange(text);
    } catch {
      toast('Allow clipboard paste or long-press inside the field', 'info');
    }
  };

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="font-medium text-[var(--text-muted)]">
          {label}
        </label>
        {hint && (
          <span className="text-[11px] text-[var(--text-subtle)]">{hint}</span>
        )}
      </div>
      <div className="relative flex items-center">
        <TextInput
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          disabled={disabled}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={placeholder}
          className="pr-24 font-mono text-[13px]"
          onChange={(event) => onChange(event.target.value)}
        />
        <div className="absolute right-2 flex items-center gap-1">
          {value ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange('')}
              aria-label={`Clear ${label}`}
              className="tap rounded-md px-2 py-1 text-[11px] font-semibold text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text-strong)]"
            >
              Clear
            </button>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={handlePaste}
              aria-label={`Paste ${label} from clipboard`}
              className="tap rounded-md bg-[var(--surface-raised)] px-2 py-1 text-[11px] font-semibold text-[var(--text-2)] transition-colors hover:text-[var(--accent)]"
            >
              Paste
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={onToggleVisible}
            aria-label={visible ? `Hide ${label}` : `Show ${label}`}
            aria-pressed={visible}
            className="tap flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--text-strong)]"
          >
            <span className="h-4 w-4">
              {visible ? icons.eyeOff : icons.eye}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
