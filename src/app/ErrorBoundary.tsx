import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="grid min-h-screen place-items-center bg-[var(--bg)] px-6 text-center text-[var(--text-strong)]">
        <div className="flex max-w-sm flex-col items-center gap-4">
          <h1 className="text-xl font-bold">Something went wrong</h1>
          <p className="text-sm text-[var(--text-muted)]">
            The app could not display this page. Your saved data is still on the server.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="tap rounded-[var(--radius-field)] bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-ink)]"
          >
            Reload app
          </button>
        </div>
      </main>
    );
  }
}