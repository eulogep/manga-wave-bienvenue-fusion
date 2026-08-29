import assert from 'node:assert/strict';
import test from 'node:test';
import { COMICK_SEARCH_ENABLED, isRetryableProviderStatus } from '../src/domain/providerHttp.ts';

test('does not retry deterministic Comick HTTP 400 responses', () => {
  assert.equal(isRetryableProviderStatus(400), false);
  assert.equal(isRetryableProviderStatus(404), false);
});

test('allows bounded retry for transient provider failures', () => {
  assert.equal(isRetryableProviderStatus(408), true);
  assert.equal(isRetryableProviderStatus(429), true);
  assert.equal(isRetryableProviderStatus(502), true);
});

test('Comick search is safely degraded without issuing a failing request', async () => {
  assert.equal(COMICK_SEARCH_ENABLED, false);
});
