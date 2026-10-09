import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/db/supabase';
import type { Database, Json } from '@/db/database.types';
import {
  extractCollectrPrice,
  getPokemonCard,
  getUsdToEurRate,
  resolvePokemonImageUrl,
  type PokemonCardFinish,
} from './tcgdex';
import { resolveLegoPrice } from './legoValuation';
import { getLegoImageUrl } from './lego';
import { isMinifigCode } from './brickset';
import { resolveWatchPrice } from './theWatchApi';

export type CollectibleCategory = 'pokemon' | 'lego' | 'watches';

export interface Collectible {
  id: string;
  userId: string;
  category: CollectibleCategory;
  name: string;
  identifier: string | null;
  quantity: number;
  purchasePrice: number;
  purchaseCurrency: string;
  purchaseDate: string | null;
  currentPrice: number;
  condition: string | null;
  imageUrl: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  // Computed values
  costEur: number;
  valueEur: number;
  gainEur: number;
  gainPct: number | null;
}

export const collectiblesKey = ['collectibles'] as const;

export const CATEGORY_LABELS: Record<CollectibleCategory, string> = {
  pokemon: 'Pokémon TCG',
  lego: 'LEGO & Minifigures',
  watches: 'Watches & Luxury',
};

export const CATEGORY_ICONS: Record<CollectibleCategory, string> = {
  pokemon: 'TCG',
  lego: 'LEGO',
  watches: 'Watch',
};

export const useCollectibles = () =>
  useQuery<Collectible[]>({
    queryKey: collectiblesKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collectibles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data ?? [])
        .filter(
          (row) =>
            row.category === 'pokemon' ||
            row.category === 'lego' ||
            row.category === 'watches',
        )
        .map((row) => {
          const quantity = Number(row.quantity) || 1;
          const purchasePrice = Number(row.purchase_price) || 0;
          const currentPrice = Number(row.current_price) || purchasePrice;
          const costEur = quantity * purchasePrice;
          const valueEur = quantity * currentPrice;
          const gainEur = valueEur - costEur;
          const gainPct = costEur > 0 ? gainEur / costEur : null;

          const metadata = (row.metadata as Record<string, unknown>) ?? {};
          const isMinifig =
            metadata.type === 'minifig' ||
            metadata.type === 'MINIFIG' ||
            (Boolean(row.identifier) && isMinifigCode(row.identifier || ''));

          let imageUrl = row.image_url;
          if (
            row.category === 'lego' &&
            row.identifier &&
            (!imageUrl ||
              imageUrl.includes('images.brickset.com/minifigs/images/') ||
              (isMinifig && imageUrl.includes('images.brickset.com/sets/images/')))
          ) {
            imageUrl = getLegoImageUrl(row.identifier);
          } else if (
            !imageUrl &&
            row.category === 'lego' &&
            !isMinifig &&
            typeof metadata.bricksetSetNumber === 'string'
          ) {
            imageUrl = getLegoImageUrl(metadata.bricksetSetNumber);
          }

          return {
            id: row.id,
            userId: row.user_id,
            category: row.category as CollectibleCategory,
            name: row.name,
          identifier: row.identifier,
          quantity,
          purchasePrice,
          purchaseCurrency: row.purchase_currency || 'EUR',
          purchaseDate: row.purchase_date,
          currentPrice,
          condition: row.condition,
          imageUrl,
          notes: row.notes,
          metadata,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          costEur,
          valueEur,
          gainEur,
          gainPct,
        };
      }).sort((a, b) => b.valueEur - a.valueEur);
    },
  });

export interface AddCollectibleInput {
  category: CollectibleCategory;
  name: string;
  identifier?: string | null;
  quantity: number;
  purchasePrice: number;
  purchaseCurrency?: string;
  purchaseDate?: string | null;
  currentPrice?: number;
  condition?: string | null;
  imageUrl?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export const useAddCollectible = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: AddCollectibleInput) => {
      const { error } = await supabase.from('collectibles').insert({
        category: input.category,
        name: input.name,
        identifier: input.identifier ?? null,
        quantity: input.quantity,
        purchase_price: input.purchasePrice,
        purchase_currency: input.purchaseCurrency ?? 'EUR',
        purchase_date: input.purchaseDate ?? null,
        current_price: input.currentPrice ?? input.purchasePrice,
        condition: input.condition ?? null,
        image_url: input.imageUrl ?? null,
        notes: input.notes ?? null,
        metadata: (input.metadata ?? {}) as Json,
      });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: collectiblesKey }),
  });
};

