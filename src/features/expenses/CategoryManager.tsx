import { useState, type FormEvent } from 'react';
import { Button } from '@/ui/Button';
import { Labelled, Select, TextInput } from '@/ui/Field';
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
  type Category,
} from './api/useCategories';

const childrenOf = (categories: Category[], parentId: string | null) =>
  categories.filter((category) => category.parentId === parentId);

const editInputClass =
  'min-w-0 flex-1 rounded-[var(--radius-field)] neu-sunken px-3 py-1.5 text-sm text-[var(--text-strong)] outline-none focus:border-[var(--accent)]';

export const CategoryManager = () => {
  const { data: categories = [] } = useCategories();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const remove = useDeleteCategory();
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim(), parentId: parentId || null },
      { onSuccess: () => setName('') },
    );
  };

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setDraft(category.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft('');
  };

  const saveEdit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    update.mutate(
      { id: editingId!, name: trimmed },
      { onSuccess: cancelEdit },
    );
  };

  // A plain function (not a nested component used via JSX) so the edit input
  // keeps focus across re-renders instead of remounting on every keystroke.
  const renderRow = (category: Category, variant: 'root' | 'child') => {
    const editing = editingId === category.id;
    const rowClass =
      variant === 'root'
        ? 'flex items-center gap-2 rounded-[var(--radius-field)] neu-flat px-4 py-2'
        : 'ml-6 flex items-center gap-2 rounded-[var(--radius-field)] neu-flat px-4 py-1.5';
    const nameClass =
      variant === 'root'
        ? 'font-semibold text-[var(--text-strong)]'
        : 'text-sm text-[var(--text-muted)]';

    if (editing) {
      return (
        <div className={rowClass}>
          <input
            autoFocus
            className={editInputClass}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') saveEdit();
              if (event.key === 'Escape') cancelEdit();
            }}
          />
          <button
            type="button"
            onClick={saveEdit}
            disabled={update.isPending || !draft.trim()}
            className="tap text-xs font-semibold text-[var(--accent)] disabled:opacity-50"
          >
            save
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            className="tap text-xs text-[var(--text-muted)]"
          >
            cancel
          </button>
        </div>
      );
    }

    return (
      <div className={rowClass}>
        <span className={`min-w-0 flex-1 truncate ${nameClass}`}>
          {category.name}
        </span>
        <button
          type="button"
          onClick={() => startEdit(category)}
          className="tap text-xs text-[var(--text-muted)] hover:text-[var(--accent)]"
        >
          edit
        </button>
        <button
          type="button"
          onClick={() => remove.mutate(category.id)}
          className="tap text-xs text-[var(--text-muted)] hover:text-[var(--negative)]"
        >
          remove
        </button>
      </div>
    );
  };

  const roots = childrenOf(categories, null);

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Labelled label="New category">
          <TextInput
            value={name}
            placeholder="Groceries"
            onChange={(event) => setName(event.target.value)}
          />
        </Labelled>
        <Labelled label="Inside">
          <Select
            value={parentId}
            onChange={(event) => setParentId(event.target.value)}
          >
            <option value="">Root</option>
            {roots.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Labelled>
        <Button type="submit" disabled={create.isPending || !name.trim()}>
          Add
        </Button>
      </form>

      {roots.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No categories yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {roots.map((root) => (
            <li key={root.id} className="flex flex-col gap-1">
              {renderRow(root, 'root')}
              {childrenOf(categories, root.id).map((child) => (
                <div key={child.id}>{renderRow(child, 'child')}</div>
              ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
