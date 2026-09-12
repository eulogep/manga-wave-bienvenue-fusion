import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { AniListApiError, AniListClient } from '../scripts/metadata/anilist-client.ts';
import {
  mergeAliases,
  selectAniListMatch,
  shouldOverwriteMetadata,
  quarantineBatchCollisions,
  type AniListMedia,
  type CanonicalWork,
} from '../scripts/metadata/canonical-metadata.ts';
import { adaptJikan, JikanApiError, JikanClient, normalizeJikanType } from '../scripts/metadata/jikan-client.ts';
import { adaptKitsu, KitsuClient } from '../scripts/metadata/kitsu-client.ts';
import { adaptMangaUpdates, MangaUpdatesApiError, MangaUpdatesClient, normalizeMangaUpdatesType } from '../scripts/metadata/mangaupdates-client.ts';
import { MangaDexMetadataClient, MangaDexMetadataError } from '../scripts/metadata/mangadex-metadata-client.ts';
import { MetadataProvider } from '../scripts/metadata/metadata-provider.ts';
import {
  canonicalTypeFromCountry,
  countryFromMangaDexLanguage,
  normalizeAliases,
  normalizeCountryOfOrigin,
  normalizeMetadataText,
} from '../supabase/functions/_shared/canonical-metadata.ts';

const work = (patch: Partial<CanonicalWork> = {}): CanonicalWork => ({
  id: 1,
  title: 'Solo Leveling',
  aliases: [],
  author: 'Chugong',
  manga_type: null,
  mangadex_id: null,
  sourceTitles: [],
  ...patch,
});

const media = (patch: Partial<AniListMedia> = {}): AniListMedia => ({
  id: 105398,
  idMal: 121496,
  title: { romaji: 'Ore dake Level Up na Ken', english: 'Solo Leveling', native: '나 혼자만 레벨업' },
  synonyms: ['Na Honjaman Level Up'],
  countryOfOrigin: 'KR',
  format: 'MANGA',
  startDate: { year: 2018 },
  staff: { edges: [{ role: 'Story', node: { name: { full: 'Chugong' } } }] },
  externalLinks: [],
  ...patch,
});

test('normalizes aliases without blanks, duplicates, canonical title, or provider names', () => {
  assert.deepEqual(normalizeAliases('Solo Leveling', [' Solo  Leveling ', '나 혼자만 레벨업', '나 혼자만 레벨업 ', '', 'AniList']), ['나 혼자만 레벨업']);
  assert.equal(normalizeMetadataText('SÓLO—Leveling'), 'solo leveling');
});

test('normalizes ISO origin and derives only controlled publication types', () => {
  assert.equal(normalizeCountryOfOrigin(' kr '), 'KR');
  assert.equal(normalizeCountryOfOrigin('Korea'), null);
  assert.equal(canonicalTypeFromCountry('JP'), 'manga');
  assert.equal(canonicalTypeFromCountry('KR'), 'manhwa');
  for (const country of ['CN', 'TW', 'HK']) assert.equal(canonicalTypeFromCountry(country), 'manhua');
  assert.equal(canonicalTypeFromCountry('US'), null);
  assert.equal(canonicalTypeFromCountry(null), null);
});

test('maps MangaDex original languages without guessing unknown origins', () => {
  assert.equal(countryFromMangaDexLanguage('ja'), 'JP');
  assert.equal(countryFromMangaDexLanguage('ko'), 'KR');
  assert.equal(countryFromMangaDexLanguage('zh'), 'CN');
  assert.equal(countryFromMangaDexLanguage('zh-hk'), 'HK');
  assert.equal(countryFromMangaDexLanguage('en'), null);
});

test('accepts one exact normalized AniList title match', () => {
  const result = selectAniListMatch(work(), [media()], new Map([['solo leveling', 1]]));
  assert.equal(result.confidence, 'EXACT');
  assert.equal(result.countryOfOrigin, 'KR');
  assert.equal(result.mangaType, 'manhwa');
  assert.ok(result.aliases.includes('나 혼자만 레벨업'));
});