export interface UpdateCollectibleInput {
  id: string;
  category?: CollectibleCategory;
  name?: string;
  identifier?: string | null;
  quantity?: number;
  purchasePrice?: number;
  purchaseCurrency?: string;
  purchaseDate?: string | null;
  currentPrice?: number;
  condition?: string | null;
  imageUrl?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export const useUpdateCollectible = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateCollectibleInput) => {
      type CollectibleUpdate =
        Database['public']['Tables']['collectibles']['Update'];
      const updates: CollectibleUpdate = {
        updated_at: new Date().toISOString(),
      };
      if (input.category !== undefined) updates.category = input.category;
      if (input.name !== undefined) updates.name = input.name;
      if (input.identifier !== undefined) updates.identifier = input.identifier;
      if (input.quantity !== undefined) updates.quantity = input.quantity;
      if (input.purchasePrice !== undefined) updates.purchase_price = input.purchasePrice;
      if (input.purchaseCurrency !== undefined) updates.purchase_currency = input.purchaseCurrency;
      if (input.purchaseDate !== undefined) updates.purchase_date = input.purchaseDate;
      if (input.currentPrice !== undefined) updates.current_price = input.currentPrice;
      if (input.condition !== undefined) updates.condition = input.condition;
      if (input.imageUrl !== undefined) updates.image_url = input.imageUrl;
      if (input.notes !== undefined) updates.notes = input.notes;
      if (input.metadata !== undefined) updates.metadata = input.metadata as Json;

      const { error } = await supabase
        .from('collectibles')
        .update(updates)
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: collectiblesKey }),
  });
};

export const useDeleteCollectible = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('collectibles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: collectiblesKey }),
  });
};

export const useRefreshPokemonPrices = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (collectibles: Collectible[]) => {
      const pokemonCards = collectibles.filter(
        (c) => c.category === 'pokemon' && Boolean(c.identifier),
      );

      const fxRate = await getUsdToEurRate();
      let updatedCount = 0;

      for (const card of pokemonCards) {
        if (!card.identifier) continue;
        try {
          const detail = await getPokemonCard(card.identifier);
          if (detail) {
            const preferredFinish = card.metadata?.finish as
              | PokemonCardFinish
              | undefined;
            const newPrice = await extractCollectrPrice(detail.pricing, {
              preferredFinish,
              condition: card.condition ?? undefined,
              rarity: detail.rarity,
              fxRate,
            });
            if (
              newPrice !== null &&
              newPrice > 0 &&
              newPrice !== card.currentPrice
            ) {
              await supabase
                .from('collectibles')
                .update({
                  current_price: newPrice,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', card.id);
              updatedCount += 1;
            }
          }
        } catch {
          // Continue updating other cards even if one fails
        }
      }
      return updatedCount;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: collectiblesKey }),
  });
};

export const useRefreshLegoPrices = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (collectibles: Collectible[]) => {
      const legoItems = collectibles.filter(
        (c) => c.category === 'lego' && Boolean(c.identifier),
      );

      let updatedCount = 0;
      for (const item of legoItems) {
        if (!item.identifier) continue;
        try {
          const explicitType = (item.metadata?.type as 'set' | 'minifig' | undefined)
            ? ((item.metadata.type as string).toUpperCase() as 'SET' | 'MINIFIG')
            : undefined;

          const valRes = await resolveLegoPrice({
            itemNo: item.identifier,
            itemType: explicitType,
            bricksetSetNumber:
              typeof item.metadata?.bricksetSetNumber === 'string'
                ? item.metadata.bricksetSetNumber
                : undefined,
            condition: item.condition ?? undefined,
            currency: 'EUR',
          });

          const newPrice = valRes.resolvedEur;
          if (newPrice > 0 && newPrice !== item.currentPrice) {
            const updatedMeta = {
              ...(item.metadata || {}),
              valuationSource: valRes.source,
              ...(valRes.brickset ? { brickset: valRes.brickset } : {}),
              ...(valRes.bricksetSetNumber
                ? { bricksetSetNumber: valRes.bricksetSetNumber }
                : {}),
            };

            await supabase
              .from('collectibles')
              .update({
                current_price: newPrice,
                metadata: updatedMeta as unknown as Json,
                updated_at: new Date().toISOString(),
              })
              .eq('id', item.id);
            updatedCount += 1;
          }
        } catch {
          // Continue updating other items even if one fails
        }
      }
      return updatedCount;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: collectiblesKey }),
  });
};

