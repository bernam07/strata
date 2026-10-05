import { useEffect, useState } from 'react';
import { BottomSheet } from '@/ui/BottomSheet';
import { Button } from '@/ui/Button';
import { Labelled, MoneyInput, Select, TextInput } from '@/ui/Field';
import { toast } from '@/ui/toast';
import {
  CATEGORY_LABELS,
  useDeleteCollectible,
  useUpdateCollectible,
  type Collectible,
  type CollectibleCategory,
} from '../api/useCollectibles';
import { fetchBricklinkPrice, type BricklinkPriceResult } from '../api/bricklink';
import {
  getPokemonCard,
  getUsdToEurRate,
  resolvePokemonPrice,
  type PokemonCardFinish,
  type PokemonPriceBreakdown,
} from '../api/tcgdex';

interface EditCollectibleModalProps {
  collectible: Collectible | null;
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

export const EditCollectibleModal = ({ collectible, onClose }: EditCollectibleModalProps) => {
  const update = useUpdateCollectible();
  const remove = useDeleteCollectible();

  const [category, setCategory] = useState<CollectibleCategory>('pokemon');
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [condition, setCondition] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const [fetchingBricklinkPrice, setFetchingBricklinkPrice] = useState(false);
  const [bricklinkGuide, setBricklinkGuide] = useState<BricklinkPriceResult | null>(null);
  const [fetchingPokemonPrice, setFetchingPokemonPrice] = useState(false);
  const [pokemonBreakdown, setPokemonBreakdown] = useState<PokemonPriceBreakdown | null>(null);

  useEffect(() => {
    if (!collectible) return;
    setCategory(collectible.category);
    setName(collectible.name);
    setIdentifier(collectible.identifier ?? '');
    setCondition(collectible.condition ?? '');
    setQuantity(String(collectible.quantity));
    setPurchasePrice(String(collectible.purchasePrice));
    setCurrentPrice(String(collectible.currentPrice));
    setImageUrl(collectible.imageUrl ?? '');
    setPurchaseDate(collectible.purchaseDate ?? '');
    setNotes(collectible.notes ?? '');
    setMetadata(collectible.metadata ?? {});
    setConfirmDelete(false);
    setBricklinkGuide(null);
    setFetchingBricklinkPrice(false);
    setPokemonBreakdown(null);
    setFetchingPokemonPrice(false);
  }, [collectible]);

  const handleFetchBricklink = async () => {
    if (!identifier.trim()) {
      toast('Please enter a LEGO set number or minifigure code', 'error');
      return;
    }
    setFetchingBricklinkPrice(true);
    try {
      const isUsed = /used|opened|loose|incomplete/i.test(condition);
      const res = await fetchBricklinkPrice({
        itemNo: identifier.trim(),
        guideType: 'sold',
        condition: isUsed ? 'U' : 'N',
      });
      if (res) {
        setBricklinkGuide(res);
        const p =
          res.avgPrice > 0
            ? res.avgPrice
            : res.qtyAvgPrice > 0
              ? res.qtyAvgPrice
              : res.minPrice;
        if (p > 0) {
          setCurrentPrice(String(p));
        }
        toast(
          `BrickLink market price loaded: €${(res.avgPrice || res.qtyAvgPrice).toFixed(2)}`,
          'success',
        );
      }
    } catch (err) {
      toast(
        err instanceof Error ? err.message : 'Failed to fetch BrickLink price',
        'error',
      );
    } finally {
      setFetchingBricklinkPrice(false);
    }
  };

  const handleFetchPokemonPrice = async () => {
    if (!identifier.trim()) {
      toast('Please enter a card identifier (e.g. sv03.5-199)', 'error');
      return;
    }
    setFetchingPokemonPrice(true);
    try {
      const card = await getPokemonCard(identifier.trim());
      if (!card) {
        toast('Card not found in TCGdex catalog', 'error');
        return;
      }
      const fxRate = await getUsdToEurRate();
      const preferredFinish = metadata.finish as PokemonCardFinish | undefined;
      const breakdown = resolvePokemonPrice(card.pricing, {
        preferredFinish,
        condition,
        rarity: card.rarity,
        fxRate,
      });
      setPokemonBreakdown(breakdown);
      if (breakdown.resolvedEur > 0) {
        setCurrentPrice(String(breakdown.resolvedEur));
        setMetadata((prev) => ({
          ...prev,
          finish: breakdown.selectedFinish,
          collectrPriceEur: breakdown.collectr?.priceEur,
          tcgplayerUsd: breakdown.collectr?.priceUsd,
          cardmarketPriceEur: breakdown.cardmarket?.priceEur,
        }));
        toast(
          `Collectr market price loaded: €${breakdown.resolvedEur.toFixed(2)}`,
          'success',
        );
      } else {
        toast('No market pricing available for this card', 'error');
      }
    } catch (err) {
      toast(
        err instanceof Error ? err.message : 'Failed to fetch Collectr price',
        'error',
      );
    } finally {
      setFetchingPokemonPrice(false);
    }
  };

  const handleSelectPokemonFinish = (finish: PokemonCardFinish) => {
    if (!pokemonBreakdown) return;
    const opt = pokemonBreakdown.finishes.find((f) => f.finish === finish);
    if (opt && opt.priceEur > 0) {
      setCurrentPrice(String(opt.priceEur));
      setMetadata((prev) => ({
        ...prev,
        finish,
        collectrPriceEur: opt.priceEur,
        tcgplayerUsd: opt.priceUsd,
      }));
    }
  };

  if (!collectible) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast('Please specify asset name', 'error');
      return;
    }

