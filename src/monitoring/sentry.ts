import * as Sentry from '@sentry/react';
import { routeNameFor } from '@/domain/routePatterns';
import { attachErrorSink } from './errorQueue';

// Loaded lazily by main.tsx after the first render, so the SDK (~65 kB gzip) stays off
// the critical path. Errors raised before this runs are replayed from errorQueue.
export function initSentry(dsn: string) {
  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
    integrations: [
      Sentry.browserTracingIntegration({
        // Name pageload/navigation spans after the route (/manga/:id), not the URL.
        beforeStartSpan: (context) => ({
          ...context,
          name: routeNameFor(window.location.pathname),
          attributes: { ...context.attributes, 'sentry.source': 'route' },
        }),
      }),
    ],
    // Every trace locally so verification is possible; 10% in production.
    tracesSampleRate: import.meta.env.DEV ? 1.0 : 0.1,
    // Trace headers only on same-origin calls: Supabase and MangaDex are cross-origin
    // and must not receive extra headers (they would trigger CORS preflights).
    tracePropagationTargets: [/^\//],
    // Reading activity is private: no IP-derived user, cookies or HTTP bodies.
    dataCollection: { userInfo: false, cookies: false, httpBodies: [] },
    replaysSessionSampleRate: import.meta.env.DEV ? 1.0 : 0.1,
    replaysOnErrorSampleRate: 1.0,
  });

  attachErrorSink(({ error, componentStack }) => {
    Sentry.captureException(error, componentStack ? { contexts: { react: { componentStack } } } : undefined);
  });

  // Session Replay comes from Sentry's CDN on demand instead of being bundled.
  void Sentry.lazyLoadIntegration('replayIntegration')
    .then((replayIntegration) => Sentry.addIntegration(replayIntegration({ maskAllText: true, blockAllMedia: false })))
    .catch(() => undefined);
}