export interface PriceSnapshot {
  date: string;
  price: number;
  source?: string;
}

export const appendPriceSnapshot = (
  history: unknown,
  newPrice: number,
  source?: string,
  initialCost?: { date?: string | null; price: number },
): PriceSnapshot[] => {
  const list: PriceSnapshot[] = Array.isArray(history) ? [...(history as PriceSnapshot[])] : [];
  if (list.length === 0 && initialCost && initialCost.price > 0) {
    list.push({
      date: initialCost.date || new Date().toISOString(),
      price: Math.round(initialCost.price * 100) / 100,
      source: 'purchase',
    });
  }

  const now = new Date().toISOString();
  const last = list[list.length - 1];
  if (!last || Math.abs(last.price - newPrice) >= 0.01) {
    list.push({
      date: now,
      price: Math.round(newPrice * 100) / 100,
      source,
    });
  }

  return list.slice(-60);
};

export interface SyncSingleResult {
  updated: boolean;
  newPrice?: number;
  oldPrice: number;
}

export const useSyncSingleCollectiblePrice = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (item: Collectible): Promise<SyncSingleResult> => {
      const oldPrice = item.currentPrice;

      // 1. Pokémon Cards via Collectr (TCGplayer Market EUR)
      if (item.category === 'pokemon' && item.identifier) {
        const detail = await getPokemonCard(item.identifier);
        if (!detail) throw new Error('Card not found in TCG catalog');

        const fxRate = await getUsdToEurRate();
        const preferredFinish = item.metadata?.finish as PokemonCardFinish | undefined;
        const newPrice = await extractCollectrPrice(detail.pricing, {
          preferredFinish,
          condition: item.condition ?? undefined,
          rarity: detail.rarity,
          fxRate,
        });

        const resolvedImg =
          detail.imageUrl ||
          resolvePokemonImageUrl(item.identifier, {
            image: detail.image,
            language: item.metadata?.language as 'en' | 'ja' | undefined,
          });

        if (newPrice !== null && newPrice > 0) {
          const rawHistory = item.metadata?.priceHistory;
          const updatedHistory = appendPriceSnapshot(
            rawHistory,
            newPrice,
            'collectr',
            { date: item.purchaseDate, price: item.purchasePrice },
          );
          const updatedMeta = {
            ...(item.metadata || {}),
            priceHistory: updatedHistory,
            lastSyncedAt: new Date().toISOString(),
          };

          const updatePayload: Database['public']['Tables']['collectibles']['Update'] = {
            current_price: newPrice,
            metadata: updatedMeta as unknown as Json,
            updated_at: new Date().toISOString(),
          };
          if (!item.imageUrl && resolvedImg) {
            updatePayload.image_url = resolvedImg;
          }

          await supabase
            .from('collectibles')
            .update(updatePayload)
            .eq('id', item.id);

          return { updated: newPrice !== oldPrice, newPrice, oldPrice };
        }
        throw new Error('No live market price found on Collectr/TCGplayer for this card');
      }

      // 2. LEGO Sets & Minifigures via Brickset RRP
      if (item.category === 'lego' && item.identifier) {
        const explicitType = (item.metadata?.type as 'set' | 'minifig' | undefined)
          ? ((item.metadata.type as string).toUpperCase() as 'SET' | 'MINIFIG')
          : undefined;

        const valRes = await resolveLegoPrice({
          itemNo: item.identifier,
          itemType: explicitType,
          bricksetSetNumber:
            typeof item.metadata?.bricksetSetNumber === 'string'
              ? item.metadata.bricksetSetNumber
              : undefined,
          condition: item.condition ?? undefined,
          currency: 'EUR',
        });

        const newPrice = valRes.resolvedEur;
        if (newPrice > 0) {
          const rawHistory = item.metadata?.priceHistory;
          const updatedHistory = appendPriceSnapshot(
            rawHistory,
            newPrice,
            valRes.source,
            { date: item.purchaseDate, price: item.purchasePrice },
          );
          const updatedMeta = {
            ...(item.metadata || {}),
            valuationSource: valRes.source,
            ...(valRes.brickset ? { brickset: valRes.brickset } : {}),
            ...(valRes.bricksetSetNumber ? { bricksetSetNumber: valRes.bricksetSetNumber } : {}),
            priceHistory: updatedHistory,
            lastSyncedAt: new Date().toISOString(),
          };

          await supabase
            .from('collectibles')
            .update({
              current_price: newPrice,
              metadata: updatedMeta as unknown as Json,
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id);

          return { updated: newPrice !== oldPrice, newPrice, oldPrice };
        }
        throw new Error('No market value found on Brickset for this LEGO item');
      }

      // 3. Luxury Watches via TheWatchAPI
      if (item.category === 'watches' && item.identifier) {
        const watchRes = await resolveWatchPrice({
          referenceNumber: item.identifier,
        });

        if (watchRes && watchRes.priceEur > 0) {
          const newPrice = watchRes.priceEur;
          const rawHistory = item.metadata?.priceHistory;
          const updatedHistory = appendPriceSnapshot(
            rawHistory,
            newPrice,
            'thewatchapi',
            { date: item.purchaseDate, price: item.purchasePrice },
          );
          const updatedMeta = {
            ...(item.metadata || {}),
            brand: watchRes.brand,
            model: watchRes.model,
            specs: {
              ...((item.metadata?.specs as Record<string, unknown>) || {}),
              ...watchRes.specs,
            },
            valuationSource: 'thewatchapi',
            priceUsd: watchRes.priceUsd,
            priceHistory: updatedHistory,
            lastSyncedAt: new Date().toISOString(),
          };

          const updates: Database['public']['Tables']['collectibles']['Update'] = {
            current_price: newPrice,
            metadata: updatedMeta as unknown as Json,
            updated_at: new Date().toISOString(),
          };
          if (!item.imageUrl && watchRes.imageUrl) {
            updates.image_url = watchRes.imageUrl;
          }

          await supabase
            .from('collectibles')
            .update(updates)
            .eq('id', item.id);

          return { updated: newPrice !== oldPrice || Boolean(!item.imageUrl && watchRes.imageUrl), newPrice, oldPrice };
        }
        throw new Error('No market value found on TheWatchAPI for this watch reference');
      }

      throw new Error('This item does not have a live market identifier to sync');
    },
    onSuccess: () => client.invalidateQueries({ queryKey: collectiblesKey }),
  });
};

