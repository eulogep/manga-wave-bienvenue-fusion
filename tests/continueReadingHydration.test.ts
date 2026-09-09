import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  continueReadingQueryKey,
  getContinueReadingAuthState,
  getContinueReadingPlaceholder,
  resolveContinueReadingItems,
  shouldFetchContinueReading,
} from '../src/domain/continueReadingHydration.ts';

type Progress = { page: number };
const local: Progress[] = [{ page: 1 }];
const hookSource = fs.readFileSync(new URL('../src/hooks/useReadingProgress.ts', import.meta.url), 'utf8');

test('authenticated empty local state resolves to remote progress', () => {
  assert.deepEqual(resolveContinueReadingItems('authenticated', [], [{ page: 2 }]), [{ page: 2 }]);
  assert.doesNotMatch(hookSource, /\binitialData\s*:/);
  assert.match(hookSource, /enabled:\s*shouldFetchContinueReading\(authState\)/);
});

test('authenticated remote progress replaces stale local progress', () => {
  assert.deepEqual(resolveContinueReadingItems('authenticated', local, [{ page: 5 }]), [{ page: 5 }]);
});

test('authenticated empty remote state clears stale local progress', () => {
  assert.deepEqual(resolveContinueReadingItems('authenticated', local, []), []);
});

test('anonymous sessions continue to use local progress', () => {
  assert.deepEqual(resolveContinueReadingItems('anonymous', local, []), local);
  assert.deepEqual(getContinueReadingPlaceholder('anonymous', local), local);
});

test('auth loading neither fetches nor publishes a premature placeholder', () => {
  const state = getContinueReadingAuthState(true, undefined);
  assert.equal(state, 'loading');
  assert.equal(shouldFetchContinueReading(state), false);
  assert.equal(getContinueReadingPlaceholder(state, local), undefined);
});

test('authenticated query state is isolated by user and never seeded from local storage', () => {
  const state = getContinueReadingAuthState(false, 'user-a');
  assert.notDeepEqual(
    continueReadingQueryKey(state, 'user-a', 'local-revision'),
    continueReadingQueryKey(state, 'user-b', 'local-revision'),
  );
  assert.equal(getContinueReadingPlaceholder(state, local), undefined);
});
