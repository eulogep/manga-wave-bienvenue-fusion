import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';

const migrationUrl = new URL(
  '../supabase/migrations/20260913160000_classify_source_catalog_content_rating.sql',
  import.meta.url,
);
const migration = readFileSync(migrationUrl, 'utf8');

test('content-rating migration keeps the identifier already applied remotely', () => {
  assert.equal(existsSync(migrationUrl), true);
  assert.equal(
    existsSync(new URL('../supabase/migrations/20260914110000_classify_source_catalog_content_rating.sql', import.meta.url)),
    false,
  );
  assert.match(migrationUrl.pathname, /20260913160000_/);
});

test('generic source upsert preserves ratings and classifies exact source genre markers', () => {
  assert.match(migration, /classify_content_rating_from_genres\(genres text\[\]\)/);
  assert.match(migration, /lower\(trim\(extensions\.unaccent\(g\)\)\) = any/);
  assert.match(migration, /content_rating = coalesce\(content_rating, source_content_rating\)/);
  assert.doesNotMatch(migration, /^\s*(drop|delete|truncate)\b/im);
});
