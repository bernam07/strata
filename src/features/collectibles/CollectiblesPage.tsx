import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { icons } from '@/app/icons';
import { AmountInline } from '@/ui/Amount';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { DeltaPill } from '@/ui/DeltaPill';
import { PortfolioNav } from '@/ui/HubNav';
import { PageHeader } from '@/ui/PageHeader';
import { PageHero } from '@/ui/PageHero';
import { Stat } from '@/ui/Stat';
import { TextInput } from '@/ui/Field';
import { toast } from '@/ui/toast';
import {
  CATEGORY_LABELS,
  useCollectibles,
  useSyncCollectiblePrices,
  type Collectible,
  type CollectibleCategory,
} from './api/useCollectibles';
import {
  useIncludeCollectiblesInNetWorth,
  useSetIncludeCollectiblesInNetWorth,
} from '@/features/dashboard/api/usePreferences';
import { CategoryIcon } from './components/CategoryIcon';
import { AddCollectibleModal } from './components/AddCollectibleModal';
import { EditCollectibleModal } from './components/EditCollectibleModal';

export const CollectiblesPage = () => {
  const { data: collectibles = [], isLoading } = useCollectibles();
  const syncPrices = useSyncCollectiblePrices();
  const { data: includeInNetWorth = true } = useIncludeCollectiblesInNetWorth();
  const setIncludeInNetWorth = useSetIncludeCollectiblesInNetWorth();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Collectible | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CollectibleCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const totals = useMemo(() => {
    let value = 0;
    let cost = 0;
    let totalItems = 0;

    for (const item of collectibles) {
      value += item.valueEur;
      cost += item.costEur;
      totalItems += item.quantity;
    }

    const gain = value - cost;
    const gainPct = cost > 0 ? gain / cost : null;

    return {
      value,
      cost,
      gain,
      gainPct,
      totalItems,
    };
  }, [collectibles]);

  const filteredItems = useMemo(() => {
    let list = collectibles;
    if (selectedCategory !== 'all') {
      list = list.filter((item) => item.category === selectedCategory);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.identifier?.toLowerCase().includes(q) ||
          item.notes?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [collectibles, selectedCategory, searchQuery]);

  const categoriesWithCounts = useMemo(() => {
    const counts = new Map<CollectibleCategory, number>();
    for (const item of collectibles) {
      counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    }
    return counts;
  }, [collectibles]);

  const handleSyncPrices = () => {
    const hasSyncable = collectibles.some(
      (c) => (c.category === 'pokemon' || c.category === 'lego') && Boolean(c.identifier),
    );
    if (!hasSyncable) {
      toast('No Pokémon cards or LEGO items with identifiers to sync', 'info');
      return;
    }

    syncPrices.mutate(collectibles, {
      onSuccess: ({ pokemonUpdated, legoUpdated, totalUpdated }) => {
        if (totalUpdated > 0) {
          const parts: string[] = [];
          if (pokemonUpdated > 0) {
            parts.push(`${pokemonUpdated} Pokémon card${pokemonUpdated > 1 ? 's' : ''}`);
          }
          if (legoUpdated > 0) {
            parts.push(`${legoUpdated} LEGO item${legoUpdated > 1 ? 's' : ''}`);
          }
          toast(`Updated ${parts.join(' and ')} with live market prices!`, 'success');
        } else {
          toast(
            'All Pokémon and LEGO prices are already up to date with live market data.',
            'info',
          );
        }
      },
      onError: (err) => {
        toast(err instanceof Error ? err.message : 'Failed to sync prices', 'error');
      },
    });
  };

  const gainUp = totals.gain >= 0;

  return (
    <div className="flex flex-col gap-6">
      <PortfolioNav />

      <PageHeader
        title="Alternative Assets"
        subtitle="Collectibles, Pokémon cards, LEGO sets & minifigures, and tangible assets with live market tracking."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const next = !includeInNetWorth;
                setIncludeInNetWorth.mutate(next, {
                  onSuccess: () => {
                    toast(
                      next
                        ? 'Alternative assets included in core Net Worth'
                        : 'Alternative assets excluded from core Net Worth',
                      'info',
                    );
                  },
                });
              }}
              disabled={setIncludeInNetWorth.isPending}
              title={
                includeInNetWorth
                  ? 'Included: this asset value is added to your total Net Worth on the Dashboard'
                  : 'Excluded: this asset value is kept separate from your core Net Worth on the Dashboard'
              }
              className={`tap flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                includeInNetWorth
                  ? 'border-(--positive)/40 bg-(--positive)/10 text-(--positive)'
                  : 'border-(--line) bg-(--surface-sunken) text-(--text-muted)'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  includeInNetWorth ? 'bg-(--positive)' : 'bg-(--text-muted)'
                }`}
              />
              <span>{includeInNetWorth ? 'In Net Worth: Yes' : 'In Net Worth: No'}</span>
            </button>

            {collectibles.some(
              (c) =>
                (c.category === 'pokemon' || c.category === 'lego') &&
                Boolean(c.identifier),
            ) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSyncPrices}
                disabled={syncPrices.isPending}
              >
                <span
                  className={`mr-1.5 inline-block h-3.5 w-3.5 ${syncPrices.isPending ? 'animate-spin' : ''}`}
                >
                  {icons.sync}
                </span>
                {syncPrices.isPending ? 'Syncing…' : 'Sync Prices'}
              </Button>
            )}
            <Button size="sm" onClick={() => setAddModalOpen(true)}>
              + Add Collectible
            </Button>
          </div>
        }
      />

      {collectibles.length > 0 && (
        <PageHero
          label="Total Alternative Assets Value"
          value={totals.value}
          aside={
            totals.gainPct !== null ? (
              <DeltaPill
                value={totals.gain}
                tone={gainUp ? 'positive' : 'negative'}
                note={totals.gainPct !== null ? `${gainUp ? '+' : '−'}${(Math.abs(totals.gainPct) * 100).toFixed(1)}%` : undefined}
              />
            ) : undefined
          }
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat
              label="Invested Cost"
              value={<AmountInline value={totals.cost} />}
            />
            <Stat
              label="Unrealized P&L"
              value={<AmountInline value={totals.gain} signed />}
              hint={
                totals.gainPct !== null
                  ? `${gainUp ? '+' : '−'}${(Math.abs(totals.gainPct) * 100).toFixed(1)}% total return`
                  : undefined
              }
              tone={gainUp ? 'positive' : 'negative'}
            />
            <Stat
              label="Total Items / Sets"
              value={totals.totalItems}
              hint={`${collectibles.length} holding${collectibles.length > 1 ? 's' : ''}`}
            />
          </div>
        </PageHero>
      )}

      {/* Category Filter Pills, Search & View Mode */}
      {collectibles.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`tap rounded-full px-3 py-1 text-xs font-semibold transition ${
                  selectedCategory === 'all'
                    ? 'neu-raised border border-(--accent) bg-(--surface-raised) text-(--accent)'
                    : 'neu-sunken text-(--text-muted) hover:text-(--text-strong)'
                }`}
              >
                All ({collectibles.length})
              </button>
              {(Object.keys(CATEGORY_LABELS) as CollectibleCategory[]).map((cat) => {
                const count = categoriesWithCounts.get(cat) ?? 0;
                if (count === 0) return null;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`tap flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                      selectedCategory === cat
                        ? 'neu-raised border border-(--accent) bg-(--surface-raised) text-(--accent)'
                        : 'neu-sunken text-(--text-muted) hover:text-(--text-strong)'
                    }`}
                  >
                    <CategoryIcon category={cat} size={14} />
                    <span>{CATEGORY_LABELS[cat]}</span>
                    <span className="opacity-75">({count})</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <div className="w-48 sm:w-60">
                <TextInput
                  value={searchQuery}
                  placeholder="Filter holdings…"
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-1 rounded-lg neu-sunken p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`tap rounded px-2.5 py-1 transition ${
                    viewMode === 'grid'
                      ? 'neu-raised bg-(--surface-raised) text-(--text-strong)'
                      : 'text-(--text-muted) hover:text-(--text-strong)'
                  }`}
                >
                  Grid
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`tap rounded px-2.5 py-1 transition ${
                    viewMode === 'list'
                      ? 'neu-raised bg-(--surface-raised) text-(--text-strong)'
                      : 'text-(--text-muted) hover:text-(--text-strong)'
                  }`}
                >
                  List
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-sm text-(--text-muted)">
          Loading collectibles portfolio…
        </div>
      ) : collectibles.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-(--surface-sunken) text-(--accent)">
            <span className="h-8 w-8">{icons.collectibles}</span>
          </div>
          <div className="max-w-md">
            <h3 className="text-base font-bold text-(--text-strong)">
              No alternative assets added yet
            </h3>
            <p className="mt-1 text-xs text-(--text-muted) leading-relaxed">
              Track Pokémon cards with live Cardmarket prices, LEGO sets &amp; rare minifigures via Rebrickable,
              luxury watches, bullion coins, or fine art and monitor their appreciation in your net worth.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => setAddModalOpen(true)}>
              + Add First Collectible
            </Button>
            <NavLink to="/integrations">
              <Button variant="ghost">
                Configure Integrations →
              </Button>
            </NavLink>
          </div>
        </Card>
      ) : filteredItems.length === 0 ? (
        <Card className="p-8 text-center text-xs text-(--text-muted)">
          No items match your filter criteria.
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filteredItems.map((item) => {
            const isProfit = item.gainEur >= 0;
            return (
              <div
                key={item.id}
                onClick={() => setEditingItem(item)}
                className="tap group relative flex cursor-pointer flex-col overflow-hidden rounded-(--radius-card) border border-(--line) bg-(--surface-raised) transition duration-200 hover:-translate-y-1 hover:border-(--accent) hover:shadow-lg"
              >
                {/* Proportional, well-sized Image Showcase */}
                <div className="relative flex h-36 w-full items-center justify-center overflow-hidden bg-(--surface-sunken) p-2 sm:h-40">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      loading="lazy"
                      className="max-h-full max-w-full object-contain drop-shadow-sm transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1.5 text-(--text-muted)">
                      <CategoryIcon category={item.category} size={28} />
                      <span className="text-[10px] font-medium">{CATEGORY_LABELS[item.category]}</span>
                    </div>
                  )}

                  {/* Top Category and Condition Badges */}
                  <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                    <span className="flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-xs">
                      <CategoryIcon category={item.category} size={11} />
                      {item.quantity > 1 ? `×${item.quantity}` : ''}
                    </span>
                  </div>

                  {item.condition && (
                    <div className="absolute right-2 top-2">
                      <span className="rounded-full bg-(--surface-raised)/90 px-1.5 py-0.5 text-[9px] font-bold text-(--accent) backdrop-blur-xs border border-(--line)">
                        {item.condition.split(' ')[0]}
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Body */}
                <div className="flex flex-1 flex-col justify-between p-2.5 sm:p-3">
                  <div>
                    <h4 className="line-clamp-2 text-xs font-bold text-(--text-strong) group-hover:text-(--accent)">
                      {item.name}
                    </h4>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      {item.identifier && (
                        <p className="truncate text-[10px] text-(--text-muted) font-mono">
                          #{item.identifier}
                        </p>
                      )}
                      {Boolean(
                        item.metadata?.language === 'ja' ||
                          (item.category === 'pokemon' &&
                            item.identifier &&
                            /^(sv\d+[a-z]?|s\d+[a-z]?|sm\d+|pmcg)/i.test(item.identifier)),
                      ) && (
                        <span className="rounded bg-rose-950/80 border border-rose-500/30 px-1 py-0.2 text-[9px] font-bold text-rose-300">
                          JA
                        </span>
                      )}
                      {Boolean(item.metadata?.finish) && (
                        <span className="rounded bg-(--surface-sunken) px-1 py-0.2 text-[9px] font-semibold uppercase tracking-wider text-(--accent)">
                          {String(item.metadata.finish).replace(/-/g, ' ')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-end justify-between border-t border-(--line)/50 pt-2">
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-(--text-muted)">
                        Value
                      </p>
                      <p className="text-xs font-extrabold text-(--text-strong) sm:text-sm">
                        <AmountInline value={item.valueEur} />
                      </p>
                    </div>

                    <div className="text-right">
                      {item.gainPct !== null ? (
                        <span
                          className={`text-[11px] font-bold tabular-nums sm:text-xs ${
                            isProfit ? 'text-(--positive)' : 'text-(--negative)'
                          }`}
                        >
                          {isProfit ? '+' : ''}
                          {(item.gainPct * 100).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-[11px] text-(--text-muted) sm:text-xs">—</span>
                      )}
                      <p className="text-[9px] text-(--text-muted)">
                        cost: <AmountInline value={item.costEur} />
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-(--line) bg-(--surface-sunken) text-[10px] font-bold uppercase tracking-wider text-(--text-muted)">
                <tr>
                  <th className="px-4 py-3">Asset</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Condition</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Total Cost</th>
                  <th className="px-4 py-3 text-right">Current Value</th>
                  <th className="px-4 py-3 text-right">Unrealized P&amp;L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-(--line)">
                {filteredItems.map((item) => {
                  const isProfit = item.gainEur >= 0;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setEditingItem(item)}
                      className="tap cursor-pointer hover:bg-(--surface-flat)"
                    >
                      <td className="flex items-center gap-2.5 px-4 py-3">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="h-8 w-8 rounded object-contain bg-(--surface-sunken) p-0.5"
                          />
                        ) : (
                          <span className="grid h-8 w-8 place-items-center rounded bg-(--surface-sunken) text-(--text-muted)">
                            <CategoryIcon category={item.category} size={16} />
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-bold text-(--text-strong)">
                            {item.name}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {item.identifier && (
                              <p className="text-[10px] text-(--text-muted) font-mono">
                                #{item.identifier}
                              </p>
                            )}
                            {Boolean(item.metadata?.finish) && (
                              <span className="rounded bg-(--surface-sunken) px-1 py-0.2 text-[9px] font-semibold uppercase tracking-wider text-(--accent)">
                                {String(item.metadata.finish).replace(/-/g, ' ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-(--text-2)">
                        <div className="flex items-center gap-1.5">
                          <CategoryIcon category={item.category} size={13} />
                          <span>{CATEGORY_LABELS[item.category]}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-(--text-muted)">
                        {item.condition || '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        <AmountInline value={item.costEur} />
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-(--text-strong)">
                        <AmountInline value={item.valueEur} />
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">
                        {item.gainPct !== null ? (
                          <span className={isProfit ? 'text-(--positive)' : 'text-(--negative)'}>
                            {isProfit ? '+' : ''}
                            <AmountInline value={item.gainEur} signed /> ({(item.gainPct * 100).toFixed(1)}%)
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modals */}
      <AddCollectibleModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
      />

      <EditCollectibleModal
        collectible={editingItem}
        onClose={() => setEditingItem(null)}
      />
    </div>
  );
};
