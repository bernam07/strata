import { useEffect, useState } from 'react';
import { BottomSheet } from '@/ui/BottomSheet';
import { Button } from '@/ui/Button';
import { Labelled, MoneyInput, Select, TextInput } from '@/ui/Field';
import { toast } from '@/ui/toast';
import {
  CATEGORY_LABELS,
  useDeleteCollectible,
  useSyncSingleCollectiblePrice,
  useUpdateCollectible,
  type Collectible,
  type CollectibleCategory,
  type PriceSnapshot,
} from '../api/useCollectibles';
import { getLegoImageUrl } from '../api/lego';
import { cleanLegoInput } from '../api/brickset';
import { resolveLegoPrice, type LegoValuationResult } from '../api/legoValuation';
import {
  resolveWatchPrice,
  cleanWatchReference,
  type WatchDetailsResult,
} from '../api/theWatchApi';

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

const WATCH_CONDITIONS = [
  { value: 'Brand New / Unworn (Box & Papers)', label: 'Brand New / Unworn (Box & Papers)' },
  { value: 'Mint / Like New (Box & Papers)', label: 'Mint / Like New (Box & Papers)' },
  { value: 'Very Good (Watch Only)', label: 'Very Good (Watch Only)' },
  { value: 'Good / Fair (Wear / Scratches)', label: 'Good / Fair (Wear / Scratches)' },
  { value: 'Vintage / Serviced', label: 'Vintage / Serviced' },
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
  const [fetchingLegoPrice, setFetchingLegoPrice] = useState(false);
  const [legoValuation, setLegoValuation] = useState<LegoValuationResult | null>(null);
  const [fetchingWatchPrice, setFetchingWatchPrice] = useState(false);
  const [watchValuation, setWatchValuation] = useState<WatchDetailsResult | null>(null);

  const syncSingle = useSyncSingleCollectiblePrice();

  const handleQuickSync = () => {
    if (!collectible) return;
    syncSingle.mutate(collectible, {
      onSuccess: (res) => {
        if (res.newPrice !== undefined) {
          setCurrentPrice(String(res.newPrice));
          setMetadata((prev) => ({
            ...prev,
            lastSyncedAt: new Date().toISOString(),
          }));
          toast(
            `Live market price updated: €${res.newPrice.toFixed(2)}${
              res.newPrice !== res.oldPrice
                ? ` (was €${res.oldPrice.toFixed(2)})`
                : ' (unchanged)'
            }`,
            'success',
          );
        }
      },
      onError: (err) => {
        toast(err instanceof Error ? err.message : 'Failed to sync price', 'error');
      },
    });
  };

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
    setLegoValuation(null);
    setFetchingLegoPrice(false);
    setWatchValuation(null);
    setFetchingWatchPrice(false);
  }, [collectible]);

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
        }
        if (res.imageUrl && !imageUrl) {
          setImageUrl(res.imageUrl);
        }
        if (!name || name === 'Luxury Watch' || name.startsWith('Watch #')) {
          setName(res.fullName);
        }
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

  const handleFetchLegoValuation = async (
    overrideItemNo?: string,
    overrideType?: 'SET' | 'MINIFIG',
  ) => {
    const targetItemNo = (overrideItemNo || identifier).trim();
    if (!targetItemNo) {
      toast('Please enter a LEGO set number or minifigure code', 'error');
      return;
    }
    setFetchingLegoPrice(true);
    try {
      const metadataType = overrideType ? overrideType.toLowerCase() : metadata.type;
      const hintedType =
        overrideType ||
        (metadataType === 'minifig' || metadataType === 'MINIFIG' ? 'MINIFIG' : undefined);
      const cleaned = cleanLegoInput(targetItemNo, hintedType);

      if (
        cleaned.raw !== cleaned.itemNo &&
        (cleaned.raw.includes('http') || cleaned.raw.startsWith('#'))
      ) {
        setIdentifier(cleaned.itemNo);
      }

      const res = await resolveLegoPrice({
        itemNo: cleaned.itemNo,
        itemType: cleaned.itemType,
        bricksetSetNumber:
          cleaned.itemType === 'MINIFIG'
            ? undefined
            : typeof metadata.bricksetSetNumber === 'string'
              ? metadata.bricksetSetNumber
              : undefined,
        condition,
        currency: 'EUR',
      });
      if (res && res.resolvedEur > 0) {
        setLegoValuation(res);
        setCurrentPrice(String(res.resolvedEur));
        const freshImg = getLegoImageUrl(res.itemNo);
        setImageUrl(freshImg);
        if (
          !name ||
          name === 'LEGO Set' ||
          name.startsWith('LEGO Set #') ||
          name.startsWith('Minifigure #') ||
          res.itemType === 'MINIFIG'
        ) {
          if (res.name) setName(`${res.name} (#${res.itemNo})`);
        }
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
        err instanceof Error ? err.message : 'Failed to fetch valuation',
        'error',
      );
    } finally {
      setFetchingLegoPrice(false);
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
                  : WATCH_CONDITIONS
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
                {identifier.trim() && (category === 'pokemon' || category === 'lego' || category === 'watches') && (
                  <button
                    type="button"
                    disabled={syncSingle.isPending || fetchingLegoPrice || fetchingWatchPrice}
                    onClick={handleQuickSync}
                    className="tap inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--accent)] hover:underline"
                  >
                    {syncSingle.isPending ? 'Syncing…' : 'Sync Live Market Price'}
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
                      setCondition('Minifigure Mint / Complete');
                      setMetadata((m) => {
                        const next: Record<string, unknown> = { ...m, type: 'minifig' };
                        delete next.bricksetSetNumber;
                        return next;
                      });
                      void handleFetchLegoValuation(code, 'MINIFIG');
                    }
                  }}
                  className="tap font-semibold text-emerald-400 hover:underline"
                >
                  Set as Minifig Item →
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

        {category === 'lego' && identifier.trim() && (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
            <span>Reference:</span>
            {(() => {
              const cleaned = cleanLegoInput(
                identifier.trim(),
                metadata.type === 'minifig' || metadata.type === 'MINIFIG' ? 'MINIFIG' : undefined,
              );
              const href =
                cleaned.itemType === 'MINIFIG'
                  ? `https://brickset.com/minifigs/${encodeURIComponent(cleaned.itemNo.replace(/^#/, ''))}`
                  : `https://brickset.com/sets/${cleaned.itemNo.replace(/-\d+$/, '')}-1`;
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-emerald-500 hover:underline inline-flex items-center gap-0.5"
                >
                  Brickset ↗
                </a>
              );
            })()}
          </div>
        )}

        {category === 'watches' && (
          <div className="flex flex-col gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-semibold text-purple-400">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                TheWatchAPI Reference Valuation
              </span>
              <button
                type="button"
                disabled={fetchingWatchPrice || !identifier.trim()}
                onClick={() => handleFetchWatchValuation()}
                className="tap text-[10px] font-semibold text-purple-300 hover:underline"
              >
                {fetchingWatchPrice ? 'Checking…' : 'Refetch Watch Details'}
              </button>
            </div>

            {(watchValuation || metadata.brand || metadata.specs) ? (
              <div className="flex flex-col gap-1.5 text-[11px] text-[var(--text-muted)]">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--text-strong)]">
                    {watchValuation
                      ? `${watchValuation.brand} ${watchValuation.model}`
                      : `${String(metadata.brand ?? '')} ${String(metadata.model ?? '')}`.trim() || 'Watch Details'}
                  </span>
                  {Boolean(watchValuation?.priceEur || metadata.priceUsd) && (
                    <span className="font-bold text-purple-400">
                      {watchValuation
                        ? `€${watchValuation.priceEur.toFixed(2)}`
                        : metadata.priceUsd
                          ? `$${Number(metadata.priceUsd).toLocaleString('en-US')}`
                          : ''}
                    </span>
                  )}
                </div>

                {(() => {
                  const specs =
                    watchValuation?.specs ||
                    (metadata.specs as Record<string, string | undefined> | undefined);
                  if (!specs) return null;
                  return (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-purple-500/20 text-[10px]">
                      {specs.caseDiameter && (
                        <span className="rounded bg-[var(--surface-raised)] px-1.5 py-0.5 text-[var(--text-muted)]">
                          {specs.caseDiameter}
                        </span>
                      )}
                      {specs.caseMaterial && (
                        <span className="rounded bg-[var(--surface-raised)] px-1.5 py-0.5 text-[var(--text-muted)]">
                          {specs.caseMaterial}
                        </span>
                      )}
                      {specs.movement && (
                        <span className="rounded bg-[var(--surface-raised)] px-1.5 py-0.5 text-[var(--text-muted)]">
                          {specs.movement}
                        </span>
                      )}
                      {specs.caliber && (
                        <span className="rounded bg-[var(--surface-raised)] px-1.5 py-0.5 text-[var(--text-muted)]">
                          {specs.caliber}
                        </span>
                      )}
                      {specs.waterResistance && (
                        <span className="rounded bg-[var(--surface-raised)] px-1.5 py-0.5 text-[var(--text-muted)]">
                          {specs.waterResistance}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <p className="text-[11px] text-[var(--text-muted)]">
                {identifier.trim()
                  ? 'Click "Refetch Watch Details" to retrieve model info, specs and live secondary valuation.'
                  : 'Enter a watch reference number above to sync market details.'}
              </p>
            )}
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

        {/* Price History & Valuation Trend */}
        {(() => {
          const history = (metadata.priceHistory as PriceSnapshot[] | undefined) || [];
          const hasMultiplePoints = history.length > 1;
          const hasPriceDiff = Number(purchasePrice) > 0 && Number(currentPrice) > 0 && Number(purchasePrice) !== Number(currentPrice);

          if (!hasMultiplePoints && !hasPriceDiff) return null;

          const basePrice = (history[0]?.price ?? Number(purchasePrice)) || Number(currentPrice);
          const latestPrice = Number(currentPrice) || basePrice;
          const diff = latestPrice - basePrice;
          const diffPct = basePrice > 0 ? (diff / basePrice) * 100 : 0;
          const isUp = diff >= 0;

          return (
            <div className="flex flex-col gap-2 rounded-[var(--radius-field)] neu-sunken p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[var(--text-strong)]">
                  Price History &amp; Trend
                </span>
                <span
                  className={`font-mono text-xs font-bold ${
                    isUp ? 'text-[var(--positive)]' : 'text-[var(--negative)]'
                  }`}
                >
                  {isUp ? '+' : ''}€{diff.toFixed(2)} ({isUp ? '+' : ''}{diffPct.toFixed(1)}%)
                </span>
              </div>

              <div className="flex max-h-36 flex-col gap-1.5 overflow-y-auto pr-1 text-[11px]">
                {history.length > 0 ? (
                  history
                    .slice()
                    .reverse()
                    .map((entry, idx) => (
                      <div
                        key={`${entry.date}-${idx}`}
                        className="flex items-center justify-between rounded bg-[var(--surface-raised)] px-2.5 py-1.5 shadow-2xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[var(--text-muted)]">
                            {new Date(entry.date).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                          {entry.source && (
                            <span className="rounded bg-[var(--surface-sunken)] px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wider text-[var(--accent)]">
                              {entry.source}
                            </span>
                          )}
                        </div>
                        <span className="font-mono font-bold text-[var(--text-strong)]">
                          €{entry.price.toFixed(2)}
                        </span>
                      </div>
                    ))
                ) : (
                  <div className="flex items-center justify-between rounded bg-[var(--surface-raised)] px-2.5 py-1.5 text-[var(--text-muted)]">
                    <span>Acquisition Cost Basis</span>
                    <span className="font-mono font-bold text-[var(--text-strong)]">
                      €{Number(purchasePrice).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

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
