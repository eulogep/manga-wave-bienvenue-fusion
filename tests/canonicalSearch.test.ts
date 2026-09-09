import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeQuery, parseSearchState, serializeSearchState, searchCanonicalWorks, scoreSearchResult, type SearchWork } from '../src/domain/canonicalSearch.ts';
const work = (id: number, title: string, patch: Partial<SearchWork> = {}): SearchWork => ({ id, title, aliases: [], author: null, genre: [], manga_type: 'manhwa', status: 'ongoing', rating: null, views: 0, created_at: '2026-01-01', cover_image: null, ...patch });
const solo = work(110, 'Solo Leveling', { aliases: ['나 혼자만 레벨업', 'Only I Level Up'], author: 'Chugong', genre: ['Action', 'Fantasy'], status: 'completed' });
const works = [solo, work(111, 'Solo Leveling Ragnarok'), work(112, 'Omniscient Reader’s Viewpoint'), work(113, 'One Piece', { manga_type: 'manga', genre: ['Action'] })];
const search = (q: string, params = '') => searchCanonicalWorks(works, parseSearchState(new URLSearchParams(`q=${encodeURIComponent(q)}&${params}`)));
test('normalization handles spaces accents punctuation and preserves non-Latin identity', () => {
  for (const q of ['Solo-Leveling', '  solo   leveling  ', 'SÓLO LEVELING']) assert.equal(normalizeQuery(q), 'solo leveling');
  assert.notEqual(normalizeQuery('進撃の巨人'), '');
  assert.notEqual(normalizeQuery('나 혼자만 레벨업'), normalizeQuery('다른 작품'));
});
test('exact canonical title ranks first and appears once', () => assert.deepEqual(search('Solo Leveling').map(w => w.id), [110, 111]));
test('exact aliases including Korean find the same canonical id', () => { for (const q of solo.aliases) assert.deepEqual(search(q).map(w => w.id), [110]); });
test('partial canonical title and alias match', () => { assert.equal(search('level')[0].id, 110); assert.equal(search('Only I')[0].id, 110); });
test('bounded typos find Solo Leveling and Omniscient Reader', () => { assert.equal(search('solo levling')[0].id, 110); assert.equal(search('omnicient reader')[0].id, 112); assert.deepEqual(search('zzzzzzzz'), []); assert.deepEqual(search('slo'), []); });
test('author query finds works by that author', () => assert.deepEqual(search('chugong').map(w => w.id), [110]));
test('genre context is exact and ranks below titles', () => { assert.deepEqual(search('fantasy').map(w => w.id), [110]); assert.deepEqual(search('fantas'), []); assert.ok(scoreSearchResult(work(9, 'Fantasy'), 'fantasy') > scoreSearchResult(solo, 'fantasy')); });
test('type filter excludes mismatched and unknown types', () => assert.deepEqual(search('', 'type=manga').map(w => w.id), [113]));
test('status filter is enforced', () => assert.deepEqual(search('solo', 'status=completed').map(w => w.id), [110]));
test('combined query type status genre filters use AND', () => { assert.deepEqual(search('level', 'type=manhwa&status=completed&genre=Action').map(w => w.id), [110]); assert.deepEqual(search('level', 'type=manga&status=completed'), []); });
test('dedup uses canonical id and preserves sequels even with shared aliases', () => {
  assert.deepEqual(searchCanonicalWorks([solo, solo, work(111, 'Solo Leveling Ragnarok', { aliases: ['Solo Leveling'] })], parseSearchState(new URLSearchParams('q=Solo+Leveling'))).map(w => w.id), [110,111]);
});
test('all relevance tiers stay ordered', () => {
  const titles = [work(1, 'Solo Leveling'), work(2, 'Other', { aliases: ['Solo Leveling'] }), work(3, 'Solo Leveling Ragnarok'), work(4, 'Other', { aliases: ['Solo Leveling sequel'] }), work(5, 'The Solo Leveling story'), work(6, 'Other', { aliases: ['The Solo Leveling story'] }), work(7, 'Solo Levling'), work(8, 'Other', { author: 'Solo Leveling' })];
  const scores = titles.map(w => scoreSearchResult(w, 'Solo Leveling'));
  scores.slice(1).forEach((score, i) => assert.ok(scores[i] > score));
});
test('unrelated MangaFire garbage is never admitted as a match', () => { assert.equal(scoreSearchResult(work(800, 'Martial Peak'), 'Solo Leveling'), 0); assert.equal(scoreSearchResult(work(801, 'MangaFire Home'), 'Solo Leveling'), 0); });
test('Comick degradation cannot trigger requests or retries from canonical search', () => {
  const hook = readFileSync(new URL('../src/hooks/useCanonicalSearch.ts', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../src/pages/Search.tsx', import.meta.url), 'utf8');
  assert.match(hook, /from\('mangas'\)/);
  assert.doesNotMatch(hook + page, /useComick|useMangaFire|useCatalogSearch|useExternalSources|\/api\/extract/);
});
test('URL state round trips filters sort pagination and sanitizes malformed input', () => {
  const state = parseSearchState(new URLSearchParams('q=Solo+Leveling&type=manhwa&status=ongoing&genre=Action&sort=rating&page=2'));
  assert.deepEqual(parseSearchState(serializeSearchState(state)), state);
  assert.deepEqual(parseSearchState(new URLSearchParams('type=unknown&status=bad&sort=bad&page=NaN')), { q:'',type:'',status:'',genre:'',sort:'relevance',page:1 });
});
test('explicit sort uses metadata and retains deterministic tie breaks', () => {
  const list = [work(1, 'A', { views: 1, rating: 3 }), work(2, 'B', { views: 10, rating: 9 })];
  for (const sort of ['popularity','rating']) assert.equal(searchCanonicalWorks(list, parseSearchState(new URLSearchParams(`sort=${sort}`)))[0].id,2);
});
