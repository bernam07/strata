import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NetWorthChart } from './NetWorthChart';

describe('NetWorthChart', () => {
  it('draws a line path and axis labels for a series', () => {
    const { container } = render(
      <NetWorthChart
        series={[
          { date: '2026-01-01', value: 1000 },
          { date: '2026-02-01', value: 1500 },
          { date: '2026-03-01', value: 1200 },
        ]}
      />,
    );
    const paths = container.querySelectorAll('path');
    // one filled area + one stroked line
    expect(paths.length).toBeGreaterThanOrEqual(2);
    expect(paths[1]!.getAttribute('d')).toMatch(/^M/);
  });

  it('shows an empty message with fewer than two points', () => {
    render(<NetWorthChart series={[{ date: '2026-01-01', value: 1000 }]} />);
    expect(screen.getByText(/Not enough data/i)).toBeInTheDocument();
  });
});
