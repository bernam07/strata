import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Providers } from './app/providers';
import { AppRouter } from './app/router';
import './index.css';

// Prune persisted keys from features that no longer exist, so stale settings
// don't linger in a returning user's browser.
try {
  ['dashboard-period'].forEach((key) => localStorage.removeItem(key));
} catch {
  // storage unavailable — nothing to prune
}

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <Providers>
      <AppRouter />
    </Providers>
  </StrictMode>,
);
