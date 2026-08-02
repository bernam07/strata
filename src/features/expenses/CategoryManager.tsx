import { useState, type FormEvent } from 'react';
import { Button } from '@/ui/Button';
import { Labelled, Select, TextInput } from '@/ui/Field';
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  type Category,
} from './api/useCategories';

const childrenOf = (categories: Category[], parentId: string | null) =>
  categories.filter((category) => category.parentId === parentId);

export const CategoryManager = () => {
  const { data: categories = [] } = useCategories();
  const create = useCreateCategory();
  const remove = useDeleteCategory();
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string>('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim(), parentId: parentId || null },
      { onSuccess: () => setName('') },
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
              <div className="flex items-center justify-between rounded-[var(--radius-field)] neu-flat px-4 py-2">
                <span className="font-semibold text-[var(--text-strong)]">
                  {root.name}
                </span>
                <button
                  type="button"
                  className="text-xs text-[var(--text-muted)]"
                  onClick={() => remove.mutate(root.id)}
                >
                  remove
                </button>
              </div>
              {childrenOf(categories, root.id).map((child) => (
                <div
                  key={child.id}
                  className="ml-6 flex items-center justify-between rounded-[var(--radius-field)] neu-flat px-4 py-1.5"
                >
                  <span className="text-sm text-[var(--text-muted)]">
                    {child.name}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-[var(--text-muted)]"
                    onClick={() => remove.mutate(child.id)}
                  >
                    remove
                  </button>
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
