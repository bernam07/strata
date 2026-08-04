import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { money } from '@/core/money/money';
import type { Position } from '@/core/positions/derivePositions';
import type { InstrumentMeta } from '@/features/positions/api/usePositions';
import { Movers } from './Movers';

const position = (
  id: string,
  unrealizedPct: number | null,
  dayChangePct: number | null,
): Position => ({
  instrumentId: id,
  quantity: money('1'),
  averageCost: money('10'),
  costBasis: money('10'),
  marketValue: money('11'),
  unrealized: unrealizedPct === null ? null : money(unrealizedPct * 10),
  unrealizedPct,
  dayChange: dayChangePct === null ? null : money(dayChangePct * 10),
  dayChangePct,
});

const instruments = new Map<string, InstrumentMeta>([
  ['a', { id: 'a', ticker: 'AAA', isin: null, name: 'Alpha', currency: 'EUR' }],
  ['b', { id: 'b', ticker: 'BBB', isin: null, name: 'Bravo', currency: 'EUR' }],
]);

const renderMovers = (positions: Position[]) =>
  render(
    <MemoryRouter>
      <Movers positions={positions} instruments={instruments} />
    </MemoryRouter>,
  );

describe('Movers', () => {
  it('labels by day change when day data is present', () => {
    renderMovers([position('a', 0.2, 0.05), position('b', -0.1, -0.03)]);
    expect(screen.getByText('Up today')).toBeInTheDocument();
    expect(screen.getByText('Down today')).toBeInTheDocument();
  });

  it('falls back to all-time leaders/laggards without day data', () => {
    renderMovers([position('a', 0.2, null), position('b', -0.1, null)]);
    expect(screen.getByText('Leaders')).toBeInTheDocument();
    expect(screen.getByText('Laggards')).toBeInTheDocument();
  });

  it('renders nothing with fewer than two ranked positions', () => {
    const { container } = renderMovers([position('a', null, null)]);
    expect(container).toBeEmptyDOMElement();
  });
});
