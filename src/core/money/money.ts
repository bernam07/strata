import Decimal from 'decimal.js';

Decimal.set({ precision: 34, rounding: Decimal.ROUND_HALF_EVEN });

export type Money = Decimal;

export const zero = (): Money => new Decimal(0);

export const money = (value: Decimal.Value): Money => new Decimal(value);

export const add = (a: Money, b: Money): Money => a.plus(b);

export const sum = (values: readonly Money[]): Money =>
  values.reduce((total, value) => total.plus(value), zero());

export const negate = (value: Money): Money => value.negated();

export const isNegative = (value: Money): boolean => value.isNegative();

export const isPositive = (value: Money): boolean => value.greaterThan(0);

export const toNumber = (value: Money): number => value.toNumber();

export const formatEur = (
  value: Money,
  locale = 'pt-PT',
): string =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
  }).format(value.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN).toNumber());
