import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildMangaDexQuery,
  chooseIdentityToAttach,
  chunk,
  DEFAULT_SYNC_PLAN,
  MAX_SYNC_PAGES,
  mergeCatalogRows,
  parseSyncPlan,
  splitCatalogWrites,
  toCatalogRow,
  type CatalogRow,
  type MangaDexManga,
} from '../supabase/functions/_shared/mangadex-catalog.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const proxy = 'https://proxy.example/mangadex-proxy';

const manga = (id: string, patch: Partial<MangaDexManga['attributes']> = {}, relationships: MangaDexManga['relationships'] = []): MangaDexManga => ({
  id,
  attributes: {
    title: { en: `Title ${id}` }, description: { fr: 'Résumé', en: 'Summary' }, originalLanguage: 'ko', status: 'ongoing',
    contentRating: 'safe', updatedAt: '2026-10-20T00:00:00Z',
    tags: [{ attributes: { group: 'genre', name: { en: 'Action' } } }, { attributes: { group: 'theme', name: { en: 'Monsters' } } }],
    ...patch,
  },
  relationships,
});

test('the sync plan defaults to French then English, three pages each', () => {
  assert.deepEqual(parseSyncPlan(undefined), DEFAULT_SYNC_PLAN);
  assert.deepEqual(parseSyncPlan({}).languages, ['fr', 'en']);
});

test('requested plans are clamped and unknown languages dropped', () => {
  assert.equal(parseSyncPlan({ pages: 999 }).pages, MAX_SYNC_PAGES);
  assert.equal(parseSyncPlan({ pages: 0 }).pages, 1);
  assert.equal(parseSyncPlan({ pages: 2.5 }).pages, DEFAULT_SYNC_PLAN.pages);
  assert.deepEqual(parseSyncPlan({ languages: ['en', 'xx', 'en'] }).languages, ['en']);
  assert.deepEqual(parseSyncPlan({ languages: ['xx'] }).languages, ['fr', 'en']);
});

test('queries paginate by offset and only ask for safe or suggestive titles in one language', () => {
  const query = buildMangaDexQuery('en', 2);
  assert.equal(query.get('limit'), '100');
  assert.equal(query.get('offset'), '200');
  assert.deepEqual(query.getAll('availableTranslatedLanguage[]'), ['en']);
  assert.deepEqual(query.getAll('contentRating[]'), ['safe', 'suggestive']);
  assert.equal(query.get('order[followedCount]'), 'desc');
});

test('MangaDex titles map to catalogue rows with genres only, proxied covers and inferred type', () => {
  const row = toCatalogRow(manga('a1', {}, [
    { id: 'au', type: 'author', attributes: { name: ' Chugong ' } },
    { id: 'c', type: 'cover_art', attributes: { fileName: 'cover file.jpg' } },
  ]), '2026-10-24T00:00:00Z', proxy)!;
  assert.equal(row.title, 'Title a1');
  assert.equal(row.author, 'Chugong');
  assert.equal(row.description, 'Résumé');
  assert.deepEqual(row.genre, ['Action']);
  assert.equal(row.manga_type, 'manhwa');
  assert.equal(row.cover_image, `${proxy}/cover/a1/cover%20file.jpg.256.jpg`);
});

test('explicit or untitled entries are rejected even if a page contains them', () => {
  assert.equal(toCatalogRow(manga('x', { contentRating: 'erotica' }), '', proxy), null);
  assert.equal(toCatalogRow(manga('y', { contentRating: 'pornographic' }), '', proxy), null);
  assert.equal(toCatalogRow(manga('z', { title: {} }), '', proxy), null);
});

const row = (id: string, patch: Partial<CatalogRow> = {}): CatalogRow => ({ ...toCatalogRow(manga(id), 't', proxy)!, ...patch });

test('a title present in both passes keeps its French-pass row', () => {
  const merged = mergeCatalogRows([row('a', { title: 'FR' }), row('b'), row('a', { title: 'EN' })]);
  assert.deepEqual(merged.map((entry) => `${entry.mangadex_id}:${entry.title}`), ['a:FR', 'b:Title b']);
});

test('known identities never receive manga_type; new ones do', () => {
  const { refresh, insert } = splitCatalogWrites([row('known'), row('new')], new Set(['known']));
  assert.equal(refresh.length, 1);
  assert.ok(!('manga_type' in refresh[0]));
  assert.equal(insert[0].manga_type, 'manhwa');
});

test('a new MangaDex title attaches only to a unique, exact, unclaimed match with a compatible author', () => {
  const exact = { manga_id: 7, confidence: 1, mangadex_id: null, author: null };
  assert.equal(chooseIdentityToAttach({ author: 'Chugong' }, [exact]), 7);
  assert.equal(chooseIdentityToAttach({ author: 'Chugong' }, [{ ...exact, author: 'CHUGONG' }]), 7);
  assert.equal(chooseIdentityToAttach({ author: 'Chugong' }, [{ ...exact, confidence: 0.6 }]), null, 'fuzzy match');
  assert.equal(chooseIdentityToAttach({ author: 'Chugong' }, [{ ...exact, mangadex_id: 'other' }]), null, 'already claimed');
  assert.equal(chooseIdentityToAttach({ author: 'Chugong' }, [{ ...exact, author: 'Oda' }]), null, 'different author');
  assert.equal(chooseIdentityToAttach({ author: 'Chugong' }, [exact, { ...exact, manga_id: 8 }]), null, 'ambiguous');
  assert.equal(chooseIdentityToAttach({ author: 'Auteur inconnu' }, [{ ...exact, author: 'Oda' }]), 7);
});

test('chunks split writes into bounded batches', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 3), []);
});

test('the edge function paginates politely, writes in batches and attaches before inserting', () => {
  const source = read('supabase/functions/catalog-sync/index.ts');
  assert.match(source, /if \(requests\+\+ > 0\) await sleep\(PAGE_DELAY_MS\)/);
  assert.match(source, /for \(const batch of chunk\(insert, WRITE_BATCH_SIZE\)\)/);
  assert.match(source, /supabase\.rpc\("find_canonical_manga"/);
  assert.match(source, /\.update\(fields\)\.eq\("id", targetId\)\.is\("mangadex_id", null\)/);
  assert.match(source, /if \(!hasServiceRole\(request\)\)/);
});
