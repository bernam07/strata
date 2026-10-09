import { useState } from 'react';
import { BottomSheet } from '@/ui/BottomSheet';
import { Button } from '@/ui/Button';
import { Labelled, MoneyInput, Select, TextInput } from '@/ui/Field';
import { toast } from '@/ui/toast';
import {
  CATEGORY_LABELS,
  useAddCollectible,
  type CollectibleCategory,
} from '../api/useCollectibles';
import {
  resolvePokemonPrice,
  resolvePokemonImageUrl,
  getUsdToEurRate,
  getCachedUsdToEurRate,
  isJapaneseId,
  type PokemonCardDetail,
  type PokemonPriceBreakdown,
  type PokemonCardFinish,
} from '../api/tcgdex';
import { getLegoImageUrl, type LegoSetResult } from '../api/lego';
import { cleanLegoInput } from '../api/brickset';
import { resolveLegoPrice, type LegoValuationResult } from '../api/legoValuation';
import {
  resolveWatchPrice,
  cleanWatchReference,
  resolveCuratedWatchImage,
  type WatchDetailsResult,
} from '../api/theWatchApi';
import { CategoryIcon } from './CategoryIcon';
import { PokemonCardSearch } from './PokemonCardSearch';
import { LegoSetSearch } from './LegoSetSearch';

interface AddCollectibleModalProps {
  open: boolean;
  onClose: () => void;
}

const POKEMON_CONDITIONS = [
  { value: 'Near Mint (NM)', label: 'Near Mint (NM)' },
  { value: 'Mint', label: 'Mint' },
  { value: 'Lightly Played (LP)', label: 'Lightly Played (LP)' },
  { value: 'PSA 10 Gem Mint', label: 'PSA 10 (Gem Mint)' },
  { value: 'PSA 9 Mint', label: 'PSA 9 (Mint)' },
  { value: 'PSA 8', label: 'PSA 8' },
  { value: 'BGS 9.5 Gem Mint', label: 'BGS 9.5 (Gem Mint)' },
  { value: 'BGS 10 Pristine', label: 'BGS 10 (Pristine)' },
  { value: 'CGC 10 Pristine', label: 'CGC 10 (Pristine)' },
  { value: 'Sealed Booster Box', label: 'Sealed Booster Box' },
  { value: 'Sealed ETB', label: 'Sealed Elite Trainer Box (ETB)' },
  { value: 'Sealed Pack', label: 'Sealed Booster Pack' },
];

const LEGO_CONDITIONS = [
  { value: 'Factory Sealed (MISB)', label: 'Factory Sealed (MISB)' },
  { value: 'Sealed w/ Box Wear', label: 'Sealed w/ Box Wear' },
  { value: 'Complete w/ Box & Manual', label: 'Complete w/ Box & Manual' },
  { value: 'Complete without Box', label: 'Complete without Box' },
  { value: 'Minifigure Mint / Complete', label: 'Minifigure Mint / Complete' },
  { value: 'Loose / Parts', label: 'Loose / Parts' },
];

const WATCH_CONDITIONS = [
  { value: 'Brand New / Unworn (Box & Papers)', label: 'Brand New / Unworn (Box & Papers)' },
  { value: 'Mint / Like New (Box & Papers)', label: 'Mint / Like New (Box & Papers)' },
  { value: 'Very Good (Watch Only)', label: 'Very Good (Watch Only)' },
  { value: 'Good / Fair (Wear / Scratches)', label: 'Good / Fair (Wear / Scratches)' },
  { value: 'Vintage / Serviced', label: 'Vintage / Serviced' },
];

