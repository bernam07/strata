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

const escape = (value: string): string =>
  /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

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
