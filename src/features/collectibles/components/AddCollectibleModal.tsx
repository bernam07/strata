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
  getUsdToEurRate,
  getCachedUsdToEurRate,
  type PokemonCardDetail,
  type PokemonPriceBreakdown,
  type PokemonCardFinish,
} from '../api/tcgdex';
import { getLegoImageUrl, type LegoSetResult } from '../api/lego';
import { type BricklinkPriceResult } from '../api/bricklink';
import { resolveLegoPrice, type LegoValuationResult } from '../api/legoValuation';
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

const GENERIC_CONDITIONS = [
  { value: 'Brand New / Mint', label: 'Brand New / Mint' },
  { value: 'Near Mint / Excellent', label: 'Near Mint / Excellent' },
  { value: 'Very Good', label: 'Very Good' },
  { value: 'Good / Used', label: 'Good / Used' },
  { value: 'Vintage / Worn', label: 'Vintage / Worn' },
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
  const [bricklinkGuide, setBricklinkGuide] = useState<BricklinkPriceResult | null>(null);
  const [legoValuation, setLegoValuation] = useState<LegoValuationResult | null>(null);
  const [pokemonBreakdown, setPokemonBreakdown] = useState<PokemonPriceBreakdown | null>(null);
  const [selectedFinish, setSelectedFinish] = useState<PokemonCardFinish | null>(null);
  const [activePriceSource, setActivePriceSource] = useState<'collectr' | 'cardmarket'>('collectr');

  const resetForm = () => {
    setSelectedPokemon(null);
    setSelectedLego(null);
    setBricklinkGuide(null);
    setLegoValuation(null);
    setFetchingLegoPrice(false);
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
          : 'Brand New / Mint',
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
    setBricklinkGuide(null);
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
      setCondition('Brand New / Mint');
    }
  };

  const handleSelectPokemonCard = async (card: PokemonCardDetail) => {
    setSelectedPokemon(card);
    const cardName = card.set?.name
      ? `${card.name} (#${card.localId} - ${card.set.name})`
      : `${card.name} (#${card.localId})`;
    setName(cardName);
    setIdentifier(card.id);
    setImageUrl(card.imageUrl ?? '');

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
      language: card.language || (/^(sv\d+[a-z]?|s\d+[a-z]?|sm\d+|pmcg)/i.test(card.id) ? 'ja' : 'en'),
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
      const res = await resolveLegoPrice({
        itemNo: setNumber,
        itemType,
        condition: overrideCondition || condition,
        currency: 'EUR',
      });

      if (res && res.resolvedEur > 0) {
        setLegoValuation(res);
        if (res.bricklink) {
          setBricklinkGuide(res.bricklink);
        }
        setCurrentPrice(String(res.resolvedEur));
        if (!purchasePrice) {
          setPurchasePrice(String(res.retailPrice ?? res.resolvedEur));
        }
        setMetadata((prev) => ({
          ...prev,
          valuationSource: res.source,
          ...(res.brickeconomy ? { brickeconomy: res.brickeconomy } : {}),
          ...(res.bricklink ? { bricklink: res.bricklink } : {}),
        }));

        if (res.source === 'brickeconomy') {
          toast(
            `BrickEconomy market valuation: €${res.resolvedEur.toFixed(2)}`,
            'success',
          );
        } else if (res.source === 'bricklink') {
          toast(
            `BrickLink market price: €${res.resolvedEur.toFixed(2)}`,
            'success',
          );
        }
      }
    } catch {
      // BrickEconomy/Bricklink not connected, keep existing price
    } finally {
      setFetchingLegoPrice(false);
    }
  };

  const handleSelectLegoSet = (item: LegoSetResult) => {
    setSelectedLego(item);
    setName(`${item.name} (#${item.setNumber})`);
    setIdentifier(item.setNumber);
    setImageUrl(item.imageUrl);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast('Please enter the asset name', 'error');
      return;
    }

    const qty = Number(quantity) > 0 ? Number(quantity) : 1;
    const buyPrice = Number(purchasePrice) || 0;
    const curVal = currentPrice ? Number(currentPrice) : buyPrice;

    add.mutate(
      {
        category,
        name: name.trim(),
        identifier: identifier.trim() || null,
        quantity: qty,
        purchasePrice: buyPrice,
        currentPrice: curVal,
        condition: condition.trim() || null,
        imageUrl: imageUrl.trim() || null,
        purchaseDate: purchaseDate || null,
        notes: notes.trim() || null,
        metadata,
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
      subtitle="Pokémon cards, LEGO sets & minifigures, watches, coins or other collectibles"
      onClose={() => {
        resetForm();
        onClose();
      }}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Category Selector */}
        <Labelled label="Category">
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {(Object.keys(CATEGORY_LABELS) as CollectibleCategory[]).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategoryChange(cat)}
                className={`tap flex flex-col items-center justify-center gap-1.5 rounded-[var(--radius-field)] p-2 text-center text-xs font-semibold transition ${
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
                  {selectedPokemon.imageUrl && (
                    <img
                      src={selectedPokemon.imageUrl}
                      alt={selectedPokemon.name}
                      className="h-16 w-12 rounded object-contain shadow-xs"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-bold text-[var(--text-strong)]">
                        {selectedPokemon.name}
                      </p>
                      {Boolean(
                        metadata.language === 'ja' ||
                          /^(sv\d+[a-z]?|s\d+[a-z]?|sm\d+|pmcg)/i.test(
                            selectedPokemon.id,
                          ),
                      ) && (
                        <span className="rounded bg-rose-950/80 border border-rose-500/30 px-1 py-0.2 text-[9px] font-bold text-rose-300">
                          JA
                        </span>
                      )}
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
                  onClick={() => setSelectedLego(null)}
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
                    <span>Fetching live market valuation (BrickEconomy / BrickLink)…</span>
                  </div>
                )}

                {legoValuation?.source === 'brickeconomy' && (
                  <div className="flex flex-col gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        BrickEconomy Market Valuation
                      </span>
                      <span className="font-bold text-emerald-400">
                        €{legoValuation.resolvedEur.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between text-[11px] text-[var(--text-muted)]">
                      <span>
                        {legoValuation.retailPrice
                          ? `Original Retail: €${legoValuation.retailPrice.toFixed(2)}`
                          : 'Live Secondary Market'}
                      </span>
                      {legoValuation.growthPercent !== undefined && (
                        <span className="font-semibold text-emerald-400">
                          {legoValuation.growthPercent >= 0 ? '+' : ''}
                          {legoValuation.growthPercent.toFixed(1)}% growth
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {bricklinkGuide && legoValuation?.source !== 'brickeconomy' && (
                  <div className="flex flex-col gap-1.5 rounded-lg border border-[color-mix(in_srgb,var(--positive)_30%,transparent)] bg-[color-mix(in_srgb,var(--positive)_8%,transparent)] p-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-semibold text-[var(--positive)]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--positive)]" />
                        BrickLink Guide ({bricklinkGuide.guideType === 'sold' ? '6-mo Sales' : 'Current Stock'})
                      </span>
                      <span className="font-bold text-[var(--positive)]">
                        €{bricklinkGuide.avgPrice.toFixed(2)} (Avg)
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between text-[11px] text-[var(--text-muted)]">
                      <span>
                        {bricklinkGuide.totalQuantity > 0
                          ? `${bricklinkGuide.totalQuantity} items recorded (${bricklinkGuide.unitQuantity} lots)`
                          : 'Price estimate'}
                      </span>
                      <span>
                        Range: €{bricklinkGuide.minPrice.toFixed(2)} – €{bricklinkGuide.maxPrice.toFixed(2)}
                      </span>
                    </div>
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
                    <span>References:</span>
                    <a
                      href={`https://www.brickeconomy.com/${selectedLego.type === 'minifig' ? 'minifig' : 'set'}/${selectedLego.setNumber}${selectedLego.type === 'minifig' ? '' : '-1'}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-emerald-500 hover:underline"
                    >
                      BrickEconomy ↗
                    </a>
                    <span>·</span>
                    <a
                      href={`https://www.bricklink.com/v2/catalog/catalogitem.page?${selectedLego.type === 'minifig' ? 'M' : 'S'}=${selectedLego.setNumber}-1#T=P`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-[var(--accent)] hover:underline"
                    >
                      BrickLink ↗
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <LegoSetSearch onSelect={handleSelectLegoSet} />
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
                setIdentifier(val);
                if (category === 'lego' && !imageUrl && (/^\d{4,6}$/.test(val.trim()) || /^(fig-\d+|[a-z]{2,5}\d+[a-z]?)$/i.test(val.trim()))) {
                  setImageUrl(getLegoImageUrl(val));
                }
              }}
            />
          </Labelled>

          <Labelled label="Condition / Grade">
            <Select value={condition} onChange={(e) => setCondition(e.target.value)}>
              {(category === 'pokemon'
                ? POKEMON_CONDITIONS
                : category === 'lego'
                  ? LEGO_CONDITIONS
                  : GENERIC_CONDITIONS
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
