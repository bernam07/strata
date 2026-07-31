import Decimal from 'decimal.js';

Decimal.set({ precision: 34, rounding: Decimal.ROUND_HALF_EVEN });

export type Money = Decimal;

export const zero = (): Money => new Decimal(0);

export const money = (value: Decimal.Value): Money => new Decimal(value);

export const add = (a: Money, b: Money): Money => a.plus(b);

export const subtract = (a: Money, b: Money): Money => a.minus(b);

export const mul = (a: Money, b: Money): Money => a.times(b);

export const div = (a: Money, b: Money): Money => a.dividedBy(b);

export const isZero = (value: Money): boolean => value.isZero();

export const ratio = (part: Money, whole: Money): number =>
  whole.isZero() ? 0 : part.dividedBy(whole).toNumber();

export const sum = (values: readonly Money[]): Money =>
  values.reduce((total, value) => total.plus(value), zero());

export const negate = (value: Money): Money => value.negated();

export const isNegative = (value: Money): boolean => value.isNegative();

export const isPositive = (value: Money): boolean => value.greaterThan(0);

export const toNumber = (value: Money): number => value.toNumber();

export const formatEur = (
  value: Money,
  locale = 'en-GB',
): string =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
  }).format(value.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN).toNumber());
