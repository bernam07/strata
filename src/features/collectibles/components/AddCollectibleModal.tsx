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
import { extractCardmarketPrice, type PokemonCardDetail } from '../api/tcgdex';
import { getLegoImageUrl, type LegoSetResult } from '../api/lego';
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

  const resetForm = () => {
    setSelectedPokemon(null);
    setSelectedLego(null);
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
    if (newCat === 'pokemon') {
      setCondition('Near Mint (NM)');
    } else if (newCat === 'lego') {
      setCondition('Factory Sealed (MISB)');
    } else {
      setCondition('Brand New / Mint');
    }
  };

  const handleSelectPokemonCard = (card: PokemonCardDetail) => {
    setSelectedPokemon(card);
    const cardName = card.set?.name
      ? `${card.name} (#${card.localId} - ${card.set.name})`
      : `${card.name} (#${card.localId})`;
    setName(cardName);
    setIdentifier(card.id);
    setImageUrl(card.imageUrl ?? '');

    const marketEur = extractCardmarketPrice(card.pricing);
    if (marketEur !== null) {
      setCurrentPrice(String(marketEur));
      if (!purchasePrice) {
        setPurchasePrice(String(marketEur));
      }
    }

    setMetadata({
      setId: card.set?.id,
      setName: card.set?.name,
      rarity: card.rarity,
      localId: card.localId,
      cardmarketPriceEur: marketEur,
    });
  };

  const handleSelectLegoSet = (item: LegoSetResult) => {
    setSelectedLego(item);
    setName(`${item.name} (#${item.setNumber})`);
    setIdentifier(item.setNumber);
    setImageUrl(item.imageUrl);
    if (item.type === 'minifig') {
      setCondition('Minifigure Mint / Complete');
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
              <div className="flex items-center gap-3 rounded-[var(--radius-field)] neu-raised p-2.5">
                {selectedPokemon.imageUrl && (
                  <img
                    src={selectedPokemon.imageUrl}
                    alt={selectedPokemon.name}
                    className="h-16 w-12 rounded object-contain shadow-xs"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[var(--text-strong)]">
                    {selectedPokemon.name}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {selectedPokemon.set?.name} · #{selectedPokemon.localId}
                    {selectedPokemon.rarity && ` · ${selectedPokemon.rarity}`}
                  </p>
                  {typeof metadata.cardmarketPriceEur === 'number' && (
                    <p className="mt-1 text-xs font-semibold text-[var(--positive)]">
                      Cardmarket Trend: €{metadata.cardmarketPriceEur.toFixed(2)}
                    </p>
                  )}
                </div>
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

          <Labelled label="Current Value (€)">
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
