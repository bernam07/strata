import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/db/supabase';
import type { Database, Json } from '@/db/database.types';
import {
  extractCollectrPrice,
  getPokemonCard,
  getUsdToEurRate,
  type PokemonCardFinish,
} from './tcgdex';
import { resolveLegoPrice } from './legoValuation';
import { getLegoImageUrl } from './lego';

export type CollectibleCategory =
  | 'pokemon'
  | 'lego'
  | 'watches'
  | 'coins_bullion'
  | 'wine'
  | 'art'
  | 'other';

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
  coins_bullion: 'Coins & Bullion',
  wine: 'Wine & Spirits',
  art: 'Art & Antiques',
  other: 'Other Assets',
};

export const CATEGORY_ICONS: Record<CollectibleCategory, string> = {
  pokemon: 'TCG',
  lego: 'LEGO',
  watches: 'Watch',
  coins_bullion: 'Coin',
  wine: 'Wine',
  art: 'Art',
  other: 'Asset',
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

      return (data ?? []).map((row) => {
        const quantity = Number(row.quantity) || 1;
        const purchasePrice = Number(row.purchase_price) || 0;
        const currentPrice = Number(row.current_price) || purchasePrice;
        const costEur = quantity * purchasePrice;
        const valueEur = quantity * currentPrice;
        const gainEur = valueEur - costEur;
        const gainPct = costEur > 0 ? gainEur / costEur : null;

        const metadata = (row.metadata as Record<string, unknown>) ?? {};
        const imageUrl =
          row.image_url ||
          (row.category === 'lego' && typeof metadata.bricksetSetNumber === 'string'
            ? getLegoImageUrl(metadata.bricksetSetNumber)
            : row.category === 'lego' && row.identifier
              ? getLegoImageUrl(row.identifier)
              : null);

        return {
          id: row.id,
          userId: row.user_id,
          category: (row.category as CollectibleCategory) || 'other',
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

export interface SyncCollectiblePricesResult {
  pokemonUpdated: number;
  legoUpdated: number;
  totalUpdated: number;
}

export const useSyncCollectiblePrices = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (collectibles: Collectible[]): Promise<SyncCollectiblePricesResult> => {
      let pokemonUpdated = 0;
      let legoUpdated = 0;

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
              pokemonUpdated += 1;
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
            legoUpdated += 1;
          }
        } catch {
          // ignore error
        }
      }

      return {
        pokemonUpdated,
        legoUpdated,
        totalUpdated: pokemonUpdated + legoUpdated,
      };
    },
    onSuccess: () => client.invalidateQueries({ queryKey: collectiblesKey }),
  });
};
