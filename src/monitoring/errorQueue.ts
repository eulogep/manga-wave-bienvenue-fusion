// Tiny always-loaded error capture. The Sentry SDK is loaded after the first render
// (see main.tsx); errors raised before that are queued here and replayed into it.

export type ReportedError = { error: unknown; componentStack?: string };
type Sink = (report: ReportedError) => void;

const MAX_QUEUED = 50;
const queue: ReportedError[] = [];
let sink: Sink | null = null;

export function reportError(error: unknown, componentStack?: string) {
  const report = { error, componentStack };
  if (sink) sink(report);
  else if (queue.length < MAX_QUEUED) queue.push(report);
}

const onError = (event: ErrorEvent) => reportError(event.error ?? event.message);
const onRejection = (event: PromiseRejectionEvent) => reportError(event.reason);

export function installEarlyErrorCapture() {
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
}

/** Hands queued errors to the SDK; from then on the SDK's own global handlers take over. */
export function attachErrorSink(next: Sink) {
  window.removeEventListener('error', onError);
  window.removeEventListener('unhandledrejection', onRejection);
  sink = next;
  for (const report of queue.splice(0)) next(report);
}
