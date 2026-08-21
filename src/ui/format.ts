// Shared number/date formatters so the whole app formats money, percentages
// and dates identically from one place, instead of re-declaring
// `new Intl.NumberFormat(...)` in every component.

export const eur0 = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

export const eur2 = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
});

// Percent with exactly one decimal (e.g. +2.4%).
export const pct1 = new Intl.NumberFormat('en-GB', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

// Percent with up to one decimal (trims a trailing .0).
export const pctMax1 = new Intl.NumberFormat('en-GB', {
  style: 'percent',
  maximumFractionDigits: 1,
});

// Percent rounded to a whole number.
export const pct0 = new Intl.NumberFormat('en-GB', {
  style: 'percent',
  maximumFractionDigits: 0,
});

export const qty4 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 4 });
export const qty8 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 8 });

export const dayMonth = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
});

export const dayMonthYear = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});
