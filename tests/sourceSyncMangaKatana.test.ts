import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const sourceSync = readFileSync(new URL('../supabase/functions/source-sync/index.ts', import.meta.url), 'utf8');
const migration = readFileSync(
  new URL('../supabase/migrations/20260916090000_seed_weebcentral_mangakatana_sync_jobs.sql', import.meta.url),
  'utf8',
);

test('source-sync explicitly accepts WeebCentral and MangaKatana', () => {
  assert.match(sourceSync, /"weebcentral"/);
  assert.match(sourceSync, /"mangakatana"/);
});

test('new source seed is additive and never destructive', () => {
  assert.match(migration, /enqueue_source_sync/);
  assert.match(migration, /array\['weebcentral', 'mangakatana'\]/);
  assert.doesNotMatch(migration, /\b(drop|delete|truncate|alter)\b/i);
});

test('migration documents the required function-before-seed deployment order', () => {
  assert.match(migration, /deploy source-sync/i);
  assert.match(migration, /archive the jobs as unknown sources/i);
});
