import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './app/ErrorBoundary';
import { Providers } from './app/providers';
import { AppRouter } from './app/router';
import './index.css';
import { initPlatform, isNative } from './app/platform';

initPlatform();

// Prune persisted keys from features that no longer exist, so stale settings
// don't linger in a returning user's browser.
try {
  ['dashboard-period'].forEach((key) => localStorage.removeItem(key));
} catch {
  // storage unavailable — nothing to prune
}

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

if (import.meta.env.PROD && !isNative && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
}

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <Providers>
        <AppRouter />
      </Providers>
    </ErrorBoundary>
  </StrictMode>,
);