export const AddCollectibleModal = ({ open, onClose }: AddCollectibleModalProps) => {
  const add = useAddCollectible();

  const [category, setCategory] = useState<CollectibleCategory>('pokemon');
  const [selectedPokemon, setSelectedPokemon] = useState<PokemonCardDetail | null>(null);
  const [selectedLego, setSelectedLego] = useState<LegoSetResult | null>(null);
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [condition, setCondition] = useState('Near Mint (NM)');
  const [quantity, setQuantity] = useState('1');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [notes, setNotes] = useState('');
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const [fetchingLegoPrice, setFetchingLegoPrice] = useState(false);
  const [legoValuation, setLegoValuation] = useState<LegoValuationResult | null>(null);
  const [fetchingWatchPrice, setFetchingWatchPrice] = useState(false);
  const [watchValuation, setWatchValuation] = useState<WatchDetailsResult | null>(null);
  const [pokemonBreakdown, setPokemonBreakdown] = useState<PokemonPriceBreakdown | null>(null);
  const [selectedFinish, setSelectedFinish] = useState<PokemonCardFinish | null>(null);
  const [activePriceSource, setActivePriceSource] = useState<'collectr' | 'cardmarket'>('collectr');

  const resetForm = () => {
    setSelectedPokemon(null);
    setSelectedLego(null);
    setImageUrl('');
    setLegoValuation(null);
    setFetchingLegoPrice(false);
    setWatchValuation(null);
    setFetchingWatchPrice(false);
    setPokemonBreakdown(null);
    setSelectedFinish(null);
    setActivePriceSource('collectr');
    setName('');
    setIdentifier('');
    setCondition(
      category === 'pokemon'
        ? 'Near Mint (NM)'
        : category === 'lego'
          ? 'Factory Sealed (MISB)'
          : 'Brand New / Unworn (Box & Papers)',
    );
    setQuantity('1');
    setPurchasePrice('');
    setCurrentPrice('');
    setImageUrl('');
    setPurchaseDate('');
    setNotes('');
    setMetadata({});
  };

  const handleCategoryChange = (newCat: CollectibleCategory) => {
    setCategory(newCat);
    setSelectedPokemon(null);
    setSelectedLego(null);
    setLegoValuation(null);
    setFetchingLegoPrice(false);
    setPokemonBreakdown(null);
    setSelectedFinish(null);
    setActivePriceSource('collectr');
    if (newCat === 'pokemon') {
      setCondition('Near Mint (NM)');
    } else if (newCat === 'lego') {
      setCondition('Factory Sealed (MISB)');
    } else {
      setCondition('Brand New / Unworn (Box & Papers)');
    }
  };

  const handleSelectPokemonCard = async (card: PokemonCardDetail) => {
    setSelectedPokemon(card);
    const isJa = card.language === 'ja' || isJapaneseId(card.id);
    const cardLang: 'ja' | 'en' = isJa ? 'ja' : 'en';
    const tag = isJa ? ' [JA]' : '';
    const cardName = card.set?.name
      ? `${card.name}${tag} (#${card.localId} - ${card.set.name})`
      : `${card.name}${tag} (#${card.localId})`;
    setName(cardName);
    setIdentifier(card.id);
    const resolvedImg =
      card.imageUrl ||
      resolvePokemonImageUrl(card.id, {
        image: card.image,
        language: cardLang,
      });
    setImageUrl(resolvedImg ?? '');

    const fxRate = await getUsdToEurRate();
    const breakdown = resolvePokemonPrice(card.pricing, {
      condition,
      rarity: card.rarity,
      fxRate,
    });
    setPokemonBreakdown(breakdown);
    setSelectedFinish(breakdown.selectedFinish);
    setActivePriceSource(breakdown.source);

    if (breakdown.resolvedEur > 0) {
      setCurrentPrice(String(breakdown.resolvedEur));
      if (!purchasePrice) {
        setPurchasePrice(String(breakdown.resolvedEur));
      }
    }

    setMetadata({
      setId: card.set?.id,
      setName: card.set?.name,
      rarity: card.rarity,
      localId: card.localId,
      finish: breakdown.selectedFinish,
      language: cardLang,
      collectrPriceEur: breakdown.collectr?.priceEur,
      tcgplayerUsd: breakdown.collectr?.priceUsd,
      cardmarketPriceEur: breakdown.cardmarket?.priceEur,
    });
  };

  const handleSelectFinish = (finish: PokemonCardFinish) => {
    if (!selectedPokemon?.pricing) return;
    const fxRate = getCachedUsdToEurRate();
    const breakdown = resolvePokemonPrice(selectedPokemon.pricing, {
      preferredFinish: finish,
      condition,
      rarity: selectedPokemon.rarity,
      fxRate,
    });
    setPokemonBreakdown(breakdown);
    setSelectedFinish(finish);
    setActivePriceSource('collectr');
    if (breakdown.resolvedEur > 0) {
      setCurrentPrice(String(breakdown.resolvedEur));
    }
    setMetadata((prev) => ({
      ...prev,
      finish,
      collectrPriceEur: breakdown.collectr?.priceEur,
      tcgplayerUsd: breakdown.collectr?.priceUsd,
    }));
  };

  const handleTogglePriceSource = (source: 'collectr' | 'cardmarket') => {
    setActivePriceSource(source);
    if (source === 'cardmarket' && pokemonBreakdown?.cardmarket?.priceEur) {
      setCurrentPrice(String(pokemonBreakdown.cardmarket.priceEur));
    } else if (source === 'collectr' && pokemonBreakdown?.collectr?.priceEur) {
      setCurrentPrice(String(pokemonBreakdown.collectr.priceEur));
    }
  };

  const handleFetchLegoValuation = async (
    setNumber: string,
    itemType?: 'SET' | 'MINIFIG',
    overrideCondition?: string,
  ) => {
    if (!setNumber.trim()) return;
    setFetchingLegoPrice(true);
    try {
      const cleaned = cleanLegoInput(setNumber, itemType);
      if (
        cleaned.raw !== cleaned.itemNo &&
        (cleaned.raw.includes('http') || cleaned.raw.startsWith('#'))
      ) {
        setIdentifier(cleaned.itemNo);
      }

      const res = await resolveLegoPrice({
        itemNo: cleaned.itemNo,
        itemType: cleaned.itemType,
        condition: overrideCondition || condition,
        currency: 'EUR',
      });

      if (res && res.resolvedEur > 0) {
        setLegoValuation(res);
        setCurrentPrice(String(res.resolvedEur));
        if (!purchasePrice) {
          setPurchasePrice(String(res.rrp ?? res.retailPrice ?? res.resolvedEur));
        }
        const freshImageUrl = getLegoImageUrl(res.itemNo);
        setImageUrl(freshImageUrl);
        if (
          !name ||
          name.startsWith('Minifigure #') ||
          name.startsWith('LEGO Set #') ||
          name === 'LEGO Set' ||
          res.itemType === 'MINIFIG'
        ) {
          if (res.name) {
            setName(`${res.name} (#${res.itemNo})`);
          }
        }
        setSelectedLego((prev) => {
          const isMinifig = res.itemType === 'MINIFIG';
          const theme =
            res.brickset?.theme || prev?.theme || (isMinifig ? 'Minifigures' : 'LEGO Set');
          const year = res.brickset?.year ?? prev?.year;
          const pieces = res.brickset?.pieces ?? prev?.pieces;
          if (prev) {
            return {
              ...prev,
              setNumber: res.itemNo,
              name: res.name ? `${res.name} (#${res.itemNo})` : prev.name,
              imageUrl: freshImageUrl,
              type: isMinifig ? 'minifig' : 'set',
              rrpEur: res.rrp ?? prev.rrpEur,
              theme,
              year,
              pieces,
            };
          }
          return {
            setNumber: res.itemNo,
            name: res.name ? `${res.name} (#${res.itemNo})` : res.itemNo,
            theme,
            imageUrl: freshImageUrl,
            type: isMinifig ? 'minifig' : 'set',
            rrpEur: res.rrp,
            year,
            pieces,
          };
        });
        setMetadata((prev) => {
          const next = {
            ...prev,
            type: res.itemType.toLowerCase(),
            valuationSource: res.source,
            ...(res.brickset ? { brickset: res.brickset } : {}),
            ...(res.bricksetSetNumber ? { bricksetSetNumber: res.bricksetSetNumber } : {}),
          };
          if (res.itemType === 'MINIFIG') {
            delete next.bricksetSetNumber;
          }
          return next;
        });

        if (res.source === 'brickset') {
          const breakdown =
            res.priceNew && res.priceUsed
              ? ` (New: €${res.priceNew.toFixed(2)} / Used: €${res.priceUsed.toFixed(2)})`
              : '';
          toast(`Brickset valuation loaded: €${res.resolvedEur.toFixed(2)}${breakdown}`, 'success');
        }
      } else {
        toast('Brickset did not return a price for this item', 'error');
      }
    } catch (err) {
      toast(
        err instanceof Error ? err.message : 'Failed to fetch Brickset price',
        'error',
      );
    } finally {
      setFetchingLegoPrice(false);
    }
  };

  const handleSelectLegoSet = (item: LegoSetResult) => {
    const imageUrl = item.imageUrl || getLegoImageUrl(item.setNumber);
    setSelectedLego({ ...item, imageUrl });
    setName(`${item.name} (#${item.setNumber})`);
    setIdentifier(item.setNumber);
    setImageUrl(imageUrl);
    const newCond =
      item.type === 'minifig'
        ? 'Minifigure Mint / Complete'
        : 'Factory Sealed (MISB)';
    if (item.type === 'minifig') {
      setCondition(newCond);
    }
    if (item.rrpEur) {
      setCurrentPrice(String(item.rrpEur));
      if (!purchasePrice) {
        setPurchasePrice(String(item.rrpEur));
      }
    }
    setMetadata({
      type: item.type || 'set',
      theme: item.theme,
      pieces: item.pieces,
      year: item.year,
      rrpEur: item.rrpEur,
    });

    // Auto-fetch LEGO valuation for the selected item
    void handleFetchLegoValuation(
      item.setNumber,
      item.type === 'minifig' ? 'MINIFIG' : 'SET',
      newCond,
    );
  };

  const handleFetchWatchValuation = async (overrideRef?: string) => {
    const targetRef = (overrideRef || identifier).trim();
    if (!targetRef) {
      toast('Please enter a watch reference number (e.g. 126610LN)', 'error');
      return;
    }
    setFetchingWatchPrice(true);
    try {
      const cleaned = cleanWatchReference(targetRef);
      setIdentifier(cleaned);
      const res = await resolveWatchPrice({ referenceNumber: cleaned });
      if (res) {
        setWatchValuation(res);
        if (res.priceEur > 0) {
          setCurrentPrice(String(res.priceEur));
          if (!purchasePrice) {
            setPurchasePrice(String(res.priceEur));
          }
        }
        if (res.imageUrl) {
          setImageUrl(res.imageUrl);
        }
        if (!name || name === 'Luxury Watch' || name.startsWith('Watch #')) {
          setName(res.fullName);
        }
        setCondition((prev) => prev || 'Brand New / Unworn (Box & Papers)');
        setMetadata((prev) => ({
          ...prev,
          brand: res.brand,
          model: res.model,
          specs: res.specs,
          priceUsd: res.priceUsd,
          valuationSource: 'thewatchapi',
        }));
        toast(
          `TheWatchAPI valuation loaded: ${res.brand} ${res.model} (€${res.priceEur.toFixed(2)})`,
          'success',
        );
      } else {
        toast(
          'No match found on TheWatchAPI for this reference. You can configure your API token in Settings → Integrations.',
          'error',
        );
      }
    } catch (err) {
      toast(
        err instanceof Error ? err.message : 'Failed to fetch watch details',
        'error',
      );
    } finally {
      setFetchingWatchPrice(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast('Please enter the asset name', 'error');
      return;
    }

    const qty = Number(quantity) > 0 ? Number(quantity) : 1;
    let buyPrice = Number(purchasePrice) || 0;
    let curVal = currentPrice ? Number(currentPrice) : buyPrice;
    if (category === 'watches' && watchValuation?.priceEur && watchValuation.priceEur > 0) {
      if (buyPrice === 0) buyPrice = watchValuation.priceEur;
      if (curVal === 0) curVal = watchValuation.priceEur;
    }

    const persistedImageUrl =
      imageUrl.trim() ||
      (category === 'watches' && identifier.trim()
        ? (watchValuation?.imageUrl || resolveCuratedWatchImage(identifier.trim()))
        : null) ||
      (category === 'lego' && identifier.trim()
        ? getLegoImageUrl(
            typeof metadata.bricksetSetNumber === 'string'
              ? metadata.bricksetSetNumber
              : identifier.trim(),
          )
        : null) ||
      (category === 'pokemon' && identifier.trim()
        ? resolvePokemonImageUrl(identifier.trim(), {
            language: metadata?.language as 'en' | 'ja' | undefined,
          })
        : null);

    const mergedMetadata = {
      ...metadata,
      ...(category === 'watches' && watchValuation
        ? {
            brand: watchValuation.brand,
            model: watchValuation.model,
            specs: watchValuation.specs,
            priceUsd: watchValuation.priceUsd,
            valuationSource: 'thewatchapi',
          }
        : {}),
    };

    add.mutate(
      {
        category,
        name: name.trim(),
        identifier: identifier.trim() || null,
        quantity: qty,
        purchasePrice: buyPrice,
        currentPrice: curVal,
        condition: condition.trim() || null,
        imageUrl: persistedImageUrl,
        purchaseDate: purchaseDate || null,
        notes: notes.trim() || null,
        metadata: mergedMetadata,
      },
      {
        onSuccess: () => {
          toast('Collectible added successfully', 'success');
          resetForm();
          onClose();
        },
        onError: (err) => {
          toast(err instanceof Error ? err.message : 'Failed to save collectible', 'error');
        },
      },
    );
  };

  return (
    <BottomSheet
      open={open}
      title="Add Alternative Asset"
      subtitle="Pokémon cards, LEGO sets & minifigures, and luxury watches"
      onClose={() => {
        resetForm();
        onClose();
      }}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Category Selector */}
        <Labelled label="Category">
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(CATEGORY_LABELS) as CollectibleCategory[]).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategoryChange(cat)}
                className={`tap flex flex-col items-center justify-center gap-1.5 rounded-[var(--radius-field)] p-2.5 text-center text-xs font-semibold transition ${
                  category === cat
                    ? 'neu-raised border border-[var(--accent)] bg-[var(--surface-raised)] text-[var(--accent)]'
                    : 'neu-sunken text-[var(--text-muted)] hover:text-[var(--text-strong)]'
                }`}
              >
                <CategoryIcon category={cat} size={18} />
                <span className="truncate text-[11px]">{CATEGORY_LABELS[cat]}</span>
              </button>
            ))}
          </div>
        </Labelled>

        {/* Pokemon Flow */}
        {category === 'pokemon' && (
          <div className="flex flex-col gap-3 rounded-[var(--radius-field)] neu-sunken p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                {selectedPokemon ? 'Selected Card' : 'Search TCGdex Catalog'}
              </span>
              {selectedPokemon && (
                <button
                  type="button"
                  onClick={() => setSelectedPokemon(null)}
                  className="tap text-xs font-semibold text-[var(--accent)] hover:underline"
                >
                  Change card
                </button>
              )}
            </div>

            {selectedPokemon ? (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-3 rounded-[var(--radius-field)] neu-raised p-2.5">
                  <div className="relative flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded bg-[var(--surface-sunken)] p-0.5 shadow-xs">
                    {selectedPokemon.imageUrl ? (
                      <img
                        src={selectedPokemon.imageUrl}
                        alt={selectedPokemon.name}
                        className="h-full w-full object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center text-center text-[8px] font-mono text-[var(--text-muted)]">
                        <span>#{selectedPokemon.localId}</span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-bold text-[var(--text-strong)]">
                        {selectedPokemon.name}
                      </p>
                      <span
                        className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider ${
                          metadata.language === 'ja' || selectedPokemon.language === 'ja'
                            ? 'bg-rose-950/80 text-rose-300 border border-rose-500/30'
                            : 'bg-sky-950/80 text-sky-300 border border-sky-500/30'
                        }`}
                      >
                        {metadata.language === 'ja' || selectedPokemon.language === 'ja'
                          ? 'JA · Japanese Edition'
                          : 'EN · English Edition'}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">
                      {selectedPokemon.set?.name} · #{selectedPokemon.localId}
                      {selectedPokemon.rarity && ` · ${selectedPokemon.rarity}`}
                    </p>
                  </div>
                </div>

                {/* Valuation details */}
                {pokemonBreakdown?.collectr ? (
                  <div className="flex flex-col gap-1 rounded-lg border border-[color-mix(in_srgb,var(--positive)_30%,transparent)] bg-[color-mix(in_srgb,var(--positive)_8%,transparent)] p-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-semibold text-[var(--positive)]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--positive)]" />
                        Collectr Valuation (TCGplayer Market)
                      </span>
                      <span className="font-bold text-[var(--positive)]">
                        €{pokemonBreakdown.collectr.priceEur.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                      <span>
                        Market Price: ${pokemonBreakdown.collectr.priceUsd.toFixed(2)} USD
                      </span>
                      <span>
                        FX: €{pokemonBreakdown.fxRateUsed.toFixed(4)} / $
                      </span>
                    </div>
                  </div>
                ) : pokemonBreakdown?.cardmarket ? (
                  <div className="flex flex-col gap-1 rounded-lg border border-[color-mix(in_srgb,var(--positive)_30%,transparent)] bg-[color-mix(in_srgb,var(--positive)_8%,transparent)] p-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-semibold text-[var(--positive)]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--positive)]" />
                        Cardmarket Valuation (EU Market Trend)
                      </span>
                      <span className="font-bold text-[var(--positive)]">
                        €{pokemonBreakdown.cardmarket.priceEur.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                      <span>Japanese Market (Cardmarket EU)</span>
                      {pokemonBreakdown.cardmarket.avgEur && (
                        <span>Avg: €{pokemonBreakdown.cardmarket.avgEur.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                ) : null}

                {/* Card Finish / Variant selector */}
                {pokemonBreakdown && pokemonBreakdown.finishes.length > 1 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-semibold text-[var(--text-muted)]">
                      Select Finish / Variant:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {pokemonBreakdown.finishes.map((f) => (
                        <button
                          key={f.finish}
                          type="button"
                          onClick={() => handleSelectFinish(f.finish)}
                          className={`tap flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                            selectedFinish === f.finish
                              ? 'border border-[var(--accent)] bg-[var(--surface-raised)] text-[var(--accent)] font-semibold shadow-xs'
                              : 'neu-sunken text-[var(--text-muted)] hover:text-[var(--text-strong)]'
                          }`}
                        >
                          <span>{f.label}</span>
                          <span className="font-mono text-[11px] opacity-80">
                            €{f.priceEur.toFixed(2)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Optional source toggle if both Collectr and Cardmarket exist */}
                {pokemonBreakdown?.collectr && pokemonBreakdown?.cardmarket && (
                  <div className="flex items-center justify-between border-t border-[var(--border)] pt-2 text-[11px]">
                    <span className="text-[var(--text-muted)]">Price Source:</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleTogglePriceSource('collectr')}
                        className={`rounded px-2 py-0.5 font-medium transition ${
                          activePriceSource === 'collectr'
                            ? 'bg-[var(--accent)] text-white shadow-xs'
                            : 'neu-sunken text-[var(--text-muted)] hover:text-[var(--text-strong)]'
                        }`}
                      >
                        Collectr / TCGplayer
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTogglePriceSource('cardmarket')}
                        className={`rounded px-2 py-0.5 font-medium transition ${
                          activePriceSource === 'cardmarket'
                            ? 'bg-[var(--accent)] text-white shadow-xs'
                            : 'neu-sunken text-[var(--text-muted)] hover:text-[var(--text-strong)]'
                        }`}
                      >
                        Cardmarket (€{pokemonBreakdown.cardmarket.priceEur.toFixed(2)})
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <PokemonCardSearch onSelect={handleSelectPokemonCard} />
            )}
          </div>
        )}

        {/* LEGO Set & Minifigure Flow */}
        {category === 'lego' && (
          <div className="flex flex-col gap-3 rounded-[var(--radius-field)] neu-sunken p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                {selectedLego ? 'Selected LEGO Set / Minifig' : 'Search LEGO & Minifigures'}
              </span>
              {selectedLego && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLego(null);
                    setImageUrl('');
                  }}
                  className="tap text-xs font-semibold text-[var(--accent)] hover:underline"
                >
                  Change selection
                </button>
              )}
            </div>

            {selectedLego ? (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-3 rounded-[var(--radius-field)] neu-raised p-2.5">
                  <img
                    src={selectedLego.imageUrl}
                    alt={selectedLego.name}
                    className="h-16 w-16 rounded object-contain bg-[var(--surface-sunken)] p-1 shadow-xs"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-[var(--accent)]">
                        #{selectedLego.setNumber}
                      </span>
                      <span className="rounded bg-[var(--surface-sunken)] px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider text-[var(--accent)]">
                        {selectedLego.type === 'minifig' ? 'Minifig' : 'Set'}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {selectedLego.theme} {selectedLego.year ? `(${selectedLego.year})` : ''}
                      </span>
                    </div>
                    <p className="truncate text-sm font-bold text-[var(--text-strong)]">
                      {selectedLego.name}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {selectedLego.pieces
                        ? `${selectedLego.pieces.toLocaleString()} ${selectedLego.type === 'minifig' ? 'parts' : 'pieces'}`
                        : ''}
                      {selectedLego.rrpEur ? ` · RRP: €${selectedLego.rrpEur.toFixed(2)}` : ''}
                    </p>
                  </div>
                </div>

                {fetchingLegoPrice && (
                  <div className="flex items-center gap-2 rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-xs text-[var(--text-muted)]">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                    <span>Fetching official LEGO retail price (Brickset)…</span>
                  </div>
                )}

                {legoValuation?.source === 'brickset' && (
                  <div className="flex flex-col gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        Brickset Market Valuation
                      </span>
                      <span className="font-bold text-emerald-400">
                        €{legoValuation.resolvedEur.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-[var(--text-muted)]">
                      <div className="flex flex-wrap items-center gap-2">
                        {legoValuation.priceNew !== undefined && (
                          <span>
                            New (MISB):{' '}
                            <strong className="text-[var(--text-strong)]">
                              €{legoValuation.priceNew.toFixed(2)}
                            </strong>
                          </span>
                        )}
                        {legoValuation.priceUsed !== undefined && (
                          <span>
                            Used:{' '}
                            <strong className="text-[var(--text-strong)]">
                              €{legoValuation.priceUsed.toFixed(2)}
                            </strong>
                          </span>
                        )}
                        {legoValuation.rrp !== undefined && (
                          <span>
                            RRP:{' '}
                            <strong className="text-[var(--text-strong)]">
                              €{legoValuation.rrp.toFixed(2)}
                            </strong>
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {condition.toLowerCase().includes('used') || condition.toLowerCase().includes('loose')
                          ? 'Used condition applied'
                          : 'Sealed / mint valuation applied'}
                      </span>
                    </div>

                    {legoValuation.containedMinifig && (
                      <div className="flex items-center justify-between border-t border-emerald-500/20 pt-1.5 text-[11px]">
                        <span className="text-[var(--text-muted)]">
                          Includes minifigure:{' '}
                          <strong className="text-emerald-400">#{legoValuation.containedMinifig.code}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (legoValuation.containedMinifig) {
                              const code = legoValuation.containedMinifig.code;
                              const minifigImg = getLegoImageUrl(code);
                              setIdentifier(code);
                              setImageUrl(minifigImg);
                              setSelectedLego({
                                setNumber: code,
                                name: `Minifigure #${code.toUpperCase()}`,
                                theme: selectedLego.theme,
                                imageUrl: minifigImg,
                                type: 'minifig',
                              });
                              setCondition('Minifigure Mint / Complete');
                              void handleFetchLegoValuation(code, 'MINIFIG', 'Minifigure Mint / Complete');
                            }
                          }}
                          className="tap font-semibold text-emerald-400 hover:underline"
                        >
                          Check Minifig Value →
                        </button>
                      </div>
                    )}

                    {legoValuation.appearsIn && legoValuation.appearsIn.length > 0 && (
                      <div className="border-t border-emerald-500/20 pt-1 text-[10px] text-[var(--text-muted)]">
                        <span>Appears in sets: </span>
                        <span className="font-semibold text-[var(--text-strong)]">
                          {legoValuation.appearsIn.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[var(--border)] text-[11px] text-[var(--text-muted)]">
                  {!fetchingLegoPrice && (
                    <button
                      type="button"
                      onClick={() =>
                        handleFetchLegoValuation(
                          selectedLego.setNumber,
                          selectedLego.type === 'minifig' ? 'MINIFIG' : 'SET',
                        )
                      }
                      className="tap flex items-center gap-1.5 font-semibold text-[var(--accent)] hover:underline"
                    >
                      <span>Refresh live valuation</span>
                    </button>
                  )}
                  <div className="flex items-center gap-2.5 ml-auto">
                    <span>Source:</span>
                    <a
                      href={
                        selectedLego.type === 'minifig' || legoValuation?.itemType === 'MINIFIG'
                          ? `https://brickset.com/minifigs/${encodeURIComponent(
                              (legoValuation?.bricksetSetNumber || selectedLego.setNumber).replace(/^#/, ''),
                            )}`
                          : `https://brickset.com/sets/${(legoValuation?.bricksetSetNumber || selectedLego.setNumber).replace(/-\d+$/, '')}-1`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-[var(--accent)] hover:underline"
                    >
                      Brickset ↗
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <LegoSetSearch onSelect={handleSelectLegoSet} />
            )}
          </div>
        )}

        {/* Watch Flow via TheWatchAPI */}
        {category === 'watches' && (
          <div className="flex flex-col gap-3 rounded-[var(--radius-field)] neu-sunken p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                TheWatchAPI Watch Lookup
              </span>
              <span className="rounded bg-[var(--surface-raised)] px-2 py-0.5 text-[10px] font-bold text-purple-400">
                TheWatchAPI
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-xs text-[var(--text-muted)]">
                Enter a model reference (e.g. <strong className="text-[var(--text-strong)]">126610LN</strong>, <strong className="text-[var(--text-strong)]">310.30.42.50.01.002</strong> or <strong className="text-[var(--text-strong)]">WSSA0029</strong>) to retrieve brand, model name, catalog photo, specs and live market valuation.
              </p>

              <div className="flex gap-2">
                <div className="flex-1">
                  <TextInput
                    value={identifier}
                    placeholder="e.g. T137.407.11.091.00, 126610LN, 310.30.42.50.01.002"
                    onChange={(e) => setIdentifier(e.target.value)}
                    onBlur={() => {
                      if (identifier.trim() && !watchValuation) {
                        void handleFetchWatchValuation();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleFetchWatchValuation();
                      }
                    }}
                  />
                </div>
                <Button
                  type="button"
                  disabled={fetchingWatchPrice || !identifier.trim()}
                  onClick={() => handleFetchWatchValuation()}
                  className="shrink-0"
                >
                  {fetchingWatchPrice ? 'Checking…' : 'Fetch Watch Details'}
                </Button>
              </div>
            </div>

            {watchValuation && (
              <div className="flex flex-col gap-3 rounded-xl border border-purple-500/30 bg-purple-500/10 p-3.5">
                {/* Watch Header with Photo & Valuation */}
                <div className="flex items-center gap-3">
                  {(watchValuation.imageUrl || resolveCuratedWatchImage(identifier)) && (
                    <img
                      src={watchValuation.imageUrl || resolveCuratedWatchImage(identifier)}
                      alt={watchValuation.fullName}
                      className="h-20 w-20 shrink-0 rounded-lg object-contain bg-[var(--surface-sunken)] p-1.5 shadow-sm border border-[var(--line)]"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded bg-purple-950/80 border border-purple-500/30 px-1.5 py-0.5 text-[10px] font-bold text-purple-300">
                        {watchValuation.brand}
                      </span>
                      <span className="font-mono text-xs font-bold text-[var(--accent)]">
                        #{watchValuation.referenceNumber}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm font-bold text-[var(--text-strong)]">
                      {watchValuation.model}
                    </p>
                    <div className="mt-1 flex flex-wrap items-baseline gap-2">
                      <span className="text-base font-extrabold text-purple-400">
                        €{watchValuation.priceEur.toFixed(2)}
                      </span>
                      {watchValuation.priceUsd && (
                        <span className="text-xs text-[var(--text-muted)]">
                          (${watchValuation.priceUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD · €{watchValuation.fxRateUsed.toFixed(4)}/$)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Structured Specifications Grid */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 border-t border-purple-500/20 pt-2.5">
                  {watchValuation.specs.caseDiameter && (
                    <div className="flex flex-col rounded-md bg-[var(--surface-raised)]/80 p-2 border border-[var(--line)]/50">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        Diameter
                      </span>
                      <span className="text-xs font-bold text-[var(--text-strong)]">
                        {watchValuation.specs.caseDiameter}
                      </span>
                    </div>
                  )}
                  {watchValuation.specs.caseMaterial && (
                    <div className="flex flex-col rounded-md bg-[var(--surface-raised)]/80 p-2 border border-[var(--line)]/50">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        Material
                      </span>
                      <span className="truncate text-xs font-bold text-[var(--text-strong)]" title={watchValuation.specs.caseMaterial}>
                        {watchValuation.specs.caseMaterial}
                      </span>
                    </div>
                  )}
                  {watchValuation.specs.movement && (
                    <div className="flex flex-col rounded-md bg-[var(--surface-raised)]/80 p-2 border border-[var(--line)]/50">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        Movement
                      </span>
                      <span className="truncate text-xs font-bold text-[var(--text-strong)]" title={watchValuation.specs.movement}>
                        {watchValuation.specs.movement}
                      </span>
                    </div>
                  )}
                  {watchValuation.specs.caliber && (
                    <div className="flex flex-col rounded-md bg-[var(--surface-raised)]/80 p-2 border border-[var(--line)]/50">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        Caliber
                      </span>
                      <span className="truncate text-xs font-bold text-[var(--text-strong)]" title={watchValuation.specs.caliber}>
                        {watchValuation.specs.caliber}
                      </span>
                    </div>
                  )}
                  {watchValuation.specs.dialColor && (
                    <div className="flex flex-col rounded-md bg-[var(--surface-raised)]/80 p-2 border border-[var(--line)]/50">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        Dial
                      </span>
                      <span className="truncate text-xs font-bold text-[var(--text-strong)]" title={watchValuation.specs.dialColor}>
                        {watchValuation.specs.dialColor}
                      </span>
                    </div>
                  )}
                  {watchValuation.specs.waterResistance && (
                    <div className="flex flex-col rounded-md bg-[var(--surface-raised)]/80 p-2 border border-[var(--line)]/50">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        Water Resistance
                      </span>
                      <span className="truncate text-xs font-bold text-[var(--text-strong)]" title={watchValuation.specs.waterResistance}>
                        {watchValuation.specs.waterResistance}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* General Details */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Labelled label="Asset Name">
              <TextInput
                value={name}
                placeholder={
                  category === 'pokemon'
                    ? 'e.g. Charizard ex #199/165 (151)'
                    : category === 'lego'
                      ? 'e.g. Rivendell (10316) or Boba Fett (sw0107)'
                      : 'e.g. Omega Speedmaster Professional Moonwatch'
                }
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Labelled>
          </div>

          <Labelled label="Identifier / Reference (Optional)">
            <TextInput
              value={identifier}
              placeholder={
                category === 'pokemon'
                  ? 'e.g. swsh4-25'
                  : category === 'lego'
                    ? 'e.g. 75192 or sw0107'
                    : 'e.g. 310.30.42.50.01.002'
              }
              onChange={(e) => {
                const val = e.target.value;
                if (category === 'lego') {
                  const cleaned = cleanLegoInput(val);
                  if (
                    cleaned.raw !== cleaned.itemNo &&
                    (cleaned.raw.includes('http') || cleaned.raw.startsWith('#'))
                  ) {
                    setIdentifier(cleaned.itemNo);
                    setImageUrl(getLegoImageUrl(cleaned.itemNo));
                    void handleFetchLegoValuation(cleaned.itemNo, cleaned.itemType);
                    return;
                  }
                  setIdentifier(val);
                  if (
                    !imageUrl &&
                    (/^\d{4,6}$/.test(val.trim()) ||
                      /^(fig-\d+|[a-z]{2,5}\d+[a-z]?)$/i.test(val.trim()))
                  ) {
                    setImageUrl(getLegoImageUrl(val));
                  }
                  return;
                }
                setIdentifier(val);
              }}
            />
          </Labelled>

          <Labelled label="Condition / Grade">
            <Select value={condition} onChange={(e) => setCondition(e.target.value)}>
              {(category === 'pokemon'
                ? POKEMON_CONDITIONS
                : category === 'lego'
                  ? LEGO_CONDITIONS
                  : WATCH_CONDITIONS
              ).map((cond) => (
                <option key={cond.value} value={cond.value}>
                  {cond.label}
                </option>
              ))}
            </Select>
          </Labelled>
        </div>

        {/* Financial Details */}
        <div className="grid grid-cols-3 gap-3">
          <Labelled label="Qty">
            <TextInput
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </Labelled>

          <Labelled label="Purchase Price (€)">
            <MoneyInput
              placeholder="0.00"
              value={purchasePrice}
              onChange={setPurchasePrice}
            />
          </Labelled>

          <Labelled
            label={
              <div className="flex items-center justify-between">
                <span>Current Value (€)</span>
                {category === 'lego' && identifier.trim() && (
                  <button
                    type="button"
                    disabled={fetchingLegoPrice}
                    onClick={() => handleFetchLegoValuation(identifier.trim())}
                    className="tap text-[10px] font-semibold text-[var(--accent)] hover:underline"
                  >
                    {fetchingLegoPrice ? 'Checking…' : 'Check live valuation'}
                  </button>
                )}
                {category === 'watches' && identifier.trim() && (
                  <button
                    type="button"
                    disabled={fetchingWatchPrice}
                    onClick={() => handleFetchWatchValuation(identifier.trim())}
                    className="tap text-[10px] font-semibold text-purple-400 hover:underline"
                  >
                    {fetchingWatchPrice ? 'Checking…' : 'Fetch watch valuation'}
                  </button>
                )}
              </div>
            }
          >
            <MoneyInput
              placeholder="0.00"
              value={currentPrice}
              onChange={setCurrentPrice}
            />
          </Labelled>
        </div>

        {/* Standalone Brickset Valuation Card when entered via Identifier directly */}
        {category === 'lego' && legoValuation?.source === 'brickset' && !selectedLego && (
          <div className="flex flex-col gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Brickset Market Valuation
              </span>
              <span className="font-bold text-emerald-400">
                €{legoValuation.resolvedEur.toFixed(2)}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-[var(--text-muted)]">
              <div className="flex flex-wrap items-center gap-2">
                {legoValuation.priceNew !== undefined && (
                  <span>
                    New (MISB):{' '}
                    <strong className="text-[var(--text-strong)]">
                      €{legoValuation.priceNew.toFixed(2)}
                    </strong>
                  </span>
                )}
                {legoValuation.priceUsed !== undefined && (
                  <span>
                    Used:{' '}
                    <strong className="text-[var(--text-strong)]">
                      €{legoValuation.priceUsed.toFixed(2)}
                    </strong>
                  </span>
                )}
                {legoValuation.rrp !== undefined && (
                  <span>
                    RRP:{' '}
                    <strong className="text-[var(--text-strong)]">
                      €{legoValuation.rrp.toFixed(2)}
                    </strong>
                  </span>
                )}
              </div>
              <span className="text-[10px] text-[var(--text-muted)]">
                {condition.toLowerCase().includes('used') || condition.toLowerCase().includes('loose')
                  ? 'Used condition applied'
                  : 'Sealed / mint valuation applied'}
              </span>
            </div>

            {legoValuation.containedMinifig && (
              <div className="flex items-center justify-between border-t border-emerald-500/20 pt-1.5 text-[11px]">
                <span className="text-[var(--text-muted)]">
                  Includes minifigure:{' '}
                  <strong className="text-emerald-400">#{legoValuation.containedMinifig.code}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (legoValuation.containedMinifig) {
                      const code = legoValuation.containedMinifig.code;
                      setIdentifier(code);
                      setImageUrl(getLegoImageUrl(code));
                      void handleFetchLegoValuation(code, 'MINIFIG');
                    }
                  }}
                  className="tap font-semibold text-emerald-400 hover:underline"
                >
                  Check Minifig Value →
                </button>
              </div>
            )}

            {legoValuation.appearsIn && legoValuation.appearsIn.length > 0 && (
              <div className="border-t border-emerald-500/20 pt-1 text-[10px] text-[var(--text-muted)]">
                <span>Appears in sets: </span>
                <span className="font-semibold text-[var(--text-strong)]">
                  {legoValuation.appearsIn.join(', ')}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-emerald-500/20 pt-1 text-[10px] text-[var(--text-muted)]">
              <span>Verified on Brickset:</span>
              <a
                href={
                  legoValuation.itemType === 'MINIFIG'
                    ? `https://brickset.com/minifigs/${encodeURIComponent(legoValuation.itemNo.replace(/^#/, ''))}`
                    : `https://brickset.com/sets/${legoValuation.itemNo.replace(/-\d+$/, '')}-1`
                }
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-emerald-400 hover:underline inline-flex items-center gap-0.5"
              >
                Brickset Catalog ↗
              </a>
            </div>
          </div>
        )}

        {/* Date and Image */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Labelled label="Acquisition Date (Optional)">
            <TextInput
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
            />
          </Labelled>

          <Labelled label="Image URL (Optional)">
            <TextInput
              type="url"
              value={imageUrl}
              placeholder="https://..."
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </Labelled>
        </div>

        {/* Notes */}
        <Labelled label="Notes & Provenance (Optional)">
          <TextInput
            value={notes}
            placeholder="e.g. Purchased on Cardmarket, sleeved in vault case..."
            onChange={(e) => setNotes(e.target.value)}
          />
        </Labelled>

        {/* Submit Buttons */}
        <div className="mt-2 flex gap-3">
          <Button
            type="submit"
            className="flex-1"
            disabled={add.isPending || !name.trim()}
          >
            {add.isPending ? 'Saving…' : 'Save to Portfolio'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              resetForm();
              onClose();
            }}
          >
            Cancel
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
};
