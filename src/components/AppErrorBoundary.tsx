import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '@/monitoring/errorQueue';

type State = { failed: boolean };

/** Last-resort boundary: reports render errors (React 18) and offers a reload. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, info.componentStack ?? undefined);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--mw-background)] px-6 text-center text-[var(--mw-text-primary)]">
        <h1 className="text-2xl font-bold">Une erreur inattendue est survenue</h1>
        <p className="max-w-md text-sm text-[var(--mw-text-secondary)]">Elle a été signalée automatiquement. Recharge la page pour reprendre ta lecture.</p>
        <button type="button" onClick={() => window.location.reload()} className="min-h-11 rounded-full bg-[var(--mw-accent-coral)] px-6 font-semibold text-[var(--mw-ink-on-coral)]">Recharger</button>
      </main>
    );
  }
}
