import type { ElementType, ReactNode } from 'react';

type Elevation = 'raised' | 'sunken' | 'flat';

const elevationClass: Record<Elevation, string> = {
  raised: 'neu-raised',
  sunken: 'neu-sunken',
  flat: 'neu-flat',
};

interface SurfaceProps {
  elevation?: Elevation;
  as?: ElementType;
  className?: string;
  children?: ReactNode;
}

export const Surface = ({
  elevation = 'raised',
  as: Component = 'div',
  className = '',
  children,
}: SurfaceProps) => (
  <Component
    className={`rounded-[var(--radius-card)] ${elevationClass[elevation]} ${className}`}
  >
    {children}
  </Component>
);
