import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ROUTE_PATTERNS, routeNameFor } from '../src/domain/routePatterns.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('route patterns stay in sync with the <Route path> declarations of App.tsx', () => {
  const declared = [...read('src/App.tsx').matchAll(/<Route path="([^"]+)"/g)].map((match) => match[1]).filter((path) => path !== '*');
  assert.deepEqual([...ROUTE_PATTERNS].sort(), declared.sort());
});

test('transactions are named after the route pattern, not the concrete URL', () => {
  assert.equal(routeNameFor('/manga/573'), '/manga/:id');
  assert.equal(routeNameFor('/read/mangadex/abc/def'), '/read/:source/:mangaId/:chapterId');
  assert.equal(routeNameFor('/collections/isekai'), '/collections/:slug');
  assert.equal(routeNameFor('/collections'), '/collections');
  assert.equal(routeNameFor('/'), '/');
  assert.equal(routeNameFor('/search?q=naruto#top'), '/search');
  assert.equal(routeNameFor('/manga/573/extra'), '<unmatched>');
  assert.equal(routeNameFor('/inexistante'), '<unmatched>');
});

test('errors raised before the SDK loads are queued, capped, replayed once, then sent directly', async () => {
  const listeners = new Map<string, EventListener>();
  (globalThis as unknown as { window: unknown }).window = {
    addEventListener: (type: string, listener: EventListener) => listeners.set(type, listener),
    removeEventListener: (type: string, listener: EventListener) => { if (listeners.get(type) === listener) listeners.delete(type); },
  };
  const { attachErrorSink, installEarlyErrorCapture, reportError } = await import('../src/monitoring/errorQueue.ts');
  installEarlyErrorCapture();
  assert.deepEqual([...listeners.keys()].sort(), ['error', 'unhandledrejection']);

  listeners.get('error')!({ error: new Error('boot') } as unknown as Event);
  listeners.get('unhandledrejection')!({ reason: 'rejected' } as unknown as Event);
  reportError(new Error('render'), 'in <Page>');
  for (let index = 0; index < 60; index += 1) reportError(`flood ${index}`);

  const received: unknown[] = [];
  attachErrorSink((report) => received.push(report));
  assert.equal(received.length, 50, 'queue is capped');
  assert.equal((received[0] as { error: Error }).error.message, 'boot');
  assert.equal((received[1] as { error: string }).error, 'rejected');
  assert.equal((received[2] as { componentStack: string }).componentStack, 'in <Page>');
  assert.equal(listeners.size, 0, 'early listeners are removed once the SDK takes over');

  reportError('after');
  assert.equal((received.at(-1) as { error: string }).error, 'after');
});

test('the SDK is loaded lazily after first render and never imported statically', () => {
  const main = read('src/main.tsx');
  assert.match(main, /installEarlyErrorCapture\(\);/);
  assert.match(main, /import\('\.\/monitoring\/sentry'\)/);
  for (const file of ['src/main.tsx', 'src/App.tsx', 'src/components/AppErrorBoundary.tsx', 'src/monitoring/errorQueue.ts']) {
    assert.doesNotMatch(read(file), /from ['"]@sentry\//, `${file} must not import the SDK statically`);
  }
});

test('Sentry is configured for privacy and sane production sampling', () => {
  const sentry = read('src/monitoring/sentry.ts');
  assert.match(sentry, /dataCollection: \{ userInfo: false, cookies: false, httpBodies: \[\] \}/);
  assert.match(sentry, /tracesSampleRate: import\.meta\.env\.DEV \? 1\.0 : 0\.1/);
  assert.match(sentry, /tracePropagationTargets: \[\/\^\\\/\/\]/);
  assert.match(sentry, /maskAllText: true/);
});