    const qty = Number(quantity) > 0 ? Number(quantity) : 1;
    const buyPrice = Number(purchasePrice) || 0;
    const curVal = currentPrice ? Number(currentPrice) : buyPrice;

    update.mutate(
      {
        id: collectible.id,
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
          toast('Asset updated successfully', 'success');
          onClose();
        },
        onError: (err) => {
          toast(err instanceof Error ? err.message : 'Failed to update asset', 'error');
        },
      },
    );
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    remove.mutate(collectible.id, {
      onSuccess: () => {
        toast('Asset removed from portfolio', 'success');
        onClose();
      },
      onError: (err) => {
        toast(err instanceof Error ? err.message : 'Failed to remove asset', 'error');
      },
    });
  };

  return (
    <BottomSheet
      open={Boolean(collectible)}
      title="Edit Alternative Asset"
      subtitle={collectible.name}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Preview image if present */}
        {imageUrl && (
          <div className="flex items-center justify-center p-2">
            <img
              src={imageUrl}
              alt={name}
              className="max-h-36 rounded-md object-contain shadow-sm"
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Labelled label="Category">
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value as CollectibleCategory)}
            >
              {(Object.keys(CATEGORY_LABELS) as CollectibleCategory[]).map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </option>
              ))}
            </Select>
          </Labelled>

          <Labelled label="Condition / Grade">
            <Select value={condition} onChange={(e) => setCondition(e.target.value)}>
              <option value="">Unspecified</option>
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

          <div className="sm:col-span-2">
            <Labelled label="Asset Name">
              <TextInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Labelled>
          </div>

          <Labelled label="Identifier / Reference">
            <TextInput
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </Labelled>

          <Labelled label="Quantity">
            <TextInput
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </Labelled>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Labelled label="Purchase Price (€)">
            <MoneyInput
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
                    disabled={fetchingBricklinkPrice}
                    onClick={handleFetchBricklink}
                    className="tap text-[10px] font-semibold text-[var(--accent)] hover:underline"
                  >
                    {fetchingBricklinkPrice ? 'Checking…' : 'Fetch BrickLink'}
                  </button>
                )}
                {category === 'pokemon' && identifier.trim() && (
                  <button
                    type="button"
                    disabled={fetchingPokemonPrice}
                    onClick={handleFetchPokemonPrice}
                    className="tap text-[10px] font-semibold text-[var(--accent)] hover:underline"
                  >
                    {fetchingPokemonPrice ? 'Checking…' : 'Fetch Collectr'}
                  </button>
                )}
              </div>
            }
          >
            <MoneyInput
              value={currentPrice}
              onChange={setCurrentPrice}
            />
          </Labelled>
        </div>

        {pokemonBreakdown?.collectr && (
          <div className="flex flex-col gap-1.5 rounded-lg border border-[color-mix(in_srgb,var(--positive)_30%,transparent)] bg-[color-mix(in_srgb,var(--positive)_8%,transparent)] p-2.5 text-xs">
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
              <span>Market: ${pokemonBreakdown.collectr.priceUsd.toFixed(2)} USD</span>
              <span>FX: €{pokemonBreakdown.fxRateUsed.toFixed(4)} / $</span>
            </div>
            {pokemonBreakdown.finishes.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-[var(--text-muted)]">Finish:</span>
                {pokemonBreakdown.finishes.map((f) => (
                  <button
                    key={f.finish}
                    type="button"
                    onClick={() => handleSelectPokemonFinish(f.finish)}
                    className={`rounded px-2 py-0.5 text-[11px] font-medium transition ${
                      metadata.finish === f.finish
                        ? 'bg-[var(--accent)] text-white shadow-xs'
                        : 'neu-sunken text-[var(--text-muted)] hover:text-[var(--text-strong)]'
                    }`}
                  >
                    {f.label}: €{f.priceEur.toFixed(2)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {bricklinkGuide && (
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Labelled label="Acquisition Date">
            <TextInput
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
            />
          </Labelled>

          <Labelled label="Image URL">
            <TextInput
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </Labelled>
        </div>

        <Labelled label="Notes & Provenance">
          <TextInput
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Labelled>

        <div className="mt-2 flex items-center justify-between gap-3 border-t border-[var(--line)] pt-3">
          <button
            type="button"
            onClick={handleDelete}
            className={`tap rounded-[var(--radius-field)] px-3 py-2 text-xs font-semibold transition ${
              confirmDelete
                ? 'bg-[var(--negative)] font-bold text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--negative)]'
            }`}
          >
            {confirmDelete ? 'Confirm deletion?' : 'Delete from portfolio'}
          </button>

          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending || !name.trim()}>
              {update.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </form>
    </BottomSheet>
  );
};
