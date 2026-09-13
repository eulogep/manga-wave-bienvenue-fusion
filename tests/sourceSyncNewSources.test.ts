import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';

const sourceSync = readFileSync(new URL('../supabase/functions/source-sync/index.ts', import.meta.url), 'utf8');
const migrationUrl = new URL('../supabase/migrations/20260914100000_seed_new_source_sync_jobs.sql', import.meta.url);
const migration = readFileSync(migrationUrl, 'utf8');

test('source-sync explicitly accepts MangaPill and Sushi-Scan', () => {
  assert.match(sourceSync, /"mangapill"/);
  assert.match(sourceSync, /"sushiscan"/);
});

test('new source seed is additive and ordered after the latest remote migration', () => {
  assert.equal(existsSync(new URL('../supabase/migrations/20260913150000_seed_new_source_sync_jobs.sql', import.meta.url)), false);
  assert.match(migrationUrl.pathname, /20260914100000_/);
  assert.match(migration, /enqueue_source_sync/);
  assert.match(migration, /array\['mangapill', 'sushiscan'\]/);
  assert.doesNotMatch(migration, /\b(drop|delete|truncate|alter)\b/i);
});

test('migration documents the required function-before-seed deployment order', () => {
  assert.match(migration, /deploy source-sync/i);
  assert.match(migration, /archive the jobs as unknown sources/i);
});