test('accepts HIGH only with corroborating source-title and author evidence', () => {
  const canonical = work({ title: 'Dress Up Darling!', author: 'Shinichi Fukuda', sourceTitles: ['My Dress-Up Darling'] });
  const candidate = media({
    id: 101583,
    title: { romaji: 'Sono Bisque Doll wa Koi wo Suru', english: 'My Dress-Up Darling', native: 'その着せ替え人形は恋をする' },
    synonyms: [],
    countryOfOrigin: 'JP',
    staff: { edges: [{ role: 'Story & Art', node: { name: { full: 'Shinichi Fukuda' } } }] },
  });
  assert.equal(selectAniListMatch(canonical, [candidate], new Map()).confidence, 'HIGH');
});

test('sends equally confident candidates to manual review', () => {
  const duplicate = media({ id: 999 });
  assert.equal(selectAniListMatch(work(), [media(), duplicate], new Map()).confidence, 'REVIEW');
});

test('alias colliding with another canonical title becomes REVIEW_REQUIRED', () => {
  const canonical = work({ id: 1, title: 'Na Honjaman Level-Up' });
  const result = selectAniListMatch(canonical, [media({ title: { romaji: 'Na Honjaman Level-Up', english: 'Solo Leveling', native: null } })], new Map([
    ['na honjaman level up', 1],
    ['solo leveling', 110],
  ]));
  assert.equal(result.confidence, 'REVIEW');
  assert.deepEqual(result.collisions, [{ alias: 'Solo Leveling', canonicalId: 110 }]);
  assert.deepEqual(result.aliases, []);
});

test('weak fuzzy title without corroborating evidence is never auto-written', () => {
  const result = selectAniListMatch(work({ title: 'Solo Levelling', author: null }), [media()], new Map());
  assert.equal(result.confidence, 'REVIEW');
});

test('a novel is not treated as its comic adaptation despite an exact title', () => {
  const result = selectAniListMatch(work({ title: 'Example' }), [media({
    title: { romaji: 'Example', english: null, native: null },
    countryOfOrigin: 'JP',
    format: 'NOVEL',
  })], new Map([['example', 1]]));
  assert.equal(result.confidence, 'REJECT');
  assert.equal(result.mangaType, null);
});

test('alias merging and confidence overwrite policy are idempotent', () => {
  const once = mergeAliases('Solo Leveling', [], ['Only I Level Up', '나 혼자만 레벨업']);
  assert.deepEqual(mergeAliases('Solo Leveling', once, once), once);
  assert.equal(shouldOverwriteMetadata('EXACT', 'HIGH'), false);
  assert.equal(shouldOverwriteMetadata('EXACT', 'EXACT'), false);
  assert.equal(shouldOverwriteMetadata('HIGH', 'HIGH'), false);
  assert.equal(shouldOverwriteMetadata('HIGH', 'EXACT'), true);
  assert.equal(shouldOverwriteMetadata(null, 'HIGH'), true);
  assert.equal(shouldOverwriteMetadata(null, 'REVIEW'), false);
});

test('AniList client honors Retry-After on 429 and retries safely', async () => {
  const waits: number[] = [];
  let calls = 0;
  const fakeFetch = async () => {
    calls += 1;
    if (calls === 1) return new Response(JSON.stringify({ errors: [{ message: 'Too Many Requests.', status: 429 }] }), { status: 429, headers: { 'retry-after': '1' } });
    return new Response(JSON.stringify({ data: { Page: { media: [media()] } } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const client = new AniListClient(fakeFetch as typeof fetch, async (milliseconds) => { waits.push(milliseconds); }, 0, () => 0);
  assert.equal((await client.search('Solo Leveling')).length, 1);
  assert.equal(calls, 2);
  assert.deepEqual(waits, [1_000]);
});

test('AniList client reports a non-retryable service shutdown without looping', async () => {
  let calls = 0;
  const fakeFetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ errors: [{ message: 'temporarily disabled', status: 403 }] }), { status: 403 });
  };
  const client = new AniListClient(fakeFetch as typeof fetch, async () => undefined, 0, () => 0);
  await assert.rejects(() => client.search('Solo Leveling'), (error: AniListApiError) => error.status === 403 && !error.retryable);
  assert.equal(calls, 1);
});

