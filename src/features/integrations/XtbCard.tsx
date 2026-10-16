import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { formatEur, money } from '@/core/money/money';
import { InstitutionLogo } from '@/features/accounts/components/InstitutionLogo';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Labelled, TextInput } from '@/ui/Field';
import { Surface } from '@/ui/Surface';
import { toast } from '@/ui/toast';
import {
  useImportXtbReport,
  useResetXtbData,
  useUpsertXtbHolding,
  useXtbState,
} from './api/useXtb';

const relativeTime = (date: string): string => {
  const minutes = Math.round((new Date(date).getTime() - Date.now()) / 60000);
  if (Math.abs(minutes) < 1) return 'just now';
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, 'hour');
  return formatter.format(Math.round(hours / 24), 'day');
};

interface XtbCardProps {
  accountId?: string;
  compact?: boolean;
}

export const XtbCard = ({ accountId, compact = false }: XtbCardProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { data: xtbState } = useXtbState();
  const importReport = useImportXtbReport();
  const upsertHolding = useUpsertXtbHolding();
  const resetXtb = useResetXtbData();

  const [showGuide, setShowGuide] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [avgPrice, setAvgPrice] = useState('');

  const hasData =
    xtbState !== null &&
    xtbState !== undefined &&
    (xtbState.openPositionsCount > 0 ||
      xtbState.cashOperationsCount > 0 ||
      xtbState.total > 0);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const csvText = await file.text();
      const result = await importReport.mutateAsync({
        csvText,
        accountId,
      });
      toast(
        `XTB report imported · ${result.openPositionsCount} position${
          result.openPositionsCount === 1 ? '' : 's'
        }, ${result.insertedTransactions} new cash operation${
          result.insertedTransactions === 1 ? '' : 's'
        }`,
        'success',
      );
    } catch (err) {
      toast(
        err instanceof Error ? err.message : 'Could not import XTB CSV report',
        'error',
      );
    }
  };

  const handleManualSubmit = (event: FormEvent) => {
    event.preventDefault();
    const cleanSymbol = symbol.trim().toUpperCase();
    const parsedQty = Number(quantity.replace(',', '.'));
    const parsedAvg = Number(avgPrice.replace(',', '.'));

    if (!cleanSymbol || !Number.isFinite(parsedQty) || parsedQty <= 0) {
      toast('Enter a valid ticker and positive quantity', 'error');
      return;
    }
    if (!Number.isFinite(parsedAvg) || parsedAvg <= 0) {
      toast('Enter a valid average buy price in EUR', 'error');
      return;
    }

    const fallbackName = cleanSymbol.split('.')[0] || cleanSymbol;
    upsertHolding.mutate(
      {
        accountId,
        symbol: cleanSymbol,
        name: name.trim() || fallbackName,
        quantity: parsedQty,
        averagePriceEur: parsedAvg,
      },
      {
        onSuccess: () => {
          toast(`Position ${cleanSymbol} saved with live Yahoo Finance pricing`, 'success');
          setSymbol('');
          setName('');
          setQuantity('');
          setAvgPrice('');
          setShowManualForm(false);
        },
        onError: (err) => {
          toast(
            err instanceof Error ? err.message : 'Failed to save position',
            'error',
          );
        },
      },
    );
  };

  return (
    <Card className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <InstitutionLogo institutionId="xtb" />
          <div>
            <p className="font-semibold text-[var(--text-strong)]">XTB</p>
            {hasData && xtbState ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--positive)_16%,transparent)] px-2.5 py-0.5 text-xs font-semibold text-[var(--positive)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--positive)]" />
                  Active
                  {xtbState.accountNumber ? ` · #${xtbState.accountNumber}` : ''}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  Updated {relativeTime(xtbState.importedAt)}
                </span>
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">
                Import xStation CSV reports or manage holdings with live Yahoo Finance quotes
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            size={compact ? 'sm' : 'md'}
            disabled={importReport.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            {importReport.isPending ? 'Importing…' : 'Import CSV report'}
          </Button>
          <Button
            size={compact ? 'sm' : 'md'}
            variant="ghost"
            onClick={() => setShowManualForm((prev) => !prev)}
          >
            {showManualForm ? 'Close form' : 'Add / edit position'}
          </Button>
        </div>
      </div>

      {hasData && xtbState && (
        <Surface
          elevation="sunken"
          className="grid grid-cols-2 gap-2.5 p-3.5 sm:grid-cols-4"
        >
          <div className="rounded-lg bg-[var(--surface-raised)] px-3 py-2">
            <p className="text-[11px] font-medium text-[var(--text-muted)]">
              Open positions
            </p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-[var(--text-strong)]">
              {xtbState.openPositionsCount}
            </p>
          </div>
          <div className="rounded-lg bg-[var(--surface-raised)] px-3 py-2">
            <p className="text-[11px] font-medium text-[var(--text-muted)]">
              Invested cost
            </p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-[var(--text-strong)]">
              {formatEur(money(xtbState.invested))}
            </p>
          </div>
          <div className="rounded-lg bg-[var(--surface-raised)] px-3 py-2">
            <p className="text-[11px] font-medium text-[var(--text-muted)]">
              Free cash
            </p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-[var(--text-strong)]">
              {formatEur(money(xtbState.freeCash))}
            </p>
          </div>
          <div className="rounded-lg bg-[var(--surface-raised)] px-3 py-2">
            <p className="text-[11px] font-medium text-[var(--text-muted)]">
              Account total
            </p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-[var(--text-strong)]">
              {formatEur(money(xtbState.total))}
            </p>
          </div>
        </Surface>
      )}

      {showManualForm && (
        <form
          onSubmit={handleManualSubmit}
          className="flex flex-col gap-3.5 rounded-xl border border-[var(--line)] bg-[var(--surface-sunken)] p-4"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-2)]">
              Add or update XTB holding
            </p>
            <span className="text-[11px] text-[var(--text-muted)]">
              Auto-synced with Yahoo Finance
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Labelled label="Ticker / XTB Symbol (e.g. NKE.US, VUAA.DE)">
              <TextInput
                placeholder="NKE.US"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                required
              />
            </Labelled>
            <Labelled label="Company / ETF Name (Optional)">
              <TextInput
                placeholder="Nike"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Labelled>
            <Labelled label="Total Shares">
              <TextInput
                type="number"
                step="any"
                min="0.00000001"
                placeholder="1.4007"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </Labelled>
            <Labelled label="Average Buy Price (EUR)">
              <TextInput
                type="number"
                step="any"
                min="0.0001"
                placeholder="33.26"
                value={avgPrice}
                onChange={(e) => setAvgPrice(e.target.value)}
                required
              />
            </Labelled>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button
              type="submit"
              size="sm"
              disabled={upsertHolding.isPending}
            >
              {upsertHolding.isPending ? 'Saving…' : 'Save position'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowManualForm(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
        <button
          type="button"
          onClick={() => setShowGuide((prev) => !prev)}
          className="tap text-xs font-semibold text-[var(--accent)] hover:underline"
        >
          {showGuide
            ? 'Hide xStation export guide'
            : 'How to export your CSV report from XTB?'}
        </button>

        {hasData && !confirmReset && (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="tap text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--negative)]"
          >
            Reset XTB data
          </button>
        )}

        {confirmReset && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)]">
              Clear imported XTB positions and cash operations?
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="text-[var(--negative)]"
              disabled={resetXtb.isPending}
              onClick={() => {
                resetXtb.mutate(undefined, {
                  onSuccess: () => {
                    setConfirmReset(false);
                    toast('XTB data cleared', 'info');
                  },
                });
              }}
            >
              {resetXtb.isPending ? 'Clearing…' : 'Confirm'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmReset(false)}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>

      {showGuide && (
        <Surface
          elevation="sunken"
          className="flex flex-col gap-2 p-3.5 text-xs text-[var(--text-muted)]"
        >
          <p className="font-semibold text-[var(--text-2)]">
            How to export your XTB report (xStation 5 / Mobile):
          </p>
          <ol className="list-decimal space-y-1 pl-4">
            <li>
              Open <strong className="text-[var(--text-2)]">xStation 5</strong>{' '}
              and go to{' '}
              <strong className="text-[var(--text-2)]">
                History → Export
              </strong>{' '}
              (or Account History in the mobile app).
            </li>
            <li>
              Select the desired period (e.g.{' '}
              <span className="text-[var(--text-2)]">
                Last 30 days, Current year, or Custom range
              </span>
              ) and enable{' '}
              <strong className="text-[var(--text-2)]">
                Closed Positions, Cash Operations, and Open Positions
              </strong>
              .
            </li>
            <li>
              Choose <strong className="text-[var(--text-2)]">CSV</strong>{' '}
              format and upload the file here. Duplicate cash operations are
              skipped automatically, and open positions are enriched with live
              Yahoo Finance quotes and daily change tracking.
            </li>
          </ol>
        </Surface>
      )}
    </Card>
  );
};
