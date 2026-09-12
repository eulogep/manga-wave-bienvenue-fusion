import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync('src/App.tsx', 'utf8');

test('homepage stays eager while secondary routes load on demand', () => {
  assert.match(app, /import Index from "\.\/pages\/Index"/);
  for (const route of ['Auth', 'Search', 'MangaDetail', 'History', 'Library', 'Trending', 'Ranking', 'Random', 'Reader', 'NotFound']) {
    assert.match(app, new RegExp(`const ${route} = lazy\\(\\(\\) => import\\("\\.\\/pages\\/${route}"\\)\\)`));
    assert.doesNotMatch(app, new RegExp(`import ${route} from "\\.\\/pages\\/${route}"`));
  }
});

test('lazy routes share one accessible loading boundary', () => {
  assert.match(app, /<Suspense fallback={<RouteLoading \/>}>/);
  assert.match(app, /<p role="status"[^>]*>Chargement de Manga Wave…<\/p>/);
});

test('command search code loads only after its global state opens', () => {
  assert.match(app, /const CommandSearchDialog = lazy\(\(\) => import\("@\/components\/CommandSearchDialog"\)/);
  assert.match(app, /if \(!isOpen\) return null/);
  assert.match(app, /<DeferredCommandSearchDialog \/>/);
});