test('catalog sync cannot use MangaDex format tags as canonical manga_type', () => {
  const source = readFileSync(new URL('../supabase/functions/catalog-sync/index.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /formats\[0\]/);
  assert.match(source, /canonicalTypeFromCountry\(country\)/);
  assert.match(source, /originalLanguage/);
});

test('metadata migration is additive and CLI has no database write path', () => {
  const migration = readFileSync(new URL('../supabase/migrations/20260910100000_add_canonical_metadata_enrichment.sql', import.meta.url), 'utf8');
  assert.match(migration, /add column if not exists country_of_origin/);
  assert.match(migration, /mangas_metadata_external_identity_key/);
  assert.doesNotMatch(migration, /\b(drop table|delete from|truncate|update public\.mangas)\b/i);
  const cli = readFileSync(new URL('../scripts/metadata/enrich-canonical-manga.ts', import.meta.url), 'utf8');
  assert.match(cli, /Apply désactivé/);
  const refused = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/metadata/enrich-canonical-manga.ts', '--dry-run', '--apply'], { encoding: 'utf8', env: {} });
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /Apply désactivé/);
  assert.match(cli, /--dry-run/);
  assert.match(cli, /--resume/);
});

const jikan = (type = 'Manhwa') => adaptJikan({ mal_id: 121496, title: 'Solo Leveling', title_english: 'Solo Leveling', title_japanese: '나 혼자만 레벨업', title_synonyms: ['Only I Level Up', ' Jikan ', ''], type, authors: [{ name: 'Chugong' }], published: { prop: { from: { year: 2018 } } } });
test('Jikan normalization strictly accepts only the three named publication types', () => {
  assert.equal(normalizeJikanType('Manga'), 'manga');
  assert.equal(normalizeJikanType('Manhwa'), 'manhwa');
  assert.equal(normalizeJikanType('Manhua'), 'manhua');
  for (const type of ['Novel', 'Light Novel', 'One-shot', 'Doujinshi', 'Web Comic', 'Adaptation', 'manga', null]) assert.equal(normalizeJikanType(type), null);
});
test('Jikan exact match uses shared matcher and preserves Unicode aliases, without invented country', () => {
  const match = selectAniListMatch(work(), [jikan()], new Map());
  assert.equal(match.confidence, 'EXACT');
  assert.equal(match.mangaType, 'manhwa');
  assert.equal(match.countryOfOrigin, null);
  assert.deepEqual(match.aliases, ['나 혼자만 레벨업', 'Only I Level Up']);
});
test('Jikan HIGH requires corroborating author; conflicting types remain review', () => {
  assert.equal(selectAniListMatch(work({ title: 'Only I Gain Levels', sourceTitles: ['Solo Leveling'] }), [jikan()], new Map()).confidence, 'HIGH');
  assert.equal(selectAniListMatch(work({ manga_type: 'manga', metadata_confidence: 'EXACT' }), [jikan()], new Map()).confidence, 'REVIEW');
  assert.equal(selectAniListMatch(work({ author: 'Another Person' }), [jikan()], new Map()).confidence, 'REVIEW');
});
test('Jikan ambiguous equal matches and duplicate canonical identities are quarantined', () => {
  assert.equal(selectAniListMatch(work(), [jikan(), { ...jikan(), id: 999 }], new Map()).confidence, 'REVIEW');
  const items = [1, 2].map((id) => ({ work: work({ id }), decision: selectAniListMatch(work({ id }), [jikan()], new Map()) }));
  quarantineBatchCollisions(items);
  assert.ok(items.every((item) => item.decision.confidence === 'REVIEW' && !item.decision.aliases.length && item.decision.collisions.length));
});
test('AniList disabled 403 opens circuit once; source cache avoids repeated secondary lookup', async () => {
  let primary = 0; let secondary = 0;
  const provider = MetadataProvider.legacy({ search: async () => { primary++; throw new AniListApiError('temporarily disabled', 403, false); } }, { search: async () => { secondary++; return [jikan()]; } });
  assert.equal((await provider.search('Solo Leveling')).source, 'jikan');
  await provider.search('Solo Leveling');
  assert.equal(primary, 1); assert.equal(secondary, 1);
  assert.equal(provider.cache['jikan:Solo Leveling'].source, 'jikan');
});
test('primary ambiguity or empty result never triggers blind secondary fallback', async () => {
  let secondary = 0;
  const provider = MetadataProvider.legacy({ search: async () => [media(), media({ id: 999 })] }, { search: async () => { secondary++; return [jikan()]; } });
  const result = await provider.search('Solo Leveling');
  assert.equal(selectAniListMatch(work(), result.candidates, new Map()).confidence, 'REVIEW');
  assert.equal(secondary, 0);
});
test('network and exhausted 5xx fall back; unrelated forbidden response does not', async () => {
  for (const status of [0, 503]) {
    const provider = MetadataProvider.legacy({ search: async () => { throw new AniListApiError('unavailable', status, true); } }, { search: async () => [jikan()] });
    assert.equal((await provider.search('Solo Leveling')).source, 'jikan');
  }
  const forbidden = MetadataProvider.legacy({ search: async () => { throw new AniListApiError('forbidden token', 403, false); } }, { search: async () => { throw new Error('must not reach fallback'); } });
  await assert.rejects(() => forbidden.search('test'), /forbidden token/);
});
test('stale cache is refreshed and source namespaces are independent', async () => {
  let calls = 0;
  const provider = MetadataProvider.legacy({ search: async () => { calls++; return [media()]; } }, { search: async () => [] }, {
    'anilist:test': { source: 'anilist', query: 'test', fetchedAt: '2000-01-01T00:00:00Z', candidates: [] },
    'jikan:test': { source: 'jikan', query: 'test', fetchedAt: new Date().toISOString(), candidates: [jikan()] },
  });
  assert.equal((await provider.search('test')).candidates[0].id, media().id);
  await provider.search('test'); assert.equal(calls, 1);
});
test('Jikan bounded retries on 5xx and network failure make exactly four attempts', async () => {
  for (const network of [false, true]) {
    let calls = 0;
    const client = new JikanClient(async () => { calls++; if (network) throw new TypeError('network'); return new Response('{}', { status: 504 }); }, async () => undefined, 0);
    await assert.rejects(() => client.search('Solo Leveling'));
    assert.equal(calls, 4);
  }
});
test('Jikan respects retry-after, rejects malformed results, quarantines truncation', async () => {
  const waits: number[] = []; let calls = 0;
  const client = new JikanClient(async () => { calls++; return calls === 1 ? new Response('{}', { status: 429, headers: { 'retry-after': '2' } }) : new Response(JSON.stringify({ data: [{ mal_id: 1, title: 'Example', type: 'Manga' }] })); }, async (ms) => { waits.push(ms); }, 0);
  assert.equal((await client.search('Example'))[0].normalizedType, 'manga'); assert.deepEqual(waits, [2000]);
  for (const payload of [{ data: 'broken' }, { data: [{ mal_id: 'broken', title: 'Example' }] }]) {
    const invalid = new JikanClient(async () => new Response(JSON.stringify(payload)), async () => undefined, 0);
    await assert.rejects(() => invalid.search('Example'));
  }
  const partial = new JikanClient(async () => new Response(JSON.stringify({ data: [{ mal_id: 1, title: 'Solo Leveling', type: 'Manhwa' }], pagination: { has_next_page: true } })), async () => undefined, 0);
  assert.equal(selectAniListMatch(work(), await partial.search('Solo Leveling'), new Map()).confidence, 'REVIEW');
});

test('Kitsu distinguishes real-style manhua and novel homonyms through the shared matcher', () => {
  const candidate = (subtype: string) => adaptKitsu({ id: '40987', attributes: { canonicalTitle: 'Martial Peak', titles: { en_us: 'Martial Peak', zh_cn: '武炼巅峰' }, abbreviatedTitles: ['Wu Lian Dian Feng', ' Kitsu '], subtype, startDate: '2017-06-01' } });
  const canonical = work({ title: 'Martial Peak', author: null });
  const match = selectAniListMatch(canonical, [candidate('manhua'), { ...candidate('novel'), id: 888 }], new Map());
  assert.equal(match.confidence, 'EXACT'); assert.equal(match.mangaType, 'manhua');
  assert.deepEqual(match.aliases, ['武炼巅峰', 'Wu Lian Dian Feng']);
});
test('Kitsu activates only on Jikan availability failure; Jikan ambiguity stays unresolved', async () => {
  let calls = 0;
  const primary = { search: async () => { throw new AniListApiError('temporarily disabled', 403, false); } };
  const tertiary = { search: async () => { calls++; return []; } };
  const provider = MetadataProvider.legacy(primary, { search: async () => { throw new JikanApiError('HTTP 504', 504); } }, {}, Date.now, tertiary);
  assert.equal((await provider.search('test')).source, 'kitsu');
  assert.equal(provider.outages.length, 2);
  const ambiguous = MetadataProvider.legacy(primary, { search: async () => [jikan(), { ...jikan(), id: 9 }] }, {}, Date.now, tertiary);
  assert.equal((await ambiguous.search('test')).source, 'jikan'); assert.equal(calls, 1);
});
test('Kitsu malformed response fails closed and transient requests have a retry bound', async () => {
  let calls = 0;
  const down = new KitsuClient(async () => { calls++; return new Response('{}', { status: 503 }); }, async () => undefined);
  await assert.rejects(() => down.search('Example')); assert.equal(calls, 4);
  const malformed = new KitsuClient(async () => new Response('{}'), async () => undefined);
  await assert.rejects(() => malformed.search('Example'), /schema/);
});

// === MangaUpdates adapter tests ===
test('MangaUpdates type normalization strictly accepts only Manga, Manhwa, Manhua', () => {
  assert.equal(normalizeMangaUpdatesType('Manga'), 'manga');
  assert.equal(normalizeMangaUpdatesType('Manhwa'), 'manhwa');
  assert.equal(normalizeMangaUpdatesType('Manhua'), 'manhua');
  for (const type of ['Novel', 'Light Novel', 'Doujinshi', 'One-shot', 'OEL', null]) {
    assert.equal(normalizeMangaUpdatesType(type), null);
  }
});

test('MangaUpdates adapter maps search result to shared AniListMedia shape with aliases and authors', () => {
  const record = { series_id: 15180124327, title: 'Solo Leveling', type: 'Manhwa', year: '2018',
    associated: [{ title: '나 혼자만 레벨업' }, { title: 'Only I Level Up' }, { title: '' }],
    authors: [{ name: 'Chugong', type: 'Author', author_id: 71651794005 }, { name: 'DUBU (Redice Studio)', type: 'Artist', author_id: 61564873920 }],
  };
  const adapted = adaptMangaUpdates(record);
  assert.equal(adapted.source, 'mangaupdates');
  assert.equal(adapted.normalizedType, 'manhwa');
  assert.equal(adapted.id, 15180124327);
  assert.deepEqual(adapted.synonyms, ['나 혼자만 레벨업', 'Only I Level Up']);
  assert.equal(adapted.staff.edges.length, 2);
  assert.equal(adapted.staff.edges[0].role, 'Story');
  assert.equal(adapted.staff.edges[0].node.name.full, 'Chugong');
  assert.equal(adapted.startDate.year, 2018);
});

test('MangaUpdates exact match uses shared confidence model with author corroboration', () => {
  const mu = adaptMangaUpdates({ series_id: 15180124327, title: 'Solo Leveling', type: 'Manhwa', year: '2018',
    associated: [{ title: '나 혼자만 레벨업' }, { title: 'Only I Level Up' }],
    authors: [{ name: 'Chugong', type: 'Author', author_id: 71651794005 }],
  });
  const match = selectAniListMatch(work(), [mu], new Map());
  assert.equal(match.confidence, 'EXACT');
  assert.equal(match.mangaType, 'manhwa');
  assert.ok(match.aliases.includes('나 혼자만 레벨업'));
  assert.ok(match.aliases.includes('Only I Level Up'));
});

test('MangaUpdates novel homonym is rejected by format filter', () => {
  const novel = adaptMangaUpdates({ series_id: 13184758110, title: 'Solo Leveling', type: 'Novel', year: '2016',
    associated: [], authors: [{ name: 'Chugong', type: 'Author', author_id: 71651794005 }],
  });
  const match = selectAniListMatch(work(), [novel], new Map([['solo leveling', 1]]));
  assert.equal(match.confidence, 'REJECT');
});

test('MangaUpdates Manhua identification works through shared matcher', () => {
  const manhua = adaptMangaUpdates({ series_id: 19455438921, title: 'Martial Peak', type: 'Manhua', year: '2018',
    associated: [{ title: '武炼巅峰' }, { title: 'Wu Lian Dian Feng' }],
    authors: [],
  });
  const canonical = work({ title: 'Martial Peak', author: null });
  const match = selectAniListMatch(canonical, [manhua], new Map());
  assert.equal(match.confidence, 'EXACT');
  assert.equal(match.mangaType, 'manhua');
  assert.ok(match.aliases.includes('武炼巅峰'));
});

test('MangaUpdates client retries on 5xx and rejects malformed responses', async () => {
  let calls = 0;
  const down = new MangaUpdatesClient(
    async () => { calls++; return new Response('{}', { status: 503 }); },
    async () => undefined, 0,
  );
  await assert.rejects(() => down.search('test'));
  assert.equal(calls, 4);
  const malformed = new MangaUpdatesClient(
    async () => new Response(JSON.stringify({ results: 'broken' })),
    async () => undefined, 0,
  );
  await assert.rejects(() => malformed.search('test'), /schema/);
});

test('MangaUpdates failover chain: AniList 403 + Jikan 504 → MangaUpdates', async () => {
  const mu = adaptMangaUpdates({ series_id: 15180124327, title: 'Solo Leveling', type: 'Manhwa', year: '2018',
    associated: [{ title: '나 혼자만 레벨업' }], authors: [{ name: 'Chugong', type: 'Author', author_id: 71651794005 }],
  });
  const provider = new MetadataProvider([
    { name: 'anilist', provider: { search: async () => { throw new AniListApiError('temporarily disabled', 403, false); } } },
    { name: 'jikan', provider: { search: async () => { throw new JikanApiError('HTTP 504', 504); } } },
    { name: 'mangaupdates', provider: { search: async () => [mu] } },
  ]);
  const result = await provider.search('Solo Leveling');
  assert.equal(result.source, 'mangaupdates');
  assert.equal(result.candidates[0].normalizedType, 'manhwa');
  assert.equal(provider.outages.length, 2);
});

test('MangaUpdates availability failure cascades to Kitsu', async () => {
  const provider = new MetadataProvider([
    { name: 'anilist', provider: { search: async () => { throw new AniListApiError('temporarily disabled', 403, false); } } },
    { name: 'jikan', provider: { search: async () => { throw new JikanApiError('HTTP 504', 504); } } },
    { name: 'mangaupdates', provider: { search: async () => { throw new MangaUpdatesApiError('HTTP 503', 503); } } },
    { name: 'kitsu', provider: { search: async () => [adaptKitsu({ id: '40987', attributes: { canonicalTitle: 'Test', titles: {}, subtype: 'manga', startDate: null } })] } },
  ]);
  const result = await provider.search('Test');
  assert.equal(result.source, 'kitsu');
  assert.equal(provider.outages.length, 3);
});

// === MangaDex metadata client tests ===
test('MangaDex direct lookup by ID extracts aliases, derives country/type and sets EXACT confidence on matching work', async () => {
  const mangadexId = '32d76d19-8a05-4db0-9fc2-e0b0648fe9d0';
  const mockPayload = {
    data: {
      id: mangadexId,
      attributes: {
        title: { 'ko-ro': 'Na Honjaman Level-Up', en: 'Solo Leveling' },
        altTitles: [
          { en: 'Only I Level Up' },
          { ko: '나 혼자만 레벨업' },
          { fr: 'Solo Leveling (FR)' },
        ],
        originalLanguage: 'ko',
        status: 'completed',
        year: 2018,
      },
      relationships: [
        { id: 'auth-1', type: 'author', attributes: { name: 'Chugong' } },
        { id: 'art-1', type: 'artist', attributes: { name: 'DUBU' } },
      ],
    },
  };
  const client = new MangaDexMetadataClient(
    async () => new Response(JSON.stringify(mockPayload), { status: 200 }),
    async () => undefined,
    0,
  );
  const media = await client.getById(mangadexId);
  assert.equal(media.source, 'mangadex');
  assert.equal(media.id, mangadexId);
  assert.equal(media.normalizedType, 'manhwa');
  assert.equal(media.countryOfOrigin, 'KR');
  assert.equal(media.status, 'completed');
  assert.equal(media.startDate.year, 2018);
  assert.ok(media.synonyms.includes('Only I Level Up'));
  assert.ok(media.synonyms.includes('나 혼자만 레벨업'));
  assert.equal(media.staff.edges.length, 2);
  assert.equal(media.staff.edges[0].node.name.full, 'Chugong');

  // Test match evaluation with canonical work
  const canonical = work({ id: 1, title: 'Na Honjaman Level-Up', mangadex_id: mangadexId });
  const match = selectAniListMatch(canonical, [media], new Map());
  assert.equal(match.confidence, 'EXACT');
  assert.ok(match.reasons.includes('stable MangaDex identifier overlap'));
  assert.equal(match.mangaType, 'manhwa');
  assert.equal(match.countryOfOrigin, 'KR');
  assert.ok(match.aliases.includes('Solo Leveling'));
  assert.ok(match.aliases.includes('Only I Level Up'));
});

test('MangaDex client search returns candidates with relationships and computes searchIncomplete', async () => {
  const mockPayload = {
    data: [
      {
        id: 'md-1',
        attributes: {
          title: { 'ja-ro': 'Choujin X', en: 'Superhuman X' },
          altTitles: [{ ja: '超人X' }],
          originalLanguage: 'ja',
          status: 'ongoing',
          year: 2021,
        },
        relationships: [{ id: 'a-1', type: 'author', attributes: { name: 'Ishida Sui' } }],
      },
    ],
    total: 25,
    limit: 10,
  };
  const client = new MangaDexMetadataClient(
    async () => new Response(JSON.stringify(mockPayload), { status: 200 }),
    async () => undefined,
    0,
  );
  const results = await client.search('Choujin X');
  assert.equal(results.length, 1);
  assert.equal(results[0].id, 'md-1');
  assert.equal(results[0].normalizedType, 'manga');
  assert.equal(results[0].countryOfOrigin, 'JP');
  assert.equal(results[0].searchIncomplete, true); // total 25 > limit 10
});

test('MangaDex client retries on 5xx, honors retry-after and handles 404', async () => {
  let calls = 0;
  const waits: number[] = [];
  const client = new MangaDexMetadataClient(
    async () => {
      calls++;
      return calls === 1
        ? new Response('{}', { status: 429, headers: { 'retry-after': '3' } })
        : new Response(JSON.stringify({ data: { id: 'test-id', attributes: { title: { en: 'Test' } } } }));
    },
    async (ms) => { waits.push(ms); },
    0,
  );
  const media = await client.getById('test-id');
  assert.equal(media.id, 'test-id');
  assert.deepEqual(waits, [3000]);

  // 404 handling
  const notFoundClient = new MangaDexMetadataClient(
    async () => new Response('{}', { status: 404 }),
    async () => undefined,
    0,
  );
  await assert.rejects(() => notFoundClient.getById('missing'), (err: unknown) => {
    return err instanceof MangaDexMetadataError && err.status === 404;
  });
});

test('MangaDex availability failure cascades in MetadataProvider', async () => {
  const provider = new MetadataProvider([
    { name: 'mangadex', provider: { search: async () => { throw new MangaDexMetadataError('HTTP 503', 503); } } },
    { name: 'mangaupdates', provider: { search: async () => [adaptMangaUpdates({ series_id: 1, title: 'Solo Leveling', type: 'Manhwa', year: '2018', associated: [], authors: [] })] } },
  ]);
  const result = await provider.search('Solo Leveling');
  assert.equal(result.source, 'mangaupdates');
  assert.equal(provider.outages.length, 1);
  assert.equal(provider.outages[0].source, 'mangadex');
});

test('real catalog-sync handler preserves existing enrichment and inserts only normalized new types', async () => {
  const writes: Array<{ kind: string; patch: Record<string, unknown>; options?: unknown }> = [];
  const sdk = { createClient: () => ({ from: () => ({
    select: () => ({ in: async () => ({ data: [{ mangadex_id: 'existing' }], error: null }) }),
    update: (patch: Record<string, unknown>) => ({ eq: async () => { writes.push({ kind: 'update', patch }); return { error: null }; } }),
    upsert: async (patch: Record<string, unknown>, options: unknown) => { writes.push({ kind: 'insert', patch, options }); return { error: null }; },
  }) }) };
  const source = readFileSync(new URL('../supabase/functions/catalog-sync/index.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports: { default?: { fetch: (request: Request) => Promise<Response> } } = {};
  runInNewContext(compiled, {
    exports, require: (name: string) => name.startsWith('jsr:') ? {} : name.startsWith('npm:') ? sdk : { canonicalTypeFromCountry, countryFromMangaDexLanguage },
    Deno: { env: { get: (name: string) => name === 'SUPABASE_SERVICE_ROLE_KEY' ? 'test-key' : name === 'SUPABASE_URL' ? 'https://example.invalid' : undefined } },
    Request, Response, URL, URLSearchParams,
    fetch: async () => new Response(JSON.stringify({ data: [
      { id: 'existing', attributes: { title: { en: 'Existing' }, originalLanguage: 'ja', status: 'ongoing' } },
      { id: 'new', attributes: { title: { en: 'New' }, originalLanguage: 'ko', status: 'ongoing', tags: [{ attributes: { group: 'format', name: { en: 'Adaptation' } } }] } },
    ] })),
  });
  const response = await exports.default!.fetch(new Request('https://example.invalid/functions/v1/catalog-sync', { method: 'POST', headers: { apikey: 'test-key' } }));
  assert.equal(response.status, 200);
  assert.equal(writes.length, 2);
  for (const key of ['manga_type', 'aliases', 'country_of_origin', 'metadata_source', 'metadata_confidence']) assert.equal(key in writes[0].patch, false);
  assert.equal(writes[1].patch.manga_type, 'manhwa');
  assert.equal((writes[1].options as { ignoreDuplicates: boolean }).ignoreDuplicates, true);
});
