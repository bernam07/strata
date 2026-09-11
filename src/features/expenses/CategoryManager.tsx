import { useState, type FormEvent } from 'react';
import { Button } from '@/ui/Button';
import { Labelled, Select, TextInput } from '@/ui/Field';
import { toast } from '@/ui/toast';
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useMergeCategory,
  useUpdateCategory,
  type Category,
} from './api/useCategories';
import { CATEGORY_COLORS, tileStyle } from './categoryColors';

const childrenOf = (categories: Category[], parentId: string | null) =>
  categories.filter((category) => category.parentId === parentId);

const editInputClass =
  'min-w-0 flex-1 rounded-[var(--radius-field)] neu-sunken px-3 py-1.5 text-sm text-[var(--text-strong)] outline-none focus:border-[var(--accent)]';

const actionClass = 'tap text-xs text-[var(--text-muted)]';

const swatchClass = (selected: boolean): string =>
  `tap h-5 w-5 rounded-full border ${
    selected
      ? 'outline outline-2 outline-offset-2 outline-[var(--accent)]'
      : 'opacity-80 hover:opacity-100'
  }`;

export const CategoryManager = () => {
  const { data: categories = [] } = useCategories();
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const remove = useDeleteCategory();
  const merge = useMergeCategory();
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string>('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftParent, setDraftParent] = useState<string>('');
  const [draftColor, setDraftColor] = useState<string | null>(null);
  const [mergingId, setMergingId] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState<string>('');

  const roots = childrenOf(categories, null);
  const hasChildren = (id: string) =>
    categories.some((category) => category.parentId === id);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim(), parentId: parentId || null },
      {
        onSuccess: () => {
          setName('');
          toast('Category added', 'success');
        },
      },
    );
  };

  const startEdit = (category: Category) => {
    setMergingId(null);
    setEditingId(category.id);
    setDraftName(category.name);
    setDraftParent(category.parentId ?? '');
    setDraftColor(category.color);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftName('');
    setDraftParent('');
    setDraftColor(null);
  };

  const saveEdit = (category: Category) => {
    const trimmed = draftName.trim();
    if (!trimmed) return;
    const leaf = !hasChildren(category.id);
    update.mutate(
      {
        id: category.id,
        name: trimmed,
        color: draftColor,
        // Only leaves can be re-parented (the tree is two levels deep).
        ...(leaf ? { parentId: draftParent || null } : {}),
      },
      {
        onSuccess: () => {
          cancelEdit();
          toast('Category updated', 'success');
        },
      },
    );
  };

  const startMerge = (category: Category) => {
    setEditingId(null);
    setMergingId(category.id);
    setMergeTarget('');
  };

  const confirmMerge = (category: Category) => {
    if (!mergeTarget) return;
    const target = categories.find((c) => c.id === mergeTarget);
    if (
      !window.confirm(
        `Move every transaction in “${category.name}” to “${target?.name}” and delete “${category.name}”?`,
      )
    ) {
      return;
    }
    merge.mutate(
      { sourceId: category.id, targetId: mergeTarget },
      {
        onSuccess: () => {
          setMergingId(null);
          toast('Categories merged', 'success');
        },
        onError: () => toast("Couldn't merge categories", 'error'),
      },
    );
  };

  // Plain functions (not nested components) so inputs keep focus across renders.
  const renderRow = (category: Category, variant: 'root' | 'child') => {
    const rowClass =
      variant === 'root'
        ? 'flex flex-wrap items-center gap-2 rounded-[var(--radius-field)] neu-flat px-4 py-2'
        : 'ml-6 flex flex-wrap items-center gap-2 rounded-[var(--radius-field)] neu-flat px-4 py-1.5';
    const nameClass =
      variant === 'root'
        ? 'font-semibold text-[var(--text-strong)]'
        : 'text-sm text-[var(--text-muted)]';
    const leaf = !hasChildren(category.id);

    if (editingId === category.id) {
      return (
        <div className={rowClass}>
          <input
            autoFocus
            className={editInputClass}
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') saveEdit(category);
              if (event.key === 'Escape') cancelEdit();
            }}
          />
          {leaf && (
            <select
              value={draftParent}
              onChange={(event) => setDraftParent(event.target.value)}
              className="rounded-[var(--radius-field)] neu-sunken px-2 py-1.5 text-xs text-[var(--text-strong)] outline-none focus:border-[var(--accent)]"
            >
              <option value="">Root</option>
              {roots
                .filter((root) => root.id !== category.id)
                .map((root) => (
                  <option key={root.id} value={root.id}>
                    in {root.name}
                  </option>
                ))}
            </select>
          )}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setDraftColor(null)}
              title="Default (neutral)"
              aria-label="Default (neutral)"
              aria-pressed={draftColor === null}
              className={swatchClass(draftColor === null)}
              style={{
                background: 'var(--surface-sunken)',
                borderColor: 'var(--line)',
              }}
            />
            {CATEGORY_COLORS.map((swatch) => (
              <button
                key={swatch.hex}
                type="button"
                onClick={() => setDraftColor(swatch.hex)}
                title={swatch.name}
                aria-label={swatch.name}
                aria-pressed={draftColor === swatch.hex}
                className={swatchClass(draftColor === swatch.hex)}
                style={{ background: swatch.hex, borderColor: 'transparent' }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => saveEdit(category)}
            disabled={update.isPending || !draftName.trim()}
            className="tap text-xs font-semibold text-[var(--accent)] disabled:opacity-50"
          >
            save
          </button>
          <button type="button" onClick={cancelEdit} className={actionClass}>
            cancel
          </button>
        </div>
      );
    }

    if (mergingId === category.id) {
      const targets = categories.filter(
        (c) => c.id !== category.id && c.parentId !== category.id,
      );
      return (
        <div className={rowClass}>
          <span className={`min-w-0 flex-1 truncate ${nameClass}`}>
            {category.name} →
          </span>
          <select
            value={mergeTarget}
            onChange={(event) => setMergeTarget(event.target.value)}
            className="min-w-0 rounded-[var(--radius-field)] neu-sunken px-2 py-1.5 text-xs text-[var(--text-strong)] outline-none focus:border-[var(--accent)]"
          >
            <option value="">Merge into…</option>
            {targets.map((c) => (
              <option key={c.id} value={c.id}>
                {c.parentId ? `↳ ${c.name}` : c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => confirmMerge(category)}
            disabled={merge.isPending || !mergeTarget}
            className="tap text-xs font-semibold text-[var(--accent)] disabled:opacity-50"
          >
            merge
          </button>
          <button
            type="button"
            onClick={() => setMergingId(null)}
            className={actionClass}
          >
            cancel
          </button>
        </div>
      );
    }

    return (
      <div className={rowClass}>
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: tileStyle(category.color).dot }}
        />
        <span className={`min-w-0 flex-1 truncate ${nameClass}`}>
          {category.name}
        </span>
        <button
          type="button"
          onClick={() => startEdit(category)}
          className={`${actionClass} hover:text-[var(--accent)]`}
        >
          edit
        </button>
        {leaf && categories.length > 1 && (
          <button
            type="button"
            onClick={() => startMerge(category)}
            className={`${actionClass} hover:text-[var(--text-strong)]`}
          >
            merge
          </button>
        )}
        <button
          type="button"
          onClick={() =>
            remove.mutate(category.id, {
              onSuccess: () => toast('Category removed'),
            })
          }
          className={`${actionClass} hover:text-[var(--negative)]`}
        >
          remove
        </button>
      </div>
    );
  };

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
