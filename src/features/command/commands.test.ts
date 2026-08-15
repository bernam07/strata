import { describe, expect, it } from 'vitest';
import { filterCommands } from './commands';

const items = [
  { label: 'Overview', keywords: ['home', 'dashboard'] },
  { label: 'Portfolio', keywords: ['positions', 'holdings'] },
  { label: 'Refresh prices', keywords: ['sync', 'update'] },
];

describe('filterCommands', () => {
  it('returns everything for an empty query', () => {
    expect(filterCommands(items, '   ')).toHaveLength(3);
  });

  it('matches on the label case-insensitively', () => {
    expect(filterCommands(items, 'PORT').map((i) => i.label)).toEqual(['Portfolio']);
  });

  it('matches on keywords', () => {
    expect(filterCommands(items, 'dashboard').map((i) => i.label)).toEqual([
      'Overview',
    ]);
  });

  it('requires every term to match (AND)', () => {
    expect(filterCommands(items, 'refresh sync').map((i) => i.label)).toEqual([
      'Refresh prices',
    ]);
    expect(filterCommands(items, 'refresh nope')).toHaveLength(0);
  });
});
