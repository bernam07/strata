import { useState } from 'react';
import { BottomSheet } from '@/ui/BottomSheet';
import { Button } from '@/ui/Button';
import { Labelled, MoneyInput, Select, TextInput } from '@/ui/Field';
import { toast } from '@/ui/toast';
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  useAddCollectible,
  type CollectibleCategory,
} from '../api/useCollectibles';
import { extractCardmarketPrice, type PokemonCardDetail } from '../api/tcgdex';
import { getLegoImageUrl, type LegoSetResult } from '../api/lego';
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
  { value: 'Selado de Fábrica (MISB)', label: 'Selado de Fábrica (MISB)' },
  { value: 'Selado c/ Danos Caixa', label: 'Selado c/ Danos na Caixa' },
  { value: 'Montado Completo c/ Caixa & Manual', label: 'Montado Completo c/ Caixa & Manual' },
  { value: 'Montado Completo sem Caixa', label: 'Montado Completo sem Caixa' },
  { value: 'Incompleto / Peças', label: 'Incompleto / Peças' },
];

const GENERIC_CONDITIONS = [
  { value: 'Novo / Mint', label: 'Novo / Mint' },
  { value: 'Excelente', label: 'Excelente' },
  { value: 'Bom estado', label: 'Bom estado' },
  { value: 'Usado / Vintage', label: 'Usado / Vintage' },
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
    setCondition(category === 'pokemon' ? 'Near Mint (NM)' : category === 'lego' ? 'Selado de Fábrica (MISB)' : 'Novo / Mint');
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
      setCondition('Selado de Fábrica (MISB)');
    } else {
      setCondition('Novo / Mint');
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

  const handleSelectLegoSet = (set: LegoSetResult) => {
    setSelectedLego(set);
    setName(`${set.name} (#${set.setNumber})`);
    setIdentifier(set.setNumber);
    setImageUrl(set.imageUrl);
    if (set.rrpEur) {
      setCurrentPrice(String(set.rrpEur));
      if (!purchasePrice) {
        setPurchasePrice(String(set.rrpEur));
      }
    }
    setMetadata({
      theme: set.theme,
      pieces: set.pieces,
      year: set.year,
      rrpEur: set.rrpEur,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast('Indica o nome do ativo', 'error');
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
          toast('Ativo adicionado com sucesso', 'success');
          resetForm();
          onClose();
        },
        onError: (err) => {
          toast(err instanceof Error ? err.message : 'Falha ao guardar ativo', 'error');
        },
      },
    );
  };

  return (
    <BottomSheet
      open={open}
      title="Adicionar Ativo Alternativo"
      subtitle="Cartas Pokémon, LEGO, relógios, moedas ou outros colecionáveis"
      onClose={() => {
        resetForm();
        onClose();
      }}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Category Selector */}
        <Labelled label="Categoria">
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {(Object.keys(CATEGORY_LABELS) as CollectibleCategory[]).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategoryChange(cat)}
                className={`tap flex flex-col items-center justify-center gap-1 rounded-[var(--radius-field)] p-2 text-center text-xs font-semibold transition ${
                  category === cat
                    ? 'neu-raised border border-[var(--accent)] bg-[var(--surface-raised)] text-[var(--accent)]'
                    : 'neu-sunken text-[var(--text-muted)] hover:text-[var(--text-strong)]'
                }`}
              >
                <span className="text-base">{CATEGORY_ICONS[cat]}</span>
                <span className="truncate">{CATEGORY_LABELS[cat]}</span>
              </button>
            ))}
          </div>
        </Labelled>

        {/* Pokemon Flow */}
        {category === 'pokemon' && (
          <div className="flex flex-col gap-3 rounded-[var(--radius-field)] neu-sunken p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                {selectedPokemon ? 'Carta Selecionada' : 'Pesquisar Catálogo TCGdex'}
              </span>
              {selectedPokemon && (
                <button
                  type="button"
                  onClick={() => setSelectedPokemon(null)}
                  className="tap text-xs font-semibold text-[var(--accent)] hover:underline"
                >
                  Trocar carta
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

        {/* LEGO Set Flow */}
        {category === 'lego' && (
          <div className="flex flex-col gap-3 rounded-[var(--radius-field)] neu-sunken p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                {selectedLego ? 'Set LEGO Selecionado' : 'Pesquisar Catálogo LEGO'}
              </span>
              {selectedLego && (
                <button
                  type="button"
                  onClick={() => setSelectedLego(null)}
                  className="tap text-xs font-semibold text-[var(--accent)] hover:underline"
                >
                  Trocar set
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
                    <span className="text-xs text-[var(--text-muted)]">
                      {selectedLego.theme} {selectedLego.year ? `(${selectedLego.year})` : ''}
                    </span>
                  </div>
                  <p className="truncate text-sm font-bold text-[var(--text-strong)]">
                    {selectedLego.name}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {selectedLego.pieces ? `${selectedLego.pieces.toLocaleString()} peças` : ''}
                    {selectedLego.rrpEur ? ` · RRP Oficial: €${selectedLego.rrpEur.toFixed(2)}` : ''}
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
            <Labelled label="Nome do Ativo">
              <TextInput
                value={name}
                placeholder={
                  category === 'pokemon'
                    ? 'Ex: Charizard ex #199/165'
                    : category === 'lego'
                      ? 'Ex: 10316 - O Senhor dos Anéis: Rivendell'
                      : 'Ex: Omega Speedmaster Professional'
                }
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Labelled>
          </div>

          <Labelled label="Identificador / Ref (Opcional)">
            <TextInput
              value={identifier}
              placeholder={
                category === 'pokemon'
                  ? 'Ex: swsh4-25'
                  : category === 'lego'
                    ? 'Ex: 75192'
                    : 'Ex: 310.30.42.50.01.002'
              }
              onChange={(e) => {
                const val = e.target.value;
                setIdentifier(val);
                if (category === 'lego' && !imageUrl && /^\d{4,6}$/.test(val.trim())) {
                  setImageUrl(getLegoImageUrl(val));
                }
              }}
            />
          </Labelled>

          <Labelled label="Condição / Estado">
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
          <Labelled label="Qtd">
            <TextInput
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </Labelled>

          <Labelled label="Preço Compra (€)">
            <MoneyInput
              placeholder="0.00"
              value={purchasePrice}
              onChange={setPurchasePrice}
            />
          </Labelled>

          <Labelled label="Cotação Atual (€)">
            <MoneyInput
              placeholder="0.00"
              value={currentPrice}
              onChange={setCurrentPrice}
            />
          </Labelled>
        </div>

        {/* Date and Image */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Labelled label="Data de Aquisição (Opcional)">
            <TextInput
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
            />
          </Labelled>

          <Labelled label="URL da Imagem (Opcional)">
            <TextInput
              type="url"
              value={imageUrl}
              placeholder="https://..."
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </Labelled>
        </div>

        {/* Notes */}
        <Labelled label="Notas / Detalhes (Opcional)">
          <TextInput
            value={notes}
            placeholder="Ex: Comprado na Cardmarket, guardado em sleeve + toploader..."
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
            {add.isPending ? 'A guardar...' : 'Guardar no Portfólio'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              resetForm();
              onClose();
            }}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
};
