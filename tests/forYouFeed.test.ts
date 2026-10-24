import assert from 'node:assert/strict';
import test from 'node:test';
import {
  affinityScore,
  buildForYouFeed,
  buildTasteProfile,
  dailySeed,
  EXPLORATION_EVERY,
  feedReasonLabel,
  seededRandom,
  type FeedSignal,
} from '../src/domain/forYouFeed.ts';
import type { SearchWork } from '../src/domain/canonicalSearch.ts';

const now = new Date(2026, 9, 24, 12);
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

let nextId = 1;
const work = (patch: Partial<SearchWork> = {}): SearchWork => {
  const id = nextId++;
  return {
    id, title: `Œuvre ${id}`, aliases: [], author: `Auteur ${id}`, genre: ['Action'], manga_type: 'manhwa', status: 'ongoing',
    cover_image: null, rating: 4, views: 10, created_at: daysAgo(200), content_rating: 'safe', ...patch,
  };
};
const signal = (mangaId: number, kind: FeedSignal['kind'], age = 1): FeedSignal => ({ mangaId, kind, at: daysAgo(age) });

// A catalogue with clear taste clusters.
const isekaiRead = work({ title: 'Isekai Lu', genre: ['Isekai', 'Fantasy'] });
const isekaiA = work({ title: 'Isekai A', genre: ['Isekai', 'Fantasy'], views: 5 });
const isekaiB = work({ title: 'Isekai B', genre: ['Isekai', 'Adventure'], views: 4 });
const romance = work({ title: 'Romance', genre: ['Romance'], views: 500, rating: 4.8 });
const horror = work({ title: 'Horreur', genre: ['Horror'], views: 300 });
const sport = work({ title: 'Sport', genre: ['Sports'], views: 200 });
const comedy = work({ title: 'Comédie', genre: ['Comedy'], views: 100 });
const catalog = [isekaiRead, isekaiA, isekaiB, romance, horror, sport, comedy];
const readerSignals = [signal(isekaiRead.id, 'favorite'), signal(isekaiRead.id, 'chapter_finished'), signal(isekaiRead.id, 'follow')];
const base = { catalog, trending: new Map<number, number>(), now, seed: 7 };

test('cold start ranks by popularity and quality, with no personal reason', () => {
  const feed = buildForYouFeed({ ...base, signals: [] });
  assert.equal(feed[0].work.id, romance.id);
  assert.ok(feed.every((item) => ['popular', 'trending', 'fresh'].includes(item.reason.kind)));
});

test('a reader of isekai gets isekai first, explained by the work they read', () => {
  const feed = buildForYouFeed({ ...base, signals: readerSignals });
  assert.deepEqual(feed.slice(0, 2).map((item) => item.work.id).sort(), [isekaiA.id, isekaiB.id].sort());
  assert.deepEqual(feed.find((item) => item.work.id === isekaiA.id)?.reason, { kind: 'because_you_read', anchorTitle: 'Isekai Lu' });
});

test('works already in the reader’s life and dismissed works never reappear; skipped ones may', () => {
  const feed = buildForYouFeed({
    ...base,
    signals: [...readerSignals, signal(romance.id, 'dismiss'), signal(horror.id, 'feed_skip')],
  });
  const ids = feed.map((item) => item.work.id);
  assert.ok(!ids.includes(isekaiRead.id));
  assert.ok(!ids.includes(romance.id));
  assert.ok(ids.includes(horror.id));
});

test('explicit works and duplicate imports are kept out of the feed', () => {
  const adult = work({ title: 'Explicite', genre: ['Isekai'], content_rating: 'erotica' });
  const copyOfRead = work({ title: 'isekai lu', author: isekaiRead.author, genre: ['Isekai'] });
  const twinA = work({ title: 'Jumeau', author: 'Même', genre: ['Comedy'] });
  const twinB = work({ title: 'jumeau', author: 'même', genre: ['Comedy'] });
  const ids = buildForYouFeed({ ...base, catalog: [...catalog, adult, copyOfRead, twinA, twinB], signals: readerSignals }).map((item) => item.work.id);
  assert.ok(!ids.includes(adult.id));
  assert.ok(!ids.includes(copyOfRead.id));
  assert.equal([twinA.id, twinB.id].filter((id) => ids.includes(id)).length, 1);
});

test(`every ${EXPLORATION_EVERY}th card explores a genre the reader never showed interest in`, () => {
  const many = [...catalog, ...Array.from({ length: 12 }, (_, index) => work({ title: `Isekai ${index}`, genre: ['Isekai'] }))];
  const feed = buildForYouFeed({ ...base, catalog: many, signals: readerSignals });
  const explore = feed[EXPLORATION_EVERY - 1];
  assert.equal(explore.reason.kind, 'explore');
  assert.ok(!explore.work.genre.includes('Isekai') && !explore.work.genre.includes('Fantasy'));
});

