import type { Transaction } from '../types';

export type Label = (id: string | null) => string;

const header = [
  'Date',
  'Kind',
  'Amount EUR',
  'Account',
  'Category',
  'Instrument',
  'Quantity',
  'Note',
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

export const transactionsToCsv = (
  transactions: readonly Transaction[],
  accountName: Label,
  instrumentName: Label,
  categoryName?: Label,
): string => {
  const rows = [...transactions]
    .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))
    .map((transaction) =>
      [
        isoDate(transaction.occurredAt),
        transaction.kind,
        Number(transaction.amount).toFixed(2),
        accountName(transaction.accountId),
        categoryName ? categoryName(transaction.id) : '',
        transaction.instrumentId ? instrumentName(transaction.instrumentId) : '',
        transaction.quantity ?? '',
        transaction.note ?? '',
      ]
        .map((cell) => escape(String(cell)))
        .join(','),
    );
  return [header.join(','), ...rows].join('\n');
};
