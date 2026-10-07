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
    default:
      // Wristwatch
      return svg(
        <>
          <circle cx="12" cy="12" r="6" />
          <path d="M12 9v3l2 1" />
          <path d="M9 6V3h6v3M9 18v3h6v-3" />
        </>,
        size,
      );
  }
};
