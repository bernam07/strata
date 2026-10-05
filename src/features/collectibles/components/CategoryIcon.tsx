import type { ReactNode } from 'react';
import type { CollectibleCategory } from '../api/useCollectibles';

const svg = (children: ReactNode, size = 16) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="shrink-0"
  >
    {children}
  </svg>
);

export const CategoryIcon = ({
  category,
  size = 16,
}: {
  category: CollectibleCategory;
  size?: number;
}) => {
  switch (category) {
    case 'pokemon':
      // Trading card with star emblem
      return svg(
        <>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M12 8l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" />
        </>,
        size,
      );

    case 'lego':
      // 2x2 LEGO brick with studs
      return svg(
        <>
          <rect x="4" y="8" width="16" height="12" rx="1.5" />
          <path d="M8 8V5M16 8V5" />
        </>,
        size,
      );

    case 'watches':
      // Wristwatch
      return svg(
        <>
          <circle cx="12" cy="12" r="6" />
          <path d="M12 9v3l2 1" />
          <path d="M9 6V3h6v3M9 18v3h6v-3" />
        </>,
        size,
      );

    case 'coins_bullion':
      // Stacked coins
      return svg(
        <>
          <ellipse cx="12" cy="7" rx="7" ry="3" />
          <path d="M5 7v5c0 1.66 3.13 3 7 3s7-1.34 7-3V7" />
          <path d="M5 12v5c0 1.66 3.13 3 7 3s7-1.34 7-3v-5" />
        </>,
        size,
      );

    case 'wine':
      // Wine bottle & glass
      return svg(
        <>
          <path d="M8 22h8M12 15v7M12 15a5 5 0 0 0 5-5V3H7v7a5 5 0 0 0 5 5z" />
        </>,
        size,
      );

    case 'art':
      // Picture frame / palette
      return svg(
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </>,
        size,
      );

    case 'other':
    default:
      // Diamond / Gem
      return svg(
        <>
          <path d="M6 3h12l4 6-10 12L2 9z" />
          <path d="M2 9h20" />
        </>,
        size,
      );
  }
};
