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
    setConfirmDelete(false);
  }, [collectible]);

  if (!collectible) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast('Indica o nome do ativo', 'error');
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
      },
      {
        onSuccess: () => {
          toast('Ativo atualizado', 'success');
          onClose();
        },
        onError: (err) => {
          toast(err instanceof Error ? err.message : 'Falha ao atualizar ativo', 'error');
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
        toast('Ativo removido do portfólio', 'success');
        onClose();
      },
      onError: (err) => {
        toast(err instanceof Error ? err.message : 'Falha ao remover ativo', 'error');
      },
    });
  };

  return (
    <BottomSheet
      open={Boolean(collectible)}
      title="Editar Ativo"
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
              className="max-h-40 rounded-md object-contain shadow-sm"
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Labelled label="Categoria">
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

          <Labelled label="Condição / Estado">
            <Select value={condition} onChange={(e) => setCondition(e.target.value)}>
              <option value="">Não especificado</option>
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
            <Labelled label="Nome do Ativo">
              <TextInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Labelled>
          </div>

          <Labelled label="Identificador / Ref">
            <TextInput
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </Labelled>

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
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Labelled label="Preço Compra (€)">
            <MoneyInput
              value={purchasePrice}
              onChange={setPurchasePrice}
            />
          </Labelled>

          <Labelled label="Cotação Atual (€)">
            <MoneyInput
              value={currentPrice}
              onChange={setCurrentPrice}
            />
          </Labelled>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Labelled label="Data de Aquisição">
            <TextInput
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
            />
          </Labelled>

          <Labelled label="URL da Imagem">
            <TextInput
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
          </Labelled>
        </div>

        <Labelled label="Notas">
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
            {confirmDelete ? 'Confirmar remoção?' : 'Remover do portfólio'}
          </button>

          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={update.isPending || !name.trim()}>
              {update.isPending ? 'A guardar...' : 'Guardar'}
            </Button>
          </div>
        </div>
      </form>
    </BottomSheet>
  );
};
