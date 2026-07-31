import type { ReactNode } from 'react';
import { Surface } from './Surface';

interface CardProps {
  className?: string;
  children: ReactNode;
}

export const Card = ({ className = '', children }: CardProps) => (
  <Surface elevation="raised" className={`p-6 ${className}`}>
    {children}
  </Surface>
);
