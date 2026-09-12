import assert from 'node:assert/strict';
import test from 'node:test';
import { ProviderHttpClient, ProviderHttpError } from '../server/src/lib/provider-http.ts';

test('deduplicates concurrent requests and serves later reads from cache', async () => {
  let calls = 0;
  const client = new ProviderHttpClient({
    fetch: async () => {
      calls += 1;
      await Promise.resolve();
      return new Response('catalogue');
    },
  });

  const [first, second] = await Promise.all([
    client.getText('https://example.test/catalogue', { minIntervalMs: 0 }),
    client.getText('https://example.test/catalogue', { minIntervalMs: 0 }),
  ]);
  assert.equal(first, 'catalogue');
  assert.equal(second, 'catalogue');
  assert.equal(await client.getText('https://example.test/catalogue', { minIntervalMs: 0 }), 'catalogue');
  assert.equal(calls, 1);
});

test('keeps the response cache bounded and evicts the oldest entry', async () => {
  let calls = 0;
  const client = new ProviderHttpClient({
    fetch: async (input) => {
      calls += 1;
      return new Response(String(input));
    },
  });

  for (let index = 0; index <= 200; index += 1) {
    await client.getText(`https://example.test/item/${index}`, { minIntervalMs: 0 });
  }
  await client.getText('https://example.test/item/0', { minIntervalMs: 0 });
  assert.equal(calls, 202);
});

test('paces distinct requests to the same origin', async () => {
  let clock = 1_000;
  const waits: number[] = [];
  const client = new ProviderHttpClient({
    now: () => clock,
    sleep: async (milliseconds) => { waits.push(milliseconds); clock += milliseconds; },
    fetch: async () => new Response('ok'),
  });

  await client.getText('https://example.test/one', { minIntervalMs: 500 });
  await client.getText('https://example.test/two', { minIntervalMs: 500 });
  assert.deepEqual(waits, [500]);
});

test('honors Retry-After for 429 and keeps retry count bounded', async () => {
  let calls = 0;
  const waits: number[] = [];
  const client = new ProviderHttpClient({
    sleep: async (milliseconds) => { waits.push(milliseconds); },
    fetch: async () => {
      calls += 1;
      return calls === 1
        ? new Response('slow down', { status: 429, headers: { 'Retry-After': '2' } })
        : new Response('recovered');
    },
  });

  assert.equal(await client.getText('https://example.test/rate-limit', { minIntervalMs: 0 }), 'recovered');
  assert.equal(calls, 2);
  assert.deepEqual(waits, [2_000]);
});

test('stops retrying transient failures at the configured bound', async () => {
  let calls = 0;
  const client = new ProviderHttpClient({
    sleep: async () => {},
    fetch: async () => {
      calls += 1;
      return new Response('unavailable', { status: 503 });
    },
  });

  await assert.rejects(
    () => client.getText('https://example.test/unavailable', { minIntervalMs: 0, maxRetries: 2 }),
    (error: ProviderHttpError) => error.status === 503 && error.retryable === true,
  );
  assert.equal(calls, 3);
});

test('fails closed on 403 without retrying or invoking an anti-bot fallback', async () => {
  let calls = 0;
  const client = new ProviderHttpClient({
    fetch: async () => {
      calls += 1;
      return new Response('forbidden', { status: 403 });
    },
  });

  await assert.rejects(
    () => client.getText('https://example.test/protected', { minIntervalMs: 0 }),
    (error: ProviderHttpError) => error.status === 403 && error.retryable === false,
  );
  assert.equal(calls, 1);
});

test('rejects cleartext provider URLs', async () => {
  const client = new ProviderHttpClient({ fetch: async () => new Response('unexpected') });
  await assert.rejects(
    () => client.getText('http://example.test/catalogue'),
    (error: ProviderHttpError) => error.status === null && error.retryable === false,
  );
});
