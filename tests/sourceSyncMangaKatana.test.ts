import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const sourceSync = readFileSync(new URL('../supabase/functions/source-sync/index.ts', import.meta.url), 'utf8');
const migration = readFileSync(
  new URL('../supabase/migrations/20260916090000_seed_mangakatana_sync_job.sql', import.meta.url),
  'utf8',
);

test('source-sync explicitly accepts MangaKatana', () => {
  assert.match(sourceSync, /"mangakatana"/);
});

test('source-sync does not (re-)accept WeebCentral', () => {
  // WeebCentral was evaluated and built the same way, but production
  // verification (from Vercel's IP ranges) found it is Cloudflare-protected
  // and silently blocks non-residential origins — invisible from this
  // developer's own residential IP during initial research. Removed rather
  // than shipped non-functional or worked around with a proxy; this guards
  // against it being silently re-added to the accepted-source gate without
  // that decision being revisited explicitly.
  assert.doesNotMatch(sourceSync, /"weebcentral"/);
});

test('new source seed is additive and never destructive', () => {
  assert.match(migration, /enqueue_source_sync/);
  assert.match(migration, /'source',\s*'mangakatana'/);
  assert.doesNotMatch(migration, /\b(drop|delete|truncate|alter)\b/i);
});

test('migration documents the required function-before-seed deployment order', () => {
  assert.match(migration, /deploy source-sync/i);
  assert.match(migration, /archive the job as an unknown source/i);
});
