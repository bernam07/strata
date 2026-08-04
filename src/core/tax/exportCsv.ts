import type { Money } from '../money/money';
import type { Disposal } from './fifo';

export type InstrumentName = (instrumentId: string) => string;

const header = [
  'Instrument',
  'Quantity',
  'Acquired',
  'Disposed',
  'Cost EUR',
  'Proceeds EUR',
  'Gain EUR',
];

const isoDate = (iso: string): string => iso.slice(0, 10);

const risky = (value: string): boolean =>
  /^[=@\t\r]/.test(value) || (/^[+-]/.test(value) && !/^[+-][\d.]/.test(value));

const escape = (value: string): string => {
  const guarded = risky(value) ? `'${value}` : value;
  return /[",\n]/.test(guarded)
    ? `"${guarded.replace(/"/g, '""')}"`
    : guarded;
};

export const disposalsToCsv = (
  disposals: readonly Disposal[],
  nameOf: InstrumentName,
): string => {
  const rows = disposals.map((disposal) =>
    [
      nameOf(disposal.instrumentId),
      disposal.quantity.toString(),
      isoDate(disposal.acquiredAt),
      isoDate(disposal.disposedAt),
      disposal.cost.toFixed(2),
      disposal.proceeds.toFixed(2),
      disposal.gain.toFixed(2),
    ]
      .map((cell) => escape(cell))
      .join(','),
  );
  return [header.join(','), ...rows].join('\n');
};

export interface ForeignIncomeRow {
  country: string;
  gain: Money;
  dividends: Money;
}

const foreignHeader = ['Country', 'Realized gain EUR', 'Dividends EUR'];

export const foreignIncomeToCsv = (
  rows: readonly ForeignIncomeRow[],
): string => {
  const lines = rows.map((row) =>
    [row.country, row.gain.toFixed(2), row.dividends.toFixed(2)]
      .map((cell) => escape(cell))
      .join(','),
  );
  return [foreignHeader.join(','), ...lines].join('\n');
};
