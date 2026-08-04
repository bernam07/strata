export type AlertDirection = 'above' | 'below';

export const alertMet = (
  direction: AlertDirection,
  target: number,
  price: number,
): boolean => (direction === 'above' ? price >= target : price <= target);
