import { describe, expect, it } from 'vitest';
import { money } from '../money/money';
import { budgetLines, totalBudget } from './budget';

const spend = (map: Record<string, string>) => (categoryId: string) =>
  money(map[categoryId] ?? '0');

describe('budgetLines', () => {
  it('computes remaining, ratio and over flag', () => {
    const lines = budgetLines(
      [
        { categoryId: 'food', limit: '400' },
        { categoryId: 'rent', limit: '900' },
      ],
      spend({ food: '450', rent: '900' }),
    );

    const food = lines.find((line) => line.categoryId === 'food')!;
    expect(food.remaining.toString()).toBe('-50');
    expect(food.ratio).toBeCloseTo(1.125);
    expect(food.over).toBe(true);

    const rent = lines.find((line) => line.categoryId === 'rent')!;
    expect(rent.remaining.toString()).toBe('0');
    expect(rent.over).toBe(false);
  });

  it('sorts by ratio descending', () => {
    const lines = budgetLines(
      [
        { categoryId: 'a', limit: '100' },
        { categoryId: 'b', limit: '100' },
      ],
      spend({ a: '10', b: '90' }),
    );
    expect(lines.map((line) => line.categoryId)).toEqual(['b', 'a']);
  });

  it('treats a zero limit as ratio zero without dividing', () => {
    const [line] = budgetLines([{ categoryId: 'x', limit: '0' }], spend({ x: '5' }));
    expect(line!.ratio).toBe(0);
    expect(line!.over).toBe(true);
  });

  it('totals limits and spend across lines', () => {
    const lines = budgetLines(
      [
        { categoryId: 'a', limit: '100' },
        { categoryId: 'b', limit: '200' },
      ],
      spend({ a: '40', b: '260' }),
    );
    const totals = totalBudget(lines);
    expect(totals.limit.toString()).toBe('300');
    expect(totals.spent.toString()).toBe('300');
  });
});