export interface SyncCollectiblePricesResult {
  pokemonUpdated: number;
  legoUpdated: number;
  watchesUpdated: number;
  totalUpdated: number;
}

export const useSyncCollectiblePrices = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (collectibles: Collectible[]): Promise<SyncCollectiblePricesResult> => {
      let pokemonUpdated = 0;
      let legoUpdated = 0;
      let watchesUpdated = 0;

      // 1. Refresh Pokémon cards via Collectr (TCGplayer Market EUR)
      const pokemonCards = collectibles.filter(
        (c) => c.category === 'pokemon' && Boolean(c.identifier),
      );
      const fxRate = await getUsdToEurRate();

      for (const card of pokemonCards) {
        if (!card.identifier) continue;
        try {
          const detail = await getPokemonCard(card.identifier);
          if (detail) {
            const preferredFinish = card.metadata?.finish as
              | PokemonCardFinish
              | undefined;
            const newPrice = await extractCollectrPrice(detail.pricing, {
              preferredFinish,
              condition: card.condition ?? undefined,
              rarity: detail.rarity,
              fxRate,
            });
            const resolvedImg =
              detail.imageUrl ||
              resolvePokemonImageUrl(card.identifier, {
                image: detail.image,
                language: card.metadata?.language as 'en' | 'ja' | undefined,
              });

            const updates: Database['public']['Tables']['collectibles']['Update'] = {
              updated_at: new Date().toISOString(),
            };
            let shouldUpdate = false;

            if (
              newPrice !== null &&
              newPrice > 0 &&
              newPrice !== card.currentPrice
            ) {
              const rawHistory = card.metadata?.priceHistory;
              const updatedHistory = appendPriceSnapshot(
                rawHistory,
                newPrice,
                'collectr',
                { date: card.purchaseDate, price: card.purchasePrice },
              );

              updates.current_price = newPrice;
              updates.metadata = {
                ...(card.metadata || {}),
                priceHistory: updatedHistory,
                lastSyncedAt: new Date().toISOString(),
              } as unknown as Json;
              shouldUpdate = true;
            }

            if (!card.imageUrl && resolvedImg) {
              updates.image_url = resolvedImg;
              shouldUpdate = true;
            }

            if (shouldUpdate) {
              await supabase
                .from('collectibles')
                .update(updates)
                .eq('id', card.id);
              if (updates.current_price !== undefined) {
                pokemonUpdated += 1;
              }
            }
          }
        } catch {
          // ignore error
        }
      }

      // 2. Refresh LEGO sets & minifigures via Brickset RRP
      const legoItems = collectibles.filter(
        (c) => c.category === 'lego' && Boolean(c.identifier),
      );
      for (const item of legoItems) {
        if (!item.identifier) continue;
        try {
          const explicitType = (item.metadata?.type as 'set' | 'minifig' | undefined)
            ? ((item.metadata.type as string).toUpperCase() as 'SET' | 'MINIFIG')
            : undefined;

          const valRes = await resolveLegoPrice({
            itemNo: item.identifier,
            itemType: explicitType,
            bricksetSetNumber:
              typeof item.metadata?.bricksetSetNumber === 'string'
                ? item.metadata.bricksetSetNumber
                : undefined,
            condition: item.condition ?? undefined,
            currency: 'EUR',
          });

          const newPrice = valRes.resolvedEur;
          const freshImg = getLegoImageUrl(item.identifier);
          const updates: Database['public']['Tables']['collectibles']['Update'] = {
            updated_at: new Date().toISOString(),
          };
          let shouldUpdate = false;

          if (newPrice > 0 && newPrice !== item.currentPrice) {
            const rawHistory = item.metadata?.priceHistory;
            const updatedHistory = appendPriceSnapshot(
              rawHistory,
              newPrice,
              valRes.source,
              { date: item.purchaseDate, price: item.purchasePrice },
            );

            const updatedMeta = {
              ...(item.metadata || {}),
              valuationSource: valRes.source,
              ...(valRes.brickset ? { brickset: valRes.brickset } : {}),
              ...(valRes.bricksetSetNumber
                ? { bricksetSetNumber: valRes.bricksetSetNumber }
                : {}),
              priceHistory: updatedHistory,
              lastSyncedAt: new Date().toISOString(),
            };

            updates.current_price = newPrice;
            updates.metadata = updatedMeta as unknown as Json;
            shouldUpdate = true;
          }

          if (!item.imageUrl && freshImg) {
            updates.image_url = freshImg;
            shouldUpdate = true;
          }

          if (shouldUpdate) {
            await supabase
              .from('collectibles')
              .update(updates)
              .eq('id', item.id);
            if (updates.current_price !== undefined) {
              legoUpdated += 1;
            }
          }
        } catch {
          // ignore error
        }
      }

      // 3. Refresh Luxury Watches via TheWatchAPI
      const watchItems = collectibles.filter(
        (c) => c.category === 'watches' && Boolean(c.identifier),
      );
      for (const item of watchItems) {
        if (!item.identifier) continue;
        try {
          const watchRes = await resolveWatchPrice({
            referenceNumber: item.identifier,
            fxRate,
          });

          if (watchRes && watchRes.priceEur > 0 && (watchRes.priceEur !== item.currentPrice || !item.imageUrl)) {
            const newPrice = watchRes.priceEur;
            const rawHistory = item.metadata?.priceHistory;
            const updatedHistory = appendPriceSnapshot(
              rawHistory,
              newPrice,
              'thewatchapi',
              { date: item.purchaseDate, price: item.purchasePrice },
            );

            const updatedMeta = {
              ...(item.metadata || {}),
              brand: watchRes.brand,
              model: watchRes.model,
              specs: {
                ...((item.metadata?.specs as Record<string, unknown>) || {}),
                ...watchRes.specs,
              },
              valuationSource: 'thewatchapi',
              priceUsd: watchRes.priceUsd,
              priceHistory: updatedHistory,
              lastSyncedAt: new Date().toISOString(),
            };

            const updates: Database['public']['Tables']['collectibles']['Update'] = {
              current_price: newPrice,
              metadata: updatedMeta as unknown as Json,
              updated_at: new Date().toISOString(),
            };
            if (!item.imageUrl && watchRes.imageUrl) {
              updates.image_url = watchRes.imageUrl;
            }

            await supabase
              .from('collectibles')
              .update(updates)
              .eq('id', item.id);
            watchesUpdated += 1;
          }
        } catch {
          // ignore error
        }
      }

      return {
        pokemonUpdated,
        legoUpdated,
        watchesUpdated,
        totalUpdated: pokemonUpdated + legoUpdated + watchesUpdated,
      };
    },
    onSuccess: () => client.invalidateQueries({ queryKey: collectiblesKey }),
  });
};