test('the same author is not repeated while alternatives exist', () => {
  const sameAuthor = Array.from({ length: 4 }, (_, index) => work({ title: `Série ${index}`, author: 'Prolifique', genre: ['Isekai', 'Fantasy'] }));
  const others = Array.from({ length: 4 }, (_, index) => work({ title: `Autre ${index}`, genre: ['Isekai', 'Adventure'] }));
  const feed = buildForYouFeed({ ...base, catalog: [isekaiRead, ...sameAuthor, ...others], signals: readerSignals });
  const authors = feed.slice(0, 4).map((item) => item.work.author);
  assert.equal(authors.filter((author) => author === 'Prolifique').length, 1);
});

test('the same seed gives the same feed; refreshing the seed reshuffles it', () => {
  const many = Array.from({ length: 30 }, (_, index) => work({ title: `T${index}`, genre: [['Action', 'Romance', 'Comedy'][index % 3]], views: 10 }));
  const order = (seed: number) => buildForYouFeed({ ...base, catalog: many, signals: [], seed }).map((item) => item.work.id).join();
  assert.equal(order(dailySeed(now)), order(dailySeed(now)));
  assert.notEqual(order(dailySeed(now)), order(dailySeed(now, 1)));
});

test('signals fade with a 30-day half-life, and endless re-reads are capped', () => {
  const fresh = buildTasteProfile(catalog, [signal(romance.id, 'favorite', 0)], [], now);
  const old = buildTasteProfile(catalog, [signal(romance.id, 'favorite', 30)], [], now);
  assert.ok(Math.abs((old.engagement.get(romance.id) || 0) - (fresh.engagement.get(romance.id) || 0) / 2) < 0.01);
  const binge = Array.from({ length: 50 }, () => signal(sport.id, 'chapter_finished', 0));
  assert.equal(buildTasteProfile(catalog, binge, [], now).engagement.get(sport.id), 6);
});

test('a dismissal lowers affinity for that taste, not only for the work', () => {
  const profile = buildTasteProfile(catalog, [signal(horror.id, 'dismiss')], [], now);
  assert.ok(affinityScore(work({ genre: ['Horror'] }), profile) < 0);
});

test('onboarding genres seed a new reader’s feed', () => {
  const feed = buildForYouFeed({ ...base, signals: [], onboardingGenres: ['Sports'] });
  assert.equal(feed[0].work.id, sport.id);
});

test('the PRNG is deterministic and uniform enough for exploration', () => {
  const a = seededRandom(42); const b = seededRandom(42);
  const values = Array.from({ length: 1000 }, () => a());
  assert.equal(values[0], b());
  assert.ok(values.every((value) => value >= 0 && value < 1));
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  assert.ok(mean > 0.45 && mean < 0.55);
});

test('reasons read naturally in French', () => {
  assert.equal(feedReasonLabel({ kind: 'because_you_read', anchorTitle: 'Solo Leveling' }), 'Parce que tu as lu Solo Leveling');
  assert.equal(feedReasonLabel({ kind: 'genre', genre: 'Comedy' }, (genre) => (genre === 'Comedy' ? 'Comédie' : genre)), 'Parce que tu aimes : Comédie');
  assert.equal(feedReasonLabel({ kind: 'explore' }), 'Pour sortir de tes habitudes');
});

test('several tastes are interleaved instead of one taste filling the top of the feed', () => {
  // Like production data, the romances lead with different first genres.
  const romances = Array.from({ length: 6 }, (_, index) => work({ title: `Rom ${index}`, genre: [['Comedy', 'Drama', 'Action'][index % 3], 'Romance'], views: 900, rating: 4.8 }));
  // Isekai carry many genres (diluted affinity) and fewer views: they lose on raw score.
  const isekais = Array.from({ length: 3 }, (_, index) => work({ title: `Ise ${index}`, genre: ['Isekai', 'Action', 'Fantasy', 'Adventure'], views: 50, rating: 4 }));
  const feed = buildForYouFeed({ ...base, catalog: [...romances, ...isekais], signals: [], onboardingGenres: ['Isekai', 'Romance'] });
  const top = feed.slice(0, 3).map((item) => item.work.genre.includes('Isekai') ? 'isekai' : 'romance');
  assert.ok(top.includes('isekai') && top.includes('romance'), top.join());
});
