import { useMemo, useState } from 'react';
import { AmountInline } from '@/ui/Amount';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { DeltaPill } from '@/ui/DeltaPill';
import { PortfolioNav } from '@/ui/HubNav';
import { PageHeader } from '@/ui/PageHeader';
import { PageHero } from '@/ui/PageHero';
import { Stat } from '@/ui/Stat';
import { toast } from '@/ui/toast';
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  useCollectibles,
  useRefreshPokemonPrices,
  type Collectible,
  type CollectibleCategory,
} from './api/useCollectibles';
import {
  useIncludeCollectiblesInNetWorth,
  useSetIncludeCollectiblesInNetWorth,
} from '@/features/dashboard/api/usePreferences';
import { AddCollectibleModal } from './components/AddCollectibleModal';
import { EditCollectibleModal } from './components/EditCollectibleModal';

export const CollectiblesPage = () => {
  const { data: collectibles = [], isLoading } = useCollectibles();
  const refreshPokemon = useRefreshPokemonPrices();
  const { data: includeInNetWorth = true } = useIncludeCollectiblesInNetWorth();
  const setIncludeInNetWorth = useSetIncludeCollectiblesInNetWorth();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Collectible | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CollectibleCategory | 'all'>('all');
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
    if (selectedCategory === 'all') return collectibles;
    return collectibles.filter((item) => item.category === selectedCategory);
  }, [collectibles, selectedCategory]);

  const categoriesWithCounts = useMemo(() => {
    const counts = new Map<CollectibleCategory, number>();
    for (const item of collectibles) {
      counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    }
    return counts;
  }, [collectibles]);

  const handleRefreshPokemon = () => {
    const pokemonCount = collectibles.filter((c) => c.category === 'pokemon' && c.identifier).length;
    if (pokemonCount === 0) {
      toast('Nenhuma carta com identificador TCGdex para atualizar', 'info');
      return;
    }

    refreshPokemon.mutate(collectibles, {
      onSuccess: (count) => {
        toast(
          count > 0
            ? `${count} carta${count > 1 ? 's' : ''} atualizada${count > 1 ? 's' : ''} com cotações Cardmarket!`
            : 'As cotações das cartas já estão atualizadas.',
          'success',
        );
      },
      onError: (err) => {
        toast(err instanceof Error ? err.message : 'Falha ao atualizar cotações', 'error');
      },
    });
  };

  const gainUp = totals.gain >= 0;

  return (
    <div className="flex flex-col gap-6">
      <PortfolioNav />

      <PageHeader
        title="Alternative Assets"
        subtitle="Colecionáveis, cartas Pokémon, LEGO e ativos tangíveis com cotações de mercado."
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
                        ? 'Ativos alternativos somados ao Net Worth principal'
                        : 'Ativos alternativos excluídos do Net Worth principal',
                      'info',
                    );
                  },
                });
              }}
              disabled={setIncludeInNetWorth.isPending}
              title={
                includeInNetWorth
                  ? 'Ativo: este valor está somado ao teu Net Worth no Dashboard'
                  : 'Inativo: este valor está separado do teu Net Worth no Dashboard'
              }
              className={`tap flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                includeInNetWorth
                  ? 'border-[var(--positive)]/40 bg-[var(--positive)]/10 text-[var(--positive)]'
                  : 'border-[var(--line)] bg-[var(--surface-sunken)] text-[var(--text-muted)]'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  includeInNetWorth ? 'bg-[var(--positive)]' : 'bg-[var(--text-muted)]'
                }`}
              />
              <span>{includeInNetWorth ? 'No Net Worth: Sim' : 'No Net Worth: Não'}</span>
            </button>

            {collectibles.some((c) => c.category === 'pokemon' && c.identifier) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleRefreshPokemon}
                disabled={refreshPokemon.isPending}
              >
                <span
                  className={`mr-1.5 inline-block ${refreshPokemon.isPending ? 'animate-spin' : ''}`}
                >
                  ⚡
                </span>
                {refreshPokemon.isPending ? 'A atualizar...' : 'Atualizar Pokémon'}
              </Button>
            )}
            <Button size="sm" onClick={() => setAddModalOpen(true)}>
              + Adicionar Ativo
            </Button>
          </div>
        }
      />

      {collectibles.length > 0 && (
        <PageHero
          label="Valor Total de Colecionáveis"
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
              label="Investido (Custo)"
              value={<AmountInline value={totals.cost} />}
            />
            <Stat
              label="Mais-Valia Não Realizada"
              value={<AmountInline value={totals.gain} signed />}
              hint={
                totals.gainPct !== null
                  ? `${gainUp ? '+' : '−'}${(Math.abs(totals.gainPct) * 100).toFixed(1)}% de retorno`
                  : undefined
              }
              tone={gainUp ? 'positive' : 'negative'}
            />
            <Stat
              label="Total de Peças / Itens"
              value={totals.totalItems}
              hint={`${collectibles.length} registo${collectibles.length > 1 ? 's' : ''}`}
            />
          </div>
        </PageHero>
      )}

      {/* Category Filter Pills & View Mode */}
      {collectibles.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`tap rounded-full px-3 py-1 text-xs font-semibold transition ${
                selectedCategory === 'all'
                  ? 'neu-raised border border-[var(--accent)] bg-[var(--surface-raised)] text-[var(--accent)]'
                  : 'neu-sunken text-[var(--text-muted)] hover:text-[var(--text-strong)]'
              }`}
            >
              Todos ({collectibles.length})
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
                      ? 'neu-raised border border-[var(--accent)] bg-[var(--surface-raised)] text-[var(--accent)]'
                      : 'neu-sunken text-[var(--text-muted)] hover:text-[var(--text-strong)]'
                  }`}
                >
                  <span>{CATEGORY_ICONS[cat]}</span>
                  <span>{CATEGORY_LABELS[cat]}</span>
                  <span className="opacity-75">({count})</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 rounded-lg neu-sunken p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`tap rounded px-2.5 py-1 transition ${
                viewMode === 'grid'
                  ? 'neu-raised bg-[var(--surface-raised)] text-[var(--text-strong)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'
              }`}
            >
              Grelha
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`tap rounded px-2.5 py-1 transition ${
                viewMode === 'list'
                  ? 'neu-raised bg-[var(--surface-raised)] text-[var(--text-strong)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-strong)]'
              }`}
            >
              Lista
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12 text-sm text-[var(--text-muted)]">
          A carregar os teus colecionáveis...
        </div>
      ) : collectibles.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--surface-sunken)] text-3xl">
            ⚡
          </div>
          <div className="max-w-md">
            <h3 className="text-base font-bold text-[var(--text-strong)]">
              Nenhum ativo alternativo registado
            </h3>
            <p className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">
              Regista cartas Pokémon com cotações automáticas Cardmarket, sets de LEGO, relógios,
              moedas ou obras de arte e acompanha a sua valorização no teu património total.
            </p>
          </div>
          <Button onClick={() => setAddModalOpen(true)}>
            + Adicionar Primeiro Ativo
          </Button>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredItems.map((item) => {
            const isProfit = item.gainEur >= 0;
            return (
              <div
                key={item.id}
                onClick={() => setEditingItem(item)}
                className="tap group relative flex cursor-pointer flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface-raised)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-lg"
              >
                {/* Image container */}
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-[var(--surface-sunken)]">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      loading="lazy"
                      className="h-full w-full object-contain p-2 transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
                      <span className="text-4xl">{CATEGORY_ICONS[item.category]}</span>
                      <span className="text-xs">{CATEGORY_LABELS[item.category]}</span>
                    </div>
                  )}

                  {/* Top Badges */}
                  <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1">
                    <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                      {CATEGORY_ICONS[item.category]} {item.quantity > 1 ? `x${item.quantity}` : ''}
                    </span>
                    {item.condition && (
                      <span className="rounded-full bg-[var(--accent)]/90 px-2 py-0.5 text-[10px] font-bold text-[var(--accent-ink)] backdrop-blur-xs">
                        {item.condition}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="flex flex-1 flex-col justify-between p-3.5">
                  <div>
                    <h4 className="line-clamp-2 text-xs font-bold text-[var(--text-strong)] group-hover:text-[var(--accent)]">
                      {item.name}
                    </h4>
                    {item.identifier && (
                      <p className="mt-0.5 text-[11px] text-[var(--text-muted)] font-mono">
                        {item.identifier}
                      </p>
                    )}
                  </div>

                  <div className="mt-3 flex items-end justify-between border-t border-[var(--line)]/50 pt-2.5">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                        Valor
                      </p>
                      <p className="text-sm font-extrabold text-[var(--text-strong)]">
                        <AmountInline value={item.valueEur} />
                      </p>
                    </div>

                    <div className="text-right">
                      {item.gainPct !== null ? (
                        <span
                          className={`text-xs font-bold tabular-nums ${
                            isProfit ? 'text-[var(--positive)]' : 'text-[var(--negative)]'
                          }`}
                        >
                          {isProfit ? '+' : ''}
                          {(item.gainPct * 100).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--text-muted)]">—</span>
                      )}
                      <p className="text-[10px] text-[var(--text-muted)]">
                        custo: <AmountInline value={item.costEur} />
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
              <thead className="border-b border-[var(--line)] bg-[var(--surface-sunken)] text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3">Ativo</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Condição</th>
                  <th className="px-4 py-3 text-right">Qtd</th>
                  <th className="px-4 py-3 text-right">Custo Total</th>
                  <th className="px-4 py-3 text-right">Valor Atual</th>
                  <th className="px-4 py-3 text-right">P&L</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {filteredItems.map((item) => {
                  const isProfit = item.gainEur >= 0;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setEditingItem(item)}
                      className="tap cursor-pointer hover:bg-[var(--surface-flat)]"
                    >
                      <td className="flex items-center gap-2.5 px-4 py-3">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="h-8 w-8 rounded object-contain"
                          />
                        ) : (
                          <span className="grid h-8 w-8 place-items-center rounded bg-[var(--surface-sunken)] text-sm">
                            {CATEGORY_ICONS[item.category]}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-bold text-[var(--text-strong)]">
                            {item.name}
                          </p>
                          {item.identifier && (
                            <p className="text-[10px] text-[var(--text-muted)] font-mono">
                              {item.identifier}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-2)]">
                        {CATEGORY_LABELS[item.category]}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-muted)]">
                        {item.condition || '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        <AmountInline value={item.costEur} />
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[var(--text-strong)]">
                        <AmountInline value={item.valueEur} />
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">
                        {item.gainPct !== null ? (
                          <span className={isProfit ? 'text-[var(--positive)]' : 'text-[var(--negative)]'}>
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
